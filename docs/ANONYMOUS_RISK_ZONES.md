# Anonymous community risk zones

## What ships

SafeCity can optionally turn confirmed distress events into recent community risk zones:

1. The phone converts the available GPS fix into a Web Mercator zoom-16 cell before any network request. Around Indian latitudes, a cell is roughly 500–600 metres wide.
2. The phone rounds the event time to one hour and assigns a broad trigger category.
3. A random secret in platform SecureStore creates a SHA-256 token that changes for every cell and day. The secret never leaves the phone. This prevents one installation from repeatedly inflating the same cell without creating a stable cross-cell identifier.
4. The encrypted SQLite retry queue contains only the coarse payload. Failed uploads never block SOS and retry at startup.
5. The FastAPI service stores coarse reports for at most 30 days. It rejects unknown fields, including precise latitude and longitude.
6. A cell is returned only after at least three accepted contributions. The API publishes an intensity band, never exact counts, individual timestamps, tokens or trigger categories.

This is a privacy reduction, not a mathematical guarantee of anonymity. Sparse populations, coordinated false reports, compromised clients and infrastructure logs outside this repository remain deployment risks.

## API

### Submit one coarse report

`POST /v1/risk/reports`

```json
{
  "schemaVersion": 1,
  "cellId": "r1:46826:27327",
  "timeBucket": "2026-07-25T08:00:00.000Z",
  "eventKind": "manual_sos",
  "accuracyBand": "good",
  "dedupeToken": "64-lowercase-hex-characters"
}
```

The endpoint returns HTTP 202. `accepted: false` means the rotating token was already present; the response deliberately does not disclose any other report.

### Read visible zones

`GET /v1/risk/zones?south=...&west=...&north=...&east=...&hours=48`

Map queries are centred on the viewer's coarse cell rather than pinpoint GPS. The server bounds time windows and geographic spans, rate-limits reads and returns a five-minute cacheable snapshot.

## Configuration

Backend settings use the `SAFECITY_` prefix and are listed in `service/.env.example`. Important production values are:

- `ANONYMOUS_RISK_MINIMUM_REPORTS`: default 3; raise this for sparse-area privacy after a population-risk review.
- `ANONYMOUS_RISK_RETENTION_DAYS`: default 30.
- `ANONYMOUS_RISK_MAX_REPORT_AGE_HOURS`: default 48.
- `ANONYMOUS_RISK_POST_LIMIT_PER_MINUTE`: default 30 per network address and process.
- `ANONYMOUS_RISK_GET_LIMIT_PER_MINUTE`: default 120 per network address and process.

Build the mobile app with an HTTPS endpoint:

```text
EXPO_PUBLIC_RISK_API_BASE_URL=https://risk-api.example.com
```

The setting remains off until the user confirms it in **Settings → Privacy and data → Anonymous community risk zones**.

## Map renderer compatibility

The API returns weighted cell centres and radii, so it is renderer-independent. SafeCity's existing in-app OSM/CARTO map renders concentric weighted zones without adding a location SDK or API key.

The Google Maps JavaScript Heatmap Layer was decommissioned in May 2026. A web Google Maps client should use Google's documented deck.gl integration. Native Android clients can convert each response zone into `WeightedLatLng` data for the still-supported Maps SDK for Android Utility Library `HeatmapTileProvider`.

## Production rollout

Do not deploy this service directly from a developer machine.

- Put it behind TLS, a privacy-reviewed reverse proxy and infrastructure configured not to retain full network addresses or request bodies.
- Keep the supplied Uvicorn access log disabled. Review load-balancer, CDN, WAF, crash-reporting and database backup logs separately.
- Use a shared edge rate limiter for multi-worker or multi-instance deployments; the built-in limiter is intentionally process-local.
- Add platform attestation and abuse monitoring before treating the map as resistant to coordinated poisoning. Never let a risk zone trigger SOS or label a route as safe.
- Start with a feature flag and a limited geographic pilot. Monitor only aggregate accept/reject/latency/expiry metrics.
- Verify deletion, backup expiry, TLS, alerting and rollback in staging before production.

## Verification

```bash
cd service
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests

cd ../mobile
npx tsc --noEmit
```

The tests enforce crowd-threshold hiding, rotating-token deduplication, rejection of precise-coordinate fields and omission of counts/tokens/timestamps from public zone responses.
