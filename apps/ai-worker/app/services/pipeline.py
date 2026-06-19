import os
import asyncio
import logging
from typing import List, Tuple, Optional, Any, Dict

from app.core.constants import (
    GENRE_LABELS,
)
from app.ml.models import (
    predict_text_zero_shot,
    predict_audio_tags,
)
from app.core.utils import (
    parse_filename_fallback,
    extract_year_from_filename,
    is_cover_track,
)
from app.services.shazam import (
    recognize_via_shazam_local,
)
from app.services.youtube import (
    fetch_and_validate_youtube_metadata,
)
from app.services.theaudiodb import (
    fetch_release_year_from_theaudiodb,
)
from app.services.musicbrainz import (
    fetch_release_year_from_musicbrainz,
    fetch_release_year_from_musicbrainz_by_isrc,
)
from app.schemas.analysis import (
    AnalyzeResult,
    YTMetadata,
)

logger = logging.getLogger("sortund-ai-pipeline")


def format_zero_shot_text_tags(
    raw_text_tags: List[
        Dict[
            str,
            Any,
        ]
    ],
) -> List[str]:
    """Filters and formats text tags (genres and others)."""
    genres = [t for t in raw_text_tags if t["label"] in GENRE_LABELS]
    non_genres = [t for t in raw_text_tags if t["label"] not in GENRE_LABELS]
    genres.sort(
        key=lambda x: x["prob"],
        reverse=True,
    )

    filtered = [f"{g['label']} ({float(g['prob']):.1f}%)" for g in genres[:2]]
    filtered += [f"{ng['label']} ({float(ng['prob']):.1f}%)" for ng in non_genres]
    return filtered


def parse_youtube_extra_info(
    yt_extra_info: List[str],
) -> Tuple[
    Optional[str],
    List[str],
]:
    """Extracts album name and additional tags from YouTube metadata."""
    album_name = None
    extra_tags = []
    for tag in yt_extra_info:
        if tag.startswith("Album: "):
            album_name = tag.replace(
                "Album: ",
                "",
            ).strip()
        else:
            extra_tags.append(tag)
    return (
        album_name,
        extra_tags,
    )


async def get_base_metadata(
    temp_file_path: str,
    original_filename: str,
) -> Tuple[
    str,
    str,
    str,
    YTMetadata,
    Optional[str],
    Optional[str],
]:
    """Determines base metadata (Artist, Title) from Shazam or local parser."""
    is_cover = is_cover_track(original_filename)

    shazam_match = None
    if not is_cover:
        shazam_match = await recognize_via_shazam_local(temp_file_path)

    artwork = None
    isrc = None

    if shazam_match:
        (
            artist,
            title,
            artwork,
            isrc,
        ) = shazam_match
        source_analysis = "Shazam Core Engine"
        yt_data = await fetch_and_validate_youtube_metadata(
            artist,
            title,
            source_analysis,
            original_filename,
        )
    else:
        (
            fallback_artist,
            fallback_title,
        ) = parse_filename_fallback(original_filename)
        source_analysis = "Filename Local Parser"
        yt_data = await fetch_and_validate_youtube_metadata(
            fallback_artist,
            fallback_title,
            source_analysis,
            original_filename,
        )

        artist = yt_data.artist
        title = yt_data.title
        source_analysis = yt_data.source

    return (
        artist,
        title,
        source_analysis,
        yt_data,
        artwork,
        isrc,
    )


async def get_text_tags(
    artist: str,
    title: str,
) -> List[str]:
    """Gets and formats genres from Zero-Shot text model."""
    raw_text_tags = await predict_text_zero_shot(f"{artist} - {title}")
    return format_zero_shot_text_tags(raw_text_tags)


async def get_audio_tags(
    audio_ai_task: asyncio.Task,
) -> List[str]:
    """Waits for background audio analysis results and filters them."""
    (
        audio_tags,
        _,
    ) = await audio_ai_task
    if "Music" in audio_tags:
        audio_tags.remove("Music")
    return audio_tags


def get_final_tags(
    text_tags: List[str],
    audio_tags: List[str],
    yt_extra_tags: List[str],
    year: Optional[int],
) -> List[str]:
    """Combines all tags into a single final set."""
    final_tags = set(text_tags + audio_tags + yt_extra_tags)

    return list(final_tags)


async def execute_analysis_pipeline(
    temp_file_path: str,
    original_filename: str,
) -> AnalyzeResult:
    """Orchestrates the entire recognition process, data collection, and AI analysis for the track."""

    # 1. AUDIO AI (run in background)
    audio_ai_task = asyncio.create_task(predict_audio_tags(temp_file_path))

    # 2. BASE METADATA
    (
        artist,
        title,
        source_analysis,
        yt_data,
        artwork,
        isrc,
    ) = await get_base_metadata(
        temp_file_path,
        original_filename,
    )

    # 3. ALBUM
    (
        album_name,
        yt_extra_tags,
    ) = parse_youtube_extra_info(yt_data.extra_info)

    # 4. TEXT TAGS
    text_tags = await get_text_tags(
        artist,
        title,
    )

    # 5. AUDIO TAGS
    audio_tags = await get_audio_tags(audio_ai_task)

    # 5.5 YEAR CASCADE (Concurrent for better results)
    final_year = None
    if isrc:
        final_year = await fetch_release_year_from_musicbrainz_by_isrc(isrc)
        if final_year:
            logger.info(f"🧠 ISRC-Priority: MusicBrainz found year {final_year} via ISRC {isrc}")

    if not final_year:
        theaudiodb_year_task = asyncio.create_task(
            fetch_release_year_from_theaudiodb(
                artist,
                title,
            )
        )
        musicbrainz_year_task = asyncio.create_task(
            fetch_release_year_from_musicbrainz(
                artist,
                title,
            )
        )

        (
            adb_year,
            mb_year,
        ) = await asyncio.gather(
            theaudiodb_year_task,
            musicbrainz_year_task,
        )

        years = [
            y
            for y in [
                adb_year,
                mb_year,
            ]
            if y is not None
        ]
        if years:
            final_year = min(years)
            logger.info(
                f"🧠 Smart Cascade chose final year: {final_year} (TheAudioDB: {adb_year}, MusicBrainz: {mb_year})"
            )
        else:
            final_year = extract_year_from_filename(original_filename)
            if final_year:
                logger.info(f"Fallback found release year {final_year} from filename")

    # 6. FINAL TAGS
    final_tags = get_final_tags(
        text_tags,
        audio_tags,
        yt_extra_tags,
        final_year,
    )

    # 7. RESULT
    genre_tag = next(
        (t for t in final_tags if t in GENRE_LABELS or "(" in t),
        None,
    )
    if not genre_tag and final_tags:
        genre_tag = final_tags[0]

    result = AnalyzeResult(
        title=title,
        artist=artist,
        album=album_name,
        artwork=artwork,
        genre=genre_tag,
        date=(str(final_year) if final_year else None),
        rating=None,
        analysis_source=source_analysis,
        tags=final_tags,
    )

    logger.info(f"✅ Analysis complete:` {result.model_dump()}")

    return result
