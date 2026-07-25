import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Screen } from '@/components/Screen';
import { useLocalization } from '@/i18n/localization-provider';
import { useMonitoring } from '@/services/MonitoringProvider';
import { isSirenStartCancelled, startSiren, stopSiren } from '@/services/siren';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing, type } from '@/theme/tokens';

export default function SirenScreen() {
  const router = useRouter();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const sessionState = useMonitorStore((state) => state.sessionState);
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const resumeMonitoring = useRef(false);

  const stop = async () => {
    Vibration.cancel();
    stopSiren();
    setActive(false);
    if (resumeMonitoring.current) {
      resumeMonitoring.current = false;
      await monitoring.resumeAfterSiren().catch(() => undefined);
    }
  };

  useEffect(
    () => () => {
      Vibration.cancel();
      stopSiren();
      if (resumeMonitoring.current) void monitoring.resumeAfterSiren();
    },
    [monitoring],
  );

  const start = async () => {
    setBusy(true);
    try {
      if (sessionState === 'monitoring') {
        resumeMonitoring.current = true;
        await monitoring.suspendForSiren();
      }
      await startSiren();
      Vibration.vibrate([0, 300, 200, 300, 700], true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setActive(true);
    } catch (error) {
      Vibration.cancel();
      stopSiren();
      if (resumeMonitoring.current) {
        resumeMonitoring.current = false;
        await monitoring.resumeAfterSiren().catch(() => undefined);
      }
      if (isSirenStartCancelled(error)) return;
      Alert.alert(
        'Could not play siren',
        'Check your media volume and audio output, then try again. You can still call 112.',
      );
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    await stop();
    router.back();
  };

  return (
    <Screen
      eyebrow="Audible safety tool"
      title={t('home.sirenTitle')}
      right={
        <Pressable accessibilityRole="button" onPress={() => void close()} style={styles.doneButton}>
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      }
    >
      <View style={[styles.sirenPanel, active && styles.sirenPanelActive]}>
        <View style={[styles.sirenRing, active && styles.sirenRingActive]}>
          <Text style={styles.sirenIcon}>◖))</Text>
        </View>
        <Text style={styles.state}>{active ? 'SIREN PLAYING' : 'SIREN READY'}</Text>
        <Text style={styles.detail}>
          {active
            ? 'Tap Stop as soon as the alert is no longer needed.'
            : 'This plays a repeating danger tone at the phone’s current media volume and vibrates the device.'}
        </Text>
      </View>

      <View style={styles.actions}>
        {active ? (
          <ActionButton label="Stop siren" variant="danger" onPress={() => void stop()} />
        ) : (
          <ActionButton label="Start loud siren" loading={busy} variant="danger" onPress={() => void start()} />
        )}
        <ActionButton label="Call 112" variant="secondary" onPress={() => void Linking.openURL('tel:112')} />
      </View>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Before you start</Text>
        <Text style={styles.noticeBody}>
          Raise your media volume. For a more effective alert, connect your phone to a Bluetooth speaker before starting the siren. Monitoring pauses while the siren plays so the phone does not mistake its own alarm for distress audio, then resumes when you stop it.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { color: colors.watch, fontWeight: '900' },
  sirenPanel: { minHeight: 390, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: '#160D13', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  sirenPanelActive: { backgroundColor: '#341017', borderColor: colors.danger },
  sirenRing: { width: 170, height: 170, borderRadius: 85, borderWidth: 3, borderColor: colors.dangerBorder, backgroundColor: '#431C28', alignItems: 'center', justifyContent: 'center' },
  sirenRingActive: { borderColor: colors.danger, backgroundColor: '#8D1C27' },
  sirenIcon: { color: colors.white, fontSize: 48, fontWeight: '900' },
  state: { color: colors.white, fontSize: type.heading, fontWeight: '900', letterSpacing: 1.2, marginTop: spacing.xl },
  detail: { color: '#C4CAD4', fontSize: type.body, lineHeight: 22, textAlign: 'center', marginTop: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  notice: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, marginTop: spacing.md },
  noticeTitle: { color: colors.text, fontSize: type.body, fontWeight: '900' },
  noticeBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: spacing.xs },
});
