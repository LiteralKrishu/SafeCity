# SafeCity Terms and Conditions

**Version:** 2026-07-23-v3
**Effective date:** 23 July 2026
**Status:** Production template — operator details and legal review required

> These Terms are a deployment template, not legal advice. The deploying entity must complete every bracketed field and obtain review from qualified Indian counsel, including review under the Indian Contract Act, 1872, Consumer Protection Act, 2019, DPDP Act and any health, emergency, telecom or state law applicable to the final service.

## 1. Agreement and operator

These Terms are between the person accepting them (“you”) and **[LEGAL ENTITY NAME]**, of **[REGISTERED ADDRESS]** (“Operator”), concerning the deployed SafeCity mobile application (“SafeCity”). Contact: **[SUPPORT EMAIL]**. Grievance Officer: **[NAME, DESIGNATION AND EMAIL]**.

By a clear affirmative action, you agree to these Terms and acknowledge the separate Privacy Notice. If you do not agree, do not finish setup or start monitoring.

The repository’s MIT License governs rights to copy, modify and distribute the source code. These Terms govern use of the deployed service and do not remove rights granted by that open-source licence.

## 2. Eligibility

This build is intended only for people aged 18 or older. By accepting, you confirm that you are at least 18 and legally capable of entering this agreement. A child must not use this build. A child-capable version requires a separately reviewed parental-consent and child-safety design.

You must have authority to provide an emergency contact’s name and number. You should inform the contact that SafeCity may prepare an SOS message addressed to them.

## 3. The service

SafeCity may, when you start monitoring and allow the relevant permissions:

- analyze short-lived microphone windows and device-motion features;
- optionally detect “Help” or “Bachao” through SafeCity’s bundled offline keyword model;
- use limited context and location for safety assessment and incidents;
- request a check-in or escalate to an SOS capture flow;
- encrypt the latest 15-second pre-alert snapshot after SOS confirmation and collect one rear photo, one front photo and 15 seconds of post-SOS audio while the capture screen is visible;
- encrypt incident evidence locally;
- open an SMS composer addressed to saved emergency contacts; and
- display local incident history and deletion controls.

## 4. Critical safety limitations

SafeCity is an assistive prototype. It is **not**:

- an emergency service, monitored alarm, law-enforcement or rescue service;
- a medical device or source of medical, legal or emergency-response advice;
- guaranteed to detect distress, falls, violence or emergencies;
- guaranteed to run in the background, obtain location, capture evidence, open an SMS composer, deliver a message or obtain a response; or
- a replacement for calling the appropriate emergency number or maintaining other safety arrangements.

Models can miss emergencies and raise false alarms. Phones can suspend background work, sensors can fail, batteries and networks can be unavailable, and the user must press **Send** in the system SMS composer. Never delay contacting emergency services because of SafeCity.

## 5. User responsibilities

You agree to:

- provide accurate information and keep emergency contacts current;
- choose permissions deliberately and review the visible sensor-health state;
- decide when monitoring is appropriate and stop it when it is no longer needed;
- review recipients, message content and location before pressing **Send**;
- maintain device, app and operating-system security;
- comply with recording, surveillance, communications and privacy laws; and
- maintain another way to obtain urgent help.

You must not use SafeCity to surveil another person, record or track unlawfully, harass, impersonate, send a knowingly false emergency message, interfere with service security, reverse engineer a deployed service where prohibited by law, or violate another person’s rights.

## 6. Permissions, location, evidence and communications

Operating-system permissions are optional, but denied access degrades features. “Allow all the time” location access is preferable for active monitoring coverage, but it is not mandatory for manual SOS.

Camera evidence can normally be captured only while SafeCity is visible. Evidence remains encrypted in app-private storage unless you deliberately share or export it. Keyword accuracy, power use, and background continuity vary by device even though inference is bundled and offline. An SMS, map action, or user-requested OpenStreetMap nearby-place lookup invokes a third-party service governed by that provider’s terms. Carrier or data charges may apply. SafeCity does not claim delivery merely because a composer or map opened.

## 7. Privacy

The SafeCity Privacy Notice explains personal-data categories, purposes, recipients, retention, security and rights. Consent to personal-data processing is separate from agreement to these Terms and may be withdrawn in Settings. A production operator must ensure that actual practices match the published notice.

## 8. On-device inference

The supported build bundles its audio model and risk calculations inside the app. Monitoring audio and motion are not sent to a laptop, server or cloud for inference. Modified builds that add remote processing require a separate security, privacy, processor and consent review before use.

## 9. Availability, maintenance and changes

SafeCity may be updated, suspended or discontinued. Changes may affect sensors, model thresholds, platform compatibility or evidence behavior. The Operator will not use an update to introduce a materially new personal-data purpose without updating the Privacy Notice and obtaining consent where required.

## 10. Intellectual property and open-source components

The source code is licensed under the repository’s MIT License. Third-party software and model components are subject to their own licences. Names, logos and deployed-service content not covered by an open-source licence remain owned by their respective owners.

## 11. Disclaimer

To the extent permitted by applicable law, SafeCity is provided without a promise that it will be uninterrupted, error-free, accurate or suitable as your only safety measure. Nothing in these Terms excludes or limits a warranty, remedy, consumer right or liability that cannot lawfully be excluded or limited under Indian law.

## 12. Liability

The production Operator must replace this section with a limitation reviewed for the actual commercial model, insurance, risk allocation and mandatory Indian consumer law. No provision may exclude liability that applicable law does not allow to be excluded. **[COUNSEL-APPROVED LIABILITY LANGUAGE REQUIRED BEFORE RELEASE].**

## 13. Suspension and termination

You may stop using SafeCity at any time. You may withdraw consent and erase data through Settings. The Operator may suspend access reasonably necessary to address unlawful use, abuse, material security risk or a legal requirement, subject to applicable law and any required notice.

## 14. Governing law and dispute resolution

These Terms are governed by the laws of India. Subject to mandatory statutory and consumer forums, courts at **[CITY, STATE]** have jurisdiction. **[COUNSEL TO ADD ANY VALID DISPUTE-RESOLUTION OR ARBITRATION TERMS, IF DESIRED].**

## 15. Grievances

Contact **[GRIEVANCE OFFICER NAME AND DESIGNATION]** at **[GRIEVANCE EMAIL]** or **[POSTAL ADDRESS]**. Nothing in these Terms prevents access to the Data Protection Board of India, a consumer commission, court or another competent authority after following any process required by applicable law.

## 16. General terms

If a provision is unenforceable, it will be limited to the minimum necessary and the remaining provisions continue. A failure to enforce a provision is not a waiver. You may not transfer this agreement where doing so would materially affect safety or privacy without the Operator’s consent; the Operator may transfer it only with appropriate notice and continued protection of your rights. These Terms and the Privacy Notice form the agreement for the deployed service, alongside terms that cannot be excluded by law.
