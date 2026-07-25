# SafeCity service API reference

**Service version:** `2.0.0`  
**Implementation:** `service/app/`  
**Default local base URL:** `http://localhost:8000`

The FastAPI service has two roles:

1. a development comparison oracle for audio/motion fusion; and
2. the optional anonymous coarse risk-zone aggregation API.

The mobile app does not call the comparison-oracle routes. It calls only `/v1/risk/reports` and `/v1/risk/zones` when the risk API is configured and the relevant feature is used.

## Security status

No route currently requires authentication. Only the two risk routes have process-local per-network-address rate limiting. The supplied Compose file publishes port `8000` on every host interface.

Treat the full service as development-only unless it is placed behind TLS and access controls. At minimum:

- isolate `/v1/analyze`, `/v1/patterns`, `/v1/feedback`, `/v1/privacy/erase`, and `/metrics`;
- apply shared edge rate limits to public risk endpoints;
- disable or protect interactive documentation in production as appropriate;
- minimize reverse-proxy request, body, and network-address logs; and
- add abuse monitoring and an attestation strategy before relying on community data.

## Discovery

| URL | Purpose |
| --- | --- |
| `/docs` | Swagger UI |
| `/openapi.json` | Generated OpenAPI schema |
| `/redoc` | Disabled |

FastAPI validation errors use the normal `{"detail": [...]}` response. Explicit route errors use `{"detail": "message"}`.

## Endpoint summary

| Method | Path | Role | Authentication | Route rate limit |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | Service/model health | None | None |
| `POST` | `/v1/analyze` | Development PCM comparison assessment | None | None |
| `GET` | `/v1/patterns` | Development pattern catalog | None | None |
| `POST` | `/v1/feedback` | Update comparison assessment feedback | None | None |
| `POST` | `/v1/privacy/erase` | Erase comparison summaries for a device ID | None | None |
| `POST` | `/v1/risk/reports` | Submit one anonymous coarse report | None | Default 30/min/address/process |
| `GET` | `/v1/risk/zones` | Read crowd-thresholded zones | None | Default 120/min/address/process |
| `GET` | `/metrics` | Aggregate comparison/risk counts | None | None |

## `GET /health`

Returns service, model, pattern, and privacy state.

### Response: `200 OK`

```json
{
  "status": "ok",
  "serviceVersion": "2.0.0",
  "model": "Google YAMNet / AudioSet",
  "modelState": "warming",
  "patterns": 8,
  "privacy": "local-summary-only"
}
```

`modelState` is:

- `warming`: model is not loaded and no load error is recorded;
- `ready`: YAMNet is loaded; or
- `degraded`: model loading failed.

The top-level `status` is `degraded` only when `modelState` is degraded. Risk aggregation can still be available when the analyzer model is degraded.

## `POST /v1/analyze`

Runs the Python comparison pipeline. The request body is raw little-endian signed 16-bit mono PCM, not WAV.

### Headers

| Header | Required | Meaning |
| --- | --- | --- |
| `X-SafeCity-Metadata` | Yes | URL-encoded JSON matching `AnalyzeMetadata`; maximum header value length 8192 |
| `Content-Type` | No enforced value | Use `application/octet-stream` |

### Metadata

```json
{
  "deviceId": "device-opaque-id-123",
  "sessionId": "session-opaque-id-123",
  "sampleRate": 16000,
  "motion": {
    "peakAccelerationG": 3.1,
    "jerkRms": 20.0,
    "rotationRms": 210.0,
    "freeFallObserved": false,
    "impactAfterFreeFall": false,
    "sampleCount": 30
  },
  "context": {
    "hour": 21,
    "appState": "active"
  }
}
```

### Validation

| Field | Constraint |
| --- | --- |
| `deviceId` | 8–128 characters |
| `sessionId` | 8–128 characters |
| `sampleRate` | 8,000–48,000; default 16,000 |
| `peakAccelerationG` | 0–20 |
| `jerkRms` | 0–500 |
| `rotationRms` | 0–3,000 |
| `sampleCount` | 0–10,000 |
| `hour` | 0–23 |
| `appState` | Maximum 32 characters |

Default maximum audio body size is 1,048,576 bytes and is configurable with `SAFECITY_MAX_AUDIO_BYTES`.

An empty body is accepted and produces a motion-only comparison assessment.

### Example

