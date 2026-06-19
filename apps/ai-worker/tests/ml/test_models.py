import pytest
from unittest.mock import (
    patch,
    MagicMock,
)
from app.ml.models import (
    load_onnx_models,
    _sync_predict_text_zero_shot,
    _sync_predict_audio_tags,
    predict_text_zero_shot,
    predict_audio_tags,
)


def test_sync_predict_text_zero_shot_no_session():
    # If session is None, it should return []
    result = _sync_predict_text_zero_shot("Test track")
    assert result == []


def test_sync_predict_audio_tags_no_session():
    # If session is None, it should return [], "Unknown"
    (
        result,
        mood,
    ) = _sync_predict_audio_tags("dummy.mp3")
    assert result == []
    assert mood == "Unknown"


@pytest.mark.asyncio
async def test_predict_text_zero_shot_wrapper(
    mocker,
):
    mocker.patch(
        "app.ml.models._sync_predict_text_zero_shot",
        return_value=[
            {
                "label": "Rock",
                "prob": 90.0,
            }
        ],
    )
    result = await predict_text_zero_shot("Track")
    assert result == [
        {
            "label": "Rock",
            "prob": 90.0,
        }
    ]


@pytest.mark.asyncio
async def test_predict_audio_tags_wrapper(
    mocker,
):
    mocker.patch(
        "app.ml.models._sync_predict_audio_tags",
        return_value=(
            ["Guitar"],
            "Energetic",
        ),
    )
    (
        tags,
        mood,
    ) = await predict_audio_tags("dummy.mp3")
    assert tags == ["Guitar"]
    assert mood == "Energetic"


def test_load_onnx_models_download_exception(
    mocker,
):
    mocker.patch(
        "os.path.exists",
        return_value=False,
    )
    mocker.patch(
        "app.ml.models.snapshot_download",
        side_effect=Exception("HF Error"),
    )
    # Should handle gracefully without raising
    load_onnx_models()
