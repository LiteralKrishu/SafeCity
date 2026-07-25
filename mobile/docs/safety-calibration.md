# Safety sensor calibration

This document records SafeCity's initial real-world calibration assumptions. These values are conservative engineering defaults, not a clinical certification or a substitute for representative field validation across phone models, placements, users and environments.

## Sensor units and sampling

| Path | Accelerometer | Gyroscope | Normal sampling | Battery-saver sampling |
| --- | --- | --- | --- | --- |
| Visible React Native monitor | g after conversion from m/s² | degrees/second | 50 Hz | 25 Hz |
| Persistent Android service | g after conversion from m/s² | radians/second | 50 Hz acceleration, 40 Hz gyro | 25 Hz acceleration, 20 Hz gyro |

Expo reports `rotationRate` in degrees/second. Native Android `TYPE_GYROSCOPE` reports radians/second. SafeCity keeps each platform's documented unit at its sensor boundary and converts only when displaying native-equivalent values.

## Motion decision rules

- A low-g phase requires acceleration magnitude at or below **0.45 g** for at least **60 ms** and no longer than **1,000 ms**.
- The following impact must reach at least **2.4 g** within **1,200 ms**.
- Closed-app detection also requires at least **30°** integrated rotation, **2.6 rad/s** peak rotation, a **3.4 g** strong impact, or a **3.0 g** impact on a phone without a gyroscope.
- Violent-motion detection requires acceleration of **2.8 g**, jerk of **18 g/s**, angular speed of **4.0 rad/s**, and two distinct bursts within **900 ms**.
- A lone impact, ordinary walking, or a single short low-g sample cannot directly open SOS. It may enter silent validation if its combined score is unusual.

The ordered low-g → impact rule follows the established two-phase structure used in fall-detection research. Published work also warns that threshold-only systems and simulated falls do not fully represent real-world falls, so SafeCity retains a cancellation countdown and multi-sensor confirmation.

## Outdoor audio conditioning

- A first-order **90 Hz high-pass filter** removes DC, handling rumble and much wind energy.
- A 20 ms adaptive floor estimates steady ambient noise.
- Gain opens quickly for speech/shouts and closes slowly to avoid chopping words.
- Gain never falls below **52%**, protecting quieter emergency words.
- Persistent distress audio requires about **600 ms** of qualifying audio, with RMS, zero-crossing and crest-factor checks.
- Evidence audio remains the original captured signal; conditioning is used only for local inference.

## Calibration checks

`scripts/validate-safety-calibration.cjs` evaluates deterministic rest, walking, phone-bump, ordered-fall, wind-only and outdoor-shout scenarios against the same TypeScript calibration functions used by the app.

## References

- Expo DeviceMotion units: <https://docs.expo.dev/versions/latest/sdk/devicemotion/>
- Android motion sensor units: <https://developer.android.com/develop/sensors-and-location/sensors/sensors_motion>
- Android audio preprocessing guidance: <https://source.android.com/docs/core/audio/implement-pre-processing>
- Real-world fall algorithm evaluation: <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0037062>
- Smartphone and smartwatch two-phase fall detection: <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0140929>
