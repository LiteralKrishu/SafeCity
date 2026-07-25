# Validation and rollout plan

**Baseline:** source commit `2115fd4`
**Last repository audit run:** 25 July 2026
**Current result:** deterministic and service checks pass; release safety, device, accessibility, and live dependency evidence is incomplete

Passing repository checks establish that selected policies are internally consistent. They do not establish real-world detection accuracy, emergency-message delivery, background continuity, legal compliance, or fitness for a safety claim.

## 1. Audit-run results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Threat-language policy harness | Pass | `npm run check:threat-language` completed |
| Behavior-baseline policy harness | Pass | `npm run check:behavior-baseline` completed |
| Strict TypeScript check | Pass | The `tsc --noEmit` stage of `npm run check` completed |
| Expo Doctor | Partial | 18 of 20 checks passed; the Expo config-schema and React Native Directory checks required blocked network access |
| Mobile production dependency tree | Pass | `npm ls --all --omit=dev --json` resolved with exit code 0 |
| Safety calibration harness | Pass | Fall/impact, rest, walking, bump, shout-SNR, gain, and wind-reduction checks passed after compiling the target files to a temporary directory |
| Python tests | Pass | 17 tests passed; one Starlette TestClient/httpx deprecation warning |
| Python lint | Pass | Ruff found no violations in `service/app` or `service/tests` |
| Bundled model integrity | Pass | All six model/keyword files matched the SHA-256 values recorded below |
| Live npm vulnerability audit | Not verified | Registry egress was not authorized; no clean vulnerability claim can be made |
| Live Python vulnerability audit | Not verified | No registry-backed scanner was run |
| Python dependency consistency | Not verified | The checked-in virtual environment has no `pip`; the project also has no lock file |
| Python coverage | Not available | `pytest-cov` is not installed in the checked-in environment |
| Git object/ref integrity | Fail | `.git/refs/.DS_Store` is parsed as an invalid ref; `git fsck` also reported dangling trees |
| Android/iOS build and install | Not run | Remote Android EAS build, local iOS native build, signing, and physical-device access were outside this documentation audit |
| Physical safety scenarios | Not run | No representative pilot dataset or supported-device report is present |

### Reproduce the checks that do not require external services

```bash
cd mobile
npm run check:threat-language
npm run check:behavior-baseline
npx tsc --noEmit
npm ls --all --omit=dev --json
```

`npm run check` combines the first two policy scripts, TypeScript, and Expo Doctor. Expo Doctor must have network access to complete all metadata checks.

The safety-calibration script expects compiled CommonJS files:

```bash
cd mobile
./node_modules/.bin/tsc \
  src/inference/safetyCalibration.ts \
  src/inference/audioConditioning.ts \
  --ignoreConfig \
  --outDir /tmp/safecity-calibration \
  --module commonjs \
  --target es2020 \
  --skipLibCheck
node scripts/validate-safety-calibration.cjs /tmp/safecity-calibration
```

This harness is not currently part of `npm run check`; add it to the normal check or CI workflow.

Service checks:

```bash
cd service
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check app tests
```

The supported fresh-environment path is:

```bash
cd service
python3.11 -m venv .venv
.venv/bin/python -m pip install -e '.[dev]'
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check app tests
```

### Recorded safety-calibration output

| Scenario | Recorded value | Outcome |
| --- | --- | --- |
| Ordered fall | 220 ms duration, impact observed, 109° angular travel, 0.96 score | Pass |
| Rest | 0.00 motion score | Pass |
| Walking | 0.12 motion score | Pass |
| Short bump | 0.523879 motion score | Pass |
| Conditioned shout | 15 dB SNR, 0.86 gain | Pass |
| Wind suppression | 75% reduction | Pass |

These are deterministic synthetic fixtures, not sensitivity/specificity measurements.

### Bundled model integrity

| File | SHA-256 |
| --- | --- |
| `yamnet.tflite` | `10c95fd9eefb6e0a38e030492ffb305fdc8940bc3191622bd27a660672310d33` |
| Sherpa encoder | `408bb9fb33d8005274e9c8b33b831b3a42f898260a889070c24e1062da61ee75` |
| Sherpa decoder | `63a2253fe31d2a15b6516dcd343be51d3672998b81cc425e88e4108cfc5751de` |
| Sherpa joiner | `190d46b92c383bf7fa1f396ac24fb2163db452d8909893ffc1349e75744863b5` |
| Sherpa tokens | `2d3f3ed8e21d890a5243c1382600ec2fa168e003ed3d39f5f0d089aa6b1f66c4` |
| Sherpa keywords | `bead846c68bc946a9fabaa1fad2988885e4945d187818639b1615a044e991572` |

Verify these hashes before every signed release and fail the build when they differ from the reviewed manifest.

## 2. Missing automated coverage

The repository does not currently contain a CI workflow. The following checks should become required on pull requests and signed releases:

- mobile install from the lock file, TypeScript, Expo Doctor, threat-language, behavior-baseline, and safety-calibration harnesses;
- unit tests for `localFusion.ts`, app-state handoff, permission routing, incident creation, evidence watchdog, retention, erasure, and risk queue expiry;
- parity fixtures exercised against foreground TypeScript, Android native, and Python oracle policies;
- Python lock-file sync, tests, lint, coverage threshold, dependency vulnerability scan, and generated OpenAPI diff;
- secret scanning, license policy, SBOM generation, model hash verification, and Git integrity;
- Android/iOS release build, artifact contents, signing identity, and reproducibility metadata;
- accessibility/static UI checks and localization completeness.

