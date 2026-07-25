# SafeCity project guide

**Documentation baseline:** source commit `2115fd4`  
**Reviewed:** 25 July 2026  
**Product status:** safety-oriented prototype; not release-certified

This is the end-to-end engineering guide for the SafeCity repository. It describes the current code, including known platform differences. It does not replace the [model card](MODEL_CARD.md), [validation plan](VALIDATION.md), [audit](AUDIT_REPORT.md), or qualified privacy, security, accessibility, and legal review.

## 1. Product boundary

SafeCity is a native Expo/React Native personal-safety app. Its principal functions are:

- user-consented microphone and motion monitoring;
- foreground on-device YAMNet or lightweight audio analysis;
- deterministic fall and violent-motion features;
- emergency-word and limited threat-phrase keyword spotting;
- local multi-signal fusion and a cancelable SOS countdown;
- encrypted incident metadata and evidence;
- a user-controlled system SMS/MMS composer;
- safety-navigation tools backed by public map services;
- optional, separately consented anonymous community risk reporting; and
- local incident history, feedback, retention, erasure, and consent withdrawal.

SafeCity is not an emergency dispatcher, monitored alarm, medical device, police service, delivery guarantee, or proof that a crime occurred.

## 2. What runs where

| Runtime | Role | Required for the app? |
| --- | --- | --- |
| Expo / React Native app | Product UI, encrypted database, foreground monitoring, local fusion, evidence, messaging, maps, settings | Yes |
| Android native voice/safety module | Persistent foreground-service ownership when the Android UI is backgrounded or removed | Android background protection only |
| Python FastAPI service | Development comparison oracle and optional anonymous risk-zone aggregation | No for normal mobile monitoring |
| EAS Build | Produces the configured preview APK and production artifacts | Required by the current `npm run android` workflow |
| Public map services | Nearby-place lookup, route calculation, and map tiles in Safety Navigator | Only when Safety Navigator is opened |

The mobile app never calls `/v1/analyze`. Production foreground inference is in `mobile/src/inference/`; the Python analyzer is a separate comparison implementation.

### Platform parity

- Android foreground: TypeScript YAMNet/lite audio, motion features, threat phrases, behavior baseline, and local fusion.
- Android background/task removed: native foreground service with Sherpa keyword spotting, conditioned-audio heuristics, and native motion rules.
- Android after reboot: motion can resume; Android 14+ requires the user to tap a notification before microphone monitoring resumes.
- iOS foreground: TypeScript monitoring and SOS flows.
- iOS background: background location may continue, but the current app-state handler stops the React audio and motion pipelines. Equivalent continuous background protection is not implemented.

## 3. Repository map

```text
SafeCity/
├── README.md
├── Makefile
├── docker-compose.yml
├── docs/
│   ├── PROJECT_GUIDE.md
│   ├── END_TO_END_WORKFLOWS.md
│   ├── ARCHITECTURE.md
│   ├── API_REFERENCE.md
│   ├── AUDIT_REPORT.md
│   └── policy, model, risk-zone, and validation documents
├── mobile/
│   ├── app/                         Expo Router screens
│   ├── src/components/              shared UI
│   ├── src/db/                      SQLCipher initialization, migrations, repository
│   ├── src/inference/               audio, motion, behavior, phrase, and fusion logic
│   ├── src/services/                monitoring, evidence, location, SMS, maps, risk API
│   ├── src/i18n/                    bundled and device-prepared translations
│   ├── modules/                     Android native Expo modules
│   ├── assets/models/               bundled TFLite and ONNX artifacts
│   ├── scripts/                     deterministic policy/calibration checks
│   ├── app.json                     native app configuration and permissions
│   ├── eas.json                     EAS build profiles
│   └── package.json
└── service/
    ├── app/api/                     FastAPI routes
    ├── app/core/                    settings, schemas, logging, assessment storage
    ├── app/detection/               Python audio, patterns, and fusion oracle
    ├── app/risk/                    coarse grid and risk aggregation
    ├── tests/
    ├── Dockerfile
    └── pyproject.toml
```

Generated or local-only directories such as `mobile/node_modules`, `mobile/android`, Python virtual environments, caches, and `graphify-out` are not runtime source.

## 4. App route map

