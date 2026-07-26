# Graph Report - SafeCity  (2026-07-26)

## Corpus Check
- 129 files · ~475,519 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1109 nodes · 1774 edges · 61 communities (51 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `435e0555`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_localization-provider.tsx|localization-provider.tsx]]
- [[_COMMUNITY_sensor.tsx|[sensor].tsx]]
- [[_COMMUNITY_useLocalization|useLocalization]]
- [[_COMMUNITY_SafeCity Terms and Conditions|SafeCity Terms and Conditions]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_expo|expo]]
- [[_COMMUNITY_safeRoute.ts|safeRoute.ts]]
- [[_COMMUNITY_repository.ts|repository.ts]]
- [[_COMMUNITY_settings.tsx|settings.tsx]]
- [[_COMMUNITY_voice-trigger.ts|voice-trigger.ts]]
- [[_COMMUNITY_MonitoringProvider.tsx|MonitoringProvider.tsx]]
- [[_COMMUNITY_SafeCity Privacy Notice|SafeCity Privacy Notice]]
- [[_COMMUNITY_domain.ts|domain.ts]]
- [[_COMMUNITY_SafeCity architecture|SafeCity architecture]]
- [[_COMMUNITY_capture.tsx|capture.tsx]]
- [[_COMMUNITY_SafeCity|SafeCity]]
- [[_COMMUNITY_sms.ts|sms.ts]]
- [[_COMMUNITY__layout.tsx|_layout.tsx]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_calculator.tsx|calculator.tsx]]
- [[_COMMUNITY_Validation and rollout checklist|Validation and rollout checklist]]
- [[_COMMUNITY_scripts|scripts]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_reactNativeDirectoryCheck|reactNativeDirectoryCheck]]
- [[_COMMUNITY_metro.config.js|metro.config.js]]
- [[_COMMUNITY_REFERENCE_FEATURE_MATRIX|REFERENCE_FEATURE_MATRIX.md]]
- [[_COMMUNITY_SafeCityVoiceTriggerService|SafeCityVoiceTriggerService]]
- [[_COMMUNITY_sensor.tsx|[sensor].tsx]]
- [[_COMMUNITY__EphemeralRateLimiter|_EphemeralRateLimiter]]
- [[_COMMUNITY_behaviorBaseline.ts|behaviorBaseline.ts]]
- [[_COMMUNITY_SafeCityVoiceTriggerModule|SafeCityVoiceTriggerModule]]
- [[_COMMUNITY_safetyCalibration.ts|safetyCalibration.ts]]
- [[_COMMUNITY_fake-call.tsx|fake-call.tsx]]
- [[_COMMUNITY_permissions.ts|permissions.ts]]
- [[_COMMUNITY_siren.ts|siren.ts]]
- [[_COMMUNITY_escape-tools.tsx|escape-tools.tsx]]
- [[_COMMUNITY_SafeCityVoiceTriggerModule|SafeCityVoiceTriggerModule]]
- [[_COMMUNITY_Anonymous community risk zones|Anonymous community risk zones]]
- [[_COMMUNITY_SafeCity DPDP readiness register|SafeCity DPDP readiness register]]
- [[_COMMUNITY_Components|Components]]
- [[_COMMUNITY_SafeCity model card|SafeCity model card]]
- [[_COMMUNITY_Safety sensor calibration|Safety sensor calibration]]
- [[_COMMUNITY_SafeCityProtectionBootReceiver|SafeCityProtectionBootReceiver]]
- [[_COMMUNITY__layout.tsx|_layout.tsx]]
- [[_COMMUNITY_with-safecity-theme-colors.js|with-safecity-theme-colors.js]]
- [[_COMMUNITY_Background monitoring lifecycle|Background monitoring lifecycle]]
- [[_COMMUNITY_haptics.ts|haptics.ts]]
- [[_COMMUNITY_wav.ts|wav.ts]]
- [[_COMMUNITY___init__.py|__init__.py]]
- [[_COMMUNITY_SafeCity project guide|SafeCity project guide]]
- [[_COMMUNITY_riskZones.ts|riskZones.ts]]
- [[_COMMUNITY_SafetyMap.tsx|SafetyMap.tsx]]
- [[_COMMUNITY_Validation and rollout plan|Validation and rollout plan]]
- [[_COMMUNITY__layout.tsx|_layout.tsx]]
- [[_COMMUNITY_history.tsx|history.tsx]]

