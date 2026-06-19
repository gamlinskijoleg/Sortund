import pytest
from unittest.mock import (
    AsyncMock,
)
from app.services.musicbrainz import (
    fetch_release_year_from_musicbrainz_by_isrc,
    fetch_release_year_from_musicbrainz,
)


@pytest.mark.asyncio
async def test_fetch_release_year_by_isrc_success(
    mocker,
):
    # Mock asyncio.to_thread and musicbrainzngs
    mock_get = mocker.patch("musicbrainzngs.get_recordings_by_isrc")
    mock_get.return_value = {
        "isrc": {
            "recording-list": [
                {
                    "release-list": [
                        {"date": "2010-05-01"},
                        {"date": "2008"},
                    ]
                }
            ]
        }
    }

    # Actually need to mock asyncio.to_thread because that's what's called
    mocker.patch(
        "asyncio.to_thread",
        new_callable=AsyncMock,
        return_value=mock_get.return_value,
    )

    year = await fetch_release_year_from_musicbrainz_by_isrc("ISRC123")
    assert year == 2008


@pytest.mark.asyncio
async def test_fetch_release_year_by_isrc_not_found(
    mocker,
):
    mocker.patch(
        "asyncio.to_thread",
        new_callable=AsyncMock,
        return_value={},
    )
    year = await fetch_release_year_from_musicbrainz_by_isrc("ISRC123")
    assert year is None


@pytest.mark.asyncio
async def test_fetch_release_year_by_isrc_empty_isrc():
    year = await fetch_release_year_from_musicbrainz_by_isrc("")
    assert year is None


@pytest.mark.asyncio
async def test_fetch_release_year_success(
    mocker,
):
    mock_result = {
        "recording-list": [
            {
                "release-list": [
                    {"date": "1999-12-31"},
                    {"date": "2005"},
                ]
            }
        ]
    }
    mocker.patch(
        "asyncio.to_thread",
        new_callable=AsyncMock,
        return_value=mock_result,
    )

    year = await fetch_release_year_from_musicbrainz(
        "Artist",
        "Title",
    )
    assert year == 1999


@pytest.mark.asyncio
async def test_fetch_release_year_unknown_artist():
    year = await fetch_release_year_from_musicbrainz(
        "Unknown Artist",
        "Title",
    )
    assert year is None
