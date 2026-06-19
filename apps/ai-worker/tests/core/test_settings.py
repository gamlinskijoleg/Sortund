import os
from pydantic_settings import (
    BaseSettings,
)
from app.core.settings import (
    Settings,
)


def test_settings_defaults():
    settings = Settings(HF_TOKEN="test_token")
    assert settings.HF_TOKEN == "test_token"
    assert settings.HOST == "0.0.0.0"
    assert settings.PORT == 8000
    assert settings.LOG_LEVEL == "INFO"


def test_settings_env_override(
    monkeypatch,
):
    monkeypatch.setenv(
        "HF_TOKEN",
        "new_token",
    )
    monkeypatch.setenv(
        "HOST",
        "127.0.0.1",
    )
    monkeypatch.setenv(
        "PORT",
        "9000",
    )
    monkeypatch.setenv(
        "LOG_LEVEL",
        "DEBUG",
    )

    settings = Settings()
    assert settings.HF_TOKEN == "new_token"
    assert settings.HOST == "127.0.0.1"
    assert settings.PORT == 9000
    assert settings.LOG_LEVEL == "DEBUG"
