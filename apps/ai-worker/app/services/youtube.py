import asyncio
import logging
import difflib
from ytmusicapi import YTMusic
from typing import List, Optional
from typing_extensions import TypedDict

logger = logging.getLogger("sortund-ai-pipeline")
yt_music_client = YTMusic()


class YTMetadata(TypedDict):
    extra_info: List[str]
    source: str
    title: str
    artist: str
    year: Optional[int]


async def fetch_and_validate_youtube_metadata(
    artist: str, title: str, source_analysis: str, original_filename: str
) -> YTMetadata:
    """Searches for a track on YouTube Music and validates the match to protect local releases."""
    enrichment: YTMetadata = {
        "extra_info": [],
        "source": source_analysis,
        "title": title,
        "artist": artist,
        "year": None,
    }

    try:
        fn_lower = original_filename.lower()
        is_cover_or_local = any(
            m in fn_lower
            for m in [
                "cover",
                "українською",
                "ukrainian",
                "ukr",
                "ua",
                "шмальцгаузен",
                "schmalgauzen",
            ]
        )

        if is_cover_or_local:
            search_query = original_filename.rsplit('.', 1)[0].replace('_', ' ')
            logger.info(f"🔍 Searching YouTube Music specifically for cover/local track: '{search_query}'")
            # Covers are often "videos", not official "songs", so we search everything
            yt_search = await asyncio.to_thread(
                yt_music_client.search, search_query
            )
        else:
            search_query = f"{artist} - {title}" if artist != "Unknown Artist" else title
            yt_search = await asyncio.to_thread(
                yt_music_client.search, search_query, filter="songs"
            )

        if yt_search:
            top_hit = yt_search[0]
            found_title = top_hit.get("title", "")
            found_artist = (
                top_hit["artists"][0].get("name", "")
                if top_hit.get("artists")
                else "Unknown Artist"
            )

            # Title similarity calculation (Fuzzy Matching)
            similarity = difflib.SequenceMatcher(
                None, title.lower(), found_title.lower()
            ).ratio()

            if (
                source_analysis == "Filename Local Parser"
                and artist == "Unknown Artist"
            ):
                if len(title) <= 5 and similarity < 0.9:
                    logger.info(
                        f"🛡️ Query too short ({title}), low match. YouTube result ignored."
                    )
                else:
                    # Safe metadata import
                    logger.info(f"✅ Auto-replacing with YouTube Music metadata for '{title}'")
                    enrichment["title"] = found_title
                    enrichment["artist"] = found_artist
                    enrichment["source"] = "YouTube Music Search Engine"

            # Additional metadata collection

            album_name = (
                top_hit.get("album", {}).get("name", "") if top_hit.get("album") else ""
            )
            if album_name:
                enrichment["extra_info"].append(f"Album: {album_name}")

    except Exception as e:
        logger.warning(f"⚠️ Failed to enrich metadata from YouTube: {e}")

    return enrichment
