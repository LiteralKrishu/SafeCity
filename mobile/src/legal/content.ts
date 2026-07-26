export const PRIVACY_NOTICE_VERSION = '2026-07-26-v9';
export const TERMS_VERSION = '2026-07-26-v6';
export const PROCESSING_CONSENT_VERSION = '2026-07-v10';
export const LEGAL_EFFECTIVE_DATE = '26 July 2026';

const requiredValue = (value: string | undefined, placeholder: string) => value?.trim() || placeholder;

export const legalOperator = {
  name: requiredValue(process.env.EXPO_PUBLIC_LEGAL_ENTITY_NAME, '[LEGAL ENTITY NAME REQUIRED]'),
  address: requiredValue(process.env.EXPO_PUBLIC_LEGAL_ADDRESS, '[REGISTERED POSTAL ADDRESS REQUIRED]'),
  privacyEmail: requiredValue(process.env.EXPO_PUBLIC_PRIVACY_EMAIL, '[PRIVACY EMAIL REQUIRED]'),
  grievanceOfficer: requiredValue(
    process.env.EXPO_PUBLIC_GRIEVANCE_OFFICER,
    '[GRIEVANCE OFFICER NAME REQUIRED]',
  ),
  grievanceEmail: requiredValue(
    process.env.EXPO_PUBLIC_GRIEVANCE_EMAIL,
    '[GRIEVANCE EMAIL REQUIRED]',
  ),
  governingCourts: requiredValue(
    process.env.EXPO_PUBLIC_GOVERNING_COURTS,
    '[CITY AND STATE COURTS REQUIRED]',
  ),
} as const;

export const legalConfigurationComplete = Object.values(legalOperator).every(
  (value) => !value.startsWith('['),
);

export interface LegalSection {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
}

