import logging
from typing import Optional

from shazamio import Shazam

from app.schemas.analysis import Recognition

logger = logging.getLogger("sortund-ai-pipeline")
shazam_client = Shazam()


async def recognize_via_shazam_local(file_path: str) -> Optional[Recognition]:
    """Recognises the track by its acoustic fingerprint via the Shazam API."""
    try:
        out = await shazam_client.recognize(file_path)
        track = out.get("track") if out else None
        if track:
            return Recognition(
                title=track.get("title") or "Unknown Title",
                artist=track.get("subtitle") or "Unknown Artist",
                artwork=(track.get("images") or {}).get("coverart"),
                isrc=track.get("isrc"),
                shazam_key=str(track["key"]) if track.get("key") else None,
            )
    except Exception as e:
        logger.warning(f"Shazam recognition failure: {e}")
    return None
