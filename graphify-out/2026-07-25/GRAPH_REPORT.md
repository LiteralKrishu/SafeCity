# Graph Report - SafeCity  (2026-07-25)

## Corpus Check
- 120 files · ~423,403 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 910 nodes · 1704 edges · 57 communities (50 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2115fd46`
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
- [[_COMMUNITY_index.tsx|index.tsx]]
- [[_COMMUNITY_escape-tools.tsx|escape-tools.tsx]]
- [[_COMMUNITY_SafeCityVoiceTriggerModule|SafeCityVoiceTriggerModule]]
- [[_COMMUNITY_Anonymous community risk zones|Anonymous community risk zones]]
- [[_COMMUNITY_SafeCity DPDP readiness register|SafeCity DPDP readiness register]]
- [[_COMMUNITY_Components|Components]]
- [[_COMMUNITY_SafeCity model card|SafeCity model card]]
- [[_COMMUNITY_Safety sensor calibration|Safety sensor calibration]]
- [[_COMMUNITY_theme-provider.tsx|theme-provider.tsx]]
- [[_COMMUNITY_SafeCityProtectionBootReceiver|SafeCityProtectionBootReceiver]]
- [[_COMMUNITY__layout.tsx|_layout.tsx]]
- [[_COMMUNITY_with-safecity-theme-colors.js|with-safecity-theme-colors.js]]
- [[_COMMUNITY_Background monitoring lifecycle|Background monitoring lifecycle]]
- [[_COMMUNITY_haptics.ts|haptics.ts]]
- [[_COMMUNITY_wav.ts|wav.ts]]
- [[_COMMUNITY___init__.py|__init__.py]]

## God Nodes (most connected - your core abstractions)
1. `SafeCityVoiceTriggerService` - 51 edges
2. `useLocalization()` - 47 edges
3. `SafeCity Terms and Conditions` - 17 edges
4. `SafeCity Privacy Notice` - 16 edges
5. `_EphemeralRateLimiter` - 16 edges
6. `AnonymousRiskStore` - 16 edges
7. `useMonitoring()` - 15 edges
8. `CamelModel` - 15 edges
9. `expo` - 13 edges
10. `readPersistentState()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `EmergencyCard()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/(tabs)/index.tsx → mobile/src/i18n/localization-provider.tsx
- `IncidentDetailScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/incident/[id].tsx → mobile/src/i18n/localization-provider.tsx
- `EscapeToolsScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/escape-tools.tsx → mobile/src/i18n/localization-provider.tsx
- `TabLayout()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/(tabs)/_layout.tsx → mobile/src/i18n/localization-provider.tsx
- `InferenceModelOption` --references--> `InferenceModelPreference`  [EXTRACTED]
  mobile/src/inference/modelProfiles.ts → mobile/src/types/domain.ts

## Import Cycles
- 1-file cycle: `mobile/metro.config.js -> mobile/metro.config.js`

## Communities (57 total, 7 thin omitted)

### Community 0 - "localization-provider.tsx"
Cohesion: 0.12
Nodes (18): CachedTranslationPack, cacheKey(), isCompletePack(), prepareTranslationPack(), readCachedTranslationPack(), TranslationPack, writeCachedTranslationPack(), englishTranslations (+10 more)

### Community 1 - "[sensor].tsx"
Cohesion: 0.24
Nodes (10): CaptureScreen(), OnboardingScreen(), SirenScreen(), styles, SosCountdownScreen(), styles, MonitorScreen(), SettingsScreen() (+2 more)

### Community 2 - "useLocalization"
Cohesion: 0.15
Nodes (16): CoverStoryScreen(), styles, PrivacyNoticeScreen(), DataRightsScreen(), TermsScreen(), HistoryScreen(), styles, LegalDocumentScreen() (+8 more)

### Community 3 - "SafeCity Terms and Conditions"
Cohesion: 0.11
Nodes (17): 10. Intellectual property and open-source components, 11. Disclaimer, 12. Liability, 13. Suspension and termination, 14. Governing law and dispute resolution, 15. Grievances, 16. General terms, 1. Agreement and operator (+9 more)

### Community 4 - "dependencies"
Cohesion: 0.06
Nodes (34): dependencies, expo, expo-asset, expo-audio, expo-battery, expo-camera, expo-constants, expo-crypto (+26 more)

### Community 5 - "expo"
Cohesion: 0.07
Nodes (28): backgroundColor, adaptiveIcon, allowBackup, package, permissions, usesNonExemptEncryption, projectId, typedRoutes (+20 more)

### Community 6 - "safeRoute.ts"
Cohesion: 0.05
Nodes (63): categories, DestinationCategory, SafetyNavigatorScreen(), styles, buildTiles(), coordinateBoundsCenter(), coordinateToWorldPixel(), fitCoordinatesZoom() (+55 more)

### Community 7 - "repository.ts"
Cohesion: 0.13
Nodes (20): AudioTarget, IncidentDetailScreen(), styles, createIncident(), deleteIncidentRecord(), eraseAllLocalData(), getIncident(), IncidentRow (+12 more)

### Community 8 - "settings.tsx"
Cohesion: 0.18
Nodes (10): styles, styles, addContact(), defaultSettings, removeContact(), enablePersistentProtection(), enableVoiceTrigger(), openVoiceTriggerOverlaySettings() (+2 more)

### Community 9 - "voice-trigger.ts"
Cohesion: 0.11
Nodes (30): getThreatPhrase(), isThreatPhraseKeyword(), SEVERITY_WEIGHT, THREAT_PHRASES, ThreatLanguageSignal, ThreatPhraseDefinition, ThreatPhraseKeyword, ThreatPhraseLanguage (+22 more)

### Community 10 - "MonitoringProvider.tsx"
Cohesion: 0.11
Nodes (21): PersistentVoiceTriggerStartResult, PersistentVoiceTriggerState, SafeCityVoiceTriggerEvents, analyzeAudioSignal(), AudioSignalAnalysis, audioSpectrumWindows, MonitoringActions, MonitoringContext (+13 more)

### Community 11 - "SafeCity Privacy Notice"
Cohesion: 0.12
Nodes (16): 10. Rights and grievance redressal, 11. Withdrawal of consent, 12. Children, 13. Language and accessibility, 14. Changes, 15. Official framework used for this draft, 1. Data Fiduciary and contact details, 2. Scope (+8 more)

### Community 12 - "domain.ts"
Cohesion: 0.18
Nodes (14): riskStyle, styles, healthColor, styles, BehaviorBaselineTelemetry, initialHealth, MonitorStore, Assessment (+6 more)

### Community 13 - "SafeCity architecture"
Cohesion: 0.29
Nodes (6): Failure behavior, Mobile modules, On-device inference modules, Production gaps, SafeCity architecture, Trust boundary

### Community 14 - "capture.tsx"
Cohesion: 0.36
Nodes (6): decryptEvidenceToCache(), encryptEvidenceBytes(), encryptEvidenceFile(), getEvidenceKey(), incidentDirectory(), sealEvidenceBytes()

### Community 15 - "SafeCity"
Cohesion: 0.17
Nodes (12): Build the native app, Build troubleshooting, Evidence and platform constraints, License, On-device AI runtime, Privacy and legal readiness, Repository layout, Research basis (+4 more)

### Community 16 - "sms.ts"
Cohesion: 0.09
Nodes (26): BoundedResult, CapturePhase, styles, SafeCityMmsModule, updateIncidentEvidence(), updateIncidentLocation(), accuracyOf(), getCurrentLocation() (+18 more)

### Community 17 - "_layout.tsx"
Cohesion: 0.11
Nodes (15): styles, readStoredLanguagePreference(), secureStoreOptions, writeStoredLanguagePreference(), LocalizationContext, LocalizationProvider(), LocalizationValue, TranslationParams (+7 more)

### Community 18 - "package.json"
Cohesion: 0.22
Nodes (8): devDependencies, expo-doctor, @types/react, typescript, main, name, private, version

### Community 19 - "calculator.tsx"
Cohesion: 0.29
Nodes (3): keys, Operator, styles

### Community 20 - "Validation and rollout checklist"
Cohesion: 0.33
Nodes (5): Automated checks, Device matrix, Release sequence, Scenario matrix, Validation and rollout checklist

### Community 21 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, android, check, check:behavior-baseline, check:threat-language, ios, prebuild, start

### Community 22 - "README.md"
Cohesion: 0.40
Nodes (3): Bundled YAMNet model, Runtime profiles, Bundled emergency-word and threat-phrase model

### Community 23 - "reactNativeDirectoryCheck"
Cohesion: 0.50
Nodes (4): reactNativeDirectoryCheck, expo, doctor, exclude

### Community 27 - "SafeCityVoiceTriggerService"
Cohesion: 0.07
Nodes (37): AudioRecord, File, Float, FloatArray, IBinder, Int, KeywordSpotter, completeStartCallbacks() (+29 more)

### Community 28 - "[sensor].tsx"
Cohesion: 0.05
Nodes (63): compactVoiceTriggerLabel(), healthColor(), healthLabel(), LiveLocation, SensorDetailScreen(), SensorType, styles, supportedSensors (+55 more)

### Community 29 - "_EphemeralRateLimiter"
Cohesion: 0.06
Nodes (50): APIRouter, AssessmentStore, BaseModel, BaseSettings, Connection, FastAPI, FusionEngine, PatternRetriever (+42 more)

### Community 30 - "behaviorBaseline.ts"
Cohesion: 0.12
Nodes (26): assessBehaviorDeviation(), BehaviorBaselinePhase, BehaviorBaselineStatus, BehaviorDeviationSignal, BehaviorLocationSample, BehaviorObservation, BehaviorProfileRow, clip() (+18 more)

### Community 31 - "SafeCityVoiceTriggerModule"
Cohesion: 0.14
Nodes (12): SafeCityDeviceCapabilitiesModule, SafeCityMmsModule, canUseFullScreenIntent(), emitKeywordDetected(), emitSafetyDetected(), Boolean, Context, String (+4 more)

### Community 32 - "safetyCalibration.ts"
Cohesion: 0.20
Nodes (11): CalibratedMotionFeatures, CalibratedMotionPoint, CalibratedMotionScore, clip01(), extractCalibratedMotionFeatures(), rms(), SAFETY_CALIBRATION, scoreCalibratedMotion() (+3 more)

### Community 33 - "fake-call.tsx"
Cohesion: 0.18
Nodes (12): CallerId, callers, CallPhase, delays, FakeCallPlaybackCancelledError, FakeCallScreen(), formatDuration(), playFakeCallAudio() (+4 more)

### Community 34 - "permissions.ts"
Cohesion: 0.26
Nodes (10): styles, allCorePermissionsGranted(), fullScreenAlertsAllowed(), getCorePermissionSnapshot(), getSensorHealth(), hasPreciseLocation(), PermissionSnapshot, requestCorePermissions() (+2 more)

### Community 35 - "siren.ts"
Cohesion: 0.26
Nodes (11): createSirenWave(), ensureSirenFile(), isSirenStartCancelled(), releasePlayer(), SirenStartCancelledError, startSiren(), startSirenAttempt(), startSirenInternal() (+3 more)

### Community 36 - "index.tsx"
Cohesion: 0.20
Nodes (7): EmergencyCard(), ProtectionCard(), ProtectionIcon, statusForHealth(), styles, LanguagePicker(), styles

### Community 37 - "escape-tools.tsx"
Cohesion: 0.24
Nodes (8): EscapeToolsScreen(), styles, VisibleSheet, ChoiceItem, ChoiceSheet(), styles, EscapeToolCard(), styles

### Community 39 - "Anonymous community risk zones"
Cohesion: 0.22
Nodes (9): Anonymous community risk zones, API, Configuration, Map renderer compatibility, Production rollout, Read visible zones, Submit one coarse report, Verification (+1 more)

### Community 40 - "SafeCity DPDP readiness register"
Cohesion: 0.29
Nodes (6): Change-control rule, Configuration required, Current legal timeline, Implemented in this repository, Release blockers, SafeCity DPDP readiness register

### Community 41 - "Components"
Cohesion: 0.29
Nodes (7): Adaptive behavior baseline, Components, Fusion and confirmation, Motion model, Pretrained audio model, Retrieved pattern layer, Voice keyword model

### Community 42 - "SafeCity model card"
Cohesion: 0.29
Nodes (7): Current quality claims, Feedback and privacy, Intended use, Known limitations, Proposed pilot gates, Required validation dataset, SafeCity model card

### Community 43 - "Safety sensor calibration"
Cohesion: 0.29
Nodes (6): Calibration checks, Motion decision rules, Outdoor audio conditioning, References, Safety sensor calibration, Sensor units and sampling

### Community 44 - "theme-provider.tsx"
Cohesion: 0.29
Nodes (4): writeSettings(), AppearancePreference, ThemeContext, ThemeValue

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
}, darkColors, lightColors

## Knowledge Gaps
- **266 isolated node(s):** `What changed`, `Repository layout`, `On-device AI runtime`, `Build troubleshooting`, `Safety decision policy` (+261 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLocalization()` connect `useLocalization` to `[sensor].tsx`, `fake-call.tsx`, `index.tsx`, `escape-tools.tsx`, `safeRoute.ts`, `repository.ts`, `settings.tsx`, `MonitoringProvider.tsx`, `_layout.tsx`, `sms.ts`, `_layout.tsx`, `[sensor].tsx`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `TranslationKey` connect `_layout.tsx` to `settings.tsx`, `fake-call.tsx`, `localization-provider.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `SafeCityVoiceTriggerModule` connect `SafeCityVoiceTriggerModule` to `MonitoringProvider.tsx`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `What changed`, `Repository layout`, `On-device AI runtime` to the rest of the system?**
  _270 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `localization-provider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11956521739130435 - nodes in this community are weakly interconnected._
- **Should `useLocalization` be split into smaller, more focused modules?**
  _Cohesion score 0.14666666666666667 - nodes in this community are weakly interconnected._
- **Should `SafeCity Terms and Conditions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._