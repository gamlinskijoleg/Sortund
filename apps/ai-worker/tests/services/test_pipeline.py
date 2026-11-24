import numpy as np
import pytest
from unittest.mock import AsyncMock

from app.ml.features import FEATURE_SIZE, NUM_AUDIOSET_CLASSES, DspSummary, NUM_DSP_FEATURES
from app.ml.genre_model import BASE_DATASET_FILE, GenreModelRegistry
from app.schemas.analysis import Recognition, YTMetadata
from app.services import pipeline
from app.services.lyrics import LyricsResult
from app.services.pipeline import (
    GenreModelMissing,
    execute_analysis_pipeline,
    parse_youtube_extra_info,
    resolve_year,
)


@pytest.fixture
def registry(tmp_path, mocker):
    rng = np.random.default_rng(1)
    labels = np.array(["hiphop"] * 20 + ["classical"] * 20)
    features = rng.normal(size=(40, FEATURE_SIZE)).astype(np.float32)
    features[:20, 36] += 5  # "rapping" probability high for hip hop
    np.savez_compressed(tmp_path / BASE_DATASET_FILE, features=features, labels=labels, names=np.arange(40))
    reg = GenreModelRegistry(str(tmp_path))
    reg.train("v1", regularization=1.0)
    mocker.patch("app.services.pipeline.registry", reg)
    return reg


@pytest.fixture
def audio(mocker):
    probs = np.zeros(NUM_AUDIOSET_CLASSES, dtype=np.float32)
    probs[36] = 0.6  # rapping
    probs[27] = 0.3  # singing
    probs[162] = 0.5  # drum kit
    probs[280] = 0.05  # exciting music
    dsp = DspSummary(bpm=95.0, key="A minor", key_confidence=0.4, rms_mean=0.2, vector=np.zeros(NUM_DSP_FEATURES))
    mocker.patch("app.services.pipeline.load_audio", return_value=np.zeros(16000, dtype=np.float32))
    mocker.patch("app.services.pipeline._analyse_audio", return_value=(probs, dsp))
    return probs


def test_parse_youtube_extra_info():
    album, tags = parse_youtube_extra_info(["Album: Test Album", "Official Video", "Remastered"])
    assert album == "Test Album"
    assert tags == ["Official Video", "Remastered"]


@pytest.mark.asyncio
async def test_resolve_year_prefers_isrc(mocker):
    mocker.patch(
        "app.services.pipeline.fetch_release_year_from_musicbrainz_by_isrc", new_callable=AsyncMock, return_value=1999
    )
    assert await resolve_year("A", "T", "ISRC1", "x.mp3") == (1999, "MusicBrainz (ISRC)")


@pytest.mark.asyncio
async def test_resolve_year_takes_earliest_then_filename(mocker):
    mocker.patch("app.services.pipeline.fetch_release_year_from_theaudiodb", new_callable=AsyncMock, return_value=2005)
    mocker.patch("app.services.pipeline.fetch_release_year_from_musicbrainz", new_callable=AsyncMock, return_value=2001)
    assert await resolve_year("A", "T", None, "x.mp3") == (2001, "MusicBrainz")

    mocker.patch("app.services.pipeline.fetch_release_year_from_theaudiodb", new_callable=AsyncMock, return_value=None)
    mocker.patch("app.services.pipeline.fetch_release_year_from_musicbrainz", new_callable=AsyncMock, return_value=None)
    assert await resolve_year("A", "T", None, "Song (1987).mp3") == (1987, "File name")