```bash
curl --request POST 'http://localhost:8000/v1/analyze' \
  --header 'Content-Type: application/octet-stream' \
  --header 'X-SafeCity-Metadata: %7B%22deviceId%22%3A%22device-opaque-id-123%22%2C%22sessionId%22%3A%22session-opaque-id-123%22%2C%22sampleRate%22%3A16000%2C%22motion%22%3A%7B%22sampleCount%22%3A0%7D%2C%22context%22%3A%7B%22hour%22%3A12%2C%22appState%22%3A%22active%22%7D%7D' \
  --data-binary '@window.pcm'
```

### Response: `200 OK`

```json
{
  "assessmentId": "d516dc7c-398d-4130-9c4e-ec5ab20b51d6",
  "riskLevel": "alert",
  "confidence": 0.64,
  "fusedScore": 0.64,
  "needsEvidenceCapture": false,
  "explanation": "A concerning signal needs a discreet check-in before escalation.",
  "factors": [
    "Audio: Screaming (82%)",
    "High acceleration (3.0g)"
  ],
  "matchedPatterns": [
    {
      "id": "coincident-scream-impact",
      "name": "Distress vocalization with abrupt impact",
      "similarity": 0.84,
      "rationale": "Independent audio and motion signals agree."
    }
  ],
  "modelVersion": "yamnet-rag-fusion-2.0.0",
  "latencyMs": 37.42
}
```

The exact pattern text depends on the loaded pattern file.

### Stored summary

The service stores:

- assessment UUID and timestamp;
- truncated SHA-256 hashes of device and session IDs;
- risk level, fused score, audio score;
- serialized motion features;
- model version, latency, and optional feedback.

It does not store the raw request PCM or a precise location. The SQLite database is not application-level encrypted by this service; protect the host volume.

### Errors

| Status | Cause |
| --- | --- |
| `413` | Declared or actual body exceeds `MAX_AUDIO_BYTES` |
| `422` | Header missing/too long, metadata decode/validation failed |
| `500` | Unexpected storage or route failure |

Audio model errors are caught and degrade to motion-only processing; they do not automatically return an error.

## `GET /v1/patterns`

Returns the public comparison pattern catalog.

### Response: `200 OK`

```json
[
  {
    "id": "media-playback",
    "name": "Likely television or music playback",
    "polarity": "suppress",
    "rationale": "Media audio is a common source of false alarms."
  }
]
```

Severity, thresholds, and full descriptions are intentionally omitted from this route.

## `POST /v1/feedback`

Updates one retained comparison assessment.

### Request

```json
{
  "assessmentId": "d516dc7c-398d-4130-9c4e-ec5ab20b51d6",
  "verdict": "false_positive"
}
```

`verdict` must be `correct`, `false_positive`, or `missed`.

### Response: `200 OK`

```json
{
  "updated": true
}
```

### Errors

| Status | Cause |
| --- | --- |
| `404` | Assessment ID is not retained |
| `422` | Invalid body or verdict |

## `POST /v1/privacy/erase`

Deletes retained comparison summaries whose stored device hash matches the supplied device ID.

### Request

```json
{
  "deviceId": "device-opaque-id-123"
}
```

### Response: `200 OK`

```json
{
  "erased": 4
}
```

Repeated erasure returns `{"erased": 0}`. This route does not erase anonymous risk reports because they intentionally do not contain the comparison device hash.

## `POST /v1/risk/reports`

Accepts one coarse anonymous distress contribution.

### Request

```json
{
  "schemaVersion": 1,
  "cellId": "r1:46826:27327",
  "timeBucket": "2026-07-25T08:00:00.000Z",
  "eventKind": "manual_sos",
  "accuracyBand": "good",
  "dedupeToken": "bc953b9ab864fd3e6fca2ddabe8ea258b3207704a0b8a896fc1890e414a56b15"
}
```

### Validation

| Field | Constraint |
| --- | --- |
| `schemaVersion` | Exactly `1` |
| `cellId` | `r1:x:y`; x/y must decode inside the zoom-16 Web Mercator grid |
| `timeBucket` | Timezone required; minute/second/microsecond must be zero |
| `eventKind` | `manual_sos`, `voice_sos`, `motion_sos`, `audio_sos`, or `confirmed_distress` |
| `accuracyBand` | `good` or `fair` |
| `dedupeToken` | 64 lowercase hexadecimal characters |

Unknown fields are forbidden, so precise `latitude` or `longitude` fields are rejected.

The time bucket may be at most five minutes in the future and, by default, no more than 48 hours old.

### Response: `202 Accepted`

```json
{
  "accepted": true
}
```

`accepted: false` means the dedupe token already existed. The response does not reveal any other report.

Response header:

