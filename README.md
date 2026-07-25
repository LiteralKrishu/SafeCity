# SafeCity

SafeCity is a native Expo personal-safety app with its audio model, motion analysis, pattern matching and temporal fusion bundled in the Android/iOS app. Monitoring inference runs on the user’s phone without a laptop, Docker service, internet connection or cloud API.

Continuous video analysis has been removed. A rolling 15-second pre-alert audio snapshot stays in RAM and is discarded unless an SOS is confirmed. Confirmed incidents can encrypt that WAV snapshot plus one rear photo, one front photo, and 15 seconds of post-SOS audio with AES-GCM in app-private storage.

> SafeCity is an assistive prototype. It cannot guarantee detection, message delivery, emergency response, or personal safety. Do not use it as the only way to obtain help.

## What changed

- Replaced the Streamlit web UI and Kivy prototype with an Expo SDK 57 iOS/Android app.
- Removed YOLO, MediaPipe, all video-detection code, and the bundled video model assets.
- Replaced single-frequency scream rules and random location risk with an APK-bundled YAMNet Lite classifier, measured motion features, deterministic safety patterns, and temporal fusion.
- Added SQLCipher-encrypted local metadata and AES-GCM-encrypted evidence files.
- Added consent, permission health, emergency contacts, monitoring sessions, sensor health, tiered alert states, local history, false-alarm feedback, and deletion. The current all-permission onboarding gate remains an audit finding.
- Added adaptive on-device inference cadence, an in-memory silence gate and Android battery-saver awareness.
- Added an optional bundled offline emergency-word and multilingual threat-phrase spotter, real OpenStreetMap safe-haven/lighting data, compact emergency SMS payloads, native haptics, and an interactive TTS fake-call companion.
- Added opt-in anonymous community risk zones using client-side location coarsening, a bounded offline queue, rotating deduplication tokens and server-side crowd-threshold aggregation.

## Repository layout

```text
SafeCity/
├── mobile/                 Expo / React Native app (no web target)
├── service/                Development oracle plus optional anonymous risk aggregation API
├── docs/                   Architecture, model card, and validation plan
├── docker-compose.yml      Optional service-side comparison tests
└── Makefile                Common development commands
```

## Documentation map

Start with the document that matches the job:

| Document | Use it for |
| --- | --- |
| [PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) | Complete setup, code map, configuration, data model, build, test, and operations guide |
| [END_TO_END_WORKFLOWS.md](docs/END_TO_END_WORKFLOWS.md) | Onboarding, monitoring, background handoff, SOS, evidence, messaging, retention, maps, and risk-zone sequences |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Trust boundaries, runtime components, external dependencies, and failure behavior |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | FastAPI comparison-oracle and anonymous-risk endpoint contract |
| [AUDIT_REPORT.md](docs/AUDIT_REPORT.md) | Evidence-backed architecture, security, privacy, safety, testing, and release-readiness audit |
| [MODEL_CARD.md](docs/MODEL_CARD.md) | Intended use, model limits, quality claims, and validation gates |
| [VALIDATION.md](docs/VALIDATION.md) | Automated, device, scenario, and release validation checklist |
| [ANONYMOUS_RISK_ZONES.md](docs/ANONYMOUS_RISK_ZONES.md) | Coarsening, deduplication, aggregation, privacy, and deployment |
| [DPDP_COMPLIANCE.md](docs/DPDP_COMPLIANCE.md) | Implemented controls and unresolved Indian privacy-law release blockers |
| [PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md) / [TERMS_AND_CONDITIONS.md](docs/TERMS_AND_CONDITIONS.md) | Deployment templates; not legal approval |

The documentation describes the current source at commit `2115fd4` as reviewed on 25 July 2026. The audit records places where intended behavior, user-facing claims, and implementation do not yet match.

## On-device AI runtime

