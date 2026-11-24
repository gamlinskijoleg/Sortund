import numpy as np
import pytest
from unittest.mock import AsyncMock

from app.ml.features import FEATURE_SIZE
from app.ml.genre_model import BASE_DATASET_FILE, GenreModelRegistry
from app.schemas.analysis import AnalyzeResult, FingerprintResult, Recognition
from app.services.pipeline import GenreModelMissing


def _result(**overrides) -> AnalyzeResult:
    data = dict(
        fingerprint="shz:1",
        model_version="v1",
        title="Test Title",
        artist="Test Artist",
        metadata_source="Shazam (acoustic fingerprint)",
        genre="rock",
        genre_confidence=0.8,
    )
    data.update(overrides)
    return AnalyzeResult(**data)


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Sortund AI Worker is healthy."}


def test_analyze_track_invalid_format(client, sample_audio_content):
    response = client.post("/v1/analyze-track", files={"file": ("test.txt", sample_audio_content, "text/plain")})
    assert response.status_code == 400
    assert response.json() == {"detail": "Unsupported audio format."}


def test_analyze_track_success(client, sample_audio_content, mocker):
    mock_pipeline = mocker.patch("app.main.execute_analysis_pipeline", new_callable=AsyncMock)
    mock_pipeline.return_value = _result()

    response = client.post(
        "/v1/analyze-track",
        files={"file": ("test.mp3", sample_audio_content, "audio/mpeg")},
        data={"model_version": "v2", "fingerprint": "shz:1"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Title"
    assert data["metadata_source"].startswith("Shazam")
    kwargs = mock_pipeline.call_args.kwargs
    assert kwargs["model_version"] == "v2"
    assert kwargs["fingerprint"] == "shz:1"
    assert kwargs["recognition"] is None
    assert kwargs["skip_recognition"] is False


def test_analyze_track_reuses_recognition(client, sample_audio_content, mocker):
    mock_pipeline = mocker.patch("app.main.execute_analysis_pipeline", new_callable=AsyncMock)
    mock_pipeline.return_value = _result()
    recognition = Recognition(artist="A", title="T", shazam_key="1")

    response = client.post(
        "/v1/analyze-track",
        files={"file": ("test.mp3", sample_audio_content, "audio/mpeg")},
        data={"recognition": recognition.model_dump_json()},
    )

    assert response.status_code == 200
    kwargs = mock_pipeline.call_args.kwargs
    assert kwargs["recognition"].artist == "A"
    assert kwargs["skip_recognition"] is True


def test_analyze_track_missing_genre_model(client, sample_audio_content, mocker):
    mocker.patch("app.main.execute_analysis_pipeline", new_callable=AsyncMock, side_effect=GenreModelMissing("v9"))
    response = client.post("/v1/analyze-track", files={"file": ("a.mp3", sample_audio_content, "audio/mpeg")})
    assert response.status_code == 409
    assert response.json()["detail"] == "genre_model_missing:v9"


def test_analyze_track_internal_error(client, sample_audio_content, mocker):
    mocker.patch("app.main.execute_analysis_pipeline", new_callable=AsyncMock, side_effect=Exception("boom"))
    response = client.post("/v1/analyze-track", files={"file": ("test.mp3", sample_audio_content, "audio/mpeg")})
    assert response.status_code == 500
    assert response.json() == {"detail": "An internal error occurred during track analysis."}


def test_fingerprint_endpoint(client, sample_audio_content, mocker):
    mocker.patch(
        "app.main.fingerprint_track",
        new_callable=AsyncMock,
        return_value=FingerprintResult(fingerprint="loc:abc", recognition=None),
    )
    response = client.post("/v1/fingerprint", files={"file": ("a.flac", sample_audio_content, "audio/flac")})
    assert response.status_code == 200
    assert response.json() == {"fingerprint": "loc:abc", "recognition": None}


def test_worker_token_required_when_configured(client, sample_audio_content, mocker):
    mocker.patch("app.main.settings.WORKER_TOKEN", "secret")
    mocker.patch(
        "app.main.fingerprint_track",
        new_callable=AsyncMock,
        return_value=FingerprintResult(fingerprint="loc:abc"),
    )
    files = {"file": ("a.mp3", sample_audio_content, "audio/mpeg")}
    assert client.post("/v1/fingerprint", files=files).status_code == 401
    ok = client.post("/v1/fingerprint", files=files, headers={"X-Worker-Token": "secret"})
    assert ok.status_code == 200
    # Health check stays public.
    assert client.get("/health").status_code == 200


@pytest.fixture
def tmp_registry(tmp_path, mocker):
    rng = np.random.default_rng(0)
    labels = np.array(["rock"] * 30 + ["jazz"] * 30)
    features = rng.normal(size=(60, FEATURE_SIZE)).astype(np.float32)
    features[:30, :50] += 3  # make the classes clearly separable
    np.savez_compressed(tmp_path / BASE_DATASET_FILE, features=features, labels=labels, names=np.arange(60))
    registry = GenreModelRegistry(str(tmp_path))
    mocker.patch("app.main.registry", registry)
    mocker.patch("app.ml.genre_model.settings.GENRE_REGULARIZATION", 1.0)
    return registry


def test_genre_model_train_upload_and_list(client, tmp_registry):
    sample = {"features": [3.0] * 50 + [0.0] * (FEATURE_SIZE - 50), "label": "rock"}
    response = client.post("/v1/genre-models/train", json={"version": "v2", "samples": [sample]})
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == "v2"
    assert body["metrics"]["corrections_used"] == 1
    assert body["metrics"]["accuracy"] > 0.9
    assert body["weights_b64"]

    listed = client.get("/v1/genre-models").json()
    assert [m["version"] for m in listed] == ["v2"]

    exported = client.get("/v1/genre-models/v2").json()
    assert client.put("/v1/genre-models/v3", json={"weights_b64": exported["weights_b64"]}).status_code == 200
    assert tmp_registry.has("v3")
    assert client.get("/v1/genre-models/missing").status_code == 404


def test_genre_model_rejects_bad_version_name(client, tmp_registry):
    response = client.post("/v1/genre-models/train", json={"version": "../evil", "samples": []})
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_startup_event(mocker):
    mock_load = mocker.patch("app.main.load_onnx_models")
    from app.main import startup_event

    await startup_event()
    mock_load.assert_called_once()


@pytest.mark.asyncio
async def test_shutdown_event(mocker):
    mock_close = mocker.patch("app.main.TheAudioDBClient.close", new_callable=AsyncMock)
    from app.main import shutdown_event

    await shutdown_event()
    mock_close.assert_called_once()


def test_cleanup_temp_file_exception(mocker):
    from app.main import cleanup_temp_file

    mocker.patch("os.path.exists", return_value=True)
    mocker.patch("os.remove", side_effect=Exception("Mock permission denied"))
    cleanup_temp_file("some_dummy_path.mp3")
