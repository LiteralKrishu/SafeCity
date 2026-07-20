# SafeCity Privacy Notice

**Version:** 2026-07-20-v2  
**Effective date:** 20 July 2026  
**Status:** Production template — operator details must be completed before release

> This notice is designed for the SafeCity architecture in this repository and for readiness under India’s Digital Personal Data Protection Act, 2023 (“DPDP Act”) and Digital Personal Data Protection Rules, 2025 (“DPDP Rules”). It is not a legal opinion or a guarantee of compliance. The deploying entity must obtain advice from qualified Indian counsel, complete every bracketed field, validate the actual deployment, and maintain the operational controls described here.

## 1. Data Fiduciary and contact details

For a production deployment, the Data Fiduciary is:

- **Legal name:** [LEGAL ENTITY NAME]
- **Registered address:** [FULL POSTAL ADDRESS]
- **Privacy contact:** [PRIVACY EMAIL]
- **Grievance Officer:** [FULL NAME AND DESIGNATION]
- **Grievance email:** [GRIEVANCE EMAIL]
- **Grievance postal address:** [POSTAL ADDRESS, IF DIFFERENT]

SafeCity must not be publicly distributed until these details identify the person or organisation that determines why and how personal data is processed.

## 2. Scope

This notice applies to the SafeCity mobile app and personal data processed for SafeCity’s monitoring, SOS, evidence, support, privacy-rights and security functions. It does not govern a mobile operating system, telecom carrier, SMS app, mapping provider or emergency service acting for its own purposes; those parties provide their own notices.

## 3. Itemised personal data, purposes and handling

| Personal data | Purpose | Where processed/stored | Retention |
|---|---|---|---|
| Emergency-contact name and phone number | Prepare an SOS message to people chosen by the user | SQLCipher-encrypted database on the device | Until removed, consent is withdrawn or app data is erased |
| Monitoring-session identifier | Keep local assessment windows and incident history separate | SQLCipher-encrypted database and volatile memory on the device | Until app-data erasure; volatile fusion state expires after one hour or session stop |
| Approximately one second of microphone PCM per inference window | Detect possible distress during a user-started monitoring session | Volatile device memory and the model bundled in the APK; never sent to a laptop, server or cloud | Discarded after the assessment attempt; not written to app cache or durable storage |
| Motion features, including acceleration, jerk, rotation, free-fall and impact | Detect fall or struggle patterns and reduce false alarms | Calculated and fused in volatile memory on the device | Ordinary windows are discarded; incident factors follow incident retention |
| Hour of day and app foreground/background state | Bounded assessment context that cannot create a threat by itself | Volatile device memory only | Assessment attempt only |
| Latest available coordinates and accuracy | Attach location to an active incident or SOS | Encrypted device database; excluded from model inference | Overwritten by newer location and removed with app data; incident coordinate follows incident retention |
| Monitoring-session status and timestamps | Operate start, pause, resume and stop controls | Encrypted device database | Until app-data erasure |
| Incident metadata, risk result, factors, model version, location and feedback | Display local history, explain the alert, support safety review and deletion | Encrypted device database | User-selected 1–90 days; default 30 days; earlier deletion available |
| One rear photo, one front photo and 15 seconds of audio after an SOS | Preserve user-authorised incident evidence | AES-GCM encrypted in app-private device storage | Same period as the incident; earlier deletion available |
| Consent, adult confirmation and legal-document versions/timestamps | Record the user’s choices and demonstrate the notice shown | Encrypted device database | Until withdrawal or app-data erasure |
| Technical health and error information | Show degraded sensors and diagnose local failures | Primarily transient on the device; no analytics SDK is included | The operator must document any production crash-reporting retention if such a tool is later added |

SafeCity does not collect a contact list, advertising identifier, account password, payment data or continuous video. It does not sell personal data, use it for targeted advertising or provide it to data brokers.

## 4. Specified purposes and legal basis

SafeCity processes monitoring audio, motion, location, post-SOS evidence and associated identifiers only after free, specific, informed, unconditional and unambiguous consent through clear affirmative actions. Operating-system permissions are separate controls. The user also decides when each monitoring session begins and ends.

Emergency-contact information is voluntarily provided for the specific purpose of preparing an SOS message. The user must have authority to provide that information and should inform the contact. The app does not silently send a message; the operating system requires the user to press **Send**.

If the operator intends to rely on a ground other than consent, adds a new purpose or uses data for a materially different service, it must update this notice, identify a valid lawful basis and obtain fresh consent where required before processing.

## 5. Processors, recipients and disclosures

Personal data may be handled by:

1. **The mobile operating-system provider.** It supplies permissions, protected key storage, notifications, camera, microphone, motion and location functions under its own terms.
2. **SMS and telecom providers and chosen recipients.** They receive message content and any included coordinate only after the user presses **Send**.
3. **A mapping provider.** It receives incident coordinates only if the user chooses to open a map link.
4. **Authorities or other recipients required by law.** The operator may disclose data where legally required and will document the legal basis.

