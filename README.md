# SafeCity

SafeCity is a native Expo personal-safety app with its audio model, motion analysis, pattern matching and temporal fusion bundled in the Android/iOS app. Monitoring inference runs on the user’s phone without a laptop, Docker service, internet connection or cloud API.

Continuous video analysis has been removed. After an SOS is confirmed, the visible app captures one rear photo, one front photo, and 15 seconds of audio, encrypts all three with AES-GCM, and stores them only in the app's private local storage.

> SafeCity is an assistive prototype. It cannot guarantee detection, message delivery, emergency response, or personal safety. Do not use it as the only way to obtain help.

## What changed

- Replaced the Streamlit web UI and Kivy prototype with an Expo SDK 57 iOS/Android app.
- Removed YOLO, MediaPipe, all video-detection code, and the bundled video model assets.
- Replaced single-frequency scream rules and random location risk with an APK-bundled YAMNet Lite classifier, measured motion features, deterministic safety patterns, and temporal fusion.
- Added SQLCipher-encrypted local metadata and AES-GCM-encrypted evidence files.
- Added consent, contextual permissions, emergency contacts, monitoring sessions, sensor health, tiered alert states, local history, false-alarm feedback, and deletion.
- Added adaptive on-device inference cadence, an in-memory silence gate and Android battery-saver awareness.

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

## Run the native app

Node.js 22.13 or newer is required by Expo SDK 57.

```bash
cd mobile
npm install
npx expo prebuild
npx expo run:ios
```

Use `npm run android` for Android. A development build is required: Expo Go does not support the configured SQLCipher database or production background permissions. Camera, microphone, motion, background location, SMS, and evidence capture must be tested on real devices.

On macOS, install the recommended Android JDK once with `brew install openjdk@17`, then use `npm run android`. The project wrapper selects the Homebrew JDK and installed Android SDK automatically.

Create a standalone Android APK with:

```bash
cd mobile/android
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
ANDROID_HOME="$HOME/Library/Android/sdk" \
./gradlew app:assembleRelease
```

The repository’s current release variant still uses the debug signing key and must be given a protected production keystore before distribution.

### Local setup troubleshooting

- `Unable to locate a Java Runtime`: install JDK 17 with `brew install openjdk@17` and run Android through `npm run android` so the project wrapper selects it.
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

- Monitoring PCM is held in phone memory, analyzed locally, and discarded. It is not written to cache or transmitted for inference.
- Incident photos and 15-second audio are AES-GCM encrypted before the temporary source files are deleted.
- Mobile operating systems prevent a background app from silently opening cameras. Automatic front/rear capture therefore occurs only while the protected SOS capture screen is visible. A background detection stores the incident and raises a local notification that opens this screen.
- SMS APIs open the system composer. The user must press **Send**; the app must not claim delivery.
- Background work can stop if the user force-quits the app or the OS/vendor suspends it. The dashboard reports degraded coverage.

## Verification

```bash
cd mobile && npm run check
cd android && ./gradlew app:assembleRelease
```

The legacy service tests remain useful as a policy oracle for media-playback suppression, time-context isolation, single-modality check-ins and temporal confirmation, but they do not prove the APK’s field accuracy.

## Privacy and legal readiness

SafeCity includes an in-app, itemised privacy notice, Terms and Conditions, data-rights controls, versioned consent records, withdrawal and local device erasure. The corresponding deployment templates are in [PRIVACY_POLICY.md](docs/PRIVACY_POLICY.md), [TERMS_AND_CONDITIONS.md](docs/TERMS_AND_CONDITIONS.md), and [DPDP_COMPLIANCE.md](docs/DPDP_COMPLIANCE.md).

These templates do not by themselves make a deployment legally compliant. Before production distribution, copy `mobile/.env.example` to `mobile/.env`, provide the real Data Fiduciary and grievance details, complete every release blocker in the DPDP readiness register, and obtain review from qualified Indian privacy counsel. The app visibly warns when the legal configuration is incomplete.

## Research basis

The implementation follows current primary documentation for [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/), [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/), [Expo DeviceMotion](https://docs.expo.dev/versions/latest/sdk/devicemotion/), [Expo SQLite and SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [background location](https://docs.expo.dev/versions/latest/sdk/location/), [YAMNet](https://www.tensorflow.org/hub/tutorials/yamnet), and [semantic retrieval](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html). Android's [background camera/microphone restrictions](https://developer.android.com/about/versions/11/privacy/foreground-services) are treated as product constraints rather than hidden failures.

## License

See [LICENSE](LICENSE).
