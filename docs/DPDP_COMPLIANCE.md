# SafeCity DPDP readiness register

**Assessment date:** 20 July 2026  
**Scope:** This repository’s mobile app and APK-bundled on-device inference  
**Important:** A policy does not create compliance by itself. This file separates implemented controls from unresolved production obligations.

## Current legal timeline

The DPDP Act received Presidential assent on 11 August 2023. The Central Government’s 13 November 2025 notification brought specified institutional and procedural provisions into force on publication. Section 6(9) and part of section 27 are scheduled one year from Gazette publication. Most substantive processing duties in sections 3–17 and most operational Rules are scheduled eighteen months from publication. SafeCity is being designed to the full future standard rather than waiting for every provision to commence.

Official sources:

- [DPDP Act, 2023](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf)
- [DPDP Rules, 2025](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf)
- [Commencement notification G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf)

## Implemented in this repository

| Control | Implementation |
|---|---|
| Purpose-limited consent | Monitoring and SOS-evidence statements are separate affirmative checkboxes; consent is recorded by version and timestamp |
| Notice before consent | In-app itemised Privacy Notice and Terms links are available inside the consent confirmation |
| Adult-only gate | User must confirm age 18+; no claim of a child-capable flow |
| Easy withdrawal | Settings provides a destructive confirmation that stops monitoring and erases this installation’s local personal data |
| Access and correction | History, Settings and a Data Rights screen expose local categories; contacts/settings can be corrected |
| Data minimisation | No continuous video; short in-memory audio windows; 15-second RAM tail encrypted only after confirmed SOS; bounded context; location excluded from inference |
| Encryption | SQLCipher metadata, platform-protected keys and AES-GCM evidence |
| Retention | 1–90 day local incident retention; ordinary inference windows are not stored; individual and bulk deletion |
| Local inference | Bundled YAMNet Lite, motion features, pattern matching and temporal fusion execute on the phone without a laptop or network request |
| Sharing control | No automatic message transmission; user must press Send in the system composer |
| No advertising | No advertising SDK, sale or targeted advertising in the repository |

## Release blockers

The following must be completed before any claim of production compliance:

1. **Identify the Data Fiduciary.** Configure legal name, registered address, privacy email, Grievance Officer, grievance email and court jurisdiction through the documented Expo public variables.
2. **Indian legal review.** Qualified counsel must review the final product, operator role, lawful bases, child restriction, safety claims, Terms, consumer-law limitations, translations, processor roles and sector/state rules.
3. **Secure build and model supply chain.** Configure a production keystore, protected signing process, dependency review, software bill of materials, model provenance/hash verification and update/rollback controls.
4. **Processor contracts.** Execute valid contracts with every production support, crash-reporting, messaging, infrastructure or other Data Processor actually used, including security, breach, deletion, audit and return obligations.
5. **Grievance operation.** Staff and test a request channel, identity-verification procedure, case log, escalation path and response period not exceeding 90 days.
6. **Breach response.** Establish monitoring, a 24×7 incident owner, Board-notification capability, affected-person templates and a 72-hour detailed-report workflow.
7. **Language access.** Professionally translate and test the notice and consent request into the languages required by section 6(3); the repository currently provides English only.
8. **Age assurance.** Validate the adult-only gate. If children may use the product, implement verifiable parental consent and obtain specific advice on safety-location and behavioural-monitoring exceptions.
9. **Rights fulfilment.** Test access, correction, erasure, withdrawal, grievance and nomination procedures end to end on supported devices.
10. **Data mapping and records.** Maintain a current record of processing activities, recipients, locations, retention, system owners, lawful bases and data flows for the actual deployment.
11. **Security programme.** Complete threat modelling, mobile and third-party-integration penetration testing, dependency review, secure build/signing, vulnerability disclosure, backup/restore testing and key lifecycle controls.
12. **DPIA and designation assessment.** Assess risk and document whether SafeCity could be notified as a Significant Data Fiduciary because it processes safety, audio, location and incident data.
13. **Store/platform disclosures.** Align Google Play Data safety, Apple privacy labels, permission copy and marketing claims with the final notice.
14. **Retention conflicts.** Obtain advice on the DPDP Rules’ security-log retention requirements before the relevant provisions commence and reconcile them with minimisation. Ordinary safety assessments are not designated as security logs in this design.
15. **Evidence legality.** Review consent and recording laws for photographs, microphone capture, bystanders, domestic spaces, workplaces and each target state.

## Configuration required

Set these at build time for the in-app documents:

```text
EXPO_PUBLIC_LEGAL_ENTITY_NAME
EXPO_PUBLIC_LEGAL_ADDRESS
EXPO_PUBLIC_PRIVACY_EMAIL
EXPO_PUBLIC_GRIEVANCE_OFFICER
EXPO_PUBLIC_GRIEVANCE_EMAIL
EXPO_PUBLIC_GOVERNING_COURTS
```

The app visibly labels the legal configuration as incomplete while any value is missing. That warning is deliberate and must not be removed merely to pass release review.

## Change-control rule

Any change to collected data, purpose, recipient, retention, model hosting, evidence flow, age group or business model requires review of:

- the data map and lawful basis;
- Privacy Notice and Terms versions;
- whether fresh consent is needed;
- store disclosures and permission text;
- processor contracts and security measures; and
- the DPIA/risk assessment.
