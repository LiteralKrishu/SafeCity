# SafeCity architecture

## Trust boundary

The mobile device is the inference and storage trust boundary. The production app does not require or call a laptop, LAN API or cloud model. The Python service in this repository is retained only as a development comparison oracle and is outside the mobile runtime path.

```text
Expo / React Native app
  ├─ PCM stream (0.975 s inference + 15 s RAM ring) ─> YAMNet ─────┐
  ├─ optional bundled Help/Bachao keyword spotter ─────────────────┤
  ├─ DeviceMotion ─> acceleration/jerk/rotation/fall features ──────┼─> local patterns
  └─ hour + app-state (bounded context) ─────────────────────────────┘   + temporal fusion
                                                                         └─ transient result

Confirmed SOS
  ├─ 15 s pre-alert WAV ┐
  ├─ rear still photo ──┤
  ├─ front still photo ─┼─> AES-GCM ─> app-private document storage
  └─ 15 s post audio ───┘
```

## Mobile modules

- `MonitoringProvider`: owns the native PCM stream, motion subscription, adaptive cadence, battery-saver state, session lifecycle, local inference and SOS transition. DeviceMotion acceleration is normalized from m/s² to g before feature extraction. GPS is not refreshed for every inference window.
- `DatabaseProvider`: obtains a random 256-bit database key from platform SecureStore, applies the SQLCipher key before migrations, and enables WAL.
- `capture.tsx`: suspends the monitoring stream, records evidence, switches rear → front cameras, encrypts each result, updates the incident atomically, and resumes monitoring.
- `backgroundLocation.ts`: keeps only the latest location and uses the required visible OS background indicator.
- `voice-trigger.ts`: copies the bundled quantized Sherpa-ONNX files into private cache, feeds the existing 16 kHz PCM stream into a serialized one-thread keyword spotter, and emits only `HELP` or `BACHAO`.
- `safeRoute.ts`: retrieves user-requested OpenStreetMap facilities and lighting context; generated locations are never used as a data fallback.
- `monitorStore.ts`: contains transient UI state only; durable history stays in SQLite.

## On-device inference modules

- `onDeviceAudio.ts`: lazy-loads the APK-bundled 3.9 MB YAMNet TFLite model through the native C++ runtime, converts/resamples PCM to a fixed 15,600-sample float32 waveform, applies a conservative silence gate and scores distress/media classes. Inference runs asynchronously and is serialized to bound memory use.
- `localFusion.ts`: calculates motion risk, evaluates six inspectable risk/suppressor patterns, combines available modalities, applies bounded context, maintains the last eight windows per session, and enforces confirmation, hysteresis and incident cooldown.
- `MonitoringProvider.tsx`: retains only the latest audio tail in memory and schedules ordinary inference at 3 seconds foreground, 5 seconds background or 6 seconds in battery saver. Concerning motion temporarily uses 1.2 seconds, or 2 seconds in battery saver.
- No ordinary inference summary is written to durable storage. Only an escalated incident is stored in the encrypted database.

The optional `service/` implementation mirrors the earlier server-side policy for comparison tests. It is not imported by the app, is not packaged into the APK and is not a deployment dependency.

## Failure behavior

| Failure | Safe behavior |
| --- | --- |
| Bundled model fails to load | Motion-only local fallback; automatic audio-motion SOS is disabled; manual SOS remains available |
| Microphone denied | Motion monitoring continues with visibly degraded health |
| Motion unavailable | Audio may request check-in but cannot automatically SOS |
| Location denied | Incident is stored without a location; detection is unchanged |
| Bundled keyword engine fails to load | Voice trigger shows an error; scream, motion and manual SOS remain available |
| Nearby-place request fails | No pins are fabricated; Maps search and 112 remain available |
| Camera denied/backgrounded | Incident remains active; available audio is saved; missing evidence is explicit |
| SMS unavailable | Incident stays local and UI shows the failure; no delivery claim |
| App killed | OS monitoring stops; no claim of continuous protection |

## Production gaps

This repository is a safety-oriented MVP, not a release-certified product. A production pilot still requires a protected release keystore, signed model/config update and rollback controls, a reviewed delivery provider, a representative consented dataset, real-device background tests, battery and thermal profiling, accessibility review, mobile security review, completed Data Fiduciary and grievance contacts, language access, operational rights and breach procedures, applicable processor contracts, and Indian legal/privacy review. See [DPDP_COMPLIANCE.md](DPDP_COMPLIANCE.md).
