# Reference prototype feature matrix

This matrix maps the supplied `index.html`, `app.js`, and `styles.css` prototype to the native Expo app. Demo-only simulations and unsupported safety claims were replaced with real device behavior where the mobile operating system permits it.

| Reference capability | Native implementation |
| --- | --- |
| Start microphone, motion, and GPS sensors | Real Expo audio, device-motion, and location APIs. Sensor health is visible, but the current onboarding gate requires every permission instead of supporting contextual degraded entry. |
| Dedicated audio sensor page | Live relative microphone signal, permission/health status, monitoring control, and local diagnostic. The UI does not claim calibrated decibels. |
| Distress scream detection | APK-bundled YAMNet Lite classification, media-playback suppression, multi-window confirmation, and local fusion. Monitoring PCM stays in volatile memory. |
| Voice keyword trigger | Optional “Help” / “Bachao” detection uses a bundled 3M-parameter Sherpa-ONNX model with quantized encoder/joiner files, one CPU thread, and the same 16 kHz PCM stream used for distress analysis. It needs no system language pack or network fallback, exposes listening/error state, and creates a voice-origin SOS. A custom development/production build and real-device validation are still required. |
| Dedicated motion page | Real X/Y/Z acceleration and magnitude from the phone IMU. Fall logic uses free-fall, impact, jerk, rotation, and temporal confirmation. |
| Dedicated GPS page | Real latitude, longitude, operating-system accuracy, refresh, share sheet, guardian SMS composer, and emergency SMS composer. |
| NavIC/ISRO display | The app reports the operating system's location result. It does not falsely claim which satellite constellation supplied a fix. |
| Offline AI page | Loads and warms the bundled TFLite model, shows model version, latest fused score and latency, and describes the active local safety tasks. |
| AI safe-walk navigator | Uses the real phone position, automatically requests OpenStreetMap facility/lighting records on screen entry, obtains routes from `routing.openstreetmap.de`, and renders CARTO tiles. The exact-location disclosure mismatch is tracked in the audit. |
| Safe-haven radar | Loads real mapped police, hospital, transit, pharmacy, lit-path, and emergency-phone records through Overpass. It never substitutes generated coordinates when data is unavailable. |
| Safe-walk check-in | Shares the user's current maps link through the system share sheet and clearly labels the limitations. |
| Indian emergency shortcuts | Real `tel:` actions for 112 and 1091. |
| Guardian and 112 SMS | Opens the operating system composer with real location and saved contacts, and now includes a compact `SC1` low-connectivity payload alongside the human-readable message. SafeCity never claims silent sending or delivery. |
| Press-and-hold SOS | Long press opens a ten-second cancellable countdown, then creates a local incident and starts protected evidence capture. |
| Emergency evidence | One rear photo, one front photo, a valid WAV containing the latest 15-second pre-alert audio snapshot, and 15 seconds of post-SOS audio are encrypted with AES-GCM in app-private storage after SOS. |
| Encrypted audio vault | Incident history lists secured evidence. Both audio clips can be decrypted into temporary cache for playback, exported explicitly as encrypted `.safe` files, or deleted with the incident. |
| Loud siren | Generates and loops a local siren waveform, vibrates the phone, and pauses monitoring to prevent self-triggering until stopped. |
| Stealth calculator | A functional four-operation calculator is available from Escape Tools. |
| Fake incoming call | Configurable caller, delay, ringing/vibration, spoken TTS caller lines, answer state, call timer, exit prompt, and an interactive control that plays additional deterrence lines. |
| Additional escape tools | Cover-location text, timed interruption, ride-arrival cover, and quick exit scripts. |
| Multilingual UI | Bundled English, Hindi, and Bengali plus device-prepared private translation packs including Tamil and other supported languages. |
| Dark, light, and system themes | Persistent native appearance preference using adaptive iOS/Android colors. Emergency capture and calculator screens intentionally remain dark. |
| Monitoring switch | Starts, pauses, and resumes actual sensor subscriptions and background location instead of toggling a visual-only demo state. |
| Emergency contacts | Add and remove multiple local contacts; all saved numbers are included when the app prepares an SOS message. |
| Incident history | SQLCipher-backed local summaries, encrypted evidence status, feedback, resolution, retention, and deletion. |

The desktop “judge simulator,” fabricated sensor readings, fake map markers, artificial threat scores, and simulated dispatch success are not part of the native app.
