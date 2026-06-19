import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.shazam import recognize_via_shazam_local


@pytest.mark.asyncio
async def test_recognize_via_shazam_local_success(
    mocker,
):
    # Mock Shazam client
    mock_shazam = mocker.patch("app.services.shazam.shazam_client")
    mock_shazam.recognize = AsyncMock(
        return_value={
            "track": {
                "title": "Test Title",
                "subtitle": "Test Artist",
                "images": {"coverart": "http://example.com/art.jpg"},
                "isrc": "TEST12345",
            }
        }
    )

    result = await recognize_via_shazam_local("dummy.mp3")
    assert result == (
        "Test Artist",
        "Test Title",
        "http://example.com/art.jpg",
        "TEST12345",
    )


@pytest.mark.asyncio
async def test_recognize_via_shazam_local_not_found(
    mocker,
):
    mock_shazam = mocker.patch("app.services.shazam.shazam_client")
    mock_shazam.recognize = AsyncMock(return_value={})  # No track key

    result = await recognize_via_shazam_local("dummy.mp3")
    assert result is None


@pytest.mark.asyncio
async def test_recognize_via_shazam_local_exception(
    mocker,
):
    mock_shazam = mocker.patch("app.services.shazam.shazam_client")
    mock_shazam.recognize = AsyncMock(side_effect=Exception("API Error"))

    result = await recognize_via_shazam_local("dummy.mp3")
    assert result is None