The official YAMNet TFLite model is stored at `mobile/assets/models/yamnet.tflite` and packaged by Metro into standalone builds. `react-native-fast-tflite` executes it through the native TensorFlow Lite C++ runtime. Audio remains in volatile memory; the app does not create a PCM cache file or make an inference network request.

Foreground inference cadence is adaptive: roughly every 3 seconds in ordinary monitoring and 6 seconds in Android battery saver. Concerning motion temporarily shortens the interval to 1.2 seconds (2 seconds in battery saver). When the Android app leaves the foreground, a native foreground service takes ownership and uses its own keyword, conditioned-audio, fall, and violent-motion rules; it does not run the React YAMNet fusion loop. The current iOS implementation stops the React audio/motion loop when the app is no longer active, so equivalent iOS background protection is not implemented. These are engineering defaults, not battery-life or accuracy guarantees; profile them across supported physical devices before release.

The optional adaptive behavior check uses no additional ML runtime. Once per minute during active in-app monitoring it compares coarse routine area, motion intensity and accuracy-adjusted speed against bounded encrypted aggregate profiles. It warms up for at least 24 safe observations over three days, keeps no breadcrumb route, and can only support other distress evidence—not independently alert or activate SOS. The Local AI screen shows coverage and deviation factors, and Settings can clear or disable the learned baseline.

The Python/Docker inference implementation remains a development comparison oracle for fusion-policy tests. It is not called or required for on-device monitoring and is not included in an APK.