| Route | Purpose |
| --- | --- |
| `/` | Redirects to onboarding or the tab shell after reading consent and permissions |
| `/onboarding` | Permissions, emergency contact, adult confirmation, privacy notice, Terms, and processing consent |
| `/(tabs)` | Main application shell |
| `/(tabs)/index` | Monitoring dashboard, sensor health, shortcuts, and press-and-hold SOS |
| `/(tabs)/history` | Incident list |
| `/(tabs)/settings` | Monitoring, voice, baseline, contacts, retention, theme, privacy, and erasure |
| `/sensor/[sensor]` | Audio, motion, location, camera, and local-AI diagnostics |
| `/sos-countdown` | Ten-second cancelable countdown |
| `/capture` | Protected rear/front photo and post-SOS audio capture |
| `/incident/[id]` | Incident details, evidence, feedback, messaging, resolution, and deletion |
| `/safety-navigator` | Public-place lookup, route, tiles, coarse community risk zones, sharing, and 112 |
| `/escape-tools` | Entry point for cover tools |
| `/fake-call` | Configurable simulated incoming call and bundled audio/TTS |
| `/cover-story` | Cover-location and timed-interruption tools |
| `/calculator` | Discreet four-operation calculator |
| `/siren` | Local siren and vibration; monitoring is suspended to prevent self-triggering |
| `/legal/privacy` | In-app privacy notice |
| `/legal/terms` | In-app Terms |
| `/legal/rights` | Data-rights summary |

## 5. Development prerequisites

### Mobile

- Node.js 22.13 or newer. Expo SDK 57 declares Node 22.13.x as its minimum.
- npm and the checked-in `mobile/package-lock.json`.
- An Expo account with access to EAS project `332c6ed5-2573-42bf-afa0-e1a27c8e575a`.
- macOS, full Xcode, CocoaPods, and an appropriate Apple signing identity for iOS physical-device builds.
- Physical devices for camera, microphone, motion, background behavior, SMS/MMS, battery, and thermal validation.

Expo Go is not supported because the app uses SQLCipher, TFLite, Sherpa-ONNX, and local native modules.

### Service

- Docker with Compose, or Python 3.11/3.12.
- Network access on first Python-oracle model load if the model is not already in `TFHUB_CACHE_DIR`.
- Sufficient memory for TensorFlow; Compose limits the runtime container to 3 GB.

## 6. Local setup

### Install the mobile dependencies

```bash
cd mobile
npm ci
```

Start the development client bundler:

```bash
npm run start
```

Queue the configured EAS preview APK:

```bash
npm run android
```

Generate and run the native iOS project locally:

```bash
npm run ios
```

The Android script uses remote EAS Build. The iOS script uses Expo prebuild/run locally and may generate a local `ios/` project; generated native projects are ignored by this repository. Do not use a preview artifact as a production release.

### Run the service with Docker

```bash
cp service/.env.example service/.env
docker compose up --build inference
```

The service listens on `http://localhost:8000`. Interactive OpenAPI documentation is at `http://localhost:8000/docs`.

Run the containerized test profile:

```bash
docker compose --profile test run --rm inference-test
```

### Run the service from Python

```bash
cd service
python3.11 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The project does not currently contain a Python lock file. Reproducible production builds require one or another reviewed dependency-pinning process.

## 7. Configuration

### Mobile build-time variables

Copy `mobile/.env.example` to `mobile/.env` for local builds. Never release the placeholders.

| Variable | Meaning | Release rule |
| --- | --- | --- |
| `EXPO_PUBLIC_LEGAL_ENTITY_NAME` | Data Fiduciary/operator name | Required |
| `EXPO_PUBLIC_LEGAL_ADDRESS` | Registered postal address | Required |
| `EXPO_PUBLIC_PRIVACY_EMAIL` | Privacy contact | Required |
| `EXPO_PUBLIC_GRIEVANCE_OFFICER` | Officer name/designation | Required |
| `EXPO_PUBLIC_GRIEVANCE_EMAIL` | Grievance channel | Required |
| `EXPO_PUBLIC_GOVERNING_COURTS` | Contract jurisdiction text | Required |
| `EXPO_PUBLIC_RISK_API_BASE_URL` | Optional anonymous-risk API base URL | Use HTTPS in production |

These are Expo public variables and are embedded in the app bundle. They must not contain secrets.

The source currently displays a warning when legal values are missing; it does not fail the production build. Add a release preflight before distribution.

### Service settings

Settings use the `SAFECITY_` prefix.

| Setting | Default | Purpose |
| --- | --- | --- |
| `MODEL_URL` | `https://tfhub.dev/google/yamnet/1` | Python oracle model |
| `MODEL_PRELOAD` | `true` | Load model during app lifespan startup |
| `MODEL_THREADS` | `2` | TensorFlow inter/intra-op threads |
| `DATABASE_PATH` | `data/safecity-inference.db` | Assessment and coarse-risk SQLite database |
| `PATTERN_PATH` | `app/knowledge/patterns.json` | Base comparison patterns |
| `CUSTOM_PATTERN_PATH` | `data/patterns.local.json` | Optional local pattern extension |
| `MAX_AUDIO_BYTES` | `1048576` | `/v1/analyze` body limit |
| `ASSESSMENT_RETENTION_DAYS` | `14` | Comparison assessment retention |
| `ANONYMOUS_RISK_RETENTION_DAYS` | `30` | Coarse report retention |
| `ANONYMOUS_RISK_MINIMUM_REPORTS` | `3` | Publication crowd threshold |
| `ANONYMOUS_RISK_MAX_REPORT_AGE_HOURS` | `48` | Maximum submitted report age |
| `ANONYMOUS_RISK_MAX_WINDOW_HOURS` | `168` | Maximum read window |
| `ANONYMOUS_RISK_MAX_BBOX_SPAN_DEGREES` | `1.0` | Maximum query span |
| `ANONYMOUS_RISK_POST_LIMIT_PER_MINUTE` | `30` | Process-local POST limit per network address |
| `ANONYMOUS_RISK_GET_LIMIT_PER_MINUTE` | `120` | Process-local GET limit per network address |

