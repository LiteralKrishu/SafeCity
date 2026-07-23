import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { useLocalization } from '@/i18n/localization-provider';
import { TERMS_VERSION, termsSections } from '@/legal/content';

export default function TermsScreen() {
  const { t } = useLocalization();
  return (
    <LegalDocumentScreen
      eyebrow={t('legal.termsEyebrow')}
      title={t('legal.termsTitle')}
      version={TERMS_VERSION}
      sections={termsSections}
    />
  );
}
