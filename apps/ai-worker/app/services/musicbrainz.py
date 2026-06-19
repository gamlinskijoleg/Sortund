import logging
import asyncio
import musicbrainzngs
import re
from typing import (
    Optional,
)

logger = logging.getLogger("sortund-ai-pipeline")

# MusicBrainz requires a useragent to be set
musicbrainzngs.set_useragent(
    "SortundAIPipeline",
    "1.5.0",
    "sortund@example.com",
)


async def fetch_release_year_from_musicbrainz_by_isrc(
    isrc: str,
) -> Optional[int]:
    """Searches for track release year by ISRC code via MusicBrainz API."""
    if not isrc:
        return None

    try:
        max_retries = 3
        result = None
        for attempt in range(max_retries):
            try:
                result = await asyncio.to_thread(
                    musicbrainzngs.get_recordings_by_isrc,
                    isrc,
                    includes=["releases"],
                )
                break
            except musicbrainzngs.ResponseError as e:
                try:
                    if (
                        hasattr(
                            e,
                            "cause",
                        )
                        and hasattr(
                            e.cause,
                            "code",
                        )
                        and e.cause.code == 404
                    ):
                        return None
                except Exception:
                    pass
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
                else:
                    logger.warning(
                        f"⚠️ Final MusicBrainz ISRC failure after {max_retries} attempts: {e}"
                    )
                    return None
            except Exception as e:
                if attempt < max_retries - 1:
                    await asyncio.sleep(2)
                else:
                    logger.warning(
                        f"⚠️ Final MusicBrainz ISRC failure after {max_retries} attempts: {e}"
                    )
                    return None

        if not result or "isrc" not in result or "recording-list" not in result["isrc"]:
            return None

        recordings = result["isrc"]["recording-list"]
        best_year = None

        for recording in recordings:
            releases = recording.get(
                "release-list",
                [],
            )
            for release in releases:
                date = release.get("date")
                if date:
                    try:
                        year = int(date.split("-")[0])
                        if best_year is None or year < best_year:
                            best_year = year
                    except ValueError:
                        continue
        return best_year
    except Exception as e:
        logger.warning(f"⚠️ MusicBrainz (ISRC) subsystem failure: {e}")
        return None


async def fetch_release_year_from_musicbrainz(
    artist: str,
    title: str,
) -> Optional[int]:
    """Searches for track release year using MusicBrainz API."""
    if artist == "Unknown Artist":
        return None

    # Clean the title: remove anything in parentheses or brackets, and extra spaces
    clean_title = re.sub(
        r"\(.*?\)|\[.*?\]",
        "",
        title,
    ).strip()
    clean_title = clean_title.split(" - ")[0].strip()

    # If cleaning removes everything, fallback to original
    if not clean_title:
        clean_title = title

    try:
        # We do a lucene search for recordings matching artist and title
        query = f'artist:"{artist}" AND recording:"{clean_title}"'

        max_retries = 3
        result = None

        for attempt in range(max_retries):
            try:
                result = await asyncio.to_thread(
                    musicbrainzngs.search_recordings,
                    query=query,
                    limit=50,
                )
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(
                        f"⚠️ MusicBrainz error (attempt {attempt+1}/{max_retries}): {e}. Retrying in 2s..."
                    )
                    await asyncio.sleep(2)
                else:
                    logger.warning(
                        f"⚠️ Final MusicBrainz failure after {max_retries} attempts: {e}"
                    )
                    return None

        recordings = result.get(
            "recording-list",
            [],
        )
        best_year = None

        for recording in recordings:
            releases = recording.get(
                "release-list",
                [],
            )
            for release in releases:
                date = release.get("date")
                if date:
                    try:
                        year = int(date.split("-")[0])
                        # Find the oldest (original) release year
                        if best_year is None or year < best_year:
                            best_year = year
                    except ValueError:
                        continue

        if best_year:
            logger.info(
                f"🎵 MusicBrainz found release year {best_year} for {artist} - {clean_title}"
            )
        return best_year
    except Exception as e:
        logger.warning(f"⚠️ MusicBrainz subsystem failure: {e}")
        return None
