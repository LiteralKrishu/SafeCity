import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/components/BrandLogo';
import { readSettings } from '@/db/repository';
import {
  PRIVACY_NOTICE_VERSION,
  PROCESSING_CONSENT_VERSION,
  TERMS_VERSION,
} from '@/legal/content';
import {
  allCorePermissionsGranted,
  getCorePermissionSnapshot,
} from '@/services/permissions';
import { getPersistentVoiceTriggerState } from '@/services/persistent-voice-trigger';
import { colors } from '@/theme/tokens';

interface StartupDecision {
  onboarded: boolean;
  pendingDetection: {
    source: string;
    label: string;
    startedAt: number;
  } | null;
}

export default function IndexScreen() {
  const db = useSQLiteContext();
  const [decision, setDecision] = useState<StartupDecision | null>(null);

  useEffect(() => {
    void Promise.all([
      readSettings(db),
      getCorePermissionSnapshot(),
      getPersistentVoiceTriggerState(),
    ])
      .then(([settings, permissions, persistentState]) => {
        const pendingDetection =
          persistentState.detectionPending &&
          persistentState.pendingDetectionSource &&
          persistentState.pendingDetectionLabel &&
          persistentState.pendingDetectionStartedAt
            ? {
                source: persistentState.pendingDetectionSource,
                label: persistentState.pendingDetectionLabel,
                startedAt: persistentState.pendingDetectionStartedAt,
              }
            : null;
        setDecision({
          onboarded:
            settings.onboardingComplete &&
            settings.adultConfirmed &&
            settings.consentVersion === PROCESSING_CONSENT_VERSION &&
            settings.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
            settings.termsVersion === TERMS_VERSION &&
            allCorePermissionsGranted(permissions),
          pendingDetection,
        });
      })
      .catch(() => setDecision({ onboarded: false, pendingDetection: null }));
  }, [db]);

  if (decision === null) {
    return (
      <View style={styles.loading}>
        <BrandLogo size={88} />
        <ActivityIndicator color={colors.safe} />
      </View>
    );
  }
  if (decision.pendingDetection) {
    return (
      <Redirect
        href={{
          pathname: '/sos-countdown',
          params: {
            source: decision.pendingDetection.source,
            keyword: decision.pendingDetection.label,
            startedAt: String(decision.pendingDetection.startedAt),
          },
        }}
      />
    );
  }
  return <Redirect href={decision.onboarded ? '/(tabs)' : '/onboarding'} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    gap: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
