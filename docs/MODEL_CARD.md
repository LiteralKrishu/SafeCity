# SafeCity model card

## Intended use

SafeCity estimates whether short audio and motion windows resemble a possible personal-distress pattern. It is intended to prompt a check-in or start a user-visible evidence workflow. It is not an emergency dispatcher, crime detector, identity system, or proof that an assault occurred.

## Components

### Pretrained audio model

- Model: Google YAMNet TFLite classification model (`https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1`)
- Training taxonomy: 521 AudioSet event classes
- Input: single-channel 16 kHz waveform
- Role: produce evidence for screaming, shouting, crying, wailing, gunfire, explosions, and related classes
- Optimization: APK-bundled 3.9 MB model, one lazy native singleton, fixed 15,600-sample float32 input, conservative silence gate, serialized asynchronous inference, bounded audio buffers, adaptive cadence and Android battery-saver awareness

YAMNet is a broad environmental-sound classifier, not a purpose-trained women's-safety model. Its raw scores must never be interpreted as calibrated emergency probabilities.

### Motion model

The app converts Expo DeviceMotion acceleration from m/s² to g, then derives peak acceleration, RMS jerk, RMS rotation, free fall, and an ordered free-fall → impact feature. These signals are deterministic and device-dependent. A fall alone creates an Alert, not an automatic SOS.

### Retrieved pattern layer

The local index retrieves positive and suppressor patterns. It makes the decision traceable and lets evaluators add reviewed patterns without retraining YAMNet. Retrieval is not a generative model and cannot invent a new fact about an incident.

### Fusion and confirmation

- No time or location context can independently raise an alert.
- Ordinary automatic SOS requires independent audio-motion agreement across two windows.
- Exception: an extremely high audio score plus an ordered fall-impact score may escalate immediately.
- Television/music evidence, isolated device drops, and transport vibration reduce the score.
- A two-minute incident cooldown suppresses duplicate capture requests.
- Alert → Safe transitions pass through Watch for hysteresis.

## Current quality claims

There is no valid production precision, recall, or false-alarm claim yet. The 87% audio and 83% visual accuracy figures in the source presentation are not used because the underlying dataset, split, class balance, and subgroup results are unavailable. Visual detection has been removed entirely.

The included unit tests demonstrate policy behavior, not real-world model accuracy. Do not publish accuracy claims until the validation plan below is completed.

## Required validation dataset

A consented, documented set must include:

- authentic and safely acted screams, shouts, cries, panic speech, and ordinary speech;
- television, films, social media, games, music, sirens, crowds, traffic, celebrations, and children playing;
- phones dropped on varied surfaces, running, stairs, transit, cycling, exercise, stumbling, falls, and struggle simulations;
- different languages, accents, ages, device microphones, cases, clothing/pockets, rooms, outdoor environments, and signal-to-noise ratios;
- synchronized audio-motion examples because isolated-modality accuracy does not validate the fused system.

Report per-scenario and subgroup precision, recall, F1, false positives per monitored hour, false-negative rate, cancellation rate, P50/P95/P99 latency, battery drain, and thermal impact. Keep training/tuning/held-out participants separate.

## Proposed pilot gates

These are starting points for safety review, not universal guarantees:

- no automatic SOS from an audio-only or motion-only test;
- false automatic SOS below 1 per 100 monitored hours in controlled non-distress scenarios;
- fused-event precision at least 0.95 for automatic SOS on the held-out scripted set;
- recall at least 0.90 for predefined synchronized distress scenarios;
- P95 on-device decision latency below 1.5 seconds after a complete input window on supported hardware;
- subgroup gaps reviewed and no modality launched where harm is unacceptable;
- signed threshold/config rollback tested before pilot.

## Known limitations

- Played media may still resemble real distress.
- Quiet coercion or medical events may have no detectable audio or motion.
- Device position greatly affects motion and microphone measurements.
- YAMNet labels do not capture intent or the cause of a sound.
- A model-load or native-runtime failure disables pretrained audio inference and leaves motion-only fallback plus manual SOS.
- Thresholds have not been calibrated on representative field data.
- Mobile OS background restrictions prevent guaranteed continuous execution.

## Feedback and privacy

False-positive feedback is stored locally and linked to the model/config version. Raw monitoring audio is processed in volatile phone memory and is not cached or transmitted for inference. Incident media is separately consented, encrypted on the phone, and user-deletable.
