import os
from pydantic_settings import BaseSettings

_DEFAULT_GENRE_MODEL_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml", "genre_models")


class Settings(BaseSettings):
    HF_TOKEN: str | None = os.getenv("HF_TOKEN")
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Shared secret expected in the X-Worker-Token header. Empty = no auth (local development).
    WORKER_TOKEN: str = ""

    # Genre classifier
    GENRE_MODEL_DIR: str = _DEFAULT_GENRE_MODEL_DIR
    DEFAULT_GENRE_MODEL_VERSION: str = "v1"
    # Weight of the own audio model vs. the zero-shot text prior (by artist + title).
    GENRE_AUDIO_WEIGHT: float = 0.8
    # Inverse L2 strength of the logistic regression; 0.01 was chosen by validation on GTZAN.
    GENRE_REGULARIZATION: float = 0.01

    # Lyrics / language
    ENABLE_WHISPER: bool = True
    WHISPER_MODEL: str = "small"
    LRCLIB_URL: str = "https://lrclib.net/api"

    # Tags below these confidence values (0..1) are dropped.
    TAG_THRESHOLD: float = 0.35
    INSTRUMENT_THRESHOLD: float = 0.12
    STYLE_THRESHOLD: float = 0.15
    THEME_THRESHOLD: float = 0.2
    # Calibrated on GTZAN: classical/jazz ≈ 0.001, vocal genres > 0.02 in ~90 % of tracks.
    VOCAL_THRESHOLD: float = 0.02

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