@pytest.mark.asyncio
async def test_pipeline_with_recognition(registry, audio, mocker):
    mocker.patch(
        "app.services.pipeline.fetch_and_validate_youtube_metadata",
        new_callable=AsyncMock,
        return_value=YTMetadata(source="Shazam", title="Title", artist="Artist", extra_info=["Album: LP"]),
    )
    mocker.patch("app.services.pipeline.resolve_year", new_callable=AsyncMock, return_value=(2010, "MusicBrainz"))
    mocker.patch(
        "app.services.pipeline.get_lyrics",
        new_callable=AsyncMock,
        return_value=LyricsResult("we fight for our freedom", "lrclib", "en", 0.99),
    )
    mocker.patch("app.services.pipeline.zero_shot_single_label", return_value={})
    mocker.patch("app.services.pipeline.zero_shot", return_value={"freedom": 0.9, "love": 0.1})
    shazam = mocker.patch("app.services.pipeline.recognize_via_shazam_local", new_callable=AsyncMock)

    recognition = Recognition(artist="Artist", title="Title", artwork="http://art", isrc="X", shazam_key="42")
    result = await execute_analysis_pipeline("t.mp3", "file.mp3", recognition=recognition, skip_recognition=True)

    shazam.assert_not_called()
    assert result.fingerprint == "shz:42"
    assert result.model_version == "v1"
    assert (result.artist, result.title, result.album, result.year) == ("Artist", "Title", "LP", 2010)
    assert result.metadata_source.startswith("Shazam")
    assert result.genre == "hiphop"
    assert result.vocal == "rap"
    assert result.language == "en"
    assert [t.label for t in result.themes] == ["freedom"]
    assert result.bpm == 95.0 and result.key == "A minor"
    assert {i.label for i in result.instruments} == {"Drum kit"}
    categories = {t.category for t in result.tags}
    assert {"genre", "vocal", "language", "theme", "instrument", "mood"} <= categories
    assert all(t.confidence >= 0 for t in result.tags)
    assert len(result.embedding) == FEATURE_SIZE and len(result.features) == FEATURE_SIZE


@pytest.mark.asyncio
async def test_pipeline_filename_fallback_instrumental(registry, mocker):
    probs = np.zeros(NUM_AUDIOSET_CLASSES, dtype=np.float32)
    probs[153] = 0.7  # piano only
    dsp = DspSummary(bpm=70.0, key="C major", key_confidence=0.5, rms_mean=0.02, vector=np.zeros(NUM_DSP_FEATURES))
    mocker.patch("app.services.pipeline.load_audio", return_value=np.zeros(16000, dtype=np.float32))
    mocker.patch("app.services.pipeline._analyse_audio", return_value=(probs, dsp))
    mocker.patch("app.services.pipeline.recognize_via_shazam_local", new_callable=AsyncMock, return_value=None)
    mocker.patch(
        "app.services.pipeline.fetch_and_validate_youtube_metadata",
        new_callable=AsyncMock,
        return_value=YTMetadata(source="Filename Local Parser", title="Nocturne", artist="Chopin"),
    )
    mocker.patch("app.services.pipeline.resolve_year", new_callable=AsyncMock, return_value=(None, None))
    mocker.patch("app.services.pipeline.zero_shot_single_label", return_value={})
    lyrics = mocker.patch("app.services.pipeline.get_lyrics", new_callable=AsyncMock)
    lyrics.return_value = LyricsResult(None, None, None, 0.0)

    result = await execute_analysis_pipeline("t.mp3", "Chopin - Nocturne.mp3")

    assert result.metadata_source == "File name"
    assert result.fingerprint.startswith(("loc:", "raw:"))
    assert result.vocal == "instrumental"
    assert result.language == "instrumental"
    assert result.mood == "calm"
    assert any(t.label == "instrumental" for t in result.tags)


@pytest.mark.asyncio
async def test_pipeline_missing_model(registry):
    with pytest.raises(GenreModelMissing):
        await execute_analysis_pipeline("t.mp3", "a.mp3", model_version="v404")


@pytest.mark.asyncio
async def test_covers_are_not_sent_to_shazam(mocker):
    shazam = mocker.patch("app.services.pipeline.recognize_via_shazam_local", new_callable=AsyncMock)
    assert await pipeline.recognize("x.mp3", "Song (cover by Someone).mp3") is None
    shazam.assert_not_called()
