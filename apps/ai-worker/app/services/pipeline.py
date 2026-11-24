"""Orchestrates recognition, metadata lookup and multi-model classification of one audio fragment."""

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional, Tuple

import numpy as np

from app.core.settings import settings
from app.core.taxonomy import GENRE_TEXT_HYPOTHESES, MOOD_TEXT_HYPOTHESES, THEME_HYPOTHESES
from app.core.utils import extract_year_from_filename, is_cover_track, parse_filename_fallback
from app.ml.features import DspSummary, build_feature_vector, compute_dsp, embedding_from_features, load_audio
from app.ml.genre_model import registry
from app.ml.models import audioset_probabilities, clean_text_for_zero_shot, zero_shot, zero_shot_single_label
from app.ml.tagging import (
    audio_mood_scores,
    build_tags,
    combine_scores,
    detect_instruments,
    detect_styles,
    detect_vocal,
    ranked,
)
from app.schemas.analysis import AnalyzeResult, FingerprintResult, LabelScore, Recognition, YTMetadata
from app.services.fingerprint import fingerprint_for
from app.services.lyrics import get_lyrics
from app.services.musicbrainz import (
    fetch_release_year_from_musicbrainz,
    fetch_release_year_from_musicbrainz_by_isrc,
)
from app.services.shazam import recognize_via_shazam_local
from app.services.theaudiodb import fetch_release_year_from_theaudiodb
from app.services.youtube import fetch_and_validate_youtube_metadata

logger = logging.getLogger("sortund-ai-pipeline")

GENRE_MIN_CONFIDENCE = 0.2
UNKNOWN_ARTIST = "Unknown Artist"


class GenreModelMissing(Exception):
    """The requested genre model version is not present on this worker."""

    def __init__(self, version: str):
        super().__init__(version)
        self.version = version


@dataclass
class BaseMetadata:
    artist: str
    title: str
    album: Optional[str]
    artwork: Optional[str]
    isrc: Optional[str]
    source: str


def parse_youtube_extra_info(yt_extra_info: list) -> Tuple[Optional[str], list]:
    """Extracts album name and additional tags from YouTube metadata."""
    album_name = None
    extra_tags = []
    for tag in yt_extra_info:
        if tag.startswith("Album: "):
            album_name = tag.replace("Album: ", "").strip()
        else:
            extra_tags.append(tag)
    return album_name, extra_tags


async def recognize(temp_file_path: str, original_filename: str) -> Optional[Recognition]:
    if is_cover_track(original_filename):
        # Covers are recognised as the original recording, which would give wrong metadata.
        return None
    return await recognize_via_shazam_local(temp_file_path)


async def get_base_metadata(recognition: Optional[Recognition], original_filename: str) -> BaseMetadata:
    """Artist / title from the acoustic fingerprint, or from the file name when it is not recognised."""
    if recognition:
        yt: YTMetadata = await fetch_and_validate_youtube_metadata(
            recognition.artist, recognition.title, "Shazam", original_filename
        )
        album, _ = parse_youtube_extra_info(yt.extra_info)
        source = "Shazam (acoustic fingerprint)" + (" + YouTube Music" if album else "")
        return BaseMetadata(recognition.artist, recognition.title, album, recognition.artwork, recognition.isrc, source)

    fallback_artist, fallback_title = parse_filename_fallback(original_filename)
    yt = await fetch_and_validate_youtube_metadata(
        fallback_artist, fallback_title, "Filename Local Parser", original_filename
    )
    album, _ = parse_youtube_extra_info(yt.extra_info)
    source = "File name" if yt.source == "Filename Local Parser" else "File name + YouTube Music"
    return BaseMetadata(yt.artist, yt.title, album, None, None, source)


async def resolve_year(
    artist: str, title: str, isrc: Optional[str], filename: str
) -> Tuple[Optional[int], Optional[str]]:
    """Year of first release: MusicBrainz by ISRC, then MusicBrainz + TheAudioDB by name, then file name."""
    if isrc:
        year = await fetch_release_year_from_musicbrainz_by_isrc(isrc)
        if year:
            return year, "MusicBrainz (ISRC)"

    if artist and artist != UNKNOWN_ARTIST:
        adb_year, mb_year = await asyncio.gather(
            fetch_release_year_from_theaudiodb(artist, title),
            fetch_release_year_from_musicbrainz(artist, title),
        )
        candidates = [(y, s) for y, s in [(mb_year, "MusicBrainz"), (adb_year, "TheAudioDB")] if y]
        if candidates:
            return min(candidates, key=lambda c: c[0])

    year = extract_year_from_filename(filename)
    return (year, "File name") if year else (None, None)