See [API_REFERENCE.md](API_REFERENCE.md) before exposing the service. The comparison, feedback, erasure, metrics, and health routes have no authentication.

## 8. Local storage and keys

### SQLCipher database

`DatabaseProvider` obtains a random 256-bit hexadecimal key from platform SecureStore, applies it with `PRAGMA key`, enables cipher memory security, secure deletion, foreign keys, and WAL, and then runs schema migrations.

| Table | Durable contents |
| --- | --- |
| `settings` | JSON app settings plus cached translation packs |
| `contacts` | Name, phone, verified flag, created time |
| `sessions` | Monitoring session state and timestamps |
| `incidents` | Decision summary, optional exact incident location, evidence URIs, feedback, resolution |
| `anonymous_risk_queue` | Coarse cell, hour, category, accuracy band, rotating token, retry metadata |
| `behavior_baseline` | Bounded aggregate coarse-cell/time/motion/speed profiles |
| `behavior_baseline_days` | Bounded learning-day markers |

Ordinary audio windows, motion windows, keyword audio, map history, and ordered behavior routes are not stored in this database.

### SecureStore entries

| Key | Purpose |
| --- | --- |
| `safecity.database-key.v1` | SQLCipher key |
| `safecity.evidence-key.v1` | AES evidence key |
| `safecity.anonymous-risk-secret.v1` | Rotating risk-token input |
| `safecity.device-id.v1` | Local comparison identifier if used |
| `safecity.language-preference.v1` | Language preference |

Android native monitoring choices and model-directory state are stored in Android preferences so service restart does not depend on React state.

### Evidence vault

Confirmed incidents may contain:

- a 15-second pre-alert PCM ring encoded as WAV;
- one rear still photo;
- one front still photo; and
- 15 seconds of post-SOS audio.

Each file is AES-GCM encrypted into app-private document storage. Plain capture files are deleted after encryption. Playback and messaging decrypt to temporary cache; cleanup runs after playback teardown or after the system composer returns. Individual deletion and consent withdrawal remove encrypted files.

## 9. Inference and decision paths

### Foreground path

1. `MonitoringProvider` receives 16 kHz mono signed PCM and DeviceMotion samples.
2. The app keeps a bounded inference buffer and a 15-second RAM snapshot ring.
3. `onDeviceAudio.ts` selects YAMNet or lite inference and conditions outdoor audio.
4. `MotionWindow` and `safetyCalibration.ts` derive motion features.
5. Optional threat-language matches and behavior deviation are added.
6. `localFusion.ts` applies risk and suppressor patterns, multi-signal gates, temporal confirmation, hysteresis, and a two-minute incident cooldown.
7. A confirmed result opens the evidence workflow; alerts otherwise remain a check-in state.

### Android background path

The native `SafeCityVoiceTriggerService` becomes sensor owner. It runs:

- Sherpa-ONNX direct emergency and threat keywords;
- high-pass/noise-conditioned distress-audio heuristics;
- accelerometer/gyroscope fall and violent-motion rules;
- repetition and cross-signal timing gates; and
- visible foreground, threat-check, or SOS-countdown notifications.

This is not the same executable fusion implementation as the foreground TypeScript path.

### Python comparison path

The Python analyzer accepts raw PCM plus URL-encoded metadata, runs TensorFlow Hub YAMNet, retrieves sparse TF-IDF patterns, applies its own fusion state, and stores summary records. It does not include the mobile behavior baseline or the full current Android native policy.

## 10. Network and data-flow inventory

