from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="SAFECITY_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    service_name: str = "SafeCity Local Inference"
    service_version: str = "2.0.0"
    log_level: str = "INFO"
    model_url: str = "https://tfhub.dev/google/yamnet/1"
    model_preload: bool = True
    model_threads: int = Field(default=2, ge=1, le=8)
    database_path: Path = Path("data/safecity-inference.db")
    pattern_path: Path = Path("app/knowledge/patterns.json")
    custom_pattern_path: Path = Path("data/patterns.local.json")
    max_audio_bytes: int = Field(default=1_048_576, ge=32_000, le=10_485_760)
    assessment_retention_days: int = Field(default=14, ge=1, le=90)
    anonymous_risk_retention_days: int = Field(default=30, ge=1, le=90)
    anonymous_risk_minimum_reports: int = Field(default=3, ge=3, le=20)
    anonymous_risk_max_report_age_hours: int = Field(default=48, ge=1, le=168)
    anonymous_risk_max_window_hours: int = Field(default=168, ge=24, le=720)
    anonymous_risk_max_bbox_span_degrees: float = Field(default=1.0, gt=0, le=10)
    anonymous_risk_post_limit_per_minute: int = Field(default=30, ge=3, le=300)
    anonymous_risk_get_limit_per_minute: int = Field(default=120, ge=10, le=1_000)


@lru_cache
def get_settings() -> Settings:
    return Settings()
