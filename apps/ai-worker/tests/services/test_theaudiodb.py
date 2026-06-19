import pytest
import aiohttp
from unittest.mock import AsyncMock
from app.services.theaudiodb import fetch_release_year_from_theaudiodb, TheAudioDBClient


class MockResponse:
    def __init__(
        self,
        status,
        json_data,
    ):
        self.status = status
        self.json_data = json_data

    async def json(
        self,
    ):
        return self.json_data

    async def __aenter__(
        self,
    ):
        return self

    async def __aexit__(
        self,
        exc_type,
        exc_val,
        exc_tb,
    ):
        pass


@pytest.fixture
def mock_session():
    class MockSession:
        def __init__(
            self,
        ):
            self.responses = []
            self.urls_called = []

        def set_responses(
            self,
            responses,
        ):
            self.responses = responses

        def get(
            self,
            url,
        ):
            self.urls_called.append(url)
            return self.responses.pop(0)

    session = MockSession()
    return session


@pytest.mark.asyncio
async def test_fetch_release_year_from_theaudiodb_success(
    mocker,
    mock_session,
):
    mocker.patch(
        "app.services.theaudiodb.TheAudioDBClient.get_session",
        return_value=mock_session,
    )

    # Need two responses: one for track search, one for album search
    mock_session.set_responses(
        [
            MockResponse(
                200,
                {"track": [{"idAlbum": "999"}]},
            ),
            MockResponse(
                200,
                {"album": [{"intYearReleased": "1988"}]},
            ),
        ]
    )

    year = await fetch_release_year_from_theaudiodb(
        "Artist",
        "Title",
    )
    assert year == 1988
    assert len(mock_session.urls_called) == 2


@pytest.mark.asyncio
async def test_fetch_release_year_from_theaudiodb_unknown_artist():
    year = await fetch_release_year_from_theaudiodb(
        "Unknown Artist",
        "Title",
    )
    assert year is None


@pytest.mark.asyncio
async def test_fetch_release_year_from_theaudiodb_no_track(
    mocker,
    mock_session,
):
    mocker.patch(
        "app.services.theaudiodb.TheAudioDBClient.get_session",
        return_value=mock_session,
    )
    mock_session.set_responses(
        [
            MockResponse(
                200,
                {"track": None},
            )
        ]
    )

    year = await fetch_release_year_from_theaudiodb(
        "Artist",
        "Title",
    )
    assert year is None
