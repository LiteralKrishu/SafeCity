from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from app.core.schemas import ContextFeatures, MotionFeatures, RetrievedPattern
from app.detection.audio import AudioInference

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class Pattern:
    id: str
    name: str
    description: str
    polarity: str
    severity: float
    min_audio: float
    min_motion: float
    rationale: str


@dataclass(frozen=True, slots=True)
class PatternMatch:
    pattern: Pattern
    similarity: float

    def public(self) -> RetrievedPattern:
        return RetrievedPattern(
            id=self.pattern.id,
            name=self.pattern.name,
            similarity=self.similarity,
            rationale=self.pattern.rationale,
        )


class PatternRetriever:
    """Small, inspectable sparse-RAG index over safety and false-positive patterns."""

    def __init__(self, base_path: Path, custom_path: Path | None = None) -> None:
        self.patterns = self._load(base_path, custom_path)
        self.vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, norm="l2")
        corpus = [f"{item.name} {item.description} {item.rationale}" for item in self.patterns]
        self.pattern_vectors = self.vectorizer.fit_transform(corpus)

    @staticmethod
    def _load(base_path: Path, custom_path: Path | None) -> list[Pattern]:
        documents: list[dict] = json.loads(base_path.read_text(encoding="utf-8"))
        if custom_path and custom_path.exists():
            try:
                custom = json.loads(custom_path.read_text(encoding="utf-8"))
                documents.extend(custom)
            except (OSError, json.JSONDecodeError, TypeError):
                logger.exception("Ignoring invalid custom pattern file: %s", custom_path)
        return [Pattern(**document) for document in documents]

    @staticmethod
    def describe_window(
        audio: AudioInference,
        motion: MotionFeatures,
        context: ContextFeatures,
    ) -> str:
        tokens: list[str] = []
        tokens.extend(label for label, score in audio.top_classes if score >= 0.12)
        if audio.distress_score >= 0.65:
            tokens.extend(["persistent distress vocalization", "scream shout crying"])
        elif audio.distress_score >= 0.3:
            tokens.append("possible loud distress audio")
        if audio.media_score >= 0.3:
            tokens.extend(["television radio music media playback sound effect"])
        if motion.impact_after_free_fall:
            tokens.extend(["free fall followed by strong impact", "possible fall"])
        elif motion.peak_acceleration_g >= 2.5:
            tokens.append("single isolated impact spike")
        if motion.jerk_rms >= 10:
            tokens.append("repeated strong jerk chaotic movement")
        if motion.rotation_rms >= 180:
            tokens.append("rapid repeated rotation")
        if motion.sample_count and audio.distress_score < 0.2:
            tokens.append("without distress audio")
        if not motion.impact_after_free_fall:
            tokens.append("without free fall impact sequence")
        if context.app_state != "active":
            tokens.append("app backgrounded")
        return " ".join(tokens) or "ordinary quiet window no distress evidence"

    def retrieve(
        self,
        audio: AudioInference,
        motion: MotionFeatures,
        motion_score: float,
        context: ContextFeatures,
        limit: int = 3,
    ) -> list[PatternMatch]:
        query = self.describe_window(audio, motion, context)
        query_vector = self.vectorizer.transform([query])
        similarities = (query_vector @ self.pattern_vectors.T).toarray()[0]
        matches: list[PatternMatch] = []
        for index in np.argsort(similarities)[::-1]:
            pattern = self.patterns[int(index)]
            similarity = float(similarities[index])
            if similarity < 0.08:
                continue
            if audio.distress_score < pattern.min_audio:
                similarity *= 0.35
            if motion_score < pattern.min_motion:
                similarity *= 0.35
            if pattern.id == "media-playback" and audio.media_score < 0.25:
                similarity *= 0.2
            if pattern.id == "fall-sequence" and not motion.impact_after_free_fall:
                similarity *= 0.2
            if pattern.id == "device-drop" and motion.impact_after_free_fall:
                similarity *= 0.15
            if similarity >= 0.06:
                matches.append(PatternMatch(pattern=pattern, similarity=min(similarity, 1.0)))
            if len(matches) == limit:
                break
        return matches

