"""Lyrics and vocal-language detection.

1. LRCLIB (open lyrics database) is queried by artist / title — exact published lyrics.
2. If nothing is found, the vocal part of the fragment is transcribed with Whisper (faster-whisper),
   which also reports the spoken language.
3. The language of the text is detected with ``langdetect``; Whisper's own guess is the fallback.
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any, Optional, Tuple

import aiohttp
import numpy as np

from app.core.settings import settings

logger = logging.getLogger("sortund-ai-pipeline")

MIN_WHISPER_LANGUAGE_CONFIDENCE = 0.7
_LRC_TIMESTAMP_RE = re.compile(r"\[\d+:\d+(?:\.\d+)?\]")
_whisper_model: Any = None
_whisper_failed = False


@dataclass
class LyricsResult:
    text: Optional[str]
    source: Optional[str]  # "lrclib" | "whisper" | None
    language: Optional[str]  # ISO 639-1 code
    language_confidence: float


def _strip_lrc(text: str) -> str:
    return "\n".join(line.strip() for line in _LRC_TIMESTAMP_RE.sub("", text).splitlines() if line.strip())


async def fetch_lyrics_lrclib(artist: str, title: str) -> Optional[str]:
    if not artist or not title or artist == "Unknown Artist":
        return None
    try:
        timeout = aiohttp.ClientTimeout(total=8)
        headers = {"User-Agent": "Sortund/1.0 (music tagging)"}
        async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
            async with session.get(
                f"{settings.LRCLIB_URL}/search", params={"artist_name": artist, "track_name": title}
            ) as response:
                if response.status != 200:
                    return None
                results = await response.json()
        for item in results or []:
            if item.get("instrumental"):
                return ""
            text = item.get("plainLyrics") or (item.get("syncedLyrics") and _strip_lrc(item["syncedLyrics"]))
            if text:
                return text.strip()
    except Exception as e:
        logger.warning(f"LRCLIB lookup failed: {e}")
    return None


def detect_text_language(text: str) -> Tuple[Optional[str], float]:
    if not text or len(text) < 20:
        return None, 0.0
    try:
        from langdetect import DetectorFactory, detect_langs

        DetectorFactory.seed = 0
        best = detect_langs(text)[0]
        return best.lang, round(float(best.prob), 3)
    except Exception:
        return None, 0.0


def _get_whisper() -> Any:
    global _whisper_model, _whisper_failed
    if _whisper_model is None and not _whisper_failed and settings.ENABLE_WHISPER:
        try:
            from faster_whisper import WhisperModel

            _whisper_model = WhisperModel(settings.WHISPER_MODEL, device="cpu", compute_type="int8")
            logger.info(f"Whisper model '{settings.WHISPER_MODEL}' loaded.")
        except Exception as e:
            _whisper_failed = True
            logger.error(f"Whisper unavailable: {e}")
    return _whisper_model


def transcribe_vocals(y: np.ndarray) -> Tuple[Optional[str], Optional[str], float]:
    """Transcribes the fragment with Whisper. Returns (text, language, language_probability)."""
    model = _get_whisper()
    if model is None or y.size == 0:
        return None, None, 0.0
    try:
        segments, info = model.transcribe(
            y.astype(np.float32),
            beam_size=1,
            condition_on_previous_text=False,
            no_speech_threshold=0.6,
        )
        lines = [
            s.text.strip()
            for s in segments
            # Drop low-confidence / repetitive segments — Whisper hallucinates on instrumental parts.
            if s.no_speech_prob < 0.6 and s.avg_logprob > -1.0 and s.compression_ratio < 2.4 and s.text.strip()
        ]
        text = "\n".join(lines) or None
        return text, info.language, round(float(info.language_probability), 3)
    except Exception as e:
        logger.warning(f"Whisper transcription failed: {e}")
        return None, None, 0.0


async def get_lyrics(artist: str, title: str, y: np.ndarray, has_vocals: bool) -> LyricsResult:
    if not has_vocals:
        return LyricsResult(None, None, None, 0.0)

    text = await fetch_lyrics_lrclib(artist, title)
    if text:
        language, confidence = detect_text_language(text)
        if language:
            return LyricsResult(text, "lrclib", language, confidence)

    transcript, whisper_lang, whisper_conf = await asyncio.to_thread(transcribe_vocals, y)
    if text:
        # Lyrics found, but text language detection failed — rely on Whisper's language only.
        return LyricsResult(text, "lrclib", whisper_lang, whisper_conf)
    # Whisper's audio-based language identification is far more reliable than text detection on a
    # short, noisy transcript, so it is used as is — but only when it is reasonably confident.
    if whisper_conf < MIN_WHISPER_LANGUAGE_CONFIDENCE:
        whisper_lang, whisper_conf = None, 0.0
    return LyricsResult(transcript, "whisper" if transcript else None, whisper_lang, whisper_conf)
