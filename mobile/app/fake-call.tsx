import * as Haptics from 'expo-haptics';
import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ActionButton';
import { Screen } from '@/components/Screen';
import { useLocalization } from '@/i18n/localization-provider';
import type { TranslationKey } from '@/i18n/translations';
import { colors, radii, spacing, type } from '@/theme/tokens';

type CallPhase = 'setup' | 'waiting' | 'ringing' | 'connected';
type CallerId = 'family' | 'office' | 'driver';

const callers: Array<{
  id: CallerId;
  nameKey: TranslationKey;
  promptKey: TranslationKey;
  emoji: string;
  speechLanguage: string;
  speechLines: string[];
  audioLines: number[];
}> = [
  {
    id: 'family',
    nameKey: 'fakeCall.callerFamily',
    promptKey: 'fakeCall.promptFamily',
    emoji: 'M',
    speechLanguage: 'en-IN',
    speechLines: [
      'I am on my way home. Keep the door open for me.',
      'I am almost there. Stay on the phone with me.',
      'I am right at the metro exit and coming down your street now.',
      'Keep walking toward the main road. I will meet you there.',
    ],
    audioLines: [
      require('../assets/audio/fake-call/family-1.m4a'),
      require('../assets/audio/fake-call/family-2.m4a'),
      require('../assets/audio/fake-call/family-3.m4a'),
      require('../assets/audio/fake-call/family-4.m4a'),
    ],
  },
  {
    id: 'office',
    nameKey: 'fakeCall.callerOffice',
    promptKey: 'fakeCall.promptOffice',
    emoji: 'O',
    speechLanguage: 'en-IN',
    speechLines: [
      'I am tied up in a meeting, but I am coming down now.',
      'I will be there in a minute. Keep talking to me.',
      'Security is with me and we are walking toward you.',
      'Stay near the entrance. I can see the location you sent.',
    ],
    audioLines: [
      require('../assets/audio/fake-call/office-1.m4a'),
      require('../assets/audio/fake-call/office-2.m4a'),
      require('../assets/audio/fake-call/office-3.m4a'),
      require('../assets/audio/fake-call/office-4.m4a'),
    ],
  },
  {
    id: 'driver',
    nameKey: 'fakeCall.callerDriver',
    promptKey: 'fakeCall.promptDriver',
    emoji: 'D',
    speechLanguage: 'en-IN',
    speechLines: [
      'I am at the pickup point and walking over now.',
      'I can see you. Come straight to me.',
      'I have reached the well-lit main gate. I am waiting outside.',
      'Do not take the side lane. Meet me beside the security desk.',
    ],
    audioLines: [
      require('../assets/audio/fake-call/driver-1.m4a'),
      require('../assets/audio/fake-call/driver-2.m4a'),
      require('../assets/audio/fake-call/driver-3.m4a'),
      require('../assets/audio/fake-call/driver-4.m4a'),
    ],
  },
];

const delays = [0, 5, 15, 30] as const;
const AUDIO_LOAD_TIMEOUT_MS = 5_000;
const AUDIO_PLAY_TIMEOUT_MS = 2_000;
let bundledAudioPlayer: AudioPlayer | null = null;
let playbackOperationId = 0;
let cancelStatusWait: (() => void) | null = null;

class FakeCallPlaybackCancelledError extends Error {
  constructor() {
    super('Fake-call playback was cancelled.');
    this.name = 'FakeCallPlaybackCancelledError';
  }
}

function releasePlayer(audioPlayer: AudioPlayer | null): void {
  if (!audioPlayer) return;
  try {
    audioPlayer.pause();
  } catch {
    // The native player may already have been released.
  }
  try {
    audioPlayer.remove();
  } catch {
    // The native player may already have been released.
  }
  if (bundledAudioPlayer === audioPlayer) bundledAudioPlayer = null;
}

function stopFakeCallAudio(): void {
  playbackOperationId += 1;
  cancelStatusWait?.();
  cancelStatusWait = null;
  releasePlayer(bundledAudioPlayer);
}

function waitForPlayerStatus(
  audioPlayer: AudioPlayer,
  operationId: number,
  predicate: (status: AudioStatus) => boolean,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let subscription: ReturnType<AudioPlayer['addListener']> | undefined;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      subscription?.remove();
      if (cancelStatusWait === cancel) cancelStatusWait = null;
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };
    const check = (status: AudioStatus) => {
      if (
        operationId !== playbackOperationId ||
        bundledAudioPlayer !== audioPlayer
      ) {
        finish(new FakeCallPlaybackCancelledError());
      } else if (status.error) {
        finish(new Error(status.error));
      } else if (predicate(status)) {
        finish();
      }
    };
    const cancel = () => finish(new FakeCallPlaybackCancelledError());

    cancelStatusWait = cancel;
    subscription = audioPlayer.addListener('playbackStatusUpdate', check);
    check(audioPlayer.currentStatus);
    if (settled) return;
    timeout = setTimeout(() => {
      check(audioPlayer.currentStatus);
      if (!settled) finish(new Error(timeoutMessage));
    }, timeoutMs);
  });
}

