export const PRIVACY_NOTICE_VERSION = '2026-07-20-v2';
export const TERMS_VERSION = '2026-07-20-v2';
export const PROCESSING_CONSENT_VERSION = '2026-07-v3';
export const LEGAL_EFFECTIVE_DATE = '20 July 2026';

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
      'Emergency-contact name and phone number: stored on your device so SafeCity can prepare an SOS message addressed to the people you choose.',
      'Monitoring-session identifiers: created and stored only in the encrypted database on your device so assessment windows and incident history remain separate.',
      'Short microphone windows: approximately one second of PCM audio is processed in memory by the model bundled in the app during a monitoring session. Monitoring audio is not cached, uploaded or sent to a laptop, server or cloud.',
      'Motion features: acceleration, jerk, rotation, free-fall and impact features are calculated and combined with audio results on your device. Ordinary assessment windows are not retained.',
      'Context: hour of day and whether the app is active are used only as bounded assessment context. They do not create a threat by themselves.',
      'Location: the latest available coordinates may be held locally during monitoring and attached to an incident. Location is not used by the bundled inference model.',
      'Incident records: time, risk result, factors, model version, location if available, evidence status and your false-alarm feedback are stored in the encrypted local database.',
      'SOS evidence: after an SOS, while the capture screen is visible, SafeCity may collect one rear photo, one front photo and 15 seconds of audio. These files are AES-GCM encrypted and kept only in app-private storage.',
      'Consent and legal records: notice version, terms version, adult confirmation and acceptance timestamps are retained locally to record your choices.',
    ],
  },
  {
    title: '3. Why processing is lawful',
    paragraphs: [
      'SafeCity relies on your free, specific, informed and affirmative consent for monitoring audio, motion, location and post-SOS evidence. You separately control operating-system permissions and decide when a monitoring session starts.',
      'You voluntarily provide emergency-contact data for the specific purpose of preparing an SOS message. You must have authority to provide that contact’s details and should inform the contact.',
    ],
  },
  {
    title: '4. When data leaves the device',
    bullets: [
      'Monitoring audio, motion features, assessment context and risk calculations stay on this device. SafeCity does not transmit them to a laptop, inference server or cloud service.',
      'An SMS recipient and your telecom or messaging provider receive the message and any included location only if you press Send in the system composer.',
      'A mapping provider receives coordinates only if you choose to open the incident location.',
      'Operating-system vendors process permission, notification and device-security data under their own notices.',
      'SafeCity does not sell personal data, use it for advertising or provide it to data brokers.',
    ],
  },
  {
    title: '5. Retention and deletion',
    bullets: [
      'Raw monitoring audio and ordinary assessment windows: kept only in volatile memory while the bundled model and fusion rules run, then discarded.',
      'Incidents and encrypted evidence: kept for the retention period you choose in Settings, from 1 to 90 days; the default is 30 days. You can delete an incident sooner.',
      'Emergency contacts and consent records: kept until you remove them, withdraw consent or erase app data.',
      'Latest background location: overwritten by newer location data and erased with app data. Monitoring stops when you stop or withdraw consent.',
      'A longer period applies only where retention is required by applicable law.',
    ],
  },
  {
    title: '6. Your DPDP rights and choices',
    bullets: [
      'Access a summary of personal data and processing through History, Settings and this notice.',
      'Correct or update contact and configuration data in Settings.',
      'Erase individual incidents or use “Withdraw consent and erase data” to erase this installation’s contacts, sessions, incidents, locations, consent records and encrypted evidence.',
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
      'You are responsible for informing contacts that SafeCity may prepare messages addressed to them.',
    ],
  },
  {
    title: '3. What SafeCity is—and is not',
    paragraphs: [
      'SafeCity is an assistive personal-safety prototype. It may analyze permitted audio and motion signals, request a check-in, prepare evidence and open an SMS composer after an SOS.',
      'SafeCity is not an emergency service, medical device, law-enforcement service, monitored alarm or guarantee of detection, message delivery, rescue or safety. Call the appropriate emergency number when you need immediate help.',
    ],
  },
  {
    title: '4. Your control and responsibilities',
    bullets: [
      'You decide when monitoring starts and stops and which operating-system permissions to allow.',
      'You must review the visible sensor-health status and must not rely on unavailable or degraded sensors.',
      'You must verify SMS content, recipients and location before pressing Send. Carrier charges may apply.',
      'You must keep the device, app, operating system and emergency-contact list secure and current.',
      'You must not use SafeCity to surveil another person, record unlawfully, harass, send false emergency messages, interfere with the service or violate any law.',
    ],
  },
  {
    title: '5. Evidence, location and third-party services',
    paragraphs: [
      'Evidence collection is limited by mobile operating systems and may work only while SafeCity is visible. Location, camera, microphone, notifications, mapping and SMS depend on third-party platforms and may be interrupted or inaccurate.',
      'Third-party services have their own terms and privacy notices. SafeCity does not claim that an SMS was delivered merely because the composer opened.',
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
