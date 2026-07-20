from __future__ import annotations

import asyncio
import logging
import time
from typing import Annotated
from urllib.parse import unquote

from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import ValidationError

from app.core.config import Settings
from app.core.schemas import AnalyzeMetadata, AssessmentResponse, FeedbackRequest
from app.core.storage import AssessmentStore
from app.detection.audio import AudioInference, YamnetAudioClassifier
from app.detection.fusion import FusionEngine
from app.detection.patterns import PatternRetriever

logger = logging.getLogger(__name__)


def build_router(
    settings: Settings,
    classifier: YamnetAudioClassifier,
    retriever: PatternRetriever,
    fusion: FusionEngine,
    storage: AssessmentStore,
) -> APIRouter:
    router = APIRouter()

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

    @router.get("/metrics")
    async def metrics() -> dict[str, int | float]:
        return await asyncio.to_thread(storage.metrics)

    return router