```text
Cache-Control: no-store
```

### Errors

| Status | Cause |
| --- | --- |
| `422` | Schema, cell, hour, future-time, or age validation failed |
| `429` | Process-local per-address limit exceeded |

The built-in limiter uses `request.client.host`. Configure proxy topology and trusted forwarding deliberately; a shared edge limiter is required for multiple workers/instances.

## `GET /v1/risk/zones`

Returns recent crowd-thresholded coarse zones.

### Query parameters

| Parameter | Required | Constraint |
| --- | --- | --- |
| `south` | Yes | `-90..90` |
| `west` | Yes | `-180..180` |
| `north` | Yes | `-90..90`, greater than south |
| `east` | Yes | `-180..180`, greater than west |
| `hours` | No | `>=1`, default `24`, no more than configured maximum |

Latitude and longitude spans must each be no more than `ANONYMOUS_RISK_MAX_BBOX_SPAN_DEGREES`, default 1 degree. Antimeridian-wrapping boxes are not supported.

### Example

```bash
curl 'http://localhost:8000/v1/risk/zones?south=28.55&west=77.15&north=28.68&east=77.28&hours=48'
```

### Response: `200 OK`

```json
{
  "generatedAt": "2026-07-25T08:25:00Z",
  "windowHours": 48,
  "zones": [
    {
      "cellId": "r1:46826:27327",
      "latitude": 28.615401,
      "longitude": 77.208252,
      "intensity": 0.421,
      "radiusMeters": 381,
      "riskBand": "emerging"
    }
  ],
  "privacy": {
    "locationPrecision": "approximately 500 metre coarse cells",
    "timePrecision": "one hour buckets",
    "minimumReports": 3,
    "exactCountsExposed": false,
    "rawLocationsStored": false
  }
}
```

`generatedAt` is rounded down to a five-minute boundary.

Response header:

```text
Cache-Control: public, max-age=300, stale-while-revalidate=600
```

### Aggregation

- Reports are grouped by coarse cell inside the requested box/window.
- Cells below the configured minimum are hidden.
- Event and accuracy bands apply reviewed weights.
- Each report decays with a 24-hour half-life.
- Intensity is bounded to `0..1`.
- Bands are based on threshold multiples: emerging, elevated, high.
- At most 250 zones are returned, ordered by intensity.
- Exact counts, tokens, categories, and individual timestamps are not returned.

### Errors

| Status | Cause |
| --- | --- |
| `422` | Invalid/inverted/oversized bbox or oversized time window |
| `429` | Process-local per-address limit exceeded |

## `GET /metrics`

Returns aggregate database counters.

### Response: `200 OK`

```json
{
  "assessments": 120,
  "safe": 84,
  "watch": 18,
  "alert": 16,
  "sos": 2,
  "reviewed": 12,
  "falsePositiveRateAmongReviewed": 0.1666666667,
  "anonymousReports": 48,
  "coarseCells": 9
}
```

This route is unauthenticated and should not be exposed publicly without an explicit observability/privacy decision.

## Configuration example

```text
SAFECITY_MODEL_PRELOAD=true
SAFECITY_DATABASE_PATH=/data/safecity-inference.db
SAFECITY_PATTERN_PATH=/app/app/knowledge/patterns.json
SAFECITY_CUSTOM_PATTERN_PATH=/data/patterns.local.json
SAFECITY_MAX_AUDIO_BYTES=1048576
SAFECITY_ASSESSMENT_RETENTION_DAYS=14
SAFECITY_ANONYMOUS_RISK_RETENTION_DAYS=30
SAFECITY_ANONYMOUS_RISK_MINIMUM_REPORTS=3
SAFECITY_ANONYMOUS_RISK_MAX_REPORT_AGE_HOURS=48
SAFECITY_ANONYMOUS_RISK_MAX_WINDOW_HOURS=168
SAFECITY_ANONYMOUS_RISK_MAX_BBOX_SPAN_DEGREES=1
SAFECITY_ANONYMOUS_RISK_POST_LIMIT_PER_MINUTE=30
SAFECITY_ANONYMOUS_RISK_GET_LIMIT_PER_MINUTE=120
```

## Compatibility and versioning

- JSON field names are camelCase.
- Risk report `schemaVersion` is currently `1`.
- Risk cell identifiers are currently `r1`.
- No URL-level API version exists for `/health` or `/metrics`.
- The comparison response model version is separate from the service version.
- Breaking schema, threshold, privacy, retention, or aggregation changes require coordinated mobile/service rollout and documentation review.