async function playFakeCallAudio(source: number): Promise<void> {
  stopFakeCallAudio();
  const operationId = playbackOperationId;

  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
    allowsBackgroundRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
  });
  if (operationId !== playbackOperationId) {
    throw new FakeCallPlaybackCancelledError();
  }

  const audioPlayer = createAudioPlayer(source, {
    downloadFirst: true,
    updateInterval: 100,
  });
  bundledAudioPlayer = audioPlayer;
  audioPlayer.volume = 1;

  try {
    await waitForPlayerStatus(
      audioPlayer,
      operationId,
      (status) => status.isLoaded,
      AUDIO_LOAD_TIMEOUT_MS,
      'The caller voice took too long to load.',
    );
    audioPlayer.play();
    await waitForPlayerStatus(
      audioPlayer,
      operationId,
      (status) => status.playing,
      AUDIO_PLAY_TIMEOUT_MS,
      'The phone did not start caller voice playback.',
    );
  } catch (error) {
    releasePlayer(audioPlayer);
    throw error;
  }
}

function isPlaybackCancelled(error: unknown): boolean {
  return error instanceof FakeCallPlaybackCancelledError;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function FakeCallScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [phase, setPhase] = useState<CallPhase>('setup');
  const [callerId, setCallerId] = useState<CallerId>('family');
  const [delay, setDelay] = useState<(typeof delays)[number]>(5);
  const [remaining, setRemaining] = useState(5);
  const [connectedSeconds, setConnectedSeconds] = useState(0);
  const [spokenLineIndex, setSpokenLineIndex] = useState(2);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const caller = useMemo(
    () => callers.find((option) => option.id === callerId) ?? callers[0]!,
    [callerId],
  );

  const playCallerVoice = useCallback((source: number) => {
    setVoiceError(null);
    void playFakeCallAudio(source).catch((error) => {
      if (isPlaybackCancelled(error)) return;
      setVoiceError(
        'Caller voice could not play. Raise the media volume, check the audio output, then tap Play next line.',
      );
    });
  }, []);

  useEffect(() => {
    if (phase !== 'waiting') return;
    if (remaining <= 0) {
      setPhase('ringing');
      return;
    }
    const timeout = setTimeout(() => setRemaining((value) => value - 1), 1_000);
    return () => clearTimeout(timeout);
  }, [phase, remaining]);

  useEffect(() => {
    if (phase !== 'ringing') return;
    Vibration.vibrate([0, 550, 650], true);
    if (process.env.EXPO_OS === 'ios') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return () => Vibration.cancel();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'connected') return;
    let firstVoiceTimeout: ReturnType<typeof setTimeout> | null = null;
    let secondVoiceTimeout: ReturnType<typeof setTimeout> | null = null;
    stopFakeCallAudio();
    firstVoiceTimeout = setTimeout(() => {
      playCallerVoice(caller.audioLines[0]!);
    }, 250);
    secondVoiceTimeout = setTimeout(() => {
      playCallerVoice(caller.audioLines[1] ?? caller.audioLines[0]!);
      setSpokenLineIndex(2);
    }, 9_500);
    const interval = setInterval(() => setConnectedSeconds((value) => value + 1), 1_000);
    return () => {
      if (firstVoiceTimeout) clearTimeout(firstVoiceTimeout);
      if (secondVoiceTimeout) clearTimeout(secondVoiceTimeout);
      clearInterval(interval);
      stopFakeCallAudio();
    };
  }, [caller.audioLines, phase, playCallerVoice]);

  const start = () => {
    setRemaining(delay);
    setConnectedSeconds(0);
    setSpokenLineIndex(2);
    setVoiceError(null);
    stopFakeCallAudio();
    setPhase(delay === 0 ? 'ringing' : 'waiting');
  };

  const speakNextLine = () => {
    const source = caller.audioLines[spokenLineIndex % caller.audioLines.length];
    if (!source) return;
    playCallerVoice(source);
    setSpokenLineIndex((index) => index + 1);
  };

  if (phase === 'setup') {
    return (
      <Screen eyebrow={t('fakeCall.setupEyebrow')} title={t('fakeCall.setupTitle')}>
        <Text style={styles.sectionLabel}>{t('fakeCall.chooseCaller')}</Text>
        <View style={styles.optionGrid}>
          {callers.map((option) => {
            const selected = option.id === callerId;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setCallerId(option.id)}
                style={({ pressed }) => [styles.callerOption, selected && styles.optionSelected, pressed && styles.pressed]}
              >
                <View style={[styles.smallAvatar, selected && styles.smallAvatarSelected]}>
                  <Text style={styles.smallAvatarText}>{option.emoji}</Text>
                </View>
                <Text style={styles.optionText}>{t(option.nameKey)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t('fakeCall.chooseDelay')}</Text>
        <View style={styles.delayGrid}>
          {delays.map((seconds) => {
            const selected = seconds === delay;
            return (
              <Pressable
                key={seconds}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setDelay(seconds)}
                style={({ pressed }) => [styles.delayOption, selected && styles.optionSelected, pressed && styles.pressed]}
              >
                <Text style={[styles.delayText, selected && styles.delayTextSelected]}>
                  {seconds === 0 ? t('fakeCall.now') : t('fakeCall.seconds', { seconds })}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.startButton}>
          <ActionButton label={t('fakeCall.start')} onPress={start} />
        </View>
      </Screen>
    );
  }

  return (
    <SafeAreaView style={styles.callScreen} edges={['top', 'bottom', 'left', 'right']}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>‹</Text>
      </Pressable>
      <Text style={styles.simulationLabel}>{t('fakeCall.simulation')}</Text>
      <View style={styles.callContent}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{caller.emoji}</Text>
        </View>
        <Text style={styles.callerName}>{t(caller.nameKey)}</Text>
        <Text style={styles.callState}>
          {phase === 'waiting'
            ? t('fakeCall.waiting', { seconds: remaining })
            : phase === 'ringing'
              ? t('fakeCall.incoming')
              : `${t('fakeCall.connected')} · ${formatDuration(connectedSeconds)}`}
        </Text>
        {phase === 'connected' ? (
          <>
            <Text style={styles.prompt}>{t(caller.promptKey)}</Text>
            {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
          </>
        ) : null}
      </View>

      {phase === 'ringing' ? (
        <View style={styles.callActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('fakeCall.decline')} onPress={() => router.back()} style={[styles.callAction, styles.decline]}>
            <Text style={styles.callActionIcon}>×</Text>
            <Text style={styles.callActionLabel}>{t('fakeCall.decline')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('fakeCall.accept')} onPress={() => setPhase('connected')} style={[styles.callAction, styles.answer]}>
            <Text style={styles.callActionIcon}>☎</Text>
            <Text style={styles.callActionLabel}>{t('fakeCall.accept')}</Text>
          </Pressable>
        </View>
      ) : phase === 'connected' ? (
        <View style={styles.connectedActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('fakeCall.nextLine')}
            onPress={speakNextLine}
            style={({ pressed }) => [styles.voiceButton, pressed && styles.pressed]}
          >
            <Text style={styles.voiceButtonIcon}>▶</Text>
            <Text style={styles.voiceButtonText}>{t('fakeCall.nextLine')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('fakeCall.end')} onPress={() => router.back()} style={[styles.callAction, styles.decline]}>
            <Text style={styles.callActionIcon}>×</Text>
            <Text style={styles.callActionLabel}>{t('fakeCall.end')}</Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { color: colors.textMuted, fontSize: type.caption, fontWeight: '900', textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  optionGrid: { flexDirection: 'row', gap: spacing.sm },
  callerOption: { flex: 1, minHeight: 108, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.sm },
  optionSelected: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  pressed: { opacity: 0.72 },
  smallAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  smallAvatarSelected: { backgroundColor: colors.safe },
  smallAvatarText: { color: colors.text, fontSize: 18, fontWeight: '900' },
  optionText: { color: colors.text, fontSize: type.caption, fontWeight: '800', textAlign: 'center' },
  delayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  delayOption: { width: '47%', minHeight: 54, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  delayText: { color: colors.textMuted, fontSize: type.body, fontWeight: '800' },
  delayTextSelected: { color: colors.safe },
  startButton: { marginTop: spacing.xl },
  callScreen: { flex: 1, backgroundColor: '#071019', padding: spacing.lg },
  backButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  backText: { color: colors.white, fontSize: 34, lineHeight: 36 },
  simulationLabel: { position: 'absolute', top: 64, alignSelf: 'center', color: colors.textSubtle, fontSize: type.caption, fontWeight: '700' },
  callContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 130 },
  avatar: { width: 126, height: 126, borderRadius: 63, backgroundColor: '#2B3D51', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontSize: 48, fontWeight: '800' },
  callerName: { color: colors.white, fontSize: 34, fontWeight: '700', marginTop: spacing.lg },
  callState: { color: '#BAC5D1', fontSize: type.body, marginTop: spacing.sm, fontVariant: ['tabular-nums'] },
  prompt: { color: colors.textMuted, fontSize: type.body, lineHeight: 23, textAlign: 'center', maxWidth: 320, marginTop: spacing.xl },
  voiceError: { color: '#FFB4B9', fontSize: type.caption, lineHeight: 18, textAlign: 'center', maxWidth: 330, marginTop: spacing.md },
  callActions: { flexDirection: 'row', justifyContent: 'space-around', paddingBottom: spacing.xl },
  callAction: { width: 86, minHeight: 86, borderRadius: 43, alignItems: 'center', justifyContent: 'center' },
  decline: { backgroundColor: '#E64850' },
  answer: { backgroundColor: '#24B76C' },
  callActionIcon: { color: colors.white, fontSize: 27, fontWeight: '900' },
  callActionLabel: { color: colors.white, fontSize: 11, fontWeight: '800', marginTop: 2 },
  connectedActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingBottom: spacing.xl },
  voiceButton: { minHeight: 58, borderRadius: radii.pill, backgroundColor: '#1E3446', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  voiceButtonIcon: { color: colors.safe, fontSize: 14 },
  voiceButtonText: { color: colors.white, fontSize: type.caption, fontWeight: '900' },
});
