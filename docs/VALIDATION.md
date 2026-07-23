# Validation and rollout checklist

## Automated checks

- TypeScript strict type-check and Expo dependency validation.
- Unit tests for pattern matching, false-positive suppressors, single-modality gates and temporal confirmation.
- EAS preview APK inspection confirming the JavaScript bundle, native TFLite runtime and YAMNet asset are packaged.
- Static search verifying no Streamlit, Kivy, OpenCV, YOLO, MediaPipe, video recording, or cloud-model dependency remains.

## Device matrix

At minimum, test one low/mid/high Android device across Android 12–16 and supported iPhones across iOS 16.4–current. Record:

- microphone and DeviceMotion behavior in foreground, screen lock, background, interruptions, and force quit;
- rear/front capture success and timing;
- pre-alert WAV header/playback, 15-second RAM duration, post-SOS recording duration and encryption success;
- bundled-model extraction and cold/warm startup, “Help” / “Bachao” accent/noise recall, similar-word and television false activations, serialized stream reset, low-end CPU latency, battery/thermal impact, and foreground/background continuity;
- evidence recovery after app restart;
- SQLCipher migration and SecureStore behavior after biometric/passcode changes;
- SMS composer behavior, canceled send, and unavailable SIM/device states;
- location permission: denied, approximate, foreground, background, and revoked;
- OpenStreetMap place/lighting lookup success, timeout, empty result, attribution and no fabricated-pin fallback;
- battery percentage and thermal state for 30-, 60-, and 120-minute sessions.

## Scenario matrix

Each scenario should have multiple participants, devices, positions, and environments. Include negative tests at a much higher volume than positive tests to estimate false alarms per hour.

1. Quiet room, ordinary conversation, office, cooking, traffic, transit, running, exercise.
2. Films/TV/social media containing screams, games, music, sirens, celebrations.
3. Phone drops, abrupt pocket removal, bag movement, stairs, potholes, cycling.
4. Consented scripted shout + struggle, cry + fall, repeated plea + impact, silent fall.
5. Airplane mode, cold/warm on-device model load, battery saver, low battery, thermal throttling and recovery after app restart.

No participant should enter real danger for testing.

## Release sequence

1. Lab-only threshold calibration.
2. Controlled scripted pilot with an observer and immediate opt-out.
3. Limited opt-in beta only after privacy, security, accessibility, fairness, and model-quality review.
4. General availability only after an audited notification provider and supported-device matrix exist.
