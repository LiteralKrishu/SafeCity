from __future__ import annotations

import hashlib
import sqlite3
import threading
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.core.schemas import AnalyzeMetadata, AssessmentResponse
from app.detection.audio import AudioInference


class AssessmentStore:
    """Local summaries only; raw audio and precise locations are intentionally excluded."""

    def __init__(self, path: Path, retention_days: int) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.retention_days = retention_days
        self._lock = threading.Lock()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10)
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA busy_timeout=5000")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS assessments (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    device_hash TEXT NOT NULL,
                    session_hash TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    fused_score REAL NOT NULL,
                    audio_score REAL NOT NULL,
                    motion_json TEXT NOT NULL,
                    model_version TEXT NOT NULL,
                    latency_ms REAL NOT NULL,
                    feedback TEXT
                );
                CREATE INDEX IF NOT EXISTS assessments_created_idx ON assessments(created_at);
                CREATE INDEX IF NOT EXISTS assessments_level_idx ON assessments(risk_level);
                """
            )

    @staticmethod
    def _hash(value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()[:20]

    def save(
        self,
        metadata: AnalyzeMetadata,
        audio: AudioInference,
        assessment: AssessmentResponse,
    ) -> None:
        motion_json = metadata.motion.model_dump_json()
        with self._lock, self._connect() as connection:
            connection.execute(
                """INSERT INTO assessments (
                    id, created_at, device_hash, session_hash, risk_level, fused_score,
                    audio_score, motion_json, model_version, latency_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    assessment.assessment_id,
                    datetime.now(UTC).isoformat(),
                    self._hash(metadata.device_id),
                    self._hash(metadata.session_id),
                    assessment.risk_level,
                    assessment.fused_score,
                    audio.distress_score,
                    motion_json,
                    assessment.model_version,
                    assessment.latency_ms,
                ),
            )
            cutoff = (datetime.now(UTC) - timedelta(days=self.retention_days)).isoformat()
            connection.execute("DELETE FROM assessments WHERE created_at < ?", (cutoff,))

    def set_feedback(self, assessment_id: str, verdict: str) -> bool:
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                "UPDATE assessments SET feedback = ? WHERE id = ?", (verdict, assessment_id)
            )
            return cursor.rowcount == 1

    def metrics(self) -> dict[str, int | float]:
        with self._connect() as connection:
            total = connection.execute("SELECT COUNT(*) FROM assessments").fetchone()[0]
            levels = dict(
                connection.execute(
                    "SELECT risk_level, COUNT(*) FROM assessments GROUP BY risk_level"
                ).fetchall()
            )
            false_positives = connection.execute(
                "SELECT COUNT(*) FROM assessments WHERE feedback = 'false_positive'"
            ).fetchone()[0]
            reviewed = connection.execute(
                "SELECT COUNT(*) FROM assessments WHERE feedback IS NOT NULL"
            ).fetchone()[0]
        return {
            "assessments": total,
            "safe": levels.get("safe", 0),
            "watch": levels.get("watch", 0),
            "alert": levels.get("alert", 0),
            "sos": levels.get("sos", 0),
            "reviewed": reviewed,
            "falsePositiveRateAmongReviewed": false_positives / reviewed if reviewed else 0.0,
        }
