from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.schemas import AnonymousDistressReport
from app.main import app
from app.risk.grid import decode_cell_id, location_to_cell_id
from app.risk.storage import AnonymousRiskStore


def _hour_bucket() -> datetime:
    return datetime.now(UTC).replace(minute=0, second=0, microsecond=0)


def _report(cell_id: str, suffix: str) -> AnonymousDistressReport:
    return AnonymousDistressReport(
        schemaVersion=1,
        cellId=cell_id,
        timeBucket=_hour_bucket(),
        eventKind="manual_sos",
        accuracyBand="good",
        dedupeToken=hashlib.sha256(suffix.encode()).hexdigest(),
    )


def test_grid_discards_pinpoint_precision() -> None:
    cell_id = location_to_cell_id(28.6139, 77.2090)
    cell = decode_cell_id(cell_id)

    assert cell_id.startswith("r1:")
    assert abs(cell.latitude - 28.6139) > 0.00001
    assert abs(cell.longitude - 77.2090) > 0.00001
    assert 180 <= cell.radius_meters <= 600


def test_aggregation_hides_cells_below_minimum_crowd(
    tmp_path: Path,
) -> None:
    store = AnonymousRiskStore(tmp_path / "risk.db", retention_days=30, minimum_reports=3)
    cell_id = location_to_cell_id(28.6139, 77.2090)
    cell = decode_cell_id(cell_id)
    for index in range(2):
        assert store.save(_report(cell_id, f"hidden-{index}"))

    hidden = store.aggregate(
        south=cell.latitude - 0.02,
        west=cell.longitude - 0.02,
        north=cell.latitude + 0.02,
        east=cell.longitude + 0.02,
        hours=24,
    )
    assert hidden == []

    assert store.save(_report(cell_id, "visible-3"))
    visible = store.aggregate(
        south=cell.latitude - 0.02,
        west=cell.longitude - 0.02,
        north=cell.latitude + 0.02,
        east=cell.longitude + 0.02,
        hours=24,
    )
    assert len(visible) == 1
    assert visible[0].cell_id == cell_id


def test_duplicate_rotating_token_cannot_inflate_a_zone(tmp_path: Path) -> None:
    store = AnonymousRiskStore(tmp_path / "dedupe.db", retention_days=30, minimum_reports=3)
    cell_id = location_to_cell_id(22.5726, 88.3639)
    report = _report(cell_id, "same-phone-cell-day")

    assert store.save(report)
    assert not store.save(report)
    assert store.metrics()["anonymousReports"] == 1


def test_api_rejects_precise_location_fields() -> None:
    cell_id = location_to_cell_id(19.0760, 72.8777)
    payload = _report(cell_id, f"extra-field-{datetime.now(UTC).timestamp()}").model_dump(
        by_alias=True,
        mode="json",
    )
    payload["latitude"] = 19.0760
    payload["longitude"] = 72.8777

    with TestClient(app) as client:
        response = client.post("/v1/risk/reports", json=payload)

    assert response.status_code == 422


def test_api_aggregates_only_after_privacy_threshold() -> None:
    cell_id = location_to_cell_id(12.9716, 77.5946)
    cell = decode_cell_id(cell_id)
    with TestClient(app) as client:
        for _ in range(3):
            payload = _report(cell_id, str(uuid4())).model_dump(
                by_alias=True,
                mode="json",
            )
            submitted = client.post("/v1/risk/reports", json=payload)
            assert submitted.status_code == 202

        response = client.get(
            "/v1/risk/zones",
            params={
                "south": cell.latitude - 0.02,
                "west": cell.longitude - 0.02,
                "north": cell.latitude + 0.02,
                "east": cell.longitude + 0.02,
                "hours": 24,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert any(zone["cellId"] == cell_id for zone in body["zones"])
    assert body["privacy"] == {
        "locationPrecision": "approximately 500 metre coarse cells",
        "timePrecision": "one hour buckets",
        "minimumReports": 3,
        "exactCountsExposed": False,
        "rawLocationsStored": False,
    }


def test_zone_api_never_exposes_counts_tokens_or_event_times(tmp_path: Path) -> None:
    # The store-level contract verifies the aggregation output independently of
    # the app-global test database used by the comparison-oracle endpoints.
    store = AnonymousRiskStore(tmp_path / "public.db", retention_days=30, minimum_reports=3)
    cell_id = location_to_cell_id(23.2599, 77.4126)
    cell = decode_cell_id(cell_id)
    for index in range(3):
        store.save(_report(cell_id, f"public-{index}"))

    zone = store.aggregate(
        south=cell.latitude - 0.02,
        west=cell.longitude - 0.02,
        north=cell.latitude + 0.02,
        east=cell.longitude + 0.02,
        hours=24,
    )[0].model_dump(by_alias=True)

    assert "reportCount" not in zone
    assert "dedupeToken" not in zone
    assert "timeBucket" not in zone
    assert set(zone) == {
        "cellId",
        "latitude",
        "longitude",
        "intensity",
        "radiusMeters",
        "riskBand",
    }