No cloud analytics, advertising SDK or SafeCity-hosted evidence upload exists in this repository.

## 6. Cross-border processing

The supported SafeCity inference path stays inside the user’s phone. Operating-system, SMS, telecom or mapping providers may process data outside India under their own arrangements. Before production release, the deploying entity must inventory every such transfer, comply with any Central Government restriction or sector-specific localisation rule, and update this section with countries and safeguards. The app must not be modified to expose raw monitoring audio to an unreviewed remote service without a new data-flow assessment, notice and consent.

## 7. Retention and erasure

- Raw monitoring windows and ordinary inference results are held only in volatile device memory and discarded after each assessment attempt.
- Incidents and encrypted evidence follow the retention period selected in Settings (1–90 days, default 30) and can be deleted individually at any time.
- Contacts and consent records remain until removed, consent is withdrawn or app data is erased.
- Data may be retained longer only where a law requires it. The operator must document that law and segregate restricted records.

## 8. Security safeguards

The repository implements:

- SQLCipher encryption for durable mobile metadata;
- random 256-bit database keys and evidence keys in platform-protected key storage;
- AES-GCM encryption for incident evidence;
- app-private file storage and deletion of temporary plaintext capture files;
- in-memory monitoring audio processing with no inference network request or monitoring cache file;
- an APK-bundled model and on-device fusion rules, so loss of internet connectivity does not expose or interrupt inference;
- configurable short retention and individual/bulk erasure controls;
- no analytics, advertising or public-cloud inference integration.

A production deployment still requires secure release signing, dependency and model provenance review, tested key lifecycle controls, vulnerability management, incident response and periodic mobile security testing. A locally processed design reduces disclosure risk but does not eliminate device compromise, malicious builds, operating-system access or physical-access risk.

## 9. Personal-data breaches

The Data Fiduciary will maintain a documented incident-response process. When a personal-data breach is identified, it will, as applicable:

- notify each affected person without delay in concise, clear and plain language;
- describe the nature, extent and timing of the breach, likely consequences, mitigation, protective steps and a responsible contact;
- notify the Data Protection Board of India without delay with initial details and provide the required detailed report within 72 hours, unless the Board allows longer; and
- investigate, remediate, preserve required records and prevent recurrence.

Operational owner: [SECURITY INCIDENT OWNER AND 24×7 CONTACT].

## 10. Rights and grievance redressal

Subject to applicable law, a Data Principal may:

- request a summary of personal data and processing activities;
- request the identities of other Data Fiduciaries and Data Processors with whom personal data was shared, where applicable;
- correct, complete or update personal data;
- erase personal data when no longer required for the specified purpose or by law;
- withdraw consent as easily as it was given;
- raise a grievance; and
- nominate another individual to exercise rights in the event of death or incapacity.

In-app controls provide direct access, correction and erasure for locally stored data. Other requests may be sent to [PRIVACY EMAIL]. Grievances should be sent to [GRIEVANCE OFFICER AND EMAIL]. The production operator must respond within its published period, which must be reasonable and not exceed 90 days under the applicable DPDP Rules. A Data Principal should first use this grievance process before approaching the Data Protection Board of India through the mechanism published by the Board.

Do not send unencrypted incident evidence through ordinary email. The operator must verify a requester proportionately and collect only what is necessary to fulfil a rights request.

## 11. Withdrawal of consent

Use **Settings → Legal and your data → Withdraw consent and erase data**. SafeCity will stop monitoring, delete contacts, sessions, incidents, locations, consent records and encrypted evidence from this installation, clear any legacy installation identifier and return to onboarding. Withdrawal does not affect processing that was lawful before withdrawal or processing required by law.

## 12. Children

This build is restricted to people aged 18 or older and does not implement verifiable parental consent. It must not be offered to a child until qualified counsel has reviewed the use case and the operator has implemented verifiable parental consent, due diligence, child-wellbeing safeguards and restrictions on tracking or behavioural monitoring, including the precise scope of any safety-related exception in the DPDP Rules.

## 13. Language and accessibility

The production operator must make consent requests and notices available in clear, plain language and provide the language choices required by section 6(3) of the DPDP Act. This repository currently supplies English only; localisation, professional legal translation and accessibility testing are release requirements.

## 14. Changes

The version and effective date appear at the top. The operator may update this notice to reflect law, security or product changes. If a change materially alters personal-data categories, purposes, recipients or user choice, SafeCity will present the updated notice and obtain fresh consent before the new processing begins.

## 15. Official framework used for this draft

- [Digital Personal Data Protection Act, 2023 (MeitY)](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [Digital Personal Data Protection Rules, 2025 (MeitY)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [DPDP Act commencement notification, G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)
