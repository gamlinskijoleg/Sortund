import pytest
from unittest.mock import (
    AsyncMock,
    patch,
)

from app.services.pipeline import (
    format_zero_shot_text_tags,
    parse_youtube_extra_info,
    execute_analysis_pipeline,
)
from app.schemas.analysis import (
    YTMetadata,
)
from app.core.constants import (
    GENRE_LABELS,
)


def test_format_zero_shot_text_tags():
    # Make sure 'Rock' is in GENRE_LABELS, or pick one that is. Let's assume 'Pop' and 'Rock' are in it.
    raw = [
        {
            "label": "Pop",
            "prob": 0.9,
        },
        {
            "label": "happy",
            "prob": 0.8,
        },
    ]
    # We'll just patch GENRE_LABELS for the test if needed, or rely on actual
    formatted = format_zero_shot_text_tags(raw)
    assert len(formatted) == 2


def test_parse_youtube_extra_info():
    info = [
        "Album: Test Album",
        "Official Video",
        "Remastered",
    ]
    (
        album,
        tags,
    ) = parse_youtube_extra_info(info)
    assert album == "Test Album"
    assert tags == [
        "Official Video",
        "Remastered",
    ]


@pytest.mark.asyncio
async def test_execute_analysis_pipeline_with_shazam(
    mocker,
):
    # Mock all the background tasks and services
    mocker.patch(
        "app.services.pipeline.predict_audio_tags",
        new_callable=AsyncMock,
        return_value=(
            [
                "Guitar",
                "Music",
            ],
            None,
        ),
    )
    mocker.patch(
        "app.services.pipeline.recognize_via_shazam_local",
        new_callable=AsyncMock,
        return_value=(
            "Artist",
            "Title",
            "http://art",
            "ISRC123",
        ),
    )
    mocker.patch(
        "app.services.pipeline.fetch_and_validate_youtube_metadata",
        new_callable=AsyncMock,
        return_value=YTMetadata(
            source="yt",
            title="Title",
            artist="Artist",
            extra_info=[
                "Album: YT Album",
                "tag",
            ],
        ),
    )
    mocker.patch(
        "app.services.pipeline.predict_text_zero_shot",
        new_callable=AsyncMock,
        return_value=[
            {
                "label": "Pop",
                "prob": 0.9,
            }
        ],
    )
    mocker.patch(
        "app.services.pipeline.fetch_release_year_from_musicbrainz_by_isrc",
        new_callable=AsyncMock,
        return_value=2020,
    )

    result = await execute_analysis_pipeline(
        "dummy/path",
        "Artist - Title.mp3",
    )

    assert result.artist == "Artist"
    assert result.title == "Title"
    assert result.album == "YT Album"
    assert result.date == "2020"
    assert result.analysis_source == "Shazam Core Engine"


@pytest.mark.asyncio
async def test_execute_analysis_pipeline_fallback(
    mocker,
):
    # Mock no shazam
    mocker.patch(
        "app.services.pipeline.predict_audio_tags",
        new_callable=AsyncMock,
        return_value=(
            ["Piano"],
            None,
        ),
    )
    mocker.patch(
        "app.services.pipeline.recognize_via_shazam_local",
        new_callable=AsyncMock,
        return_value=None,
    )
    mocker.patch(
        "app.services.pipeline.fetch_and_validate_youtube_metadata",
        new_callable=AsyncMock,
        return_value=YTMetadata(
            source="yt",
            title="Fallback Title",
            artist="Fallback Artist",
            extra_info=[],
        ),
    )
    mocker.patch(
        "app.services.pipeline.predict_text_zero_shot",
        new_callable=AsyncMock,
        return_value=[],
    )
    mocker.patch(
        "app.services.pipeline.fetch_release_year_from_theaudiodb",
        new_callable=AsyncMock,
        return_value=None,
    )
    mocker.patch(
        "app.services.pipeline.fetch_release_year_from_musicbrainz",
        new_callable=AsyncMock,
        return_value=None,
    )

    result = await execute_analysis_pipeline(
        "dummy/path",
        "Fallback Artist - Fallback Title.mp3",
    )

    assert result.artist == "Fallback Artist"
    assert result.title == "Fallback Title"
    assert result.analysis_source == "yt"
