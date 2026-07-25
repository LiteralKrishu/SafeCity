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

### Voice keyword model

- Model: Sherpa-ONNX `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20`
- Input: the existing single-channel 16 kHz monitoring PCM stream
- Runtime subset: 4.4 MB int8 encoder, 743 KB decoder, 85 KB int8 joiner, token table, and keyword definitions
- Role: emit a stable direct-emergency or limited threat-phrase label while the user-enabled trigger is armed
- Deployment: bundled in the app, copied to app-private cache, one CPU thread, serialized streaming inference, no account or operating-system language pack
- Pronunciation coverage: five direct emergency intents plus 13 pilot threat phrases across English, transliterated Hindi and transliterated Bengali

This is open-vocabulary acoustic keyword spotting, not general transcription. A bundled model broadens hardware support but does not make detection universal or guaranteed.

Direct emergency words open the cancelable countdown immediately. A single threat phrase never does: matches are de-duplicated for 3 seconds and expire after 20 seconds; at least two matches must agree with independent distress audio or motion. Media-playback evidence suppresses in-app confirmation. The Hindi and Bengali phrases are phonetic pilot definitions on the upstream `zh-en` acoustic model and must not be described as native-language production coverage.

### Motion model

The app converts Expo DeviceMotion acceleration from m/s² to g, then derives peak acceleration, RMS jerk, RMS rotation, free fall, and an ordered free-fall → impact feature. These signals are deterministic and device-dependent. A fall alone creates an Alert, not an automatic SOS.

### Adaptive behavior baseline

The optional baseline is a lightweight statistical model, not a trained neural network. At most once per minute during active monitoring, it groups a safe observation by weekday/weekend, a four-hour local-time block and a zoom-16 coarse location cell, then updates bounded exponentially weighted means and variances for motion intensity and accuracy-adjusted travel speed. Location fixes worse than 120 metres and implausible speeds are excluded. The model needs at least 24 safe observations across three days before it can report a deviation.

The score combines coarse-area familiarity, unusually high motion and unusual travel speed. Learning occurs only after the existing fusion policy labels a window safe. The model stores no ordered GPS trail, and a deviation is supporting evidence only: it is explicitly excluded from independent-signal counting and every automatic-SOS gate.

### Retrieved pattern layer

The local index retrieves positive and suppressor patterns. It makes the decision traceable and lets evaluators add reviewed patterns without retraining YAMNet. Retrieval is not a generative model and cannot invent a new fact about an incident.

### Fusion and confirmation

- No time or location context can independently raise an alert.
- A behavior deviation can add only bounded supporting risk and cannot count as audio-motion agreement.
- Ordinary automatic SOS requires independent audio-motion agreement across two windows.
- A threat-language route requires two non-duplicate phrase matches within 20 seconds plus independent distress-audio or motion evidence.
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
- every direct emergency word and threat phrase spoken by consented users across target languages, dialects, accents, ages, speaking volumes, distances, phone orientations and background noise;
- phonetically similar words, ordinary conversations containing “help,” television/radio speech, and long non-trigger recordings for false-activation measurement;
- television, films, social media, games, music, sirens, crowds, traffic, celebrations, and children playing;
- phones dropped on varied surfaces, running, stairs, transit, cycling, exercise, stumbling, falls, and struggle simulations;
- different languages, accents, ages, device microphones, cases, clothing/pockets, rooms, outdoor environments, and signal-to-noise ratios;
- synchronized audio-motion examples because isolated-modality accuracy does not validate the fused system.
- consented multi-day routine traces represented at the same coarse resolution, including normal route changes, travel, shift work, GPS drift, lost fixes and genuine unusual motion/location scenarios.

Report per-scenario and subgroup precision, recall, F1, false positives per monitored hour, false-negative rate, cancellation rate, P50/P95/P99 latency, battery drain, and thermal impact. Keep training/tuning/held-out participants separate.

## Proposed pilot gates

These are starting points for safety review, not universal guarantees:

- no automatic SOS from an audio-only or motion-only test;
- no alert or automatic SOS from a behavior-deviation-only test, including a first visit to an unfamiliar area;
- false automatic SOS below 1 per 100 monitored hours in controlled non-distress scenarios;
- fused-event precision at least 0.95 for automatic SOS on the held-out scripted set;
- recall at least 0.90 for predefined synchronized distress scenarios;
- P95 on-device decision latency below 1.5 seconds after a complete input window on supported hardware;
- keyword false activations reported per monitored hour and keyword recall reported separately for each accent/noise/device group;
- threat-phrase recall and false activations reported separately by phrase, language, dialect, device and playback/real-speaker source;
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
- A short common keyword such as “Help” can occur in ordinary conversation or played media, while whispered, distant, masked, or unfamiliar pronunciations may be missed.
- The keyword runtime targets the app's supported Android/iOS devices, but low-memory hardware, unsupported CPU/OS combinations, thermal throttling, and vendor background limits can still disable or delay it.
- Routine baselines can misclassify travel, shift work, relocation, a newly carried phone position or sparse GPS as unusual. The warm-up and supporting-only gate reduce harm but do not establish accuracy.
- The JavaScript baseline samples while active app monitoring is running; the Android foreground service continues its existing audio/keyword/motion protection when the UI is closed, but does not currently update or score the adaptive routine baseline.

## Feedback and privacy

False-positive feedback is stored locally and linked to the model/config version. Raw monitoring audio is processed in volatile phone memory and is not cached or transmitted for inference. Incident media is separately consented, encrypted on the phone, and user-deletable. Optional behavior profiles are coarse aggregates in encrypted local storage, are bounded to 256 profiles and 35 day markers, and are erased when the feature is disabled or the user clears the learned baseline.
