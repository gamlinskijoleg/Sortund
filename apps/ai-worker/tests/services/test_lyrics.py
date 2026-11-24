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
