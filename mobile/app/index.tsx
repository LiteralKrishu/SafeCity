import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { readSettings } from '@/db/repository';
import {
  PRIVACY_NOTICE_VERSION,
  PROCESSING_CONSENT_VERSION,
  TERMS_VERSION,
} from '@/legal/content';
import { colors } from '@/theme/tokens';

export default function IndexScreen() {
  const db = useSQLiteContext();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    void readSettings(db).then((settings) =>
      setOnboarded(
        settings.onboardingComplete &&
          settings.adultConfirmed &&
          settings.consentVersion === PROCESSING_CONSENT_VERSION &&
          settings.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
          settings.termsVersion === TERMS_VERSION,
      ),
    );
  }, [db]);

  if (onboarded === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.safe} />
      </View>
    );
  }
  return <Redirect href={onboarded ? '/(tabs)' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
