import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { PRIVACY_NOTICE_VERSION, privacySections } from '@/legal/content';

export default function PrivacyNoticeScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="DPDP notice"
      title="Privacy Notice"
      version={PRIVACY_NOTICE_VERSION}
      sections={privacySections}
    />
  );
}
