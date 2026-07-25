from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, alias_generators, field_validator


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class MotionFeatures(CamelModel):
    peak_acceleration_g: float = Field(default=0, ge=0, le=20)
    jerk_rms: float = Field(default=0, ge=0, le=500)
    rotation_rms: float = Field(default=0, ge=0, le=3000)
    free_fall_observed: bool = False
    impact_after_free_fall: bool = False
    sample_count: int = Field(default=0, ge=0, le=10_000)


class ContextFeatures(CamelModel):
    hour: int = Field(default=12, ge=0, le=23)
    app_state: str = Field(default="active", max_length=32)


class AnalyzeMetadata(CamelModel):
    device_id: str = Field(min_length=8, max_length=128)
    session_id: str = Field(min_length=8, max_length=128)
    sample_rate: int = Field(default=16_000, ge=8_000, le=48_000)
    motion: MotionFeatures = Field(default_factory=MotionFeatures)
    context: ContextFeatures = Field(default_factory=ContextFeatures)


class RetrievedPattern(CamelModel):
    id: str
    name: str
    similarity: float = Field(ge=0, le=1)
    rationale: str


class AssessmentResponse(CamelModel):
    assessment_id: str
    risk_level: str
    confidence: float = Field(ge=0, le=1)
    fused_score: float = Field(ge=0, le=1)
    needs_evidence_capture: bool
    explanation: str
    factors: list[str]
    matched_patterns: list[RetrievedPattern]
    model_version: str
    latency_ms: float = Field(ge=0)


class FeedbackRequest(CamelModel):
    assessment_id: str
    verdict: str = Field(pattern="^(correct|false_positive|missed)$")


class DataErasureRequest(CamelModel):
    device_id: str = Field(min_length=8, max_length=128)


class DataErasureResponse(CamelModel):
    erased: int = Field(ge=0)


class AnonymousDistressReport(CamelModel):
    model_config = ConfigDict(
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
        serialize_by_alias=True,
        extra="forbid",
    )

    schema_version: Literal[1]
    cell_id: str = Field(pattern=r"^r1:\d{1,5}:\d{1,5}$", max_length=18)
    time_bucket: datetime
    event_kind: Literal[
        "manual_sos",
        "voice_sos",
        "motion_sos",
        "audio_sos",
        "confirmed_distress",
    ]
    accuracy_band: Literal["good", "fair"]
    dedupe_token: str = Field(pattern=r"^[a-f0-9]{64}$")

    @field_validator("time_bucket")
    @classmethod
    def validate_hour_bucket(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("timeBucket must include a timezone")
        if value.minute or value.second or value.microsecond:
            raise ValueError("timeBucket must be rounded to the hour")
        return value


class AnonymousReportReceipt(CamelModel):
    accepted: bool


class RiskZone(CamelModel):
    cell_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    intensity: float = Field(ge=0, le=1)
    radius_meters: int = Field(ge=100, le=2_000)
    risk_band: Literal["emerging", "elevated", "high"]


class RiskZonePrivacy(CamelModel):
    location_precision: str
    time_precision: str
    minimum_reports: int = Field(ge=3)
    exact_counts_exposed: Literal[False] = False
    raw_locations_stored: Literal[False] = False


class RiskZonesResponse(CamelModel):
    generated_at: datetime
    window_hours: int
    zones: list[RiskZone]
    privacy: RiskZonePrivacy
