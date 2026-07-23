import { LegalDocumentScreen } from '@/components/LegalDocumentScreen';
import { useLocalization } from '@/i18n/localization-provider';
import { PRIVACY_NOTICE_VERSION, rightsSections } from '@/legal/content';

export default function DataRightsScreen() {
  const { t } = useLocalization();
  return (
    <LegalDocumentScreen
      eyebrow={t('legal.rightsEyebrow')}
      title={t('legal.rightsTitle')}
      version={PRIVACY_NOTICE_VERSION}
      sections={rightsSections}
    />
  );
}