def classify_genre(
    features: np.ndarray, artist: str, title: str, model_version: str
) -> Tuple[Optional[LabelScore], dict]:
    if not registry.has(model_version):
        raise GenreModelMissing(model_version)
    audio_scores = registry.get(model_version).predict(features)

    text_scores = {}
    if artist and artist != UNKNOWN_ARTIST:
        text_scores = zero_shot_single_label(
            clean_text_for_zero_shot(f"{artist} - {title}"),
            {k: v for k, v in GENRE_TEXT_HYPOTHESES.items() if k in audio_scores},
        )
    scores = combine_scores(audio_scores, text_scores, settings.GENRE_AUDIO_WEIGHT)
    best = max(scores, key=lambda k: scores[k])
    rounded = {k: round(v, 4) for k, v in sorted(scores.items(), key=lambda kv: kv[1], reverse=True)}
    if scores[best] < GENRE_MIN_CONFIDENCE:
        return None, rounded
    return LabelScore(label=best, confidence=round(scores[best], 3)), rounded


def _analyse_audio(y: np.ndarray) -> Tuple[np.ndarray, DspSummary]:
    return audioset_probabilities(y), compute_dsp(y)


async def fingerprint_track(temp_file_path: str, original_filename: str) -> FingerprintResult:
    y_task = asyncio.to_thread(load_audio, temp_file_path, 20.0)
    recognition, y = await asyncio.gather(recognize(temp_file_path, original_filename), y_task)
    return FingerprintResult(fingerprint=fingerprint_for(recognition, y), recognition=recognition)


async def execute_analysis_pipeline(
    temp_file_path: str,
    original_filename: str,
    model_version: Optional[str] = None,
    recognition: Optional[Recognition] = None,
    skip_recognition: bool = False,
    fingerprint: Optional[str] = None,
) -> AnalyzeResult:
    started = time.perf_counter()
    model_version = model_version or settings.DEFAULT_GENRE_MODEL_VERSION
    if not registry.has(model_version):
        raise GenreModelMissing(model_version)

    y = await asyncio.to_thread(load_audio, temp_file_path)
    audio_task = asyncio.create_task(asyncio.to_thread(_analyse_audio, y))

    if recognition is None and not skip_recognition:
        recognition = await recognize(temp_file_path, original_filename)

    meta = await get_base_metadata(recognition, original_filename)
    year_task = asyncio.create_task(resolve_year(meta.artist, meta.title, meta.isrc, original_filename))

    probs, dsp = await audio_task
    features = build_feature_vector(probs, dsp)

    genre, genre_scores = await asyncio.to_thread(classify_genre, features, meta.artist, meta.title, model_version)
    instruments = detect_instruments(probs)
    styles = detect_styles(probs)
    vocal_label, vocal_conf, has_vocals = detect_vocal(probs)

    lyrics = await get_lyrics(meta.artist, meta.title, y, has_vocals)

    mood_scores = audio_mood_scores(probs, dsp.bpm, dsp.rms_mean)
    themes = []
    if lyrics.text:
        snippet = lyrics.text[:1200]
        text_moods = await asyncio.to_thread(zero_shot_single_label, snippet, MOOD_TEXT_HYPOTHESES, "This song is {}.")
        mood_scores = combine_scores(mood_scores, text_moods, 0.6)
        theme_scores = await asyncio.to_thread(zero_shot, snippet, THEME_HYPOTHESES, "This song is about {}.")
        themes = ranked(theme_scores, threshold=settings.THEME_THRESHOLD, limit=3)
    moods = ranked(mood_scores, limit=3)

    if has_vocals:
        language = lyrics.language
        language_conf = lyrics.language_confidence if language else None
    else:
        language, language_conf = "instrumental", vocal_conf

    year, year_source = await year_task
    mean, scale = registry.embedding_stats()
    embedding = embedding_from_features(features, mean, scale)

    language_tag = LabelScore(label=language, confidence=language_conf) if language and language_conf else None
    tags = build_tags(
        genre=genre,
        styles=styles,
        moods=moods,
        instruments=instruments,
        vocal=LabelScore(label=vocal_label, confidence=vocal_conf),
        language=language_tag,
        themes=themes,
    )

    result = AnalyzeResult(
        fingerprint=fingerprint or fingerprint_for(recognition, y),
        model_version=model_version,
        title=meta.title,
        artist=meta.artist,
        album=meta.album,
        artwork=meta.artwork,
        year=year,
        date=str(year) if year else None,
        metadata_source=meta.source,
        year_source=year_source,
        genre=genre.label if genre else None,
        genre_confidence=genre.confidence if genre else None,
        genre_scores=genre_scores,
        mood=moods[0].label if moods else None,
        mood_confidence=moods[0].confidence if moods else None,
        moods=moods,
        instruments=instruments,
        vocal=vocal_label,
        vocal_confidence=vocal_conf,
        language=language,
        language_confidence=language_conf,
        lyrics=lyrics.text,
        lyrics_source=lyrics.source,
        themes=themes,
        bpm=dsp.bpm,
        key=dsp.key,
        key_confidence=dsp.key_confidence if dsp.key else None,
        tags=tags,
        embedding=[round(float(v), 5) for v in embedding],
        features=[round(float(v), 6) for v in features],
        processing_ms=int((time.perf_counter() - started) * 1000),
    )
    logger.info(
        f"Analysis complete: {result.artist} - {result.title} | genre={result.genre} mood={result.mood} "
        f"vocal={result.vocal} lang={result.language} bpm={result.bpm} key={result.key} in {result.processing_ms} ms"
    )
    return result
