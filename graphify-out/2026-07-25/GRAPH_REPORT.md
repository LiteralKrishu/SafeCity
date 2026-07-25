# Graph Report - SafeCity  (2026-07-23)

## Corpus Check
- 88 files · ~91,635 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 457 nodes · 764 edges · 27 communities (24 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `672cc666`
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

## God Nodes (most connected - your core abstractions)
1. `useLocalization()` - 47 edges
2. `SafeCity Terms and Conditions` - 17 edges
3. `SafeCity Privacy Notice` - 16 edges
4. `expo` - 13 edges
5. `useMonitoring()` - 13 edges
6. `SafeCity` - 11 edges
7. `useMonitorStore` - 10 edges
8. `fetchNearbySafetyRadar()` - 9 edges
9. `SafeCity model card` - 8 edges
10. `SensorDetailScreen()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `HistoryScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/(tabs)/history.tsx → mobile/src/i18n/localization-provider.tsx
- `EmergencyCard()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/(tabs)/index.tsx → mobile/src/i18n/localization-provider.tsx
- `IncidentDetailScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/incident/[id].tsx → mobile/src/i18n/localization-provider.tsx
- `OnboardingScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/onboarding.tsx → mobile/src/i18n/localization-provider.tsx
- `SafetyNavigatorScreen()` --calls--> `useLocalization()`  [EXTRACTED]
  mobile/app/safety-navigator.tsx → mobile/src/i18n/localization-provider.tsx

## Import Cycles
- 1-file cycle: `mobile/metro.config.js -> mobile/metro.config.js`

## Communities (27 total, 3 thin omitted)

### Community 0 - "localization-provider.tsx"
Cohesion: 0.08
Nodes (38): CallerId, callers, CallPhase, delays, FakeCallScreen(), formatDuration(), styles, LanguagePicker() (+30 more)

### Community 1 - "[sensor].tsx"
Cohesion: 0.07
Nodes (31): CaptureScreen(), healthColor(), healthLabel(), LiveLocation, SensorDetailScreen(), SensorType, styles, supportedSensors (+23 more)

### Community 2 - "useLocalization"
Cohesion: 0.10
Nodes (25): CoverStoryScreen(), styles, EscapeToolsScreen(), styles, VisibleSheet, PrivacyNoticeScreen(), DataRightsScreen(), TermsScreen() (+17 more)

### Community 3 - "SafeCity Terms and Conditions"
Cohesion: 0.06
Nodes (30): Components, Current quality claims, Feedback and privacy, Fusion and confirmation, Intended use, Known limitations, Motion model, Pretrained audio model (+22 more)

### Community 4 - "dependencies"
Cohesion: 0.06
Nodes (34): dependencies, expo, expo-asset, expo-audio, expo-battery, expo-camera, expo-constants, expo-crypto (+26 more)

### Community 5 - "expo"
Cohesion: 0.07
Nodes (28): backgroundColor, adaptiveIcon, allowBackup, package, permissions, usesNonExemptEncryption, projectId, typedRoutes (+20 more)

### Community 6 - "safeRoute.ts"
Cohesion: 0.12
Nodes (24): categories, DestinationCategory, SafetyNavigatorScreen(), styles, baseScore, categoryForTags(), categoryIcon, clip() (+16 more)

### Community 7 - "repository.ts"
Cohesion: 0.16
Nodes (15): AudioTarget, IncidentDetailScreen(), styles, HistoryScreen(), styles, deleteIncidentRecord(), getIncident(), IncidentRow (+7 more)

### Community 8 - "settings.tsx"
Cohesion: 0.13
Nodes (15): OnboardingScreen(), styles, styles, addContact(), defaultSettings, eraseAllLocalData(), readSettings(), removeContact() (+7 more)

### Community 9 - "voice-trigger.ts"
Cohesion: 0.18
Nodes (16): BundledModelFile, initializeVoiceTriggerModel(), isSupportedPlatform(), isVoiceTriggerAvailable(), MODEL_FILES, nativeOperationQueue, normalizedSamples(), prepareBundledModelDirectory() (+8 more)

### Community 10 - "MonitoringProvider.tsx"
Cohesion: 0.14
Nodes (12): createIncident(), startSession(), updateIncidentSnapshotUri(), updateSession(), HapticType, triggerHaptic(), MonitoringActions, MonitoringContext (+4 more)

### Community 11 - "SafeCity Privacy Notice"
Cohesion: 0.12
Nodes (16): 10. Rights and grievance redressal, 11. Withdrawal of consent, 12. Children, 13. Language and accessibility, 14. Changes, 15. Official framework used for this draft, 1. Data Fiduciary and contact details, 2. Scope (+8 more)

### Community 12 - "domain.ts"
Cohesion: 0.24
Nodes (11): riskStyle, styles, initialHealth, MonitorStore, Assessment, MotionFeatures, RetrievedPattern, RiskLevel (+3 more)

### Community 13 - "SafeCity architecture"
Cohesion: 0.14
Nodes (12): Failure behavior, Mobile modules, On-device inference modules, Production gaps, SafeCity architecture, Trust boundary, Change-control rule, Configuration required (+4 more)

### Community 14 - "capture.tsx"
Cohesion: 0.23
Nodes (10): CapturePhase, styles, listContacts(), updateIncidentEvidence(), decryptEvidenceToCache(), encryptEvidenceBytes(), encryptEvidenceFile(), getEvidenceKey() (+2 more)

### Community 15 - "SafeCity"
Cohesion: 0.17
Nodes (12): Build the native app, Build troubleshooting, Evidence and platform constraints, License, On-device AI runtime, Privacy and legal readiness, Repository layout, Research basis (+4 more)

### Community 16 - "sms.ts"
Cohesion: 0.33
Nodes (10): buildCompactIncidentSmsMessage(), buildIncidentSmsMessage(), buildStandardIncidentSmsMessage(), EmergencySmsFormat, encodeBase36Signed(), encodeBase36Unsigned(), evidenceCode(), readBatteryPercent() (+2 more)

### Community 17 - "_layout.tsx"
Cohesion: 0.28
Nodes (5): AppStack(), styles, MonitoringProvider(), StartupMaintenance(), useTheme()

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
Cohesion: 0.33
Nodes (6): scripts, android, check, ios, prebuild, start

### Community 23 - "reactNativeDirectoryCheck"
Cohesion: 0.50
Nodes (4): reactNativeDirectoryCheck, expo, doctor, exclude

## Knowledge Gaps
- **208 isolated node(s):** `What changed`, `Repository layout`, `On-device AI runtime`, `Build troubleshooting`, `Safety decision policy` (+203 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLocalization()` connect `useLocalization` to `localization-provider.tsx`, `[sensor].tsx`, `safeRoute.ts`, `repository.ts`, `settings.tsx`, `MonitoringProvider.tsx`, `capture.tsx`, `_layout.tsx`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **What connects `What changed`, `Repository layout`, `On-device AI runtime` to the rest of the system?**
  _208 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `localization-provider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07585568917668825 - nodes in this community are weakly interconnected._
- **Should `[sensor].tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07084785133565621 - nodes in this community are weakly interconnected._
- **Should `useLocalization` be split into smaller, more focused modules?**
  _Cohesion score 0.0960960960960961 - nodes in this community are weakly interconnected._
- **Should `SafeCity Terms and Conditions` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._