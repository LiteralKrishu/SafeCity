# SafeCity engineering, privacy, security, and readiness audit

**Assessment date:** 25 July 2026  
**Source baseline:** commit `2115fd4`  
**Audited scope:** repository source, configuration, bundled model artifacts, documentation, deterministic mobile scripts, Python tests, and local build metadata  
**Overall disposition:** **not production-ready; controlled lab work only until the high-priority findings are closed**

This is an engineering audit, not a certification, penetration test, medical-device assessment, emergency-service approval, or legal opinion. Legal findings identify implementation/documentation mismatches for qualified counsel and the product owner to resolve.

## Executive summary

SafeCity has a stronger privacy-oriented foundation than a typical prototype:

- foreground monitoring and incident inference are on-device;
- the incident database is SQLCipher-encrypted with a key held in SecureStore;
- evidence files use AES-GCM;
- ordinary sensor windows are volatile;
- automatic SOS uses multi-signal and temporal gates;
- community risk reports are coarse, time-bucketed, thresholded, and separately enabled; and
- the supplied service container runs non-root with privilege escalation disabled.

However, those controls do not yet support a public safety or compliance claim. The current onboarding blocks the entire app unless every permission—including precise/background location, camera, notification, and Android full-screen alert access—is granted. It then automatically enables continuous voice processing, behavior baselining, background location, and monitoring after a bundled consent. Safety Navigator automatically sends exact coordinates to external map services even though the in-app notice describes a later user choice and the screen says the route stays inside SafeCity. iOS has no equivalent of the Android background service. The optional FastAPI service exposes costly and state-changing development routes without authentication. Finally, there is no representative device/model validation report.

### Priority profile

| Priority | Count | Meaning |
| --- | ---: | --- |
| High | 7 | Blocks production release or external safety/compliance claims |
| Medium | 8 | Must be planned before a controlled external pilot |
| Low | 2 | Engineering hygiene with limited direct user impact |

No critical remote-code-execution or plaintext-evidence defect was established by this source review. That is not proof that none exists; dynamic mobile and deployed-service testing was not performed.

## Method and confidence

The audit used:

- repository inventory and tracked-file review;
- execution-path tracing from onboarding through monitoring, app-state handoff, SOS, evidence, messaging, retention, erasure, maps, and anonymous risk aggregation;
- configuration and container review;
- deterministic mobile policy/calibration scripts;
- Python unit tests and lint;
- bundled-model SHA-256 verification;
- local dependency-tree resolution; and
- comparison with current official Expo, Android, and Indian DPDP primary material.

Confidence labels mean:

- **High:** direct, unambiguous source/config/test evidence;
- **Medium:** source evidence is clear but deployment, OS, or legal context can change impact;
- **Low:** inference needs runtime or organizational evidence.

## Validation snapshot

| Area | Result |
| --- | --- |
| Threat-language deterministic checks | Pass |
| Behavior-baseline deterministic checks | Pass |
| TypeScript strict check | Pass |
| Safety-calibration deterministic checks | Pass |
| Python tests | 17 passed |
| Python lint | Pass |
| Bundled model hashes | Six of six matched |
| Expo Doctor | 18 of 20; two network-backed metadata checks not completed |
| npm/Python live vulnerability scans | Not completed because external registry egress was not authorized |
| Mobile physical-device and release builds | Not completed |
| Representative safety-performance evidence | Not present |
| Git integrity | Failed because `.git/refs/.DS_Store` is an invalid ref; dangling trees also reported |

Full commands, hashes, limitations, and the required field matrix are in [VALIDATION.md](VALIDATION.md).

## Findings register

| ID | Priority | Area | Finding | Confidence |
| --- | --- | --- | --- | --- |
| SC-H01 | High | Privacy / UX | All-or-nothing permission gate prevents meaningful degraded use |
| SC-H02 | High | Consent / minimization | Optional continuous processing is bundled and automatically enabled |
| SC-H03 | High | Privacy / third parties | Safety Navigator exact-location egress conflicts with the notice and UI |
| SC-H04 | High | Safety / platform | Android background protection has no iOS-equivalent implementation |
| SC-H05 | High | API security | Development and state-changing service routes are unauthenticated and broadly exposed |
| SC-H06 | High | Safety assurance | No representative accuracy, false-alarm, battery, or device-continuity evidence |
| SC-H07 | High | Release governance | Placeholder legal identity/configuration does not fail a production build |
| SC-M01 | Medium | Safety architecture | Three independent decision policies can drift |
| SC-M02 | Medium | Transport security | Mobile risk configuration accepts plaintext HTTP |
| SC-M03 | Medium | Quality | No CI; default mobile check omits calibration and major application paths |
| SC-M04 | Medium | Supply chain | Python dependencies are not locked; SBOM/vulnerability evidence is absent |
| SC-M05 | Medium | Accessibility / language | Legal language, localization, and accessibility assurance are incomplete |
| SC-M06 | Medium | Abuse resistance | Risk limiter is process-local and address-derived |
| SC-M07 | Medium | Service data protection | Comparison summaries use an unencrypted application SQLite file |
| SC-M08 | Medium | Operations | No vulnerability disclosure, ownership, incident-response, or release-control files |
| SC-L01 | Low | Repository integrity | A Finder metadata file in `.git/refs` breaks ref validation |
| SC-L02 | Low | Test maintenance | Python test stack emits a Starlette/httpx deprecation warning |

## High-priority findings

### SC-H01 — All-or-nothing permission gate

**Evidence**

- `mobile/src/services/permissions.ts` defines camera, microphone, motion, foreground location, precise location, background location, notifications, and full-screen alerts in one `PermissionSnapshot`.
- `allCorePermissionsGranted()` returns `Object.values(snapshot).every(Boolean)`.
- `mobile/app/index.tsx`, `mobile/app/onboarding.tsx`, and `MonitoringProvider.tsx` use that aggregate gate.
- Onboarding cannot finish without all permissions and at least one emergency contact.

**Impact**

A user who does not grant an optional or context-specific capability cannot reach manual SOS, local history, siren, escape tools, foreground-only monitoring, or another safe degraded mode. Requiring precise/background location and camera to access unrelated features conflicts with the repository’s own claims of graceful degradation and data minimization. It also makes consent less freely chosen because refusal means loss of the whole product.

**Recommendation**

Define a small required core, preferably allowing manual tools with no sensor permission. Request permissions just in time:

- microphone/motion when the user enables monitoring;
- camera only before evidence capture or a clearly explained setup choice;
- foreground/exact location when the user invokes a location-dependent feature;
- background location only when the user separately enables it;
- notifications/full-screen access only for the relevant Android protection path.

Make the root router depend on legal/onboarding state, not every runtime permission. Show capability-specific health and allow re-enablement later.

**Exit criteria**

- A permission-to-feature matrix is approved.
- Denial/revocation tests prove unaffected features remain usable.
- No route loop sends a user back to onboarding solely because an optional permission is absent.
- Notice, store disclosure, and UX copy match the new matrix.

**Confidence:** High.

### SC-H02 — Bundled consent and automatic optional-feature enablement

**Evidence**

- The second onboarding consent statement combines local audio/motion analysis, continuous voice-SOS microphone processing, and an encrypted behavior baseline.
- `finish()` in `mobile/app/onboarding.tsx` writes `monitoringEnabled`, `backgroundLocation`, `voiceKeywordEnabled`, and `behaviorBaselineEnabled` as `true`.
- The repository default for `behaviorBaselineEnabled` is otherwise `false`.
- The Privacy Notice says optional features are separately controlled, but first completion enables them together.

**Impact**

Continuous background microphone processing, background location, and coarse routine learning are materially different purposes and risk levels. Bundling them makes it difficult to establish a specific, informed, and freely chosen opt-in. Automatic enablement also violates user expectations created by “optional” language.

**Recommendation**

Separate the choices and default optional capabilities off:

1. core foreground monitoring;
2. continuous Android voice protection;
3. background location;
4. adaptive behavior baseline;
5. anonymous community risk contribution;
6. incident evidence capture.

Explain platform-specific consequences beside each switch, record an independently versioned choice and timestamp, and allow onboarding to complete without optional switches.

**Exit criteria**

- Consent records preserve each purpose independently.
- Optional features remain off unless affirmatively enabled.
- Withdrawal of one purpose stops and erases only the relevant processing.
- Legal review approves the final notice and interaction.

**Confidence:** High for implementation; qualified legal review is still required.

### SC-H03 — Safety Navigator disclosure mismatch

**Evidence**

- On mount, `mobile/app/safety-navigator.tsx` calls `refreshLocation(true)` and then `loadNearbyHavens()` automatically.
- `mobile/src/utils/safeRoute.ts` submits an Overpass query containing the current exact coordinates.
- Selecting a destination sends exact origin and destination coordinates to `routing.openstreetmap.de`.
- `mobile/src/components/SafetyMap.tsx` loads CARTO raster tiles.
- The screen says “Route stays inside SafeCity.”
- `mobile/src/legal/content.ts` says Overpass receives coordinates only if the user chooses “Load real nearby places,” does not name the route or tile recipients, and presents local-only wording for the route.

**Impact**

The user cannot make an informed choice before exact location leaves the device. The notice and screen materially under-describe network processing and likely recipient network metadata. This creates privacy, consent, store-label, and trust risk.

**Recommendation**

Before the first network request, show a concise, accessible disclosure and separate action. State:

- current exact coordinates go to the selected nearby-place service;
- exact origin/destination go to the route service;
- CARTO receives tile requests and ordinary network metadata;
- SafeCity does not save route history, but external providers apply their own terms/notices.

Consider a local/static map state before opt-in, proxying under appropriate contracts, minimizing coordinate precision where the function allows it, and provider configuration rather than hard-coded public endpoints. Replace “Route stays inside SafeCity” with technically accurate wording.

**Exit criteria**

- No exact map request occurs before a user action covered by the notice.
- Privacy Notice, just-in-time disclosure, store labels, and implementation agree.
- Privacy/consent versions are bumped and existing users are re-prompted where required.
- Provider terms, attribution, logging, availability, and processor/controller roles are reviewed.

**Confidence:** High.

### SC-H04 — No equivalent iOS background protection

**Evidence**

- `MonitoringProvider.tsx` stops the React audio stream and motion subscription whenever `AppState` is not `active`.
- Android hands ownership to `SafeCityVoiceTriggerService`.
- No iOS native service provides equivalent keyword/audio/motion monitoring.
- Background location is not equivalent to safety-signal processing.

**Impact**

An iOS user may reasonably believe protection continues after locking the phone or leaving the app, while the core audio/motion pipeline has stopped. This is a safety-claim, UX, test, and platform-parity risk.

**Recommendation**

Choose and document one of two product positions:

- implement a permitted, App Store-reviewable iOS design with clearly bounded capabilities; or
- explicitly scope iOS protection to the active app, surface a persistent in-product status, adjust onboarding/marketing/store copy, and prevent any “continuous” cross-platform claim.

Treat Android OS/vendor interruption and force-stop behavior with the same clarity.

**Exit criteria**

- Supported states are specified per OS/version.
- Screen-lock/background/task-removal/reboot tests pass on the device matrix.
- User-facing status and marketing cannot imply unsupported continuity.

**Confidence:** High for current source behavior; runtime continuity still needs devices.

### SC-H05 — Unauthenticated service surface

**Evidence**

- FastAPI exposes `/v1/analyze`, `/v1/patterns`, `/v1/feedback`, `/v1/privacy/erase`, `/metrics`, `/v1/risk/reports`, and `/v1/risk/zones` without authentication.
- `/v1/analyze` invokes a comparatively expensive model and writes a retained summary.
- Feedback mutates stored assessment state and erasure deletes matching summaries.
- Only the two risk endpoints have route-level rate limiting.
- `docker-compose.yml` publishes `8000:8000`; Uvicorn listens on `0.0.0.0`.
- Interactive `/docs` and `/openapi.json` remain enabled.

**Impact**

