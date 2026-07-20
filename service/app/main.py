from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes import build_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.storage import AssessmentStore
from app.detection.audio import YamnetAudioClassifier
from app.detection.fusion import FusionEngine
from app.detection.patterns import PatternRetriever

settings = get_settings()
configure_logging(settings.log_level)
classifier = YamnetAudioClassifier(settings.model_url, settings.model_threads)
retriever = PatternRetriever(settings.pattern_path, settings.custom_pattern_path)
fusion = FusionEngine(retriever)
storage = AssessmentStore(settings.database_path, settings.assessment_retention_days)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.model_preload:
        app.state.model_task = asyncio.create_task(asyncio.to_thread(classifier.load))
    yield
    task = getattr(app.state, "model_task", None)
    if task and not task.done():
        task.cancel()


app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description=(
        "Local audio, motion, and retrieved-pattern assessment. Raw audio is never persisted."
    ),
    docs_url="/docs",
    redoc_url=None,
    lifespan=lifespan,
)
app.include_router(build_router(settings, classifier, retriever, fusion, storage))

