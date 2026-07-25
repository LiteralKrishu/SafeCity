from __future__ import annotations

import asyncio
import logging
import time
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import unquote

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status
from pydantic import ValidationError

from app.core.config import Settings
from app.core.schemas import (
    AnalyzeMetadata,
    AnonymousDistressReport,
    AnonymousReportReceipt,
    AssessmentResponse,
    DataErasureRequest,
    DataErasureResponse,
    FeedbackRequest,
    RiskZonePrivacy,
    RiskZonesResponse,
)
from app.core.storage import AssessmentStore
from app.detection.audio import AudioInference, YamnetAudioClassifier
from app.detection.fusion import FusionEngine
from app.detection.patterns import PatternRetriever
from app.risk.grid import decode_cell_id
from app.risk.storage import AnonymousRiskStore

logger = logging.getLogger(__name__)


class _EphemeralRateLimiter:
    """Per-process limiter. Network addresses never enter durable storage or logs."""

    def __init__(self, limit: int, window_seconds: int = 60) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._requests: dict[str, deque[float]] = defaultdict(deque)

    def allows(self, key: str) -> bool:
        now = time.monotonic()
        entries = self._requests[key]
        while entries and entries[0] <= now - self.window_seconds:
            entries.popleft()
        if len(entries) >= self.limit:
            return False
        entries.append(now)
        return True


def build_router(
    settings: Settings,
    classifier: YamnetAudioClassifier,
    retriever: PatternRetriever,
    fusion: FusionEngine,
    storage: AssessmentStore,
    risk_storage: AnonymousRiskStore,
) -> APIRouter:
    router = APIRouter()
    risk_post_limiter = _EphemeralRateLimiter(
        settings.anonymous_risk_post_limit_per_minute
    )
    risk_get_limiter = _EphemeralRateLimiter(
        settings.anonymous_risk_get_limit_per_minute
    )

    @router.get("/health")
    async def health() -> dict:
        if classifier.ready:
            model_state = "ready"
        elif classifier.load_error:
            model_state = "degraded"
        else:
            model_state = "warming"
        return {
            "status": "ok" if model_state != "degraded" else "degraded",
            "serviceVersion": settings.service_version,
            "model": "Google YAMNet / AudioSet",
            "modelState": model_state,
            "patterns": len(retriever.patterns),
            "privacy": "local-summary-only",
        }

    @router.post("/v1/analyze", response_model=AssessmentResponse)
    async def analyze(
        request: Request,
        x_safecity_metadata: Annotated[str, Header(max_length=8192)],
    ) -> AssessmentResponse:
        started = time.perf_counter()
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > settings.max_audio_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Audio window is too large",
            )
        audio_bytes = await request.body()
        if len(audio_bytes) > settings.max_audio_bytes:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                "Audio window is too large",
            )
        try:
            metadata = AnalyzeMetadata.model_validate_json(unquote(x_safecity_metadata))
        except ValidationError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, detail=exc.errors()) from exc

        audio = AudioInference()
        if audio_bytes:
            try:
                audio = await asyncio.to_thread(classifier.infer, audio_bytes, metadata.sample_rate)
            except Exception:
                logger.exception("Audio model unavailable; continuing with motion-only fallback")
        assessment = fusion.assess(metadata, audio)
        assessment.latency_ms = round((time.perf_counter() - started) * 1000, 2)
        await asyncio.to_thread(storage.save, metadata, audio, assessment)
        return assessment

    @router.get("/v1/patterns")
    async def patterns() -> list[dict]:
        return [
            {
                "id": pattern.id,
                "name": pattern.name,
                "polarity": pattern.polarity,
                "rationale": pattern.rationale,
            }
            for pattern in retriever.patterns
        ]

    @router.post("/v1/feedback")
    async def feedback(payload: FeedbackRequest) -> dict[str, bool]:
        updated = await asyncio.to_thread(
            storage.set_feedback, payload.assessment_id, payload.verdict
        )
        if not updated:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Assessment not found")
        return {"updated": True}

    @router.post("/v1/privacy/erase", response_model=DataErasureResponse)
    async def erase_device_data(payload: DataErasureRequest) -> DataErasureResponse:
        erased = await asyncio.to_thread(storage.erase_device, payload.device_id)
        return DataErasureResponse(erased=erased)

    @router.post(
        "/v1/risk/reports",
        response_model=AnonymousReportReceipt,
        status_code=status.HTTP_202_ACCEPTED,
    )
    async def submit_anonymous_distress(
        payload: AnonymousDistressReport,
        request: Request,
        response: Response,
    ) -> AnonymousReportReceipt:
        rate_key = request.client.host if request.client else "unknown"
        if not risk_post_limiter.allows(rate_key):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many anonymous reports; retry later",
            )

        try:
            decode_cell_id(payload.cell_id)
        except ValueError as exc:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Invalid coarse location cell",
            ) from exc

        now = datetime.now(UTC)
        observed_at = payload.time_bucket.astimezone(UTC)
        if observed_at > now + timedelta(minutes=5):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "timeBucket cannot be in the future",
            )
        if observed_at < now - timedelta(
            hours=settings.anonymous_risk_max_report_age_hours
        ):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Anonymous report is too old",
            )

        accepted = await asyncio.to_thread(risk_storage.save, payload, now)
        response.headers["Cache-Control"] = "no-store"
        return AnonymousReportReceipt(accepted=accepted)

    @router.get("/v1/risk/zones", response_model=RiskZonesResponse)
    async def risk_zones(
        request: Request,
        response: Response,
        south: Annotated[float, Query(ge=-90, le=90)],
        west: Annotated[float, Query(ge=-180, le=180)],
        north: Annotated[float, Query(ge=-90, le=90)],
        east: Annotated[float, Query(ge=-180, le=180)],
        hours: Annotated[int, Query(ge=1)] = 24,
    ) -> RiskZonesResponse:
        rate_key = request.client.host if request.client else "unknown"
        if not risk_get_limiter.allows(rate_key):
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Too many risk-zone requests; retry later",
            )
        if north <= south or east <= west:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Bounding box must have increasing south/west/north/east values",
            )
        maximum_span = settings.anonymous_risk_max_bbox_span_degrees
        if north - south > maximum_span or east - west > maximum_span:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Requested map area is too large",
            )
        if hours > settings.anonymous_risk_max_window_hours:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Requested risk window is too large",
            )

        now = datetime.now(UTC)
        zones = await asyncio.to_thread(
            risk_storage.aggregate,
            south=south,
            west=west,
            north=north,
            east=east,
            hours=hours,
            now=now,
        )
        generated_at = now.replace(
            minute=(now.minute // 5) * 5,
            second=0,
            microsecond=0,
        )
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=600"
        return RiskZonesResponse(
            generated_at=generated_at,
            window_hours=hours,
            zones=zones,
            privacy=RiskZonePrivacy(
                location_precision="approximately 500 metre coarse cells",
                time_precision="one hour buckets",
                minimum_reports=settings.anonymous_risk_minimum_reports,
            ),
        )

    @router.get("/metrics")
    async def metrics() -> dict[str, int | float]:
        assessment_metrics, risk_metrics = await asyncio.gather(
            asyncio.to_thread(storage.metrics),
            asyncio.to_thread(risk_storage.metrics),
        )
        return {**assessment_metrics, **risk_metrics}

    return router
