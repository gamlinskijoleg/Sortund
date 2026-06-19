import pytest
from unittest.mock import AsyncMock
from app.services.youtube import fetch_and_validate_youtube_metadata


@pytest.mark.asyncio
async def test_fetch_and_validate_youtube_metadata_success(
    mocker,
):
    mock_search = [
        {
            "title": "Test Title",
            "artists": [{"name": "Test Artist"}],
            "album": {"name": "Test Album"},
        }
    ]
    mocker.patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_search)

    result = await fetch_and_validate_youtube_metadata("Test Artist", "Test Title", "Local", "artist - title.mp3")

    assert result.title == "Test Title"
    assert result.artist == "Test Artist"
    assert "Album: Test Album" in result.extra_info
    assert result.source == "Local"  # Keeps local source if similarity is high and artist is known


@pytest.mark.asyncio
async def test_fetch_and_validate_youtube_metadata_unknown_artist(mocker):
    mock_search = [
        {
            "title": "Real Title",
            "artists": [{"name": "Real Artist"}],
            "album": {"name": "Real Album"},
        }
    ]
    mocker.patch("asyncio.to_thread", new_callable=AsyncMock, return_value=mock_search)

    result = await fetch_and_validate_youtube_metadata(
        "Unknown Artist",
        "Long Enough Title",
        "Filename Local Parser",
        "title.mp3",
    )

    # Should replace because it's unknown artist and fallback parser
    assert result.title == "Real Title"
    assert result.artist == "Real Artist"
    assert result.source == "YouTube Music Search Engine"


@pytest.mark.asyncio
async def test_fetch_and_validate_youtube_metadata_exception(mocker):
    mocker.patch("asyncio.to_thread", new_callable=AsyncMock, side_effect=Exception("YT Error"))

    result = await fetch_and_validate_youtube_metadata("Artist", "Title", "Local", "artist - title.mp3")

    assert result.title == "Title"
    assert result.artist == "Artist"
    assert result.source == "Local"
