import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/localization-provider';
import { useMonitoring } from '@/services/MonitoringProvider';
import { colors, radii, spacing, type } from '@/theme/tokens';

const COUNTDOWN_SECONDS = 5;

export default function SosCountdownScreen() {
  const router = useRouter();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const [activating, setActivating] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    Vibration.vibrate([0, 180, 820], true);
    return () => Vibration.cancel();
  }, []);

  useEffect(() => {
    if (remaining > 0 || triggered.current) {
      const timeout = setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1_000);
      return () => clearTimeout(timeout);
    }

    triggered.current = true;
    setActivating(true);
    Vibration.cancel();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    void monitoring.triggerManualSos().catch(() => {
      triggered.current = false;
      setActivating(false);
      setRemaining(COUNTDOWN_SECONDS);
    });
    return undefined;
  }, [monitoring, remaining]);

  const cancel = () => {
    if (activating) return;
    Vibration.cancel();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.radarOuter}>
        <View style={styles.radarMiddle}>
          <View style={styles.radarInner}>
            {activating ? (
              <ActivityIndicator color={colors.white} size="large" />
            ) : (
              <Text style={styles.countdown}>{remaining}</Text>
            )}
          </View>
        </View>
      </View>

      <Text style={styles.title}>{activating ? 'Starting protected SOS…' : 'SOS countdown'}</Text>
      <Text style={styles.body}>
        {activating
          ? 'SafeCity is opening evidence capture. Your phone will ask you to send any prepared SMS.'
          : 'Encrypted evidence capture will begin when the countdown reaches zero.'}
      </Text>

      <View style={styles.statusCard}>
        <Text style={styles.statusIcon}>▣</Text>
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>No silent dispatch</Text>
          <Text style={styles.statusBody}>SafeCity cannot guarantee detection, SMS delivery, police response, or family response. Call 112 directly when possible.</Text>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        disabled={activating}
        onPress={cancel}
        style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, activating && styles.disabled]}
      >
        <Text style={styles.cancelText}>{t('common.cancel')} SOS</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dangerPanel, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  radarOuter: { width: 224, height: 224, borderRadius: 112, borderWidth: 2, borderColor: colors.dangerBorder, backgroundColor: '#2B111A', alignItems: 'center', justifyContent: 'center' },
  radarMiddle: { width: 176, height: 176, borderRadius: 88, borderWidth: 2, borderColor: colors.danger, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  radarInner: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  countdown: { color: colors.white, fontSize: 64, lineHeight: 72, fontWeight: '900', fontVariant: ['tabular-nums'] },
  title: { color: colors.white, fontSize: type.title, fontWeight: '900', textAlign: 'center', marginTop: spacing.xl },
  body: { color: colors.textMuted, fontSize: type.body, lineHeight: 23, textAlign: 'center', maxWidth: 360, marginTop: spacing.sm },
  statusCard: { width: '100%', flexDirection: 'row', gap: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: '#211019', padding: spacing.md, marginTop: spacing.xl },
  statusIcon: { color: colors.alert, fontSize: 24 },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.white, fontSize: type.body, fontWeight: '900' },
  statusBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 4 },
  cancelButton: { width: '100%', minHeight: 58, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  cancelText: { color: '#81151F', fontSize: type.body, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
