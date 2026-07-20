# SafeCity architecture

## Trust boundary

The mobile device and the user's local inference computer are the only trusted processing locations. The service binds to port 8000 for LAN development but has no cloud integration, user account, or provider secret. It must stay behind a trusted firewall.

```text
Expo app
  ├─ PCM stream (1.5 s, ephemeral) ───────┐
  ├─ DeviceMotion features ───────────────┼─> FastAPI on local Docker
  └─ Hour + app-state context ────────────┘      ├─ YAMNet / AudioSet
                                                  ├─ pattern retriever
                                                  ├─ temporal fusion
                                                  └─ summary-only SQLite

Confirmed SOS
  ├─ rear still photo ──┐
  ├─ front still photo ─┼─> AES-GCM ─> app-private document storage
  └─ 15 s audio ────────┘
```

## Mobile modules

- `MonitoringProvider`: owns the native PCM stream, motion subscription, session lifecycle, service calls, local fallback, and SOS transition. DeviceMotion acceleration is normalized from m/s² to g before feature extraction.
- `DatabaseProvider`: obtains a random 256-bit database key from platform SecureStore, applies the SQLCipher key before migrations, and enables WAL.
- `capture.tsx`: suspends the monitoring stream, records evidence, switches rear → front cameras, encrypts each result, updates the incident atomically, and resumes monitoring.
- `backgroundLocation.ts`: keeps only the latest location and uses the required visible OS background indicator.
- `monitorStore.ts`: contains transient UI state only; durable history stays in SQLite.

## Inference modules

- `audio.py`: lazy-loads Google YAMNet, normalizes/resamples PCM to mono 16 kHz, scores distress classes, measures persistence, and applies media confounder penalties.
- `patterns.py`: builds a local TF-IDF index over approved positive and suppressor patterns. Custom patterns can be added through the Docker data volume without sending data externally.
- `fusion.py`: combines available modalities, applies bounded context, maintains per-session windows, enforces confirmation, hysteresis, and incident cooldown.
- `storage.py`: stores hashed device/session identifiers and derived summaries only. Raw audio and precise location are excluded.

## Failure behavior

| Failure | Safe behavior |
| --- | --- |
| Inference service offline | Motion-only local fallback; automatic SOS disabled; manual SOS remains available |
| Microphone denied | Motion monitoring continues with visibly degraded health |
| Motion unavailable | Audio may request check-in but cannot automatically SOS |
| Location denied | Incident is stored without a location; detection is unchanged |
| Camera denied/backgrounded | Incident remains active; available audio is saved; missing evidence is explicit |
| SMS unavailable | Incident stays local and UI shows the failure; no delivery claim |
| App killed | OS monitoring stops; no claim of continuous protection |

## Production gaps

This repository is a safety-oriented MVP, not a release-certified product. A production pilot still requires TLS or authenticated local pairing, signed model/config updates, a reviewed delivery provider, a representative consented dataset, real-device background tests, battery profiling, accessibility review, security review, and regional legal/privacy review.
