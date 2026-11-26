import numpy as np
import pytest
from unittest.mock import AsyncMock

from app.services import lyrics
from app.services.lyrics import _strip_lrc, detect_text_language, get_lyrics


def test_strip_lrc_timestamps():
    assert _strip_lrc("[00:01.00] Hello\n[00:02.50]World\n\n") == "Hello\nWorld"


def test_detect_text_language():
    lang, conf = detect_text_language("Ти моя любов, і я завжди буду поруч з тобою в цьому місті")
    assert lang == "uk" and conf > 0.5
    assert detect_text_language("short") == (None, 0.0)


@pytest.mark.asyncio
async def test_no_vocals_skips_everything(mocker):
    lrclib = mocker.patch("app.services.lyrics.fetch_lyrics_lrclib", new_callable=AsyncMock)
    result = await get_lyrics("A", "T", np.zeros(10, np.float32), has_vocals=False)
    assert result.text is None and result.language is None
    lrclib.assert_not_called()


@pytest.mark.asyncio
async def test_lrclib_lyrics_used_first(mocker):
    mocker.patch(
        "app.services.lyrics.fetch_lyrics_lrclib",
        new_callable=AsyncMock,
        return_value="I will always love you and I will never leave you alone tonight",
    )
    whisper = mocker.patch("app.services.lyrics.transcribe_vocals")
    result = await get_lyrics("A", "T", np.zeros(10, np.float32), has_vocals=True)
    assert result.source == "lrclib" and result.language == "en"
    whisper.assert_not_called()


@pytest.mark.asyncio
async def test_whisper_fallback_uses_confident_language_only(mocker):
    mocker.patch("app.services.lyrics.fetch_lyrics_lrclib", new_callable=AsyncMock, return_value=None)
    mocker.patch("app.services.lyrics.transcribe_vocals", return_value=("la la la", "uk", 0.92))
    result = await get_lyrics("A", "T", np.zeros(10, np.float32), has_vocals=True)
    assert (result.source, result.language, result.language_confidence) == ("whisper", "uk", 0.92)

    mocker.patch("app.services.lyrics.transcribe_vocals", return_value=("garbage", "eu", 0.51))
    result = await get_lyrics("A", "T", np.zeros(10, np.float32), has_vocals=True)
    assert result.language is None


@pytest.mark.asyncio
async def test_lrclib_skipped_for_unknown_artist():
    assert await lyrics.fetch_lyrics_lrclib("Unknown Artist", "x") is None


def test_pick_lyrics_requires_same_artist_in_free_text_results():
    results = [
        {"artistName": "Mafumafu", "trackName": "シャルル", "plainLyrics": "cover"},
        {"artistName": "Adorable Band", "trackName": "x", "plainLyrics": "other"},
        {"artistName": "Ado", "trackName": "シャルル", "plainLyrics": "line 1\nline 2"},
    ]
    assert lyrics.pick_lyrics(results, "Ado", require_artist=True) == "line 1\nline 2"
    assert lyrics.pick_lyrics(results, "Ado", require_artist=False) == "cover"
    assert lyrics.pick_lyrics(results, "Nobody", require_artist=True) is None


def test_pick_lyrics_accepts_credited_artists_and_instrumentals():
    assert lyrics.pick_lyrics([{"artistName": "Ado, Vaundy", "plainLyrics": "t"}], "ado", True) == "t"
    assert lyrics.pick_lyrics([{"artistName": "Ado feat. X", "plainLyrics": "t"}], "Ado", True) == "t"
    assert lyrics.pick_lyrics([{"artistName": "Ado", "instrumental": True}], "Ado", True) == ""
    synced = [{"artistName": "Ado", "syncedLyrics": "[00:01.00] a\n[00:02.00] b"}]
    assert lyrics.pick_lyrics(synced, "Ado", True) == "a\nb"


@pytest.mark.asyncio
async def test_free_text_search_used_when_field_search_finds_nothing(mocker):
    search = mocker.patch(
        "app.services.lyrics._lrclib_search",
        new_callable=AsyncMock,
        side_effect=[[], [{"artistName": "Ado", "trackName": "シャルル", "plainLyrics": "full text"}]],
    )
    assert await lyrics.fetch_lyrics_lrclib("Ado", "Charles") == "full text"
    assert search.await_args_list[1].args[1] == {"q": "Ado Charles"}
