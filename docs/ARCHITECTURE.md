# SafeCity architecture

## Trust boundary

The mobile device remains the inference and evidence-storage trust boundary. Monitoring audio, motion inference, contacts and evidence do not require or call a laptop, LAN API or cloud model. An optional, separately consented risk-zone path sends only a coarse location cell and hourly distress summary to the aggregation endpoints in the Python service.

```text
Expo / React Native app
  ├─ PCM stream (0.975 s inference + 15 s RAM ring) ─> YAMNet ─────┐
  ├─ optional emergency + multilingual threat phrase spotter ─────┤
  ├─ DeviceMotion ─> acceleration/jerk/rotation/fall features ──────┼─> local patterns
  ├─ optional coarse routine cell/motion/speed baseline ────────────┤   + temporal fusion
  └─ hour + app-state (bounded context) ─────────────────────────────┘
                                                                         └─ transient result

Confirmed SOS
  ├─ 15 s pre-alert WAV ┐
  ├─ rear still photo ──┤
  ├─ front still photo ─┼─> AES-GCM ─> app-private document storage
  └─ 15 s post audio ───┘

Optional anonymous risk contribution
  └─ exact GPS (phone only) ─> zoom-16 coarse cell + hourly bucket
                                └─ encrypted retry queue
                                   └─ aggregation API ─> crowd threshold ─> map intensity zone
```

## Mobile modules

- `MonitoringProvider`: owns the native PCM stream, motion subscription, adaptive cadence, battery-saver state, session lifecycle, local inference and SOS transition. DeviceMotion acceleration is normalized from m/s² to g before feature extraction. GPS is not refreshed for every inference window.
- `DatabaseProvider`: obtains a random 256-bit database key from platform SecureStore, applies the SQLCipher key before migrations, and enables WAL.
- `capture.tsx`: suspends the monitoring stream, records evidence, switches rear → front cameras, encrypts each result, updates the incident atomically, and resumes monitoring.
- `backgroundLocation.ts`: keeps only the latest location and uses the required visible OS background indicator.
- `behaviorBaseline.ts`: samples at most once per minute during active in-app monitoring, derives a zoom-16 coarse cell and accuracy-adjusted speed, and learns bounded encrypted aggregate profiles across weekday/weekend and four-hour blocks. It needs 24 safe observations across three days before scoring and never retains a breadcrumb route.
- `voice-trigger.ts`: copies the bundled quantized Sherpa-ONNX files into private cache and feeds the existing 16 kHz PCM stream into a serialized one-thread keyword spotter. Direct emergency words open the existing countdown. Limited English, Hindi and Bengali threat phrases remain armed, are de-duplicated and enter `localFusion.ts`.
- Native `SafeCityVoiceTriggerService`: uses the same model and outdoor conditioner in a visible, battery-aware Android foreground service. A threat match produces only a discreet check notification until a second match within 20 seconds agrees with recent distress audio or violent motion.
- `safeRoute.ts`: retrieves user-requested OpenStreetMap facilities and lighting context; generated locations are never used as a data fallback.
- `riskZones.ts`: converts GPS to a coarse cell before transport, creates a rotating cell/day deduplication token, queues coarse reports and retrieves crowd-thresholded zones using a coarse viewing area.
- `monitorStore.ts`: contains transient UI state only; durable history stays in SQLite.

## On-device inference modules

- `onDeviceAudio.ts`: lazy-loads the APK-bundled 3.9 MB YAMNet TFLite model through the native C++ runtime, converts/resamples PCM to a fixed 15,600-sample float32 waveform, applies a conservative silence gate and scores distress/media classes. Inference runs asynchronously and is serialized to bound memory use.
- `localFusion.ts`: calculates motion risk, evaluates inspectable risk/suppressor patterns, combines available modalities, applies bounded context, maintains the last eight windows per session, and enforces confirmation, hysteresis and incident cooldown. A behavior deviation adds only a small supporting term and is excluded from the independent-signal and automatic-SOS gates.
- `MonitoringProvider.tsx`: retains only the latest audio tail in memory and schedules ordinary inference at 3 seconds foreground, 5 seconds background or 6 seconds in battery saver. Concerning motion temporarily uses 1.2 seconds, or 2 seconds in battery saver.
- No ordinary inference summary or sensor history is written to durable storage. If the user enables adaptive behavior detection, only its bounded coarse aggregate profiles and day markers are durable; incidents are stored separately.

The optional `service/` implementation still mirrors the earlier server-side inference policy for comparison tests. Its `/v1/risk/*` endpoints now also provide the separately deployable anonymous aggregation API. It is not imported by the app or packaged into the APK; the mobile build connects only when `EXPO_PUBLIC_RISK_API_BASE_URL` is configured.

## Failure behavior

| Failure | Safe behavior |
| --- | --- |
| Bundled model fails to load | Motion-only local fallback; automatic audio-motion SOS is disabled; manual SOS remains available |
| Microphone denied | Motion monitoring continues with visibly degraded health |
| Motion unavailable | Audio may request check-in but cannot automatically SOS |
| Location denied | Incident is stored without a location; detection is unchanged |
| Adaptive baseline is off, warming up or lacks accurate GPS | Existing audio/motion/keyword detection is unchanged; Local AI explains the unavailable or motion-only coverage |
| Bundled keyword engine fails to load | Voice trigger shows an error; scream, motion and manual SOS remain available |
| Nearby-place request fails | No pins are fabricated; Maps search and 112 remain available |
| Anonymous risk service fails | SOS continues normally; a coarse-only report remains in the bounded local retry queue and the map omits the optional layer |
| Camera denied/backgrounded | Incident remains active; available audio is saved; missing evidence is explicit |
| SMS unavailable | Incident stays local and UI shows the failure; no delivery claim |
| App UI closed/swiped away | The visible Android foreground service continues opted-in audio, keyword and motion checks; vendor restrictions can still interrupt it |
| App force-stopped | Android stops background protection until the user opens SafeCity again |

## Production gaps

This repository is a safety-oriented MVP, not a release-certified product. A production pilot still requires a protected release keystore, signed model/config update and rollback controls, a reviewed delivery provider, a representative consented dataset, real-device background tests, battery and thermal profiling, accessibility review, mobile security review, completed Data Fiduciary and grievance contacts, language access, operational rights and breach procedures, applicable processor contracts, and Indian legal/privacy review. See [DPDP_COMPLIANCE.md](DPDP_COMPLIANCE.md).