If exposed beyond a trusted development host, unauthenticated clients can consume compute/storage, poison comparison feedback, enumerate public patterns/metrics, and attempt erasure. Anonymous risk endpoints can be replayed or poisoned despite coarse privacy controls. A public development surface increases denial-of-service and operational risk.

**Recommendation**

Separate the comparison oracle from the public aggregation deployment. Bind development-only service use to loopback/private networks. For any deployed service:

- require TLS;
- authenticate and authorize analysis, feedback, erasure, and metrics;
- bind erasure to a verified subject/session capability;
- use shared edge/body/concurrency/rate controls;
- add request deadlines, backpressure, quotas, and abuse telemetry;
- restrict or disable documentation and metrics externally;
- define trusted proxy handling before using client network addresses.

**Exit criteria**

- A documented ingress and trust model exists.
- Unauthorized integration tests cover every route.
- Load/abuse tests demonstrate bounded CPU, memory, database, and queue growth.
- Public risk poisoning/replay tests and operational monitoring pass.

**Confidence:** High.

### SC-H06 — Missing representative safety evidence

**Evidence**

- Deterministic scripts cover selected phrases, baseline behavior, and synthetic motion/audio conditioning.
- Python tests validate the comparison policy.
- The model card and validation file acknowledge the lack of a representative consented dataset and field calibration.
- No device-matrix report, false alarms per hour, subgroup performance, battery/thermal profile, or end-to-end delivery result is checked in.

**Impact**

The repository cannot substantiate detection, false-alarm, continuity, evidence, latency, or battery claims for the intended population and environments. In a personal-safety product, both misses and false escalations can cause harm.

**Recommendation**

Execute the staged plan in [VALIDATION.md](VALIDATION.md). Pre-register metrics and acceptance thresholds, use substantially more negative monitoring hours than scripted positives, report confidence intervals, stratify relevant language/device/environment groups, and retain traceable model/config/build provenance.

**Exit criteria**

- Independent reviewers approve the protocol and dataset governance.
- Pre-registered accuracy, false-alarm, latency, continuity, evidence, and battery thresholds pass.
- Limitations are reflected in UX, Terms, support, and marketing.
- A rollback/feature-disable and post-release monitoring process exists.

**Confidence:** High.

### SC-H07 — Production builds can retain placeholder legal configuration

**Evidence**

- `mobile/src/legal/content.ts` substitutes bracketed placeholders when six public legal variables are absent.
- The UI displays a prototype warning.
- No build-time script or EAS profile fails a production build when placeholders remain.
- The source repository cannot establish what secrets/variables may be configured in the external EAS project.

**Impact**

A distributable artifact can identify no real Data Fiduciary, address, privacy channel, Grievance Officer, or jurisdiction. A visible warning is appropriate for development but is not a production control.

**Recommendation**

Add a release preflight invoked by production EAS builds that fails on missing, placeholder, malformed, or unapproved values. Generate an artifact manifest containing legal versions, operator identity checksum, model hashes, dependency/SBOM references, signing identity, and source commit.

**Exit criteria**

- Preview builds are visibly marked non-production.
- Production builds fail closed on incomplete configuration.
- Release review verifies the rendered documents and operational channels.

**Confidence:** High for repository behavior; external EAS state was not audited.

## Medium-priority findings

### SC-M01 — Decision-policy drift

Foreground TypeScript fusion identifies itself as sensor fusion 3.4.0; the Python comparison oracle is 2.0.0; Android background processing has its own constants and high-level rules. They share intent but not one executable policy or parity suite.

**Risk:** A scenario can produce materially different escalation depending on app state or test oracle, making safety evidence difficult to interpret.

**Action:** Define a versioned, platform-neutral decision contract and shared fixtures. Require deliberate deviation records for constraints that cannot match. Incident records should identify pipeline and exact policy version.

**Confidence:** High.

### SC-M02 — Plaintext HTTP accepted for risk service

`isRiskServiceConfigured()` accepts `^https?://`, while the configuration documentation says production should use HTTPS.

**Risk:** A misconfigured release can transmit coarse safety reports and request areas over plaintext transport.

**Action:** Reject non-HTTPS endpoints in production builds; permit loopback HTTP only in an explicit development mode. Add a build-time URL test and certificate/timeout deployment policy.

**Confidence:** High.

### SC-M03 — CI and automated coverage gaps

There is no checked-in CI workflow. `npm run check` omits the safety-calibration harness and there is no broad mobile unit/integration suite for fusion, permission routing, evidence, retention, erasure, messaging, or app-state handoff.

**Risk:** Policy, privacy, and platform regressions can merge without a consistent gate.

**Action:** Implement the required pull-request/release checks listed in [VALIDATION.md](VALIDATION.md), including physical-device tests outside ordinary CI.

**Confidence:** High.

### SC-M04 — Dependency and software-supply-chain evidence

The mobile app has a lock file and its production dependency tree resolves locally. The Python project has only version ranges in `pyproject.toml`, no lock file, no SBOM, and no checked-in vulnerability report. Live npm/Python vulnerability queries were not authorized during this audit. Model hashes match today, but no release gate enforces them.

**Risk:** Rebuilds can resolve different Python transitive dependencies, and release reviewers lack current vulnerability/license/provenance evidence.

**Action:** Lock Python dependencies with hashes, build from an approved base-image digest, produce CycloneDX or SPDX SBOMs, scan source/dependencies/images, enforce model manifests, and document exception/upgrade SLAs.

**Confidence:** High for repository state; vulnerability status is unknown.

### SC-M05 — Legal language, localization, and accessibility assurance

English, Hindi, and Bengali product strings are bundled and other languages may use device translation. The legal documents themselves are authored in English, substantial screen copy remains hard-coded, and no accessibility audit evidence is present.

**Risk:** A user may consent without equivalent legal/safety information in the language used for onboarding. Stress-time controls may be inaccessible to screen-reader, low-vision, motor, hearing, or cognitive users.

**Action:** Professionally translate and legally review notice/consent/Terms for supported audiences; do not rely on unreviewed machine translation for legally operative content. Test screen readers, focus order, large text, contrast, touch targets, reduced motion, haptic/audio alternatives, and timed SOS cancellation.

**Confidence:** High for repository evidence; exact statutory language requirements need counsel.

### SC-M06 — Process-local risk rate limiter

The limiter stores address keys in an in-process dictionary of deques. It is reset by restart, does not coordinate across replicas, trusts `request.client.host`, and never removes empty address keys. Network-address sharing can also group unrelated users.

**Risk:** It is not a dependable production abuse control and can grow under high-cardinality sources.

**Action:** Use shared edge limits and verified proxy configuration, cap key cardinality, expire empty keys, add replay/attestation controls, and monitor accepted/deduplicated/rejected distributions without undermining the privacy design.

**Confidence:** High.

### SC-M07 — Unencrypted service SQLite file

The comparison oracle hashes device/session identifiers and avoids raw audio, but assessment and risk summaries are stored in a normal SQLite database on the service volume. There is no application-level volume encryption or key lifecycle in the repository.

**Risk:** Host/volume compromise exposes assessment summaries, coarse risk data, feedback, and timing information.

**Action:** Keep the oracle local/development-only or deploy on encrypted managed storage with least-privilege access, backup/restore/deletion controls, audited retention, and processor/security documentation. Reassess whether comparison summaries need persistence at all.

**Confidence:** High for application behavior; infrastructure encryption may exist outside the repository.

### SC-M08 — Operational governance files are absent

No checked-in `SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS`, release checklist, changelog, CI policy, vulnerability disclosure route, or incident-response runbook was found.

**Risk:** Ownership, review authority, security reporting, release evidence, and emergency change control are ambiguous.

**Action:** Add named code/safety/privacy owners, protected-branch rules, two-person review for safety/legal changes, a private vulnerability-reporting path, release and rollback runbooks, and incident/breach escalation procedures.

**Confidence:** High for repository state; external organizational controls were not audited.

## Low-priority findings

### SC-L01 — Invalid Git ref metadata

`git fsck` reports `.git/refs/.DS_Store` as an invalid ref and also reports dangling tree objects.

