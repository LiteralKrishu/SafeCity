# SafeCity

SafeCity is a native Expo personal-safety app backed by a local Dockerized Python inference service. It monitors short-lived audio and motion windows, retrieves relevant known safety patterns, and uses conservative multi-signal fusion before escalating.

Continuous video analysis has been removed. After an SOS is confirmed, the visible app captures one rear photo, one front photo, and 15 seconds of audio, encrypts all three with AES-GCM, and stores them only in the app's private local storage.

> SafeCity is an assistive prototype. It cannot guarantee detection, message delivery, emergency response, or personal safety. Do not use it as the only way to obtain help.

## What changed

- Replaced the Streamlit web UI and Kivy prototype with an Expo SDK 57 iOS/Android app.
- Removed YOLO, MediaPipe, all video-detection code, and the bundled video model assets.
- Replaced single-frequency scream rules and random location risk with pretrained YAMNet audio classification, measured motion features, retrieved patterns, and temporal fusion.
- Added SQLCipher-encrypted local metadata and AES-GCM-encrypted evidence files.
- Added consent, contextual permissions, emergency contacts, monitoring sessions, sensor health, tiered alert states, local history, false-alarm feedback, and deletion.
- Added a non-root Docker service with a persistent local model cache and privacy-preserving assessment summaries.

## Repository layout

```text
SafeCity/
├── mobile/                 Expo / React Native app (no web target)
├── service/                FastAPI + YAMNet + pattern RAG + fusion
├── docs/                   Architecture, model card, and validation plan
├── docker-compose.yml      Local inference runtime
└── Makefile                Common development commands
```

## Run the local AI service

Docker is the supported Python runtime. It pins Python 3.11 because TensorFlow does not support every system Python release.
Start Docker Desktop before running Compose (`docker desktop start` on macOS).

```bash
docker compose up --build
```

The first start downloads Google YAMNet into the `safecity-models` Docker volume. Later starts work from that local cache. Check readiness at `http://localhost:8000/health` and API documentation at `http://localhost:8000/docs`.

For a physical phone, find the computer's LAN address and enter it in **SafeCity → Settings → Private AI service**, for example `http://192.168.1.10:8000`. The phone and computer must be on the same trusted network. Do not expose port 8000 to the public internet.

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

### Local setup troubleshooting

- `failed to connect to the docker API`: Docker Desktop is installed but stopped. Run `docker desktop start`, wait for it to report running, then rerun `docker compose up --build`.
- `Unable to locate a Java Runtime`: install JDK 17 with `brew install openjdk@17` and run Android through `npm run android` so the project wrapper selects it.
- `CocoaPods CLI not found`: iOS builds require CocoaPods and full Xcode. Install CocoaPods with `brew install cocoapods`; install Xcode through the App Store before running `npm run ios`.

## Safety decision policy

SafeCity deliberately prevents single-sensor auto-SOS decisions:

1. YAMNet scores 1.5-second PCM windows against AudioSet classes.
2. Motion features detect acceleration, jerk, rotation, and an ordered free-fall → impact sequence.
3. The local pattern index retrieves both risk patterns and common suppressors such as television playback, transport vibration, and a dropped phone.
4. Context can adjust a fused score by at most 3% and can never create a threat.
5. A typical automatic SOS requires audio-motion agreement in two consecutive windows. An exceptional scream plus fall-impact combination may bypass the second window.
6. Audio-only distress and motion-only falls request a check-in; neither automatically captures evidence.

Thresholds are pilot defaults, not clinical or safety-certified guarantees. See [MODEL_CARD.md](docs/MODEL_CARD.md) before changing them.

## Evidence and platform constraints

- Monitoring PCM is uploaded only to the LAN service, held in memory, analyzed, and discarded. It is never written to the service database.
- Incident photos and 15-second audio are AES-GCM encrypted before the temporary source files are deleted.
- Mobile operating systems prevent a background app from silently opening cameras. Automatic front/rear capture therefore occurs only while the protected SOS capture screen is visible. A background detection stores the incident and raises a local notification that opens this screen.
- SMS APIs open the system composer. The user must press **Send**; the app must not claim delivery.
- Background work can stop if the user force-quits the app or the OS/vendor suspends it. The dashboard reports degraded coverage.

## Verification

```bash
cd mobile && npm run check
docker compose build
docker compose --profile test run --rm inference-test
```

The current tests specifically cover media-playback suppression, time-context isolation, fall-only check-ins, audio-only check-ins, temporal confirmation, retrieval behavior, and API validation.

## Research basis

The implementation follows current primary documentation for [Expo Camera](https://docs.expo.dev/versions/latest/sdk/camera/), [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/), [Expo DeviceMotion](https://docs.expo.dev/versions/latest/sdk/devicemotion/), [Expo SQLite and SQLCipher](https://docs.expo.dev/versions/latest/sdk/sqlite/), [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [background location](https://docs.expo.dev/versions/latest/sdk/location/), [YAMNet](https://www.tensorflow.org/hub/tutorials/yamnet), and [semantic retrieval](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html). Android's [background camera/microphone restrictions](https://developer.android.com/about/versions/11/privacy/foreground-services) are treated as product constraints rather than hidden failures.

## License

See [LICENSE](LICENSE).
