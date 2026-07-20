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

