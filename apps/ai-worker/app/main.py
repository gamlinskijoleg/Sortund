import os
import uuid
import asyncio
import logging
from contextlib import AsyncExitStack
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from dotenv import load_dotenv
from typing import Dict, Union, List, Optional, Tuple, Any
from typing_extensions import TypedDict

# Імпорт модулів архітектури
from app.core.config import setup_logging, GENRE_LABELS
from app.ml.models import (
    load_onnx_models,
    predict_text_zero_shot,
    predict_audio_tags,
)
from app.core.utils import parse_filename_fallback, get_epoch_tag_by_year
from app.services.shazam import recognize_via_shazam_local
from app.services.youtube import fetch_and_validate_youtube_metadata, YTMetadata


class AnalyzeResult(TypedDict):
    title: str
    artist: str
    album: Optional[str]
    year: Optional[int]
    analysis_source: str
    tags: List[str]


load_dotenv()
setup_logging()
logger = logging.getLogger("sortund-ai-pipeline")

app = FastAPI(
    title="Sortund AI Hybrid Worker",
    version="1.5.0",
    description="High-performance production pipeline for audio fingerprinting and AI multi-modal tag extraction.",
)


@app.on_event("startup")
def startup_event() -> None:
    """Виконується при запуску застосунку. Завантажує моделі ONNX."""
    os.makedirs("temp", exist_ok=True)
    load_onnx_models()


def format_zero_shot_text_tags(raw_text_tags: List[Dict[str, Any]]) -> List[str]:
    """Фільтрує та форматує текстові теги (жанри та інші)."""
    genres = [t for t in raw_text_tags if t["label"] in GENRE_LABELS]
    non_genres = [t for t in raw_text_tags if t["label"] not in GENRE_LABELS]
    genres.sort(key=lambda x: x["prob"], reverse=True)

    filtered = [f"{g['label']} ({float(g['prob']):.1f}%)" for g in genres[:2]]
    filtered += [f"{ng['label']} ({float(ng['prob']):.1f}%)" for ng in non_genres]
    return filtered


def parse_youtube_extra_info(
    yt_extra_info: List[str],
) -> Tuple[Optional[str], List[str]]:
    """Витягує назву альбому та додаткові теги з метаданих YouTube."""
    album_name = None
    extra_tags = []
    for tag in yt_extra_info:
        if tag.startswith("Album: "):
            album_name = tag.replace("Album: ", "").strip()
        else:
            extra_tags.append(tag)
    return album_name, extra_tags


async def get_base_metadata(
    temp_file_path: str, original_filename: str
) -> Tuple[str, str, Optional[int], str, YTMetadata]:
    """Визначає базові метадані (Artist, Title, Year) з Shazam або локального парсера."""
    shazam_match = await recognize_via_shazam_local(temp_file_path)

    if shazam_match:
        artist, title, final_year = shazam_match
        source_analysis = "Shazam Core Engine"
        yt_data = await fetch_and_validate_youtube_metadata(
            artist, title, source_analysis, original_filename
        )
    else:
        fallback_artist, fallback_title = parse_filename_fallback(original_filename)
        source_analysis = "Filename Local Parser"
        yt_data = await fetch_and_validate_youtube_metadata(
            fallback_artist, fallback_title, source_analysis, original_filename
        )

        artist = yt_data["artist"]
        title = yt_data["title"]
        source_analysis = yt_data["source"]
        final_year = yt_data["year"]

    return artist, title, final_year, source_analysis, yt_data


async def get_text_tags(artist: str, title: str) -> List[str]:
    """Отримує та форматує жанри з текстової моделі Zero-Shot."""
    raw_text_tags = await predict_text_zero_shot(f"{artist} - {title}")
    return format_zero_shot_text_tags(raw_text_tags)


async def get_audio_tags(audio_ai_task: asyncio.Task) -> List[str]:
    """Очікує результати фонового аналізу аудіо та фільтрує їх."""
    audio_tags, _ = await audio_ai_task
    if "Music" in audio_tags:
        audio_tags.remove("Music")
    return audio_tags


def get_final_tags(
    text_tags: List[str],
    audio_tags: List[str],
    yt_extra_tags: List[str],
    year: Optional[int],
) -> List[str]:
    """Об'єднує всі теги в один фінальний набір."""
    final_tags = set(text_tags + audio_tags + yt_extra_tags)

    epoch_tag = get_epoch_tag_by_year(year) if year is not None else None
    if epoch_tag:
        final_tags.add(epoch_tag)

    return list(final_tags)


async def execute_analysis_pipeline(
    temp_file_path: str, original_filename: str
) -> AnalyzeResult:
    """Оркеструє весь процес розпізнавання, збору даних та AI-аналізу для треку."""

    # 1. AUDIO AI (запускаємо у фоні)
    audio_ai_task = asyncio.create_task(predict_audio_tags(temp_file_path))

    # 2. BASE METADATA
    artist, title, final_year, source_analysis, yt_data = await get_base_metadata(
        temp_file_path, original_filename
    )

    # 3. ALBUM
    album_name, yt_extra_tags = parse_youtube_extra_info(yt_data.get("extra_info", []))

    # 4. TEXT TAGS
    text_tags = await get_text_tags(artist, title)

    # 5. AUDIO TAGS
    audio_tags = await get_audio_tags(audio_ai_task)

    # 6. FINAL TAGS
    final_tags = get_final_tags(text_tags, audio_tags, yt_extra_tags, final_year)

    # 7. RESULT
    return {
        "title": title,
        "artist": artist,
        "album": album_name,
        "year": final_year,
        "analysis_source": source_analysis,
        "tags": final_tags,
    }


@app.post("/v1/analyze-track", status_code=status.HTTP_200_OK)
async def analyze_track(
    file: UploadFile = File(...),
) -> AnalyzeResult:
    """Обробляє завантажений аудіофайл, витягує теги та метадані з різних джерел."""
    filename = file.filename or "unknown.mp3"
    if not filename.endswith((".mp3", ".wav", ".m4a", ".ogg", ".flac")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported audio format."
        )

    unique_id = uuid.uuid4().hex
    clean_ext = os.path.splitext(filename)[1]
    temp_file_path = os.path.join("temp", f"temp_{unique_id}{clean_ext}")

    async with AsyncExitStack() as stack:
        try:
            contents = await file.read()
            with open(temp_file_path, "wb") as buffer:
                buffer.write(contents)
            await file.close()

            # Гарантоване видалення файлу після завершення запиту
            stack.callback(
                lambda: (
                    os.remove(temp_file_path)
                    if os.path.exists(temp_file_path)
                    else None
                )
            )

            return await execute_analysis_pipeline(temp_file_path, filename)

        except Exception as general_error:
            logger.critical(
                f"🚨 Критичний збій пайплайну: {general_error}", exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(general_error),
            )
