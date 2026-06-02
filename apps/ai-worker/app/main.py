import os
import uuid
import asyncio
import logging
from contextlib import AsyncExitStack
from fastapi import FastAPI, UploadFile, File, HTTPException, status
from dotenv import load_dotenv
from typing import Dict, Union, List, Optional
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
from app.services.youtube import fetch_and_validate_youtube_metadata


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

            artist, title = "Unknown Artist", "Unknown Title"
            source_analysis = "Unknown"
            shazam_year = None

            # Етап 1: Акустичний відбиток Shazam
            shazam_match = await recognize_via_shazam_local(temp_file_path)
            if shazam_match:
                artist, title, shazam_year = shazam_match
                source_analysis = "Shazam Core Engine"
            else:
                # Етап 2: Fallback на локальний парсер назви файлу
                artist, title = parse_filename_fallback(filename)
                source_analysis = "Filename Local Parser"

            # Етап 3: Паралельний запуск ВСІХ процесів (Пошук, Теги інструментів)
            metadata_task = fetch_and_validate_youtube_metadata(
                artist, title, source_analysis, filename
            )
            audio_ai_task = predict_audio_tags(temp_file_path)

            # Чекаємо на виконання всього разом. Процесор завантажується паралельно на 100%
            yt_data, (audio_tags, fallback_mood) = await asyncio.gather(
                metadata_task, audio_ai_task, return_exceptions=False
            )

            # Перезаписуємо дані з YouTube тільки якщо це не чистий Shazam трек
            if source_analysis != "Shazam Core Engine":
                artist = yt_data["artist"]
                title = yt_data["title"]
                source_analysis = yt_data["source"]

            # Етап 4: Робота з роками та епохами релізу
            final_year = shazam_year if shazam_year is not None else yt_data["year"]
            epoch_tag = (
                get_epoch_tag_by_year(final_year) if final_year is not None else None
            )

            # Етап 5: Текстовий AI Zero-Shot та обробка жанрів
            raw_text_tags = await predict_text_zero_shot(f"{artist} - {title}")

            genres = [t for t in raw_text_tags if t["label"] in GENRE_LABELS]
            non_genres = [t for t in raw_text_tags if t["label"] not in GENRE_LABELS]
            genres.sort(key=lambda x: x["prob"], reverse=True)

            filtered_text_results = [
                f"{g['label']} ({g['prob']:.1f}%)" for g in genres[:2]
            ]
            filtered_text_results += [
                f"{ng['label']} ({ng['prob']:.1f}%)" for ng in non_genres
            ]

            # --- ФОРМУЄМО ОЧИЩЕНІ ТЕГИ ---
            if "Music" in audio_tags:
                audio_tags.remove("Music")

            album_name = None
            extra_tags_cleaned = []

            for tag in yt_data["extra_info"]:
                if tag.startswith("Album: "):
                    album_name = tag.replace("Album: ", "").strip()
                else:
                    extra_tags_cleaned.append(tag)

            if epoch_tag:
                extra_tags_cleaned.append(epoch_tag)

            final_tags = list(
                set(filtered_text_results + audio_tags + extra_tags_cleaned)
            )

            return {
                "title": title,
                "artist": artist,
                "album": album_name,
                "year": final_year,
                "analysis_source": source_analysis,
                "tags": final_tags,
            }

        except Exception as general_error:
            logger.critical(
                f"🚨 Критичний збій пайплайну: {general_error}", exc_info=True
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(general_error),
            )
