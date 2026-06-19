import os
import logging
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException, status, BackgroundTasks
from typing import Dict

from app.core.logger import setup_logging
from app.core.settings import settings
from app.ml.models import load_onnx_models
from app.services.pipeline import execute_analysis_pipeline
from app.schemas.analysis import AnalyzeResult
from app.services.theaudiodb import TheAudioDBClient

setup_logging()
logger = logging.getLogger("sortund-ai-pipeline")

app = FastAPI(
    title="Sortund AI Hybrid Worker",
    version="1.5.0",
    description="High-performance production pipeline for audio fingerprinting and AI multi-modal tag extraction.",
)


@app.on_event("startup")
async def startup_event() -> None:
    """Executed on application startup. Loads ONNX models and inits resources."""
    load_onnx_models()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    """Executed on application shutdown. Cleans up resources."""
    await TheAudioDBClient.close()


def cleanup_temp_file(
    path: str,
):
    """Deletes temporary file safely."""
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.warning(f"Failed to delete temporary file {path}: {e}")


@app.post(
    "/v1/analyze-track",
    status_code=status.HTTP_200_OK,
    response_model=AnalyzeResult,
)
async def analyze_track(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
) -> AnalyzeResult:
    """Processes the uploaded audio file, extracts tags and metadata from various sources."""
    filename = file.filename or "unknown.mp3"
    logger.info(f"📥 Received file for analysis: {filename}")
    if not filename.endswith(
        (
            ".mp3",
            ".wav",
            ".m4a",
            ".ogg",
            ".flac",
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported audio format.",
        )

    clean_ext = os.path.splitext(filename)[1]

    try:
        # Create a temp file to allow async pipeline processing
        (
            fd,
            temp_file_path,
        ) = tempfile.mkstemp(suffix=clean_ext)
        os.close(fd)

        # Guarantee file cleanup after request response
        background_tasks.add_task(
            cleanup_temp_file,
            temp_file_path,
        )

        contents = await file.read()
        with open(
            temp_file_path,
            "wb",
        ) as buffer:
            buffer.write(contents)

        result = await execute_analysis_pipeline(
            temp_file_path,
            filename,
        )
        return result

    except Exception as general_error:
        logger.critical(
            f"🚨 Critical pipeline failure: {general_error}",
            exc_info=True,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred during track analysis.",
        )
    finally:
        await file.close()


@app.get(
    "/health",
    status_code=status.HTTP_200_OK,
)
async def health_check() -> Dict[
    str,
    str,
]:
    """Simple service health check."""
    return {
        "status": "ok",
        "message": "Sortund AI Worker is healthy.",
    }