export const privacySections: LegalSection[] = [
  {
    title: '1. Who is responsible for your data',
    paragraphs: [
      `${legalOperator.name} is the Data Fiduciary for a production deployment of SafeCity. Address: ${legalOperator.address}. Privacy contact: ${legalOperator.privacyEmail}. Grievance Officer: ${legalOperator.grievanceOfficer}, ${legalOperator.grievanceEmail}.`,
      'This repository is a prototype. The person or organisation distributing a production build must replace every bracketed operator detail and ensure that its real practices match this notice before release.',
    ],
  },
  {
    title: '2. Personal data and exact purposes',
    bullets: [
      'Emergency-contact name, phone number and Guardian or Police label: stored on your device so SafeCity can address an SOS only to the recipients you choose.',
      'Monitoring-session identifiers: created and stored only in the encrypted database on your device so assessment windows and incident history remain separate.',
      'Short microphone windows: approximately one second of PCM audio is processed in memory by the model bundled in the app during a monitoring session. The latest 15 seconds also remain in a volatile RAM ring buffer and are discarded unless an SOS is confirmed.',
      'Optional voice trigger and threat-language check: if you enable it, a visible Android foreground service continuously passes 16 kHz microphone samples through SafeCity’s bundled quantized model for direct emergency words and a limited catalog of coercive or violent phrases in English, Hindi and Bengali, including while the app is not open. It is keyword spotting, not general transcription. A threat phrase alone cannot start SOS: the phrase must repeat and agree with independently detected distress audio or motion. Samples and ordinary phrase labels stay in volatile phone memory; the listener does not retain audio or use an operating-system speech service, account, language-pack download or network recognition. It remains enabled until you turn it off from SafeCity or its persistent notification.',
      'Motion features: acceleration, jerk, rotation, free-fall and impact features are calculated and combined with audio results on your device. Ordinary assessment windows are not retained.',
      'Optional adaptive deviation baseline: when enabled, SafeCity samples at most once per minute during active on-device monitoring and learns bounded aggregate profiles for weekday/weekend, a four-hour time block, an approximately 500-metre location cell, movement intensity and estimated travel speed. It does not retain a breadcrumb route. Profiles are stored only in the encrypted device database, require at least 24 safe observations across three days before use, adapt gradually and are limited to 256 profiles and 35 learning days. Deviation is supporting evidence only and cannot independently start SOS. Turning the feature off or clearing it deletes the profiles.',
      'Context: hour of day and whether the app is active are used only as bounded assessment context. They do not create a threat by themselves.',
      'Location: the latest available coordinates may be held locally during monitoring and attached to an incident. Exact location is not used by the bundled audio model. If adaptive deviation detection is enabled, the phone converts an accurate fix to an approximately 500-metre local cell before learning a routine profile. If you choose “Load real nearby places” in Safety Navigator, the current coordinates are sent to the OpenStreetMap Overpass service to retrieve nearby mapped facilities and lighting tags.',
      'Optional anonymous community risk reporting: if you separately enable it in Settings, a confirmed SOS may contribute an approximately 500-metre cell, an hourly time bucket, trigger category and a rotating one-way deduplication token. Exact GPS, audio, photos, contacts, incident details and a stable installation identifier are not sent. The aggregation service hides cells with fewer than the configured minimum number of contributions and never publishes exact counts.',
      'Incident records: time, risk result, factors, model version, location if available, evidence status and your false-alarm feedback are stored in the encrypted local database.',
      'SOS evidence: when an SOS is confirmed, SafeCity may encrypt the latest 15-second pre-alert RAM snapshot. While the capture screen is visible it may also collect one rear photo, one front photo and 15 seconds of post-SOS audio. These files are AES-GCM encrypted in app-private storage. Available evidence is decrypted into temporary app cache only while Android messaging prepares automatic MMS delivery or the fallback system message composer.',
      'Consent and legal records: notice version, terms version, adult confirmation and acceptance timestamps are retained locally to record your choices.',
    ],
  },
  {
    title: '3. Why processing is lawful',
    paragraphs: [
      'SafeCity relies on your free, specific, informed and affirmative consent for monitoring audio, motion, location, the optional continuous voice trigger, post-SOS evidence and automatic guardian messaging. Android separately asks for SMS permission, and you can turn automatic guardian messaging off in Settings. Police messaging has a separate, off-by-default control and confirmation. Anonymous community risk reporting also has a separate, off-by-default Settings control and confirmation.',
      'You voluntarily provide emergency-contact data for the specific purpose of preparing an SOS message. You must have authority to provide that contact’s details and should inform the contact.',
    ],
  },
  {
    title: '4. When data leaves the device',
    bullets: [
      'Monitoring audio, motion features, assessment context and risk calculations stay on this device. SafeCity does not transmit them to a laptop, inference server or cloud service.',
      'When automatic guardian messaging is enabled and Android SMS permission is granted, Android messaging and your telecom provider receive the SOS text, exact location and temporary evidence attachments after the countdown and evidence capture finish, and the selected Guardian contacts receive the carrier message. If automatic delivery is unavailable, SafeCity opens a prepared composer for you to send.',
      'Contacts marked Police are excluded unless you separately turn on “Send to selected police contact.” Carrier delivery and emergency-service response are not guaranteed, and SafeCity does not replace calling 112.',
      'A mapping provider receives coordinates only if you choose to open the incident location.',
      'The OpenStreetMap Overpass service receives the current coordinates only if you choose to load real nearby places in Safety Navigator. Its response is used on that screen and is not saved to SafeCity history.',
      'If you enable anonymous community risk reporting, the SafeCity aggregation service receives only the coarse cell, hourly time bucket, trigger category and a rotating cell/day token. The service retains coarse reports for up to 30 days, requires a crowd threshold before publishing a zone and does not receive SOS evidence or exact GPS.',
      'Operating-system vendors process permission, notification and device-security data under their own notices.',
      'SafeCity does not sell personal data, use it for advertising or provide it to data brokers.',
    ],
  },
  {
    title: '5. Retention and deletion',
    bullets: [
      'Raw monitoring audio and ordinary assessment windows: kept only in volatile memory while the bundled model and fusion rules run. The rolling 15-second buffer is discarded when monitoring stops unless an SOS is confirmed and the snapshot is encrypted as evidence.',
      'Incidents and encrypted evidence: kept for the retention period you choose in Settings, from 1 to 90 days; the default is 30 days. You can delete an incident sooner.',
      'Temporary decrypted evidence prepared for an SOS message is removed from SafeCity cache after automatic dispatch is requested or when you return from the fallback composer. Your messaging app may retain a draft or sent copy under its own settings and privacy notice.',
      'Emergency contacts and consent records: kept until you remove them, withdraw consent or erase app data.',
      'Latest background location: overwritten by newer location data and erased with app data. Monitoring stops when you stop or withdraw consent.',
      'Adaptive deviation profiles: up to 256 aggregate profiles and 35 distinct learning-day markers remain in the encrypted local database until you clear the baseline, turn deviation detection off, withdraw consent or erase app data.',
      'Anonymous risk queue: coarse unsent reports remain in the encrypted local database for at most 30 days. Turning the feature off deletes the queue and rotating secret. Accepted coarse reports expire from the aggregation service after at most 30 days and cannot be erased by installation because no stable installation identifier is collected.',
      'A longer period applies only where retention is required by applicable law.',
    ],
  },
  {
    title: '6. Your DPDP rights and choices',
    bullets: [
      'Access a summary of personal data and processing through History, Settings and this notice.',
      'Correct or update contact and configuration data in Settings.',
      'Erase individual incidents or use “Withdraw consent and erase data” to erase this installation’s contacts, sessions, incidents, locations, queued anonymous reports, rotating anonymous secret, consent records and encrypted evidence.',
      'Withdraw consent as easily as it was given. Withdrawal stops future consent-based processing but does not make earlier lawful processing unlawful.',
      `Raise a grievance with ${legalOperator.grievanceOfficer} at ${legalOperator.grievanceEmail}. The operator must respond within a reasonable period not exceeding 90 days.`,
      'After first using the operator’s grievance process, you may complain to the Data Protection Board of India using the mechanism it publishes.',
      'Nominate another individual to exercise applicable rights in the event of death or incapacity by contacting the Grievance Officer.',
    ],
  },
  {
    title: '7. Security',
    paragraphs: [
      'SafeCity uses a SQLCipher-encrypted database, device-protected key storage, app-private files, AES-GCM evidence encryption, in-memory monitoring inference and deletion controls. No system is completely secure.',
      'The bundled model and fusion calculations do not require network access. A production operator must still use secure build signing, dependency review, tested key management and incident-response controls.',
    ],
  },
  {
    title: '8. Children',
    paragraphs: [
      'This build is intended only for people aged 18 or older. SafeCity does not presently implement verifiable parental consent. It must not be offered to a child until the operator implements and validates the child-data requirements and applicable exceptions under Indian law.',
    ],
  },
  {
    title: '9. Breach notices and changes',
    paragraphs: [
      'If the operator becomes aware of a personal-data breach, it will notify affected people and the Data Protection Board as required, describing the breach, likely consequences, mitigation, protective steps and a contact person.',
      'Material changes to the purposes or categories of processing require an updated notice and fresh consent. The version and effective date appear at the top of this notice.',
    ],
  },
];

