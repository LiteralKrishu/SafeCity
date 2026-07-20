import json
from urllib.parse import quote

from fastapi.testclient import TestClient

from app.main import app


def test_health_describes_local_privacy_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/health")
    assert response.status_code == 200
    payload = response.json()
    assert payload["privacy"] == "local-summary-only"
    assert payload["patterns"] >= 6


def test_invalid_metadata_is_rejected() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/v1/analyze",
            content=b"",
            headers={"X-SafeCity-Metadata": "%7B%22invalid%22%3Atrue%7D"},
        )
    assert response.status_code == 422


def test_device_data_can_be_erased() -> None:
    device_id = "device-erasure-test-123"
    metadata = quote(
        json.dumps(
            {
                "deviceId": device_id,
                "sessionId": "session-erasure-test-123",
                "sampleRate": 16_000,
                "motion": {"sampleCount": 0},
                "context": {"hour": 12, "appState": "active"},
            }
        )
    )

    with TestClient(app) as client:
        assessment = client.post(
            "/v1/analyze",
            content=b"",
            headers={"X-SafeCity-Metadata": metadata},
        )
        assert assessment.status_code == 200

        erased = client.post("/v1/privacy/erase", json={"deviceId": device_id})
        assert erased.status_code == 200
        assert erased.json()["erased"] >= 1

        erased_again = client.post("/v1/privacy/erase", json={"deviceId": device_id})
        assert erased_again.json() == {"erased": 0}