**Action:** After confirming no ref data is needed, remove the Finder metadata from `.git/refs`, rerun `git fsck`, and prevent filesystem metadata in Git internals. Dangling objects are normally harmless but should be reviewed after ref repair.

**Confidence:** High.

### SC-L02 — Test-client deprecation warning

The Python suite passes but emits a Starlette TestClient/httpx deprecation warning.

**Action:** Update/pin the compatible test stack and keep deprecation warnings visible or fatal in CI before the dependency becomes incompatible.

**Confidence:** High.

## Positive controls observed

| Area | Control |
| --- | --- |
| Data minimization | No continuous video; fixed short foreground audio windows; 15-second pre-alert ring is volatile until confirmed SOS |
| Local processing | Mobile monitoring does not call the Python `/v1/analyze` endpoint |
| Evidence | AES-GCM encrypted app-private files; partial/unavailable state survives capture failure |
| Database | SQLCipher key from SecureStore; cipher memory security and secure deletion enabled |
| Decision safety | Multi-signal/two-window gates, cooldown, hysteresis, behavior support-only rule, media/drop suppressors |
| User agency | Ten-second cancelable countdown and system composer; no silent-message or delivery claim |
| Anonymous risk privacy | Coarse cell before transport, hourly bucket, rotating token, bounded queue, 30-day default retention, minimum crowd threshold, no published exact counts |
| Model provenance | Bundled artifact hashes match the documented manifest |
| Service container | Non-root runtime, `no-new-privileges`, memory limit, health check, no Uvicorn access log |
| Data rights | Local incident deletion, retention controls, consent withdrawal, and erasure flows exist |

These strengths should be preserved while remediating the findings.

## Remediation sequence

### P0 — Before any external pilot

1. Fix SC-H01 and SC-H02: permission matrix and independent optional consent.
2. Fix SC-H03 and bump the relevant legal/consent versions.
3. Decide and communicate the iOS background product boundary in SC-H04.
4. Isolate/harden the service under SC-H05 or do not deploy it.
5. Add production legal/config preflight under SC-H07.
6. Establish the safety protocol, ownership, stop criteria, and device lab for SC-H06.

### P1 — Before collecting external performance data

1. Add shared policy fixtures and explicit pipeline versions.
2. Add CI, lock/SBOM/model manifest, vulnerability scans, and release evidence.
3. Complete accessibility/language, threat-model, and privacy/legal review.
4. Harden risk abuse controls and service data storage.
5. Add owner, disclosure, incident-response, and rollback documentation.

### P2 — Before a limited field beta

1. Meet pre-registered accuracy, false-alarm, latency, battery, evidence, and continuity thresholds.
2. Close high/medium security and privacy findings or obtain documented risk acceptance from accountable owners.
3. Verify signed production artifacts, store disclosures, support coverage, grievance/rights operations, and breach response.
4. Publish precise supported-device/state limitations and a rollback path.

## Audit limitations

The following were not available or authorized:

- source and runtime state of the external EAS project, signing keys, store records, or production infrastructure;
- real Android/iOS devices, microphones, camera, SMS/MMS accounts, or OS background-state observation;
- a deployed FastAPI ingress, TLS/proxy policy, infrastructure encryption, monitoring, or backup environment;
- live npm/Python vulnerability registry queries;
- dynamic application security or penetration testing;
- representative participant data, model-quality metrics, accessibility testing, or independent legal review.

Claims about these areas must remain **unverified**, not “passed.”

## Primary reference baseline

- [Expo SDK current version reference](https://docs.expo.dev/versions/latest/)
- [Android background foreground-service start restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start)
- [Android foreground-service platform changes](https://developer.android.com/develop/background-work/services/fgs/changes)
- [Digital Personal Data Protection Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [DPDP commencement notification, 13 November 2025](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)

The existing [DPDP readiness register](DPDP_COMPLIANCE.md) correctly treats a written policy as insufficient and lists unresolved organizational/legal controls. Re-run legal review whenever collection, recipients, purpose, retention, hosting, age scope, evidence, or product claims change.
