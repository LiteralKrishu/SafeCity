import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Screen } from '@/components/Screen';
import { useLocalization } from '@/i18n/localization-provider';
import {
  cancelTimedInterruption,
  scheduleTimedInterruption,
  type TimedInterruptionCaller,
  type TimedInterruptionKind,
} from '@/services/timed-interruption';
import { colors, radii, spacing, type } from '@/theme/tokens';

const delayOptions = [15, 30, 60, 180] as const;
const callerOptions: TimedInterruptionCaller[] = ['family', 'office', 'driver'];

function delayLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  return `${seconds / 60} min`;
}

function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function TimedInterruptionScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [kind, setKind] = useState<TimedInterruptionKind>('call');
  const [callerId, setCallerId] =
    useState<TimedInterruptionCaller>('family');
  const [delaySeconds, setDelaySeconds] =
    useState<(typeof delayOptions)[number]>(30);
  const [scheduling, setScheduling] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [fallbackNotificationId, setFallbackNotificationId] =
    useState<string | null>(null);
  const [opensAutomatically, setOpensAutomatically] = useState(true);

  const callerLabels = useMemo<Record<TimedInterruptionCaller, string>>(
    () => ({
      family: t('fakeCall.callerFamily'),
      office: t('fakeCall.callerOffice'),
      driver: t('fakeCall.callerDriver'),
    }),
    [t],
  );

  useEffect(() => {
    if (!deadline) return;
    const update = () => {
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1_000)));
    };
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [deadline]);

  const schedule = async () => {
    setScheduling(true);
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Allow notifications so the interruption can ring.');
      }
      const result = await scheduleTimedInterruption(
        kind,
        delaySeconds,
        callerId,
      );
      setDeadline(result.deadline);
      setRemaining(delaySeconds);
      setFallbackNotificationId(result.fallbackNotificationId);
      setOpensAutomatically(result.opensAutomatically);
    } catch (error) {
      Alert.alert(
        t('escape.scheduleErrorTitle'),
        error instanceof Error
          ? error.message
          : t('escape.scheduleErrorBody'),
      );
    } finally {
      setScheduling(false);
    }
  };

  const cancel = async () => {
    await cancelTimedInterruption(fallbackNotificationId).catch(() => undefined);
    setDeadline(null);
    setRemaining(0);
    setFallbackNotificationId(null);
  };

  return (
    <Screen
      eyebrow="Private exit aid"
      title="Timed interruption"
      right={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.done}
        >
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      }
    >
      <View style={styles.howCard}>
        <Text style={styles.howTitle}>How to use it</Text>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Choose a call or ride arrival.</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Set the timer, then leave this screen.</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>
            SafeCity opens the selected interruption when time is up.
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>WHAT SHOULD INTERRUPT?</Text>
      <View style={styles.typeGrid}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: kind === 'call' }}
          onPress={() => setKind('call')}
          style={({ pressed }) => [
            styles.typeCard,
            kind === 'call' && styles.selectedCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.typeIcon}>
            <Text style={styles.typeIconText}>☎</Text>
          </View>
          <Text style={styles.typeTitle}>Incoming call</Text>
          <Text style={styles.typeDetail}>
            Your phone rings. Answer to hear the caller.
          </Text>
          <View
            style={[
              styles.radio,
              kind === 'call' && styles.radioSelected,
            ]}
          />
        </Pressable>

        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: kind === 'ride' }}
          onPress={() => setKind('ride')}
          style={({ pressed }) => [
            styles.typeCard,
            kind === 'ride' && styles.selectedCard,
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.typeIcon}>
            <Text style={styles.typeIconText}>▰</Text>
          </View>
          <Text style={styles.typeTitle}>Ride arrived</Text>
          <Text style={styles.typeDetail}>
            Shows “Your ride is here” with driver details.
          </Text>
          <View
            style={[
              styles.radio,
              kind === 'ride' && styles.radioSelected,
            ]}
          />
        </Pressable>
      </View>

      {kind === 'call' ? (
        <>
          <Text style={styles.sectionLabel}>WHO SHOULD CALL?</Text>
          <View style={styles.choiceRow}>
            {callerOptions.map((caller) => {
              const selected = caller === callerId;
              return (
                <Pressable
                  key={caller}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setCallerId(caller)}
                  style={({ pressed }) => [
                    styles.choice,
                    selected && styles.choiceSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      selected && styles.choiceTextSelected,
                    ]}
                  >
                    {callerLabels[caller]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>WHEN?</Text>
      <View style={styles.delayGrid}>
        {delayOptions.map((seconds) => {
          const selected = seconds === delaySeconds;
          return (
            <Pressable
              key={seconds}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setDelaySeconds(seconds)}
              style={({ pressed }) => [
                styles.delay,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.delayText,
                  selected && styles.choiceTextSelected,
                ]}
              >
                {delayLabel(seconds)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {deadline ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>INTERRUPTION READY</Text>
          <Text style={styles.countdown}>{formatRemaining(remaining)}</Text>
          <Text style={styles.activeTitle}>
            {kind === 'call'
              ? `${callerLabels[callerId]} will call`
              : 'Your ride will arrive'}
          </Text>
          <Text style={styles.activeDetail}>
            {opensAutomatically
              ? 'You can close SafeCity. Android will request the full-screen interruption.'
              : 'Tap the notification when it appears to open the interruption.'}
          </Text>
          <ActionButton
            label="Cancel interruption"
            onPress={() => void cancel()}
            variant="secondary"
          />
        </View>
      ) : (
        <>
          <View style={styles.startButton}>
            <ActionButton
              label={`Schedule ${kind === 'call' ? 'incoming call' : 'ride arrival'}`}
              loading={scheduling}
              onPress={() => void schedule()}
            />
          </View>
          <Text style={styles.permissionNote}>
            Keep notifications and full-screen alerts allowed. Some Android
            phones may show a notification instead of opening automatically.
          </Text>
        </>
      )}

      <View style={styles.safetyNote}>
        <Text style={styles.safetyTitle}>Not an SOS</Text>
        <Text style={styles.safetyText}>
          This is a private exit aid. In immediate danger, use SOS or call 112.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  done: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  doneText: { color: colors.safe, fontSize: type.body, fontWeight: '900' },
  howCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.safeDark,
    backgroundColor: colors.safeSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  howTitle: { color: colors.text, fontSize: type.heading, fontWeight: '900' },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepNumber: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: colors.safe,
    color: colors.background,
    fontSize: type.caption,
    fontWeight: '900',
    lineHeight: 27,
    textAlign: 'center',
  },
  stepText: { flex: 1, color: colors.textMuted, fontSize: type.caption, lineHeight: 18 },
  sectionLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  typeGrid: { flexDirection: 'row', gap: spacing.sm },
  typeCard: {
    flex: 1,
    minHeight: 172,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  selectedCard: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconText: { color: colors.safe, fontSize: 21, fontWeight: '900' },
  typeTitle: { color: colors.text, fontSize: type.body, fontWeight: '900', marginTop: spacing.sm },
  typeDetail: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 4, paddingRight: spacing.sm },
  radio: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  radioSelected: { borderWidth: 5, borderColor: colors.safe, backgroundColor: colors.background },
  choiceRow: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  choiceSelected: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  choiceText: { color: colors.textMuted, fontSize: type.caption, fontWeight: '800' },
  choiceTextSelected: { color: colors.safe, fontWeight: '900' },
  delayGrid: { flexDirection: 'row', gap: spacing.xs },
  delay: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  delayText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  startButton: { marginTop: spacing.lg },
  permissionNote: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  activeCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.safe,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeLabel: { color: colors.safe, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  countdown: { color: colors.text, fontSize: 44, lineHeight: 50, fontWeight: '900', fontVariant: ['tabular-nums'] },
  activeTitle: { color: colors.text, fontSize: type.heading, fontWeight: '900' },
  activeDetail: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, textAlign: 'center', marginBottom: spacing.sm },
  safetyNote: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerPanel,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  safetyTitle: { color: colors.danger, fontSize: type.body, fontWeight: '900' },
  safetyText: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 4 },
  pressed: { opacity: 0.74, transform: [{ scale: 0.985 }] },
});
