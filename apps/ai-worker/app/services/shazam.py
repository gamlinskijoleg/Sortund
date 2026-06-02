import logging
from typing import Tuple, Optional
from shazamio import Shazam
import re

logger = logging.getLogger("sortund-ai-pipeline")
shazam_client = Shazam()


async def recognize_via_shazam_local(
    file_path: str,
) -> Optional[Tuple[str, str, Optional[int]]]:
    """Аналіз аудіо за акустичним відбитком через Shazam Core API."""
    try:
        out = await shazam_client.recognize(file_path)
        if out and "track" in out:
            title = out["track"].get("title", "Unknown Title")
            artist = out["track"].get("subtitle", "Unknown Artist")
            year = None

            sections = out["track"].get("sections", [])
            if sections:
                metadata_list = sections[0].get("metadata", [])
                for item in metadata_list:
                    if item.get("title") == "Released":
                        try:
                            match = re.search(r"\d{4}", item.get("text", ""))
                            if match:
                                year = int(match.group())
                        except Exception:
                            pass
            return artist, title, year
    except Exception as e:
        logger.warning(f"⚠️ Збій підсистеми Shazam Core: {e}")
    return None
