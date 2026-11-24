import asyncio
import logging
import os
import tempfile
from typing import Dict, List, Optional

import numpy as np
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, Header, HTTPException, UploadFile, status

from app.core.logger import setup_logging
from app.core.settings import settings
from app.ml.genre_model import registry
from app.ml.models import load_onnx_models
from app.schemas.analysis import (
    AnalyzeResult,
    FingerprintResult,
    ModelInfo,
    Recognition,
    TrainRequest,
    TrainResponse,
    UploadModelRequest,
)
from app.services.pipeline import GenreModelMissing, execute_analysis_pipeline, fingerprint_track
from app.services.theaudiodb import TheAudioDBClient

setup_logging()
logger = logging.getLogger("sortund-ai-pipeline")

SUPPORTED_EXTENSIONS = (".mp3", ".wav", ".m4a", ".ogg", ".flac")
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

app = FastAPI(
    title="Sortund AI Worker",
    version="2.0.0",
    description="Audio fingerprinting, metadata lookup and multi-model tag extraction for music tracks.",
)


@app.on_event("startup")
async def startup_event() -> None:
    load_onnx_models()


@app.on_event("shutdown")
async def shutdown_event() -> None:
    await TheAudioDBClient.close()


def verify_token(x_worker_token: Optional[str] = Header(default=None)) -> None:
    """Requests from the backend carry a shared secret when WORKER_TOKEN is configured."""
    if settings.WORKER_TOKEN and x_worker_token != settings.WORKER_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid worker token.")


def cleanup_temp_file(path: str) -> None:
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception as e:
        logger.warning(f"Failed to delete temporary file {path}: {e}")


async def save_upload(file: UploadFile, background_tasks: BackgroundTasks) -> tuple[str, str]:
    filename = file.filename or "unknown.mp3"
    if not filename.lower().endswith(SUPPORTED_EXTENSIONS):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported audio format.")
    contents = await file.read()
    await file.close()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="File too large.")

    fd, temp_path = tempfile.mkstemp(suffix=os.path.splitext(filename)[1].lower())
    with os.fdopen(fd, "wb") as buffer:
        buffer.write(contents)
    background_tasks.add_task(cleanup_temp_file, temp_path)
    return temp_path, filename


@app.post("/v1/fingerprint", response_model=FingerprintResult, dependencies=[Depends(verify_token)])
async def fingerprint(background_tasks: BackgroundTasks, file: UploadFile = File(...)) -> FingerprintResult:
    """Cheap step: recognises the track and computes its fingerprint (used as the cache key)."""
    temp_path, filename = await save_upload(file, background_tasks)
    try:
        return await fingerprint_track(temp_path, filename)
    except Exception as e:
        logger.critical(f"Fingerprint failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to fingerprint the track.")


@app.post("/v1/analyze-track", response_model=AnalyzeResult, dependencies=[Depends(verify_token)])
async def analyze_track(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    model_version: Optional[str] = Form(default=None),
    fingerprint: Optional[str] = Form(default=None),
    recognition: Optional[str] = Form(default=None, description="Recognition JSON from /v1/fingerprint"),
    skip_recognition: bool = Form(default=False),
) -> AnalyzeResult:
    """Full analysis: metadata, genre, mood, instruments, vocals, language, lyrics, themes, BPM and key."""
    temp_path, filename = await save_upload(file, background_tasks)
    logger.info(f"Received file for analysis: {filename}")
    parsed_recognition = Recognition.model_validate_json(recognition) if recognition else None
    try:
        return await execute_analysis_pipeline(
            temp_path,
            filename,
            model_version=model_version,
            recognition=parsed_recognition,
            skip_recognition=skip_recognition or parsed_recognition is not None,
            fingerprint=fingerprint,
        )
    except GenreModelMissing as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"genre_model_missing:{e.version}")
    except Exception as e:
        logger.critical(f"Critical pipeline failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An internal error occurred during track analysis.")


@app.get("/v1/genre-models", response_model=List[ModelInfo], dependencies=[Depends(verify_token)])
async def list_genre_models() -> List[ModelInfo]:
    return [ModelInfo(version=v, metrics=registry.metrics(v)) for v in registry.list_versions()]


@app.get("/v1/genre-models/{version}", dependencies=[Depends(verify_token)])
async def export_genre_model(version: str) -> Dict:
    if not registry.has(version):
        raise HTTPException(status_code=404, detail="Model version not found.")
    return {"version": version, "metrics": registry.metrics(version), "weights_b64": registry.export_b64(version)}


@app.put("/v1/genre-models/{version}", dependencies=[Depends(verify_token)])
async def upload_genre_model(version: str, body: UploadModelRequest) -> Dict:
    """Restores a model version (the backend keeps the weights of every version in its database)."""
    try:
        registry.import_b64(version, body.weights_b64, body.metrics)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"version": version, "status": "stored"}


@app.post("/v1/genre-models/train", response_model=TrainResponse, dependencies=[Depends(verify_token)])
async def train_genre_model(body: TrainRequest) -> TrainResponse:
    """Trains a new version on the base dataset plus user corrections and evaluates it on the test split."""
    from app.ml.features import FEATURE_SIZE

    samples = [s for s in body.samples if len(s.features) == FEATURE_SIZE]
    extra_x = np.asarray([s.features for s in samples], dtype=np.float32) if samples else None
    extra_y = [s.label for s in samples] if samples else None
    try:
        _, metrics = await asyncio.to_thread(registry.train, body.version, extra_x, extra_y)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Base dataset is missing on the worker.")
    return TrainResponse(version=body.version, metrics=metrics, weights_b64=registry.export_b64(body.version))


@app.get("/health", status_code=status.HTTP_200_OK)
async def health_check() -> Dict[str, str]:
    """Simple service health check."""
    return {"status": "ok", "message": "Sortund AI Worker is healthy."}