## God Nodes (most connected - your core abstractions)
1. `SafeCityVoiceTriggerService` - 61 edges
2. `useLocalization()` - 29 edges
3. `SafeCity Terms and Conditions` - 17 edges
4. `SafeCity Privacy Notice` - 16 edges
5. `_EphemeralRateLimiter` - 16 edges
6. `AnonymousRiskStore` - 16 edges
7. `useMonitoring()` - 15 edges
8. `SafeCity project guide` - 15 edges
9. `CamelModel` - 15 edges
10. `expo` - 14 edges

## Surprising Connections (you probably didn't know these)
- `CoverStoryScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/cover-story.tsx → mobile/src/i18n/localization-provider.tsx
- `IncidentDetailScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/incident/[id].tsx → mobile/src/i18n/localization-provider.tsx
- `LanguagePicker()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/src/components/language-picker.tsx → mobile/src/i18n/localization-provider.tsx
- `HistoryScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/(tabs)/history.tsx → mobile/src/i18n/localization-provider.tsx
- `TabLayout()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/(tabs)/_layout.tsx → mobile/src/i18n/localization-provider.tsx

## Import Cycles
- 1-file cycle: `mobile/metro.config.js -> mobile/metro.config.js`

## Communities (61 total, 10 thin omitted)

### Community 0 - "localization-provider.tsx"
Cohesion: 0.12
Nodes (18): CachedTranslationPack, cacheKey(), isCompletePack(), prepareTranslationPack(), readCachedTranslationPack(), TranslationPack, writeCachedTranslationPack(), englishTranslations (+10 more)

### Community 1 - "[sensor].tsx"
Cohesion: 0.18
Nodes (11): CaptureScreen(), OnboardingScreen(), SosCountdownScreen(), styles, SettingsScreen(), styles, resolveSosCountdownDeadline(), sosCountdownSecondsRemaining() (+3 more)

### Community 2 - "useLocalization"
Cohesion: 0.23
Nodes (12): PrivacyNoticeScreen(), DataRightsScreen(), TermsScreen(), LegalDocumentScreen(), styles, useLocalization(), legalConfigurationComplete, legalOperator (+4 more)

### Community 3 - "SafeCity Terms and Conditions"
Cohesion: 0.11
Nodes (17): 10. Intellectual property and open-source components, 11. Disclaimer, 12. Liability, 13. Suspension and termination, 14. Governing law and dispute resolution, 15. Grievances, 16. General terms, 1. Agreement and operator (+9 more)

### Community 4 - "dependencies"
Cohesion: 0.06
Nodes (35): dependencies, expo, expo-asset, expo-audio, expo-battery, expo-camera, expo-constants, expo-crypto (+27 more)

### Community 5 - "expo"
Cohesion: 0.06
Nodes (33): backgroundColor, foregroundImage, monochromeImage, adaptiveIcon, allowBackup, icon, package, permissions (+25 more)

### Community 6 - "safeRoute.ts"
Cohesion: 0.09
Nodes (24): baseScore, categoryForTags(), categoryIcon, clip(), fallbackName, fetchNearbySafeHavens(), fetchNearbySafetyRadar(), haversineMeters() (+16 more)

### Community 7 - "repository.ts"
Cohesion: 0.05
Nodes (39): BoundedResult, CapturePhase, styles, AudioTarget, IncidentDetailScreen(), styles, SafeCityMmsModule, defaultSettings (+31 more)

### Community 8 - "settings.tsx"
Cohesion: 0.27
Nodes (4): CoverStoryScreen(), styles, EscapeToolCard(), styles

### Community 9 - "voice-trigger.ts"
Cohesion: 0.13
Nodes (27): emergencyKeywordPassesLoudnessGate(), LOUDNESS_GATED_EMERGENCY_KEYWORDS, loudnessGatedKeywords, enableVoiceTrigger(), BundledModelFile, EmergencyVoiceTriggerKeyword, getBundledVoiceTriggerModelDirectoryUri(), hasNativeKeywordEngine() (+19 more)

### Community 10 - "MonitoringProvider.tsx"
Cohesion: 0.10
Nodes (21): PersistentVoiceTriggerStartResult, PersistentVoiceTriggerState, SafeCityVoiceTriggerEvents, analyzeAudioSignal(), AudioSignalAnalysis, audioSpectrumWindows, MonitoringActions, MonitoringContext (+13 more)

### Community 11 - "SafeCity Privacy Notice"
Cohesion: 0.12
Nodes (16): 10. Rights and grievance redressal, 11. Withdrawal of consent, 12. Children, 13. Language and accessibility, 14. Changes, 15. Official framework used for this draft, 1. Data Fiduciary and contact details, 2. Scope (+8 more)

### Community 12 - "domain.ts"
Cohesion: 0.05
Nodes (49): riskStyle, styles, healthColor, styles, assessLocalSignalWindow(), calculateMotionScore(), clip(), expireSessions() (+41 more)

### Community 13 - "SafeCity architecture"
Cohesion: 0.17
Nodes (12): Anonymous risk aggregation, Durable data, Failure behavior, Foreground monitoring pipeline, Mobile components, Network and third-party data flows, Production boundary, Python service boundary (+4 more)

### Community 14 - "capture.tsx"
Cohesion: 0.36
Nodes (6): decryptEvidenceToCache(), encryptEvidenceBytes(), encryptEvidenceFile(), getEvidenceKey(), incidentDirectory(), sealEvidenceBytes()

### Community 15 - "SafeCity"
Cohesion: 0.15
Nodes (13): Build the native app, Build troubleshooting, Documentation map, Evidence and platform constraints, License, On-device AI runtime, Privacy and legal readiness, Repository layout (+5 more)

### Community 16 - "sms.ts"
Cohesion: 0.50
Nodes (3): ChoiceItem, ChoiceSheet(), styles

### Community 17 - "_layout.tsx"
Cohesion: 0.13
Nodes (13): LanguagePicker(), styles, readStoredLanguagePreference(), secureStoreOptions, writeStoredLanguagePreference(), LocalizationContext, LocalizationValue, TranslationParams (+5 more)

### Community 18 - "package.json"
Cohesion: 0.22
Nodes (8): devDependencies, expo-doctor, @types/react, typescript, main, name, private, version

### Community 20 - "Validation and rollout checklist"
Cohesion: 0.05
Nodes (38): Aggregation, Compatibility and versioning, Configuration example, Discovery, Endpoint summary, Errors, Errors, Errors (+30 more)

### Community 21 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, android, check, check:background-sos, check:behavior-baseline, check:threat-language, ios, prebuild (+1 more)

### Community 22 - "README.md"
Cohesion: 0.40
Nodes (3): Bundled YAMNet model, Runtime profiles, Bundled emergency-word and threat-phrase model

### Community 23 - "reactNativeDirectoryCheck"
Cohesion: 0.50
Nodes (4): reactNativeDirectoryCheck, expo, doctor, exclude

### Community 27 - "SafeCityVoiceTriggerService"
Cohesion: 0.06
Nodes (43): AudioRecord, File, Float, FloatArray, IBinder, Int, Intent, KeywordSpotter (+35 more)

### Community 28 - "[sensor].tsx"
Cohesion: 0.09
Nodes (36): NativeDeviceCapabilities, SafeCityDeviceCapabilitiesModule, clip(), ConditionedAudio, conditionOutdoorAudio(), OutdoorNoiseMetrics, percentile(), DeviceInferenceCapabilities (+28 more)

### Community 29 - "_EphemeralRateLimiter"
Cohesion: 0.06
Nodes (50): APIRouter, AssessmentStore, BaseModel, BaseSettings, Connection, FastAPI, FusionEngine, PatternRetriever (+42 more)

### Community 30 - "behaviorBaseline.ts"
Cohesion: 0.13
Nodes (25): assessBehaviorDeviation(), BehaviorBaselinePhase, BehaviorBaselineStatus, BehaviorBaselineTelemetry, BehaviorDeviationSignal, BehaviorLocationSample, BehaviorObservation, BehaviorProfileRow (+17 more)

### Community 31 - "SafeCityVoiceTriggerModule"
Cohesion: 0.14
Nodes (13): SafeCityDeviceCapabilitiesModule, SafeCityMmsModule, canUseFullScreenIntent(), emitKeywordDetected(), emitSafetyDetected(), Boolean, Context, Long (+5 more)

### Community 32 - "safetyCalibration.ts"
Cohesion: 0.06
Nodes (33): Audit limitations, Executive summary, Findings register, High-priority findings, Low-priority findings, Medium-priority findings, Method and confidence, P0 — Before any external pilot (+25 more)

### Community 33 - "fake-call.tsx"
Cohesion: 0.18
Nodes (12): CallerId, callers, CallPhase, delays, FakeCallPlaybackCancelledError, FakeCallScreen(), formatDuration(), playFakeCallAudio() (+4 more)

### Community 34 - "permissions.ts"
Cohesion: 0.29
Nodes (8): fullScreenAlertsAllowed(), getCorePermissionSnapshot(), hasPreciseLocation(), PermissionSnapshot, requestCorePermissions(), getPersistentVoiceTriggerState(), isPersistentVoiceTriggerAvailable(), SensorHealth

### Community 35 - "siren.ts"
Cohesion: 0.06
Nodes (35): ProtectionTestsScreen(), statusColor(), styles, TestTile(), compactVoiceTriggerLabel(), healthColor(), healthLabel(), LiveLocation (+27 more)

### Community 39 - "Anonymous community risk zones"
Cohesion: 0.20
Nodes (9): Anonymous community risk zones, API, Configuration, Map renderer compatibility, Production rollout, Read visible zones, Submit one coarse report, Verification (+1 more)

### Community 40 - "SafeCity DPDP readiness register"
Cohesion: 0.33
Nodes (6): Change-control rule, Configuration required, Current legal timeline, Implemented in this repository, Release blockers, SafeCity DPDP readiness register

### Community 41 - "Components"
Cohesion: 0.13
Nodes (14): Adaptive behavior baseline, Components, Current quality claims, Feedback and privacy, Fusion and confirmation, Intended use, Known limitations, Motion model (+6 more)

### Community 42 - "SafeCity model card"
Cohesion: 0.06
Nodes (31): 10. Safety Navigator and external data, 11. Python comparison and risk API, 1. First launch and onboarding, 2. Monitoring session lifecycle, 3. Foreground monitoring and fusion, 4. Direct emergency words and threat phrases, 5. Android foreground/background ownership, 6. Automatic or manual SOS (+23 more)

### Community 43 - "Safety sensor calibration"
Cohesion: 0.29
Nodes (6): Calibration checks, Motion decision rules, Outdoor audio conditioning, References, Safety sensor calibration, Sensor units and sampling

### Community 45 - "SafeCityProtectionBootReceiver"
Cohesion: 0.33
Nodes (4): BroadcastReceiver, Context, Intent, SafeCityProtectionBootReceiver

### Community 46 - "_layout.tsx"
Cohesion: 0.40
Nodes (3): styles, TabIconName, TabLayout()

### Community 47 - "with-safecity-theme-colors.js"
Cohesion: 0.40
Nodes (3): {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidManifest,
}, darkColors, lightColors

### Community 57 - "SafeCity project guide"
Cohesion: 0.06
Nodes (31): 10. Network and data-flow inventory, 11. Verification, 12. Deployment and operations, 13. Troubleshooting, 14. Related documents, 1. Product boundary, 2. What runs where, 3. Repository map (+23 more)

### Community 58 - "riskZones.ts"
Cohesion: 0.11
Nodes (27): accuracyOf(), getCurrentLocation(), getPreciseCurrentLocation(), getRecentAccurateLocation(), getRecentBackgroundLocation(), moreAccurateLocation(), preferFreshLocation(), SafeCityLocationFix (+19 more)

### Community 59 - "SafetyMap.tsx"
Cohesion: 0.17
Nodes (13): categories, DestinationCategory, styles, buildTiles(), coordinateBoundsCenter(), coordinateToWorldPixel(), fitCoordinatesZoom(), MapCoordinate (+5 more)

### Community 60 - "Validation and rollout plan"
Cohesion: 0.15
Nodes (13): 1. Audit-run results, 2. Missing automated coverage, 3. Physical-device matrix, 4. Safety scenario matrix, 5. Metrics and acceptance criteria, 6. Security, privacy, legal, and accessibility gates, 7. Rollout and rollback, Bundled model integrity (+5 more)

### Community 66 - "_layout.tsx"
Cohesion: 0.11
Nodes (10): StartupDecision, styles, styles, palette, SetupStep, styles, BrandLogo(), styles (+2 more)

## Knowledge Gaps
- **410 isolated node(s):** `System context`, `Runtime and platform matrix`, `Foreground monitoring pipeline`, `Mobile components`, `SOS and evidence architecture` (+405 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SafeCity project guide` connect `SafeCity project guide` to `README.md`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `SafeCity service API reference` connect `Validation and rollout checklist` to `README.md`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `useLocalization()` connect `useLocalization` to `[sensor].tsx`, `fake-call.tsx`, `siren.ts`, `history.tsx`, `repository.ts`, `settings.tsx`, `_layout.tsx`, `sms.ts`, `_layout.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `System context`, `Runtime and platform matrix`, `Foreground monitoring pipeline` to the rest of the system?**
  _414 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `localization-provider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11956521739130435 - nodes in this community are weakly interconnected._
- **Should `SafeCity Terms and Conditions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._