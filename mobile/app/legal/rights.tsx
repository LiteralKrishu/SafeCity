import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { PRIVACY_NOTICE_VERSION, rightsSections } from '@/legal/content';

export default function DataRightsScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="Your controls"
      title="Your Data Rights"
      version={PRIVACY_NOTICE_VERSION}
      sections={rightsSections}
    />
  );
}