export const termsSections: LegalSection[] = [
  {
    title: '1. Operator and acceptance',
    paragraphs: [
      `These Terms are between you and ${legalOperator.name}, at ${legalOperator.address}. By affirmatively accepting them, you agree to use SafeCity under these Terms and acknowledge the separate Privacy Notice.`,
      'The open-source software licence in the repository continues to govern copying, modification and distribution of source code. These Terms govern use of the deployed SafeCity service and safety features.',
    ],
  },
  {
    title: '2. Age and authority',
    bullets: [
      'You must be at least 18 years old for this build.',
      'You must provide accurate information and have authority to provide each emergency contact’s name and number.',
      'You are responsible for informing contacts that SafeCity may automatically address SOS messages to them.',
    ],
  },
  {
    title: '3. What SafeCity is—and is not',
    paragraphs: [
      'SafeCity is an assistive personal-safety prototype. It may analyze permitted audio and motion signals, compare coarse behavioral features with a local baseline, request a check-in, prepare evidence and request automatic Android SMS or MMS delivery after an SOS, with a system-composer fallback.',
      'SafeCity is not an emergency service, medical device, law-enforcement service, monitored alarm or guarantee of detection, message delivery, rescue or safety. Call the appropriate emergency number when you need immediate help.',
    ],
  },
  {
    title: '4. Your control and responsibilities',
    bullets: [
      'You decide when monitoring starts and stops, whether the optional voice trigger and automatic guardian messaging remain enabled, whether Police contacts are included, and which operating-system permissions to allow.',
      'You must review the visible sensor-health status and must not rely on unavailable or degraded sensors.',
      'You must keep Guardian and Police contact labels accurate and review the SOS message format before enabling automatic delivery. Carrier SMS or MMS charges may apply.',
      'You must keep the device, app, operating system and emergency-contact list secure and current.',
      'You must not use SafeCity to surveil another person, record unlawfully, harass, send false emergency messages, interfere with the service or violate any law.',
    ],
  },
  {
    title: '5. Evidence, location and third-party services',
    paragraphs: [
      'Evidence collection is limited by mobile operating systems and may work only while SafeCity is visible. Location, camera, microphone, the bundled keyword engine, full-screen notifications, mapping and SMS may be interrupted, incomplete or inaccurate. Android may replace a voice-triggered full-screen countdown with a prominent notification when full-screen alert access is unavailable; force-stopping the app stops background listening until SafeCity is opened again. After a phone restart, motion monitoring can resume automatically, but Android requires you to tap SafeCity’s notification once before microphone keyword listening resumes.',
      'Third-party services have their own terms and privacy notices. SafeCity does not claim delivery merely because Android accepted an automatic send request or opened the fallback composer.',
    ],
  },
  {
    title: '6. Availability and changes',
    paragraphs: [
      'The prototype may be changed, suspended or discontinued. Updates may change models, thresholds or platform behavior. Material changes affecting personal-data purposes require an updated notice and consent.',
    ],
  },
  {
    title: '7. Disclaimers and liability',
    paragraphs: [
      'To the extent permitted by law, the service is provided without promises that it will be uninterrupted, error-free or suitable as your only safety measure. Nothing in these Terms excludes liability or consumer rights that cannot lawfully be excluded under Indian law.',
      'Do not interpret risk scores or alerts as medical, legal or emergency-response advice. Keep alternative ways to seek help available.',
    ],
  },
  {
    title: '8. Suspension and termination',
    paragraphs: [
      'You may stop using SafeCity at any time and may withdraw consent and erase data in Settings. The operator may restrict access for unlawful, abusive or security-threatening use, subject to applicable law.',
    ],
  },
  {
    title: '9. Governing law and grievances',
    paragraphs: [
      `These Terms are governed by Indian law. Subject to mandatory consumer and statutory forums, courts at ${legalOperator.governingCourts} have jurisdiction.`,
      `Contact the Grievance Officer, ${legalOperator.grievanceOfficer}, at ${legalOperator.grievanceEmail}. Nothing here limits the right to approach a competent statutory authority or court after following any required grievance process.`,
    ],
  },
];

export const rightsSections: LegalSection[] = [
  {
    title: 'Access',
    paragraphs: [
      'History shows incident data stored on this device. Settings shows contacts, retention choices, permissions and the on-device AI design. The Privacy Notice gives a category-by-category processing summary.',
    ],
  },
  {
    title: 'Correction',
    paragraphs: [
      'Update settings directly. Remove an inaccurate emergency contact and add the corrected details. Incident feedback can be corrected from the incident screen where available.',
    ],
  },
  {
    title: 'Erasure and consent withdrawal',
    paragraphs: [
      'Delete individual incidents from History, or use “Withdraw consent and erase data” in Settings. The latter stops monitoring, deletes contacts, sessions, incident metadata, locations, consent records and encrypted evidence from this installation, then returns to onboarding.',
    ],
  },
  {
    title: 'Grievance and nomination',
    paragraphs: [
      `For an access request, grievance or nomination request, contact ${legalOperator.grievanceOfficer} at ${legalOperator.grievanceEmail}. Include enough information to identify the relevant installation without sending incident evidence by ordinary email.`,
      'The production operator must publish and operate a response process with a period not exceeding 90 days and explain how to approach the Data Protection Board of India after that process is exhausted.',
    ],
  },
];
