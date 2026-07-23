import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { useLocalization } from '@/i18n/localization-provider';
import { PRIVACY_NOTICE_VERSION, privacySections } from '@/legal/content';

export default function PrivacyNoticeScreen() {
  const { t } = useLocalization();
  return (
    <LegalDocumentScreen
      eyebrow={t('legal.privacyEyebrow')}
      title={t('legal.privacyTitle')}
      version={PRIVACY_NOTICE_VERSION}
      sections={privacySections}
    />
  );
}
