import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch

from app.main import app


@pytest.fixture
def client():
    """Returns a FastAPI TestClient instance."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def mock_onnx_models(
    monkeypatch,
):
    """Mocks ONNX model loading to prevent slow tests."""
    # Since load_onnx_models might be called, we patch it
    monkeypatch.setattr(
        "app.ml.models.load_onnx_models",
        lambda: None,
    )


@pytest.fixture
def mock_shazam_client(
    mocker,
):
    """Mocks the Shazam client."""
    mock = mocker.patch("app.services.shazam.Shazam")
    mock_instance = mock.return_value
    mock_instance.recognize_song = AsyncMock(return_value={})
    return mock_instance


@pytest.fixture
def sample_audio_content():
    """Returns a dummy byte content for a file."""
    return b"dummy_mp3_content"