| Destination | Trigger | Data sent |
| --- | --- | --- |
| SafeCity risk API | Separate setting enabled; SOS report queued | Coarse cell, hour, category, accuracy band, rotating token |
| SafeCity risk API | Safety Navigator opened and API configured | Bounding box centered on a coarse cell and time window |
| Overpass endpoints | Safety Navigator opened | Exact current latitude/longitude inside a 3 km query |
| `routing.openstreetmap.de` | A nearby destination is selected | Exact origin and selected destination |
| CARTO basemap | Safety map rendered | Tile coordinates that reveal the viewed area |
| Google/Apple/device maps | User explicitly opens a map action | Origin, destination, or incident coordinates in the URL |
| System SMS/MMS app | SOS finalization or user taps notify | Contacts, message, exact incident location if available, temporary evidence attachments |
| Device translation facility | Non-bundled language selected | Static SafeCity UI strings; no incident/contact/location content is supplied by this code |

Monitoring audio, motion features, contacts, evidence, and assessment decisions are not sent to the Python service or a cloud model by the mobile app.

## 11. Verification

Run the repository checks from a clean dependency installation:

```bash
cd mobile
npm run check
```

The command covers threat-language policy, behavior-baseline policy, strict TypeScript, and Expo Doctor. Expo Doctor's remote metadata checks require permission to contact Expo and React Native Directory.

The safety-calibration harness currently requires a manual compile step:

```bash
cd mobile
./node_modules/.bin/tsc src/inference/safetyCalibration.ts src/inference/audioConditioning.ts \
  --ignoreConfig --outDir /tmp/safecity-calibration \
  --module commonjs --target es2020 --skipLibCheck
node scripts/validate-safety-calibration.cjs /tmp/safecity-calibration
```

Run service validation:

```bash
cd service
.venv/bin/python -m pytest -q
.venv/bin/ruff check app tests
```

For results from this documentation baseline, see [AUDIT_REPORT.md](AUDIT_REPORT.md). Automated checks are policy tests, not field validation.

## 12. Deployment and operations

### Mobile release gate

Do not distribute a production build until all of the following are true:

- real legal/operator values are injected and verified in the built artifact;
- privacy and store disclosures cover every external map/routing/tile flow;
- optional monitoring features have appropriately granular user choices;
- an accessibility review and supported-language legal-content plan are complete;
- signed model/config provenance and rollback are tested;
- model, battery, thermal, latency, false-alarm, and subgroup gates pass on physical devices;
- Android background and iOS capability claims match tested behavior;
- a protected signing and dependency/SBOM process exists; and
- emergency messaging, breach, grievance, rights, and incident operations are staffed and tested.

### Risk API production gate

Place the service behind:

- TLS;
- an edge proxy configured to minimize address/body logs;
- shared rate limiting;
- authentication or separate network isolation for development-oracle routes;
- database backup/retention controls;
- abuse detection and platform attestation appropriate to the threat model;
- monitoring that exposes aggregate operational signals only; and
- a documented rollback and deletion procedure.

The supplied process-local limiter is not a multi-instance control.

## 13. Troubleshooting

| Symptom | Likely cause / action |
| --- | --- |
| Expo Go cannot start the app | Use a custom development build; native modules are required |
| `Entity not authorized` during Android build | Sign in to an Expo account with access to the configured EAS project |
| Local iOS build/signing fails | Verify full Xcode/CocoaPods, the selected simulator or device, and the Apple signing identity |
| Model falls back to lite | Review the Local AI diagnostic; verify the bundled asset and device native runtime |
| Voice trigger unavailable | Check microphone/notification permission, Android foreground-service state, model preparation, and full-screen alert access |
| Monitoring does not resume after reboot | On Android 14+, tap the visible resume notification for microphone monitoring |
| App was force-stopped | Reopen it; Android blocks service/receiver restart after force-stop |
| Camera evidence missing | The app must be visible and camera permission granted |
| SMS does not send automatically | Expected: SafeCity opens the system composer and the user must press Send |
| Nearby places or route unavailable | Public Overpass/routing service failed or returned no mapped result; SafeCity does not fabricate pins |
| Community risk zones absent | API not configured, consent disabled, network failed, or no cell reached the crowd threshold |

## 14. Related documents

- [End-to-end workflows](END_TO_END_WORKFLOWS.md)
- [Architecture](ARCHITECTURE.md)
- [API reference](API_REFERENCE.md)
- [Audit report](AUDIT_REPORT.md)
- [Model card](MODEL_CARD.md)
- [Validation plan](VALIDATION.md)
- [Anonymous risk zones](ANONYMOUS_RISK_ZONES.md)
- [DPDP readiness](DPDP_COMPLIANCE.md)
