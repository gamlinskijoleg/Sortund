import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    HF_TOKEN: str | None = os.getenv("HF_TOKEN")
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
