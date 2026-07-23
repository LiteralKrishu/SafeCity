# SafeCity

SafeCity is a native Expo personal-safety app with its audio model, motion analysis, pattern matching and temporal fusion bundled in the Android/iOS app. Monitoring inference runs on the user’s phone without a laptop, Docker service, internet connection or cloud API.

Continuous video analysis has been removed. A rolling 15-second pre-alert audio snapshot stays in RAM and is discarded unless an SOS is confirmed. Confirmed incidents can encrypt that WAV snapshot plus one rear photo, one front photo, and 15 seconds of post-SOS audio with AES-GCM in app-private storage.

> SafeCity is an assistive prototype. It cannot guarantee detection, message delivery, emergency response, or personal safety. Do not use it as the only way to obtain help.

## What changed

- Replaced the Streamlit web UI and Kivy prototype with an Expo SDK 57 iOS/Android app.
- Removed YOLO, MediaPipe, all video-detection code, and the bundled video model assets.
- Replaced single-frequency scream rules and random location risk with an APK-bundled YAMNet Lite classifier, measured motion features, deterministic safety patterns, and temporal fusion.
- Added SQLCipher-encrypted local metadata and AES-GCM-encrypted evidence files.
- Added consent, contextual permissions, emergency contacts, monitoring sessions, sensor health, tiered alert states, local history, false-alarm feedback, and deletion.
- Added adaptive on-device inference cadence, an in-memory silence gate and Android battery-saver awareness.
- Added an optional bundled offline “Help” / “Bachao” keyword spotter, real user-requested OpenStreetMap safe-haven/lighting data, compact emergency SMS payloads, native haptics, and an interactive TTS fake-call companion.

## Repository layout

```text
SafeCity/
├── mobile/                 Expo / React Native app (no web target)
├── service/                Legacy development oracle and policy tests (not used by the app)
├── docs/                   Architecture, model card, and validation plan
├── docker-compose.yml      Optional service-side comparison tests
└── Makefile                Common development commands
```

## On-device AI runtime

The official YAMNet TFLite model is stored at `mobile/assets/models/yamnet.tflite` and packaged by Metro into standalone builds. `react-native-fast-tflite` executes it through the native TensorFlow Lite C++ runtime. Audio remains in volatile memory; the app does not create a PCM cache file or make an inference network request.

Inference cadence is adaptive: roughly every 3 seconds in ordinary foreground monitoring, 5 seconds in the background, and 6 seconds in Android battery saver. Concerning motion temporarily shortens the interval to 1.2 seconds (2 seconds in battery saver). These are realistic efficiency defaults, not a battery-life or accuracy guarantee; profile them across supported physical devices before release.

The Python/Docker implementation remains only as a development comparison oracle for fusion-policy tests. It is not called, configured or required by the mobile app and is not included in an APK.

## Build the native app

Node.js 22.13 or newer is required by Expo SDK 57.

```bash
cd mobile
npm install
npm run android
```

`npm run android` queues the `preview` profile on EAS and produces an internally distributed APK. The project is linked to EAS project `332c6ed5-2573-42bf-afa0-e1a27c8e575a`. The signed APK can be downloaded from the build URL printed by EAS.

The Expo account running the command must have access to that EAS project. Expo Go is not supported because SafeCity uses SQLCipher and native offline inference modules.

For an iOS development build:

```bash
npx expo run:ios
```

Camera, microphone, voice trigger, motion, background location, SMS, and evidence capture must be tested on real devices.

### Build troubleshooting

- `Entity not authorized`: run `eas whoami`, then sign in to an Expo account with access to the configured EAS project.
- `CocoaPods CLI not found`: iOS builds require CocoaPods and full Xcode. Install CocoaPods with `brew install cocoapods`; install Xcode through the App Store before running `npm run ios`.

## Safety decision policy

SafeCity deliberately prevents single-sensor auto-SOS decisions:

1. Bundled YAMNet Lite scores 0.975-second, 16 kHz PCM windows against 521 AudioSet classes on the phone.
2. Motion features detect acceleration, jerk, rotation, and an ordered free-fall → impact sequence.
3. The local pattern index retrieves both risk patterns and common suppressors such as television playback, transport vibration, and a dropped phone.
4. Context can adjust a fused score by at most 3% and can never create a threat.
5. A typical automatic SOS requires audio-motion agreement in two consecutive windows. An exceptional scream plus fall-impact combination may bypass the second window.
6. Audio-only distress and motion-only falls request a check-in; neither automatically captures evidence.

Thresholds are pilot defaults, not clinical or safety-certified guarantees. See [MODEL_CARD.md](docs/MODEL_CARD.md) before changing them.

## Evidence and platform constraints

- Monitoring PCM is held in phone memory, analyzed locally, and discarded. The latest 15 seconds remain in a volatile ring buffer and are encrypted as a WAV only if an SOS is confirmed.
- Incident photos, the pre-alert WAV snapshot, and post-SOS audio are AES-GCM encrypted before temporary plaintext capture files are deleted.
- The optional voice trigger uses an APK-bundled 3M-parameter Sherpa-ONNX model and the existing 16 kHz microphone stream. It needs no account, internet connection, or installed phone language pack. Detection quality, power use, and background continuity still vary by phone.
- Safety Navigator sends the current coordinates to OpenStreetMap Overpass only after the user chooses to load real nearby places. Missing map data is never treated as proof that an area is unsafe.
- Mobile operating systems prevent a background app from silently opening cameras. Automatic front/rear capture therefore occurs only while the protected SOS capture screen is visible. A background detection stores the incident and raises a local notification that opens this screen.
- SMS APIs open the system composer. The user must press **Send**; the app must not claim delivery.
- Background work can stop if the user force-quits the app or the OS/vendor suspends it. The dashboard reports degraded coverage.

## Verification

```bash
cd mobile && npm run check
cd mobile && npm run android
```

The legacy service tests remain useful as a policy oracle for media-playback suppression, time-context isolation, single-modality check-ins and temporal confirmation, but they do not prove the APK’s field accuracy.

## Privacy and legal readiness

SafeCity includes an in-app, itemised privacy notice, Terms and Conditions, data-rights controls, versioned consent records, withdrawal and local device erasure. The corresponding deployment templates are in [PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md), [TERMS_AND_CONDITIONS.md](docs/TERMS_AND_CONDITIONS.md), and [DPDP_COMPLIANCE.md](docs/DPDP_COMPLIANCE.md).

These templates do not by themselves make a deployment legally compliant. Before production distribution, copy `mobile/.env.example` to `mobile/.env`, provide the real Data Fiduciary and grievance details, complete every release blocker in the DPDP readiness register, and obtain review from qualified Indian privacy counsel. The app visibly warns when the legal configuration is incomplete.

## Research basis

The implementation follows current primary documentation for [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/), [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/), [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/), [Expo SMS](https://docs.expo.dev/versions/latest/sdk/sms/), [Expo DeviceMotion](https://docs.expo.dev/versions/latest/sdk/devicemotion/), [Expo SQLite and SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [background location](https://docs.expo.dev/versions/latest/sdk/location/), [Sherpa-ONNX keyword spotting](https://k2-fsa.github.io/sherpa/onnx/kws/index.html), [OpenStreetMap attribution](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines), [YAMNet](https://www.tensorflow.org/hub/tutorials/yamnet), and [semantic retrieval](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html). Android's [background camera/microphone restrictions](https://developer.android.com/about/versions/11/privacy/foreground-services) are treated as product constraints rather than hidden failures.

## License

See [LICENSE](LICENSE).
