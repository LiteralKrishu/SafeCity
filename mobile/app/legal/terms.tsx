import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { TERMS_VERSION, termsSections } from '@/legal/content';

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      eyebrow="Use terms"
      title="Terms and Conditions"
      version={TERMS_VERSION}
      sections={termsSections}
    />
  );
}
