from __future__ import annotations

import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass, field

import numpy as np

from app.core.schemas import AnalyzeMetadata, AssessmentResponse
from app.detection.audio import AudioInference
from app.detection.patterns import PatternMatch, PatternRetriever

MODEL_VERSION = "yamnet-rag-fusion-2.0.0"


@dataclass(slots=True)
class WindowEvidence:
    at: float
    audio: float
    motion: float
    fused: float
    multi_signal: bool


@dataclass(slots=True)
class SessionMemory:
    windows: deque[WindowEvidence] = field(default_factory=lambda: deque(maxlen=8))
    last_level: str = "safe"
    last_seen: float = field(default_factory=time.monotonic)
    incident_open_until: float = 0.0


class FusionEngine:
    def __init__(self, retriever: PatternRetriever) -> None:
        self.retriever = retriever
        self._sessions: dict[str, SessionMemory] = {}
        self._lock = threading.Lock()

    @staticmethod
    def _motion_score(metadata: AnalyzeMetadata) -> tuple[float, list[str]]:
        motion = metadata.motion
        if motion.sample_count < 3:
            return 0.0, []
        if motion.impact_after_free_fall:
            return 0.97, ["Ordered free-fall and impact sequence"]

        acceleration = float(np.clip((motion.peak_acceleration_g - 1.35) / 2.3, 0, 1))
        jerk = float(np.clip((motion.jerk_rms - 4.0) / 22.0, 0, 1))
        rotation = float(np.clip((motion.rotation_rms - 65.0) / 320.0, 0, 1))
        score = 0.52 * acceleration + 0.30 * jerk + 0.18 * rotation
        factors: list[str] = []
        if acceleration >= 0.5:
            factors.append(f"High acceleration ({motion.peak_acceleration_g:.1f}g)")
        if jerk >= 0.5:
            factors.append("Repeated abrupt movement")
        if rotation >= 0.5:
            factors.append("Rapid device rotation")
        return float(np.clip(score, 0, 1)), factors

    @staticmethod
    def _fused_score(
        audio: AudioInference,
        motion_score: float,
        matches: list[PatternMatch],
        hour: int,
    ) -> tuple[float, bool, float]:
        rag_risk = max(
            (
                match.similarity * match.pattern.severity
                for match in matches
                if match.pattern.polarity == "risk"
            ),
            default=0.0,
        )
        rag_suppression = max(
            (
                match.similarity * match.pattern.severity
                for match in matches
                if match.pattern.polarity == "suppress"
            ),
            default=0.0,
        )
        has_audio = audio.available
        has_motion = motion_score > 0 or any(
            match.pattern.id in {"fall-sequence", "device-drop"} for match in matches
        )
        if has_audio and has_motion:
            fused = 0.52 * audio.distress_score + 0.36 * motion_score + 0.12 * rag_risk
        elif has_audio:
            fused = 0.79 * audio.distress_score + 0.21 * rag_risk
        else:
            fused = 0.79 * motion_score + 0.21 * rag_risk

        multi_signal = audio.distress_score >= 0.48 and motion_score >= 0.42
        if multi_signal:
            fused += 0.12
        media_penalty = min(max(audio.media_score - audio.distress_score * 0.55, 0) * 0.4, 0.22)
        isolated_suppression = rag_suppression * (0.22 if not multi_signal else 0.06)
        fused *= 1.0 - media_penalty - isolated_suppression
        if hour >= 22 or hour <= 5:
            fused *= 1.03  # Context is bounded and can never create a threat by itself.
        return float(np.clip(fused, 0, 1)), multi_signal, rag_suppression

    def assess(self, metadata: AnalyzeMetadata, audio: AudioInference) -> AssessmentResponse:
        motion_score, motion_factors = self._motion_score(metadata)
        matches = self.retriever.retrieve(audio, metadata.motion, motion_score, metadata.context)
        fused, multi_signal, rag_suppression = self._fused_score(
            audio, motion_score, matches, metadata.context.hour
        )
        now = time.monotonic()

        with self._lock:
            self._expire_sessions(now)
            memory = self._sessions.setdefault(metadata.session_id, SessionMemory())
            memory.last_seen = now
            memory.windows.append(
                WindowEvidence(
                    at=now,
                    audio=audio.distress_score,
                    motion=motion_score,
                    fused=fused,
                    multi_signal=multi_signal,
                )
            )
            recent = list(memory.windows)[-2:]
            persistent_multi = len(recent) == 2 and all(
                item.multi_signal and item.fused >= 0.63 for item in recent
            )
            persistent_audio = len(recent) == 2 and all(item.audio >= 0.7 for item in recent)
            exceptional = (
                audio.distress_score >= 0.88
                and motion_score >= 0.82
                and metadata.motion.impact_after_free_fall
                and rag_suppression < 0.45
            )
            can_open_incident = now >= memory.incident_open_until

            if can_open_incident and (exceptional or persistent_multi):
                level = "sos"
                needs_capture = True
                memory.incident_open_until = now + 120
            elif fused >= 0.56 or persistent_audio or motion_score >= 0.86:
                level = "alert"
                needs_capture = False
            elif fused >= 0.30:
                level = "watch"
                needs_capture = False
            else:
                level = "safe"
                needs_capture = False

            # Hysteresis prevents a one-window jump from Alert straight to Safe.
            if memory.last_level == "alert" and level == "safe":
                level = "watch"
            memory.last_level = level

        factors = [*audio.factors, *motion_factors]
        if multi_signal:
            factors.append("Audio and motion agree")
        if persistent_multi:
            factors.append("Pattern confirmed across consecutive windows")
        if audio.media_score >= 0.35:
            factors.append("Media-playback suppression applied")
        factors = list(dict.fromkeys(factors))[:6]

        if level == "sos":
            explanation = (
                "Multiple independent signals indicate possible distress. "
                "Local evidence capture requested."
            )
        elif level == "alert":
            explanation = "A concerning signal needs a discreet check-in before escalation."
        elif level == "watch":
            explanation = "An unusual signal is being silently validated."
        else:
            explanation = "No confirmed distress pattern is present."

        return AssessmentResponse(
            assessment_id=str(uuid.uuid4()),
            risk_level=level,
            confidence=fused,
            fused_score=fused,
            needs_evidence_capture=needs_capture,
            explanation=explanation,
            factors=factors,
            matched_patterns=[match.public() for match in matches],
            model_version=MODEL_VERSION,
            latency_ms=0,
        )

    def _expire_sessions(self, now: float) -> None:
        expired = [
            session_id
            for session_id, state in self._sessions.items()
            if now - state.last_seen > 3600
        ]
        for session_id in expired:
            del self._sessions[session_id]
