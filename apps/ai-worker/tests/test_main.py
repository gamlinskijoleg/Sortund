import pytest
from unittest.mock import (
    AsyncMock,
)


def test_health_check(
    client,
):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "message": "Sortund AI Worker is healthy.",
    }


def test_analyze_track_invalid_format(
    client,
    sample_audio_content,
):
    files = {
        "file": (
            "test.txt",
            sample_audio_content,
            "text/plain",
        )
    }
    response = client.post(
        "/v1/analyze-track",
        files=files,
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Unsupported audio format."}


@pytest.mark.asyncio
async def test_analyze_track_success(
    client,
    sample_audio_content,
    mocker,
):
    # Mock the pipeline execution to return a known AnalyzeResult
    mock_pipeline = mocker.patch(
        "app.main.execute_analysis_pipeline",
        new_callable=AsyncMock,
    )
    mock_pipeline.return_value = {
        "title": "Test Title",
        "artist": "Test Artist",
        "album": "Test Album",
        "artwork": "http://example.com/art.jpg",
        "genre": "Rock",
        "date": "2023",
        "rating": "5",
        "analysis_source": "mock_source",
        "tags": [
            "test",
            "rock",
        ],
    }

    files = {
        "file": (
            "test.mp3",
            sample_audio_content,
            "audio/mpeg",
        )
    }
    response = client.post(
        "/v1/analyze-track",
        files=files,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Test Title"
    assert data["artist"] == "Test Artist"
    assert data["analysis_source"] == "mock_source"


def test_analyze_track_internal_error(
    client,
    sample_audio_content,
    mocker,
):
    # Mock the pipeline execution to raise an Exception
    mock_pipeline = mocker.patch(
        "app.main.execute_analysis_pipeline",
        new_callable=AsyncMock,
    )
    mock_pipeline.side_effect = Exception("Mocked pipeline failure")

    files = {
        "file": (
            "test.mp3",
            sample_audio_content,
            "audio/mpeg",
        )
    }
    response = client.post(
        "/v1/analyze-track",
        files=files,
    )

    assert response.status_code == 500
    assert response.json() == {"detail": "An internal error occurred during track analysis."}


@pytest.mark.asyncio
async def test_startup_event(
    mocker,
):
    mock_load = mocker.patch("app.main.load_onnx_models")
    from app.main import (
        startup_event,
    )

    await startup_event()
    mock_load.assert_called_once()


@pytest.mark.asyncio
async def test_shutdown_event(
    mocker,
):
    mock_close = mocker.patch(
        "app.main.TheAudioDBClient.close",
        new_callable=AsyncMock,
    )
    from app.main import (
        shutdown_event,
    )

    await shutdown_event()
    mock_close.assert_called_once()


def test_cleanup_temp_file_exception(
    mocker,
):
    from app.main import (
        cleanup_temp_file,
    )

    mocker.patch(
        "os.path.exists",
        return_value=True,
    )
    mocker.patch(
        "os.remove",
        side_effect=Exception("Mock permission denied"),
    )
    # Should handle exception gracefully without raising
    cleanup_temp_file("some_dummy_path.mp3")
