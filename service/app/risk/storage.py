from __future__ import annotations

import math
import sqlite3
import threading
from collections import Counter, defaultdict
from datetime import UTC, datetime, timedelta
from pathlib import Path

from app.core.schemas import AnonymousDistressReport, RiskZone
from app.risk.grid import cell_is_inside_bbox, decode_cell_id

_EVENT_WEIGHTS = {
    "manual_sos": 1.0,
    "voice_sos": 1.0,
    "motion_sos": 0.72,
    "audio_sos": 0.68,
    "confirmed_distress": 0.9,
}
_ACCURACY_WEIGHTS = {"good": 1.0, "fair": 0.88}


class AnonymousRiskStore:
    """Stores coarse, unlinkable distress summaries; precise coordinates are unsupported."""

    def __init__(self, path: Path, retention_days: int, minimum_reports: int) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.retention_days = retention_days
        self.minimum_reports = minimum_reports
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
                CREATE TABLE IF NOT EXISTS anonymous_distress_reports (
                    dedupe_token TEXT PRIMARY KEY NOT NULL,
                    cell_id TEXT NOT NULL,
                    time_bucket TEXT NOT NULL,
                    event_kind TEXT NOT NULL,
                    accuracy_band TEXT NOT NULL,
                    received_bucket TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS anonymous_reports_time_idx
                    ON anonymous_distress_reports(time_bucket);
                CREATE INDEX IF NOT EXISTS anonymous_reports_cell_idx
                    ON anonymous_distress_reports(cell_id, time_bucket);
                """
            )

    @staticmethod
    def _bucket(value: datetime) -> str:
        return (
            value.astimezone(UTC)
            .replace(minute=0, second=0, microsecond=0)
            .isoformat()
        )

    def save(self, report: AnonymousDistressReport, now: datetime | None = None) -> bool:
        decode_cell_id(report.cell_id)
        received_at = now or datetime.now(UTC)
        cutoff = self._bucket(received_at - timedelta(days=self.retention_days))
        with self._lock, self._connect() as connection:
            connection.execute(
                "DELETE FROM anonymous_distress_reports WHERE time_bucket < ?",
                (cutoff,),
            )
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO anonymous_distress_reports (
                    dedupe_token, cell_id, time_bucket, event_kind,
                    accuracy_band, received_bucket
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    report.dedupe_token,
                    report.cell_id,
                    self._bucket(report.time_bucket),
                    report.event_kind,
                    report.accuracy_band,
                    self._bucket(received_at),
                ),
            )
            return cursor.rowcount == 1

    def aggregate(
        self,
        *,
        south: float,
        west: float,
        north: float,
        east: float,
        hours: int,
        now: datetime | None = None,
        limit: int = 250,
    ) -> list[RiskZone]:
        current = (now or datetime.now(UTC)).astimezone(UTC)
        cutoff = self._bucket(current - timedelta(hours=hours))
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT cell_id, time_bucket, event_kind, accuracy_band
                FROM anonymous_distress_reports
                WHERE time_bucket >= ?
                """,
                (cutoff,),
            ).fetchall()

        grouped: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
        for cell_id, time_bucket, event_kind, accuracy_band in rows:
            cell = decode_cell_id(cell_id)
            if cell_is_inside_bbox(
                cell,
                south=south,
                west=west,
                north=north,
                east=east,
            ):
                grouped[cell_id].append((time_bucket, event_kind, accuracy_band))

        zones: list[RiskZone] = []
        for cell_id, reports in grouped.items():
            report_count = len(reports)
            if report_count < self.minimum_reports:
                continue

            weighted_score = 0.0
            kinds: Counter[str] = Counter()
            for time_bucket, event_kind, accuracy_band in reports:
                observed_at = datetime.fromisoformat(time_bucket).astimezone(UTC)
                age_hours = max(0.0, (current - observed_at).total_seconds() / 3_600)
                decay = 0.5 ** (age_hours / 24)
                weighted_score += (
                    _EVENT_WEIGHTS[event_kind]
                    * _ACCURACY_WEIGHTS[accuracy_band]
                    * decay
                )
                kinds[event_kind] += 1

            intensity = round(min(1.0, 1 - math.exp(-weighted_score / 4)), 3)
            if report_count >= self.minimum_reports * 4:
                risk_band = "high"
            elif report_count >= self.minimum_reports * 2:
                risk_band = "elevated"
            else:
                risk_band = "emerging"

            cell = decode_cell_id(cell_id)
            zones.append(
                RiskZone(
                    cell_id=cell.cell_id,
                    latitude=cell.latitude,
                    longitude=cell.longitude,
                    intensity=intensity,
                    radius_meters=cell.radius_meters,
                    risk_band=risk_band,
                )
            )

        zones.sort(key=lambda zone: zone.intensity, reverse=True)
        return zones[:limit]

    def metrics(self) -> dict[str, int]:
        with self._connect() as connection:
            reports = connection.execute(
                "SELECT COUNT(*) FROM anonymous_distress_reports"
            ).fetchone()[0]
            cells = connection.execute(
                "SELECT COUNT(DISTINCT cell_id) FROM anonymous_distress_reports"
            ).fetchone()[0]
        return {"anonymousReports": reports, "coarseCells": cells}
