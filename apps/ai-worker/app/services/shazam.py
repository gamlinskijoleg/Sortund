import logging
from typing import Tuple, Optional
from shazamio import Shazam
import re

logger = logging.getLogger("sortund-ai-pipeline")
shazam_client = Shazam()


async def recognize_via_shazam_local(
    file_path: str,
) -> Optional[
    Tuple[
        str,
        str,
        Optional[str],
        Optional[str],
    ]
]:
    """Audio analysis by acoustic fingerprint via Shazam Core API."""
    try:
        out = await shazam_client.recognize(file_path)
        if out and "track" in out:
            title = out["track"].get(
                "title",
                "Unknown Title",
            )
            artist = out["track"].get(
                "subtitle",
                "Unknown Artist",
            )
            artwork = (
                out["track"]
                .get(
                    "images",
                    {},
                )
                .get("coverart")
            )
            isrc = out["track"].get("isrc")
            return (
                artist,
                title,
                artwork,
                isrc,
            )
    except Exception as e:
        logger.warning(f"⚠️ Shazam Core subsystem failure: {e}")
    return None
