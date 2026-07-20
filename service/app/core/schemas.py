from pydantic import BaseModel, ConfigDict, Field, alias_generators


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