No test in this repository proves SMS/MMS delivery, notification visibility, camera capture while locked, device-specific service survival, or model performance in the intended population.

## 3. Physical-device matrix

At minimum, test low-, mid-, and high-tier Android devices across every supported Android major version and supported iPhones across the published iOS range. Include vendors with aggressive battery managers.

Record:

- permission states: denied, limited/approximate, precise, foreground-only, background, revoked, and full-screen alert denied;
- microphone and motion behavior while active, locked, backgrounded, task-removed, interrupted by a call, rebooted, battery-restricted, and force-stopped;
- Android 14+ reboot notification-tap flow and every Android foreground-service start path;
- iOS transition to inactive/background and the user-facing statement of lost protection;
- foreground-to-native ownership handoff with no simultaneous microphone owner and no blind gap;
- model extraction, cold/warm startup, failure fallback, serialized inference, memory pressure, and app restart;
- rear/front capture timing, camera reversal, pre-alert WAV validity, post-alert duration, watchdog completion, and encrypted-file recovery;
- SQLCipher migration, SecureStore loss/lockout, biometric/passcode changes, backup/restore behavior, and full erasure;
- system composer availability, multiple attachments, canceled send, missing SIM/account, provider size limits, and no false delivery claim;
- Overpass, routing, CARTO, and optional risk API timeouts, malformed responses, empty results, attribution, and disclosure;
- 30-, 60-, and 120-minute CPU, battery, memory, and thermal measurements.

## 4. Safety scenario matrix

Run positive scenarios only with informed participants, a spotter, an immediate stop signal, and no real danger. Run substantially more negative hours than positive trials so false alarms per monitoring hour can be estimated.

### Negative scenarios

1. Quiet rooms, ordinary conversation, offices, cooking, road traffic, transit, exercise, running, stairs, cycling, and potholes.
2. Television, films, social media, games, music, sirens, celebrations, children playing, and speech containing similar words.
3. Phone drops, bag movement, abrupt pocket removal, desk placement, vehicle braking, and repeated device rotation.
4. Wind, rain, fans, crowd noise, clipped audio, Bluetooth route changes, and low microphone gain.

### Consented scripted positive scenarios

1. Shout plus struggle motion.
2. Cry or direct emergency word followed by impact.
3. Repeated supported threat phrase plus independent distress audio.
4. Ordered free-fall/impact/rest sequence.
5. Silent fall and audio-only distress, verifying check-in rather than unsupported auto-SOS.

Vary device location, clothing/bag placement, participant voice, accent, pitch, age band, language, ambient level, and movement ability. Do not infer demographic fairness from aggregate accuracy.

## 5. Metrics and acceptance criteria

Define thresholds before observing the final test set. At minimum report:

- sensitivity and miss rate per supported scenario;
- false automatic SOS per monitoring hour and false check-ins per hour;
- cancel rate and time-to-cancel;
- end-to-end trigger-to-notification/capture/composer latency at p50, p95, and maximum;
- evidence success, partial, unavailable, and decrypt/recovery rates;
- Android service continuity by device/state and iOS active-state limitation;
- direct-word and threat-phrase precision/recall by language and relevant subgroups;
- battery drain per hour, thermal throttling, memory peak, and crash-free monitoring hours;
- route/provider success and timeout rate;
- risk-zone poisoning, replay, and crowd-threshold privacy tests.

The repository does not set numeric release thresholds. Product, safety, privacy, and legal owners must approve them before a pilot; changing thresholds after seeing the final test results invalidates the test.

## 6. Security, privacy, legal, and accessibility gates

Before any external pilot:

- threat-model the phone, evidence vault, exported attachments, Android service, map providers, and FastAPI ingress;
- run mobile and container static/dynamic security testing and remediate high-severity findings;
- authenticate or isolate private service routes and deploy public routes behind TLS and shared abuse controls;
- correct the permission/consent flow and all map/network disclosures identified in [AUDIT_REPORT.md](AUDIT_REPORT.md);
- complete operator, address, privacy, grievance, processor, retention, breach, and data-rights procedures;
- obtain qualified review of the DPDP Act/Rules applicability and consent/notice language;
- test screen readers, dynamic text, contrast, touch targets, focus order, motion/vibration alternatives, and cognitive load during stress;
- provide reviewed legal and safety content in every supported product language.

## 7. Rollout and rollback

1. Lab-only deterministic and device calibration.
2. Internal dogfood with no safety-performance claim.
3. Controlled scripted pilot with an observer and immediate opt-out.
4. Limited opt-in field beta only after security, privacy, accessibility, fairness, device, and model gates pass.
5. General availability only after the notification/delivery path, support coverage, incident response, release signing, and supported-device matrix are audited.

Every stage needs:

- explicit enrollment and withdrawal;
- a monitored false-alarm/miss channel;
- signed configuration/model provenance;
- a remote feature disable or safe rollback plan that cannot silently weaken a user’s understood protection;
- published support and emergency limitations; and
- a stop criterion for accuracy, privacy, battery, crash, service-continuity, or disclosure regressions.
