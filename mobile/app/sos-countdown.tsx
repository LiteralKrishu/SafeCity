import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/localization-provider';
import {
  resolveSosCountdownDeadline,
  SOS_COUNTDOWN_MS,
  SOS_COUNTDOWN_SECONDS,
  sosCountdownSecondsRemaining,
} from '@/inference/sosCountdown';
import { useMonitoring } from '@/services/MonitoringProvider';
import { acknowledgePersistentDetection } from '@/services/persistent-voice-trigger';
import { colors, radii, spacing, type } from '@/theme/tokens';

export default function SosCountdownScreen() {
  const router = useRouter();
  const { source, keyword, startedAt } = useLocalSearchParams<{
    source?: string;
    keyword?: string;
    startedAt?: string;
  }>();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const deadline = useRef(resolveSosCountdownDeadline(startedAt));
  const [remaining, setRemaining] = useState(() =>
    sosCountdownSecondsRemaining(deadline.current),
  );
  const [activating, setActivating] = useState(false);
  const triggered = useRef(false);

  useEffect(() => {
    Vibration.vibrate([0, 180, 820], true);
    return () => Vibration.cancel();
  }, []);

  useEffect(() => {
    deadline.current = resolveSosCountdownDeadline(startedAt);
    const updateRemaining = () =>
      setRemaining(sosCountdownSecondsRemaining(deadline.current));
    updateRemaining();
    const interval = setInterval(updateRemaining, 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    if (remaining > 0 || triggered.current) return;
    triggered.current = true;
    setActivating(true);
    Vibration.cancel();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const trigger =
      source === 'voice' || source === 'threat'
        ? monitoring.triggerVoiceSos
        : source === 'motion'
          ? monitoring.triggerMotionSos
          : source === 'audio'
            ? monitoring.triggerAudioSos
            : monitoring.triggerManualSos;
    void (async () => {
      await acknowledgePersistentDetection().catch(() => undefined);
      await trigger();
    })().catch(() => {
      triggered.current = false;
      setActivating(false);
      deadline.current = Date.now() + SOS_COUNTDOWN_MS;
      setRemaining(SOS_COUNTDOWN_SECONDS);
      if (
        source === 'voice' ||
        source === 'threat' ||
        source === 'motion' ||
        source === 'audio'
      ) {
        void monitoring.rearmVoiceTrigger();
      }
    });
  }, [monitoring, remaining, source]);

  const cancel = () => {
    if (activating) return;
    Vibration.cancel();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (
      source === 'voice' ||
      source === 'threat' ||
      source === 'motion' ||
      source === 'audio'
    ) {
      void monitoring.rearmVoiceTrigger().finally(() => router.back());
    } else {
      router.back();
    }
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

      <Text style={styles.title}>
        {activating
          ? 'Starting protected SOS…'
          : source === 'voice' ||
              source === 'threat' ||
              source === 'motion' ||
              source === 'audio'
            ? `${String(keyword ?? 'Emergency word').replace(/_/g, ' ')} detected`
            : 'SOS countdown'}
      </Text>
      <Text style={styles.body}>
        {activating
          ? 'SafeCity is capturing available evidence, then your phone will open a message with the SOS text, location, photos and audio for you to review and send.'
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
  screen: { flex: 1, backgroundColor: '#160D13', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  radarOuter: { width: 224, height: 224, borderRadius: 112, borderWidth: 2, borderColor: colors.dangerBorder, backgroundColor: '#2B111A', alignItems: 'center', justifyContent: 'center' },
  radarMiddle: { width: 176, height: 176, borderRadius: 88, borderWidth: 2, borderColor: colors.danger, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  radarInner: { width: 128, height: 128, borderRadius: 64, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  countdown: { color: colors.white, fontSize: 64, lineHeight: 72, fontWeight: '900', fontVariant: ['tabular-nums'] },
  title: { color: colors.white, fontSize: type.title, fontWeight: '900', textAlign: 'center', marginTop: spacing.xl },
  body: { color: '#C4CAD4', fontSize: type.body, lineHeight: 23, textAlign: 'center', maxWidth: 360, marginTop: spacing.sm },
  statusCard: { width: '100%', flexDirection: 'row', gap: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: '#211019', padding: spacing.md, marginTop: spacing.xl },
  statusIcon: { color: colors.alert, fontSize: 24 },
  statusCopy: { flex: 1 },
  statusTitle: { color: colors.white, fontSize: type.body, fontWeight: '900' },
  statusBody: { color: '#C4CAD4', fontSize: type.caption, lineHeight: 18, marginTop: 4 },
  cancelButton: { width: '100%', minHeight: 58, borderRadius: radii.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginTop: spacing.lg },
  cancelText: { color: '#81151F', fontSize: type.body, fontWeight: '900' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