The only optional SafeCity-operated network path is anonymous risk aggregation. When separately enabled, the app converts a distress location into an approximately 500-metre cell before transport and sends no audio, photos, contacts, exact GPS or stable device ID. Configure its HTTPS address with `EXPO_PUBLIC_RISK_API_BASE_URL`. Safety Navigator independently uses public Overpass, OpenStreetMap routing, and CARTO tile services. See [ANONYMOUS_RISK_ZONES.md](docs/ANONYMOUS_RISK_ZONES.md) and [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Build the native app

Node.js 22.13 or newer is required by Expo SDK 57.

```bash
cd mobile
npm ci
npm run android
```

`npm run android` queues the `preview` profile on EAS and produces an internally distributed APK. The project is linked to EAS project `332c6ed5-2573-42bf-afa0-e1a27c8e575a`. The signed APK can be downloaded from the build URL printed by EAS.

The Expo account running the command must have access to that EAS project. Expo Go is not supported because SafeCity uses SQLCipher and native offline inference modules.

For a local iOS native build:

```bash
npm run ios
```

This command generates/runs the native iOS project locally. Camera, microphone, voice trigger, motion, background location, SMS, and evidence capture must be tested on real devices.

### Build troubleshooting

- `Entity not authorized`: run `eas whoami`, then sign in to an Expo account with access to the configured EAS project.
- Local iOS builds require macOS, full Xcode, CocoaPods, and an appropriate Apple signing identity for physical devices.

## Safety decision policy

SafeCity deliberately prevents single-sensor auto-SOS decisions:

1. Bundled YAMNet Lite scores 0.975-second, 16 kHz PCM windows against 521 AudioSet classes on the phone.
2. Motion features detect acceleration, jerk, rotation, and an ordered free-fall → impact sequence.
3. The local pattern index retrieves both risk patterns and common suppressors such as television playback, transport vibration, and a dropped phone.
4. If enabled and warmed up, the adaptive baseline may add a small supporting term for an unfamiliar coarse area or unusual movement; it never counts as an independent danger signal.
5. Context can adjust a fused score by at most 3% and can never create a threat.
6. A typical automatic SOS requires audio-motion agreement in two consecutive windows. An exceptional scream plus fall-impact combination may bypass the second window.
7. Audio-only distress, motion-only falls and deviation-only events cannot automatically capture evidence.

Thresholds are pilot defaults, not clinical or safety-certified guarantees. See [MODEL_CARD.md](docs/MODEL_CARD.md) before changing them.

## Evidence and platform constraints

- Monitoring PCM is held in phone memory, analyzed locally, and discarded. The latest 15 seconds remain in a volatile ring buffer and are encrypted as a WAV only if an SOS is confirmed.
- Incident photos, the pre-alert WAV snapshot, and post-SOS audio are AES-GCM encrypted before temporary plaintext capture files are deleted.
- The optional voice trigger uses an APK-bundled 3M-parameter Sherpa-ONNX model and the existing 16 kHz microphone stream. Direct SOS words open the countdown immediately. Limited English, Hindi and Bengali coercion/threat phrases require a repeat plus independent distress-audio or motion agreement, and likely media playback is suppressed. It needs no account, internet connection, or installed phone language pack. Detection quality, power use, and background continuity still vary by phone.
- The optional behavior baseline stores only encrypted coarse aggregate profiles. It rejects inaccurate GPS for location learning, updates at most once per minute, and can be erased without deleting incidents or contacts.
- Opening Safety Navigator currently refreshes location and automatically sends the current exact coordinates to an Overpass endpoint for nearby places. Selecting a destination sends exact origin/destination coordinates to the OpenStreetMap routing service, and the map requests CARTO tiles. The current just-in-time disclosure does not fully describe these flows; this is a release blocker in the audit. Missing map data is never treated as proof that an area is unsafe.
- Mobile operating systems prevent a background app from silently opening cameras. Automatic front/rear capture therefore occurs only while the protected SOS capture screen is visible. A background detection stores the incident and raises a local notification that opens this screen.
- SMS APIs open the system composer. The user must press **Send**; the app must not claim delivery.
- Background work can stop if the user force-quits the app or the OS/vendor suspends it. The dashboard reports degraded coverage.

## Verification

```bash
cd mobile && npm run check
cd service && .venv/bin/python -m pytest -q
cd service && .venv/bin/ruff check app tests
```

`npm run check` runs the threat-language policy check, behavior-baseline policy check, strict TypeScript validation, and Expo Doctor. Expo Doctor needs network access for two metadata checks. The separate safety-calibration harness and exact commands are documented in [VALIDATION.md](docs/VALIDATION.md).

The service tests remain useful as a comparison oracle for media-playback suppression, time-context isolation, single-modality check-ins and temporal confirmation. The Python oracle, foreground TypeScript fusion, and Android background service are separate implementations and must be kept aligned deliberately. None of these checks proves APK field accuracy.

## Privacy and legal readiness

SafeCity includes an in-app, itemised privacy notice, Terms and Conditions, data-rights controls, versioned consent records, withdrawal and local device erasure. The corresponding deployment templates are in [PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md), [TERMS_AND_CONDITIONS.md](docs/TERMS_AND_CONDITIONS.md), and [DPDP_COMPLIANCE.md](docs/DPDP_COMPLIANCE.md).

These templates do not by themselves make a deployment legally compliant. Before production distribution, copy `mobile/.env.example` to `mobile/.env`, provide the real Data Fiduciary and grievance details, complete every release blocker in the DPDP readiness register, and obtain review from qualified Indian privacy counsel. The app visibly warns when the legal configuration is incomplete.

## Research basis

The implementation follows current primary documentation for [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/), [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/), [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/), [Expo SMS](https://docs.expo.dev/versions/latest/sdk/sms/), [Expo DeviceMotion](https://docs.expo.dev/versions/latest/sdk/devicemotion/), [Expo SQLite and SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [background location](https://docs.expo.dev/versions/latest/sdk/location/), [Sherpa-ONNX keyword spotting](https://k2-fsa.github.io/sherpa/onnx/kws/index.html), [OpenStreetMap attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [YAMNet](https://www.tensorflow.org/hub/tutorials/yamnet), and [semantic retrieval](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html). Android's [background camera/microphone restrictions](https://developer.android.com/about/versions/11/privacy/foreground-services) are treated as product constraints rather than hidden failures.

## License

See [LICENSE](LICENSE).
