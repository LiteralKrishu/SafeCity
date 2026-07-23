import { useAudioStream, setAudioModeAsync, type AudioStreamBuffer } from 'expo-audio';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { useSQLiteContext } from 'expo-sqlite';
import { AppState, type AppStateStatus } from 'react-native';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  createIncident,
  readSettings,
  startSession,
  updateSession,
  updateIncidentSnapshotUri,
} from '@/db/repository';
import {
  getCurrentLocation,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/services/backgroundLocation';
import {
  assessLocalSignalWindow,
  calculateMotionScore,
  resetLocalSession,
} from '@/inference/localFusion';
import {
  initializeOnDeviceAudio,
  YAMNET_INPUT_SAMPLES,
  YAMNET_SAMPLE_RATE,
} from '@/inference/onDeviceAudio';
import { useLocalization } from '@/i18n/localization-provider';
import { triggerHaptic } from '@/services/haptics';
import { encryptEvidenceBytes } from '@/services/evidence';
import { getSensorHealth } from '@/services/permissions';
import {
  isVoiceTriggerAvailable,
  processVoiceTriggerPcm,
  releaseVoiceTriggerRecognition,
  startVoiceTriggerRecognition,
  stopVoiceTriggerRecognition,
} from '@/services/voice-trigger';
import { useMonitorStore } from '@/store/monitorStore';
import type { Assessment } from '@/types/domain';
import { localFallbackAssessment } from '@/utils/fallbackAssessment';
import { MotionWindow } from '@/utils/motion';
import { encodePcm16Wav } from '@/utils/wav';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface MonitoringActions {
  startMonitoring: () => Promise<void>;
  pauseMonitoring: () => Promise<void>;
  resumeMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;
  triggerManualSos: () => Promise<void>;
  setVoiceTriggerEnabled: (enabled: boolean) => Promise<void>;
  suspendForEvidence: () => Promise<void>;
  resumeAfterEvidence: () => Promise<void>;
}

const MonitoringContext = createContext<MonitoringActions | null>(null);
const ACTIVE_INTERVAL_MS = 3_000;
const ELEVATED_INTERVAL_MS = 1_200;
const BACKGROUND_INTERVAL_MS = 5_000;
const LOW_POWER_INTERVAL_MS = 6_000;
const LOW_POWER_ELEVATED_INTERVAL_MS = 2_000;
const SNAPSHOT_WINDOW_MS = 15_000;
const SNAPSHOT_PCM_BYTES = Math.round((SNAPSHOT_WINDOW_MS * YAMNET_SAMPLE_RATE * 2) / 1_000);
const VOICE_TRIGGER_BATCH_BYTES = Math.round(YAMNET_SAMPLE_RATE * 2 * 0.16);
const VOICE_TRIGGER_MAX_PENDING_BYTES = YAMNET_SAMPLE_RATE * 2 * 4;

function requiredPcmBytes(sampleRate: number): number {
  return Math.round((sampleRate * YAMNET_INPUT_SAMPLES * 2) / YAMNET_SAMPLE_RATE);
}

function takeLatestBytes(chunks: Uint8Array[], totalBytes: number, limit: number): Uint8Array {
  const outputSize = Math.min(totalBytes, limit);
  const output = new Uint8Array(outputSize);
  let targetStart = outputSize;
  for (let index = chunks.length - 1; index >= 0 && targetStart > 0; index -= 1) {
    const chunk = chunks[index];
    if (!chunk) continue;
    const copySize = Math.min(chunk.byteLength, targetStart);
    targetStart -= copySize;
    output.set(chunk.subarray(chunk.byteLength - copySize), targetStart);
  }
  return output;
}

export function MonitoringProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useLocalization();
  const motionWindow = useRef(new MotionWindow());
  const motionSubscription = useRef<ReturnType<typeof DeviceMotion.addListener> | null>(null);
  const audioChunks = useRef<Uint8Array[]>([]);
  const audioBytes = useRef(0);
  const snapshotChunks = useRef<Uint8Array[]>([]);
  const snapshotBytes = useRef(0);
  const inferenceBusy = useRef(false);
  const lastAudioAt = useRef(0);
  const lastAudioTelemetryAt = useRef(0);
  const lastMotionTelemetryAt = useRef(0);
  const lastInferenceAt = useRef(0);
  const lowPowerMode = useRef(false);
  const latestLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const locationUpdatedAt = useRef(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const submitBufferedAudioRef = useRef<(sampleRate: number) => Promise<void>>(async () => undefined);
  const shouldAnalyzeRef = useRef<() => boolean>(() => false);
  const voiceTriggerEnabled = useRef(false);
  const voiceTriggerArmed = useRef(false);
  const voiceSosBusy = useRef(false);
  const voiceInferenceBusy = useRef(false);
  const voicePcmChunks = useRef<Uint8Array[]>([]);
  const voicePcmBytes = useRef(0);
  const flushVoiceAudioRef = useRef<(sampleRate: number) => Promise<void>>(
    async () => undefined,
  );
  const triggerVoiceSosRef = useRef<() => Promise<void>>(async () => undefined);

  shouldAnalyzeRef.current = () => {
    const motion = motionWindow.current.snapshot();
    const motionScore = calculateMotionScore(motion).score;
    const elevated = motion.impactAfterFreeFall || motionScore >= 0.35;
    const interval = elevated
      ? lowPowerMode.current
        ? LOW_POWER_ELEVATED_INTERVAL_MS
        : ELEVATED_INTERVAL_MS
      : lowPowerMode.current
        ? LOW_POWER_INTERVAL_MS
        : appState.current === 'active'
          ? ACTIVE_INTERVAL_MS
          : BACKGROUND_INTERVAL_MS;
    return Date.now() - lastInferenceAt.current >= interval;
  };

  const handleAudioBuffer = useCallback((buffer: AudioStreamBuffer) => {
    if (useMonitorStore.getState().sessionState !== 'monitoring') return;
    const chunk = new Uint8Array(buffer.data).slice();
    audioChunks.current.push(chunk);
    audioBytes.current += chunk.byteLength;
    snapshotChunks.current.push(chunk);
    snapshotBytes.current += chunk.byteLength;
    if (voiceTriggerEnabled.current && voiceTriggerArmed.current) {
      voicePcmChunks.current.push(chunk);
      voicePcmBytes.current += chunk.byteLength;
      if (voicePcmBytes.current > VOICE_TRIGGER_MAX_PENDING_BYTES) {
        const tail = takeLatestBytes(
          voicePcmChunks.current,
          voicePcmBytes.current,
          VOICE_TRIGGER_MAX_PENDING_BYTES,
        );
        voicePcmChunks.current = [tail];
        voicePcmBytes.current = tail.byteLength;
      }
      if (voicePcmBytes.current >= VOICE_TRIGGER_BATCH_BYTES) {
        void flushVoiceAudioRef.current(buffer.sampleRate);
      }
    }
    lastAudioAt.current = Date.now();
    if (lastAudioAt.current - lastAudioTelemetryAt.current >= 250) {
      const samples = new Int16Array(buffer.data);
      let sumSquares = 0;
      let sampleCount = 0;
      for (let index = 0; index < samples.length; index += 4) {
        const sample = samples[index] ?? 0;
        sumSquares += sample * sample;
        sampleCount += 1;
      }
      const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) / 32_768 : 0;
      useMonitorStore.getState().setTelemetry({
        audioLevel: Math.min(1, rms * 5),
        audioUpdatedAt: lastAudioAt.current,
      });
      lastAudioTelemetryAt.current = lastAudioAt.current;
    }
    const requiredBytes = requiredPcmBytes(buffer.sampleRate);
    if (audioBytes.current > requiredBytes * 2) {
      const tail = takeLatestBytes(audioChunks.current, audioBytes.current, requiredBytes);
      audioChunks.current = [tail];
      audioBytes.current = tail.byteLength;
    }
    if (snapshotBytes.current > SNAPSHOT_PCM_BYTES) {
      const tail = takeLatestBytes(snapshotChunks.current, snapshotBytes.current, SNAPSHOT_PCM_BYTES);
      snapshotChunks.current = [tail];
      snapshotBytes.current = tail.byteLength;
    }
    if (
      audioBytes.current >= requiredBytes &&
      !inferenceBusy.current &&
      shouldAnalyzeRef.current()
    ) {
      void submitBufferedAudioRef.current(buffer.sampleRate);
    }
  }, []);

  const audioStream = useAudioStream({
    sampleRate: 16_000,
    channels: 1,
    encoding: 'int16',
    onBuffer: handleAudioBuffer,
  });

  const refreshLocation = useCallback(async () => {
    if (Date.now() - locationUpdatedAt.current < 30_000) return;
    try {
      latestLocation.current = await getCurrentLocation();
      locationUpdatedAt.current = Date.now();
      if (latestLocation.current) {
        useMonitorStore.getState().setTelemetry({
          location: { ...latestLocation.current, accuracy: null },
          locationUpdatedAt: locationUpdatedAt.current,
        });
      }
    } catch {
      useMonitorStore.getState().setHealth({ location: 'degraded' });
    }
  }, []);

  const clearAudioSnapshotBuffer = useCallback(() => {
    snapshotChunks.current = [];
    snapshotBytes.current = 0;
  }, []);

  const stopVoiceTrigger = useCallback(() => {
    voiceTriggerArmed.current = false;
    voicePcmChunks.current = [];
    voicePcmBytes.current = 0;
    void stopVoiceTriggerRecognition().catch(() => undefined);
    useMonitorStore.getState().setTelemetry({
      voiceTriggerStatus: 'disabled',
      voiceTriggerTranscript: null,
    });
  }, []);

  const startVoiceTrigger = useCallback(() => {
    const state = useMonitorStore.getState();
    if (
      !voiceTriggerEnabled.current ||
      state.sessionState !== 'monitoring' ||
      state.activeIncidentId
    ) {
      return;
    }
    if (!isVoiceTriggerAvailable()) {
      voiceTriggerArmed.current = false;
      state.setTelemetry({ voiceTriggerStatus: 'unavailable' });
      return;
    }

    voiceTriggerArmed.current = true;
    state.setTelemetry({ voiceTriggerStatus: 'checking' });
    void startVoiceTriggerRecognition()
      .then(() => {
        const current = useMonitorStore.getState();
        if (
          !voiceTriggerArmed.current ||
          !voiceTriggerEnabled.current ||
          current.sessionState !== 'monitoring' ||
          current.activeIncidentId
        ) {
          void stopVoiceTriggerRecognition().catch(() => undefined);
          return;
        }
        current.setTelemetry({ voiceTriggerStatus: 'listening' });
      })
      .catch(() => {
        voiceTriggerArmed.current = false;
        useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'error' });
      });
  }, []);

  const persistAudioSnapshot = useCallback(
    async (incidentId: string): Promise<string | null> => {
      if (snapshotBytes.current === 0) return null;
      const snapshot = takeLatestBytes(snapshotChunks.current, snapshotBytes.current, SNAPSHOT_PCM_BYTES);
      if (!snapshot.byteLength) return null;
      try {
        const wavSnapshot = encodePcm16Wav(snapshot, YAMNET_SAMPLE_RATE);
        const snapshotUri = await encryptEvidenceBytes(
          wavSnapshot,
          incidentId,
          'pre-alert-audio',
        );
        await updateIncidentSnapshotUri(db, incidentId, snapshotUri);
        clearAudioSnapshotBuffer();
        return snapshotUri;
      } catch {
        return null;
      }
    },
    [clearAudioSnapshotBuffer, db],
  );

  const openEvidenceCapture = useCallback(
    async (assessment: Assessment) => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId) return;
      await triggerHaptic('sos');
      await refreshLocation();
      const incidentId = await createIncident(
        db,
        assessment,
        state.sessionId,
        latestLocation.current,
      );
      state.setActiveIncident(incidentId);
      await persistAudioSnapshot(incidentId);
      await triggerHaptic('warning');

      if (appState.current === 'active') {
        audioStream.stream.stop();
        router.push({ pathname: '/capture', params: { incidentId } });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: t('monitor.distressTitle'),
            body: t('monitor.distressBody'),
            data: { incidentId },
            categoryIdentifier: 'safety-status',
          },
          trigger: null,
        });
      }
    },
    [audioStream.stream, db, persistAudioSnapshot, refreshLocation, router, t],
  );

  const submitWindow = useCallback(
    async (pcmBytes: Uint8Array | null, sampleRate: number) => {
      const state = useMonitorStore.getState();
      if (state.sessionState !== 'monitoring' || !state.sessionId) return;
      const motion = motionWindow.current.snapshot();
      let assessment: Assessment;
      try {
        assessment = await assessLocalSignalWindow({
          audioBytes: pcmBytes,
          sessionId: state.sessionId,
          sampleRate,
          motion,
          context: {
            hour: new Date().getHours(),
            appState: appState.current,
          },
        });
        state.setHealth({ inference: 'ready' });
      } catch {
        assessment = localFallbackAssessment(motion);
        state.setHealth({ inference: 'offline' });
      }

      state.setAssessment(assessment);
      if (assessment.riskLevel === 'alert') {
        await triggerHaptic('warning');
      }
      if (assessment.needsEvidenceCapture) await openEvidenceCapture(assessment);
    },
    [openEvidenceCapture],
  );

  submitBufferedAudioRef.current = async (sampleRate: number) => {
    if (
      inferenceBusy.current ||
      audioBytes.current === 0 ||
      !shouldAnalyzeRef.current()
    ) {
      return;
    }
    inferenceBusy.current = true;
    lastInferenceAt.current = Date.now();
    const chunks = audioChunks.current;
    const byteLength = audioBytes.current;
    audioChunks.current = [];
    audioBytes.current = 0;
    try {
      const pcmBytes = takeLatestBytes(chunks, byteLength, requiredPcmBytes(sampleRate));
      await submitWindow(pcmBytes, sampleRate);
    } finally {
      inferenceBusy.current = false;
    }
  };

  const activateSensors = useCallback(async () => {
    const state = useMonitorStore.getState();
    const health = await getSensorHealth();
    state.setHealth(health);

    if (health.motion === 'ready' && !motionSubscription.current) {
      DeviceMotion.setUpdateInterval(100);
      motionSubscription.current = DeviceMotion.addListener((measurement) => {
        motionWindow.current.add(measurement);
        const now = Date.now();
        if (now - lastMotionTelemetryAt.current >= 250) {
          const acceleration = measurement.accelerationIncludingGravity ?? measurement.acceleration;
          if (acceleration) {
            useMonitorStore.getState().setTelemetry({
              motion: {
                x: acceleration.x / DeviceMotion.Gravity,
                y: acceleration.y / DeviceMotion.Gravity,
                z: acceleration.z / DeviceMotion.Gravity,
                magnitudeG:
                  Math.sqrt(acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2) /
                  DeviceMotion.Gravity,
              },
              motionUpdatedAt: now,
            });
            lastMotionTelemetryAt.current = now;
          }
        }
      });
    }
    if (health.microphone === 'ready' && !audioStream.stream.isStreaming) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        allowsBackgroundRecording: true,
        interruptionMode: 'mixWithOthers',
      });
      await audioStream.stream.start();
    }
    if (health.microphone === 'ready' && voiceTriggerEnabled.current) {
      startVoiceTrigger();
    }
  }, [audioStream.stream, startVoiceTrigger]);

  const deactivateSensors = useCallback(() => {
    stopVoiceTrigger();
    // Expo can release the native shared object before React runs a development
    // cleanup pass. Treat an already-released stream as stopped.
    try {
      if (audioStream.stream.isStreaming) audioStream.stream.stop();
    } catch {
      // The native audio stream has already been disposed.
    }
    motionSubscription.current?.remove();
    motionSubscription.current = null;
    audioChunks.current = [];
    audioBytes.current = 0;
    clearAudioSnapshotBuffer();
    lastAudioAt.current = 0;
    useMonitorStore.getState().setTelemetry({ audioLevel: 0 });
  }, [audioStream.stream, clearAudioSnapshotBuffer, stopVoiceTrigger]);

  const startMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (state.sessionState !== 'idle') return;
    const settings = await readSettings(db);
    voiceTriggerEnabled.current = settings.voiceKeywordEnabled;
    const id = await startSession(db);
    state.setSession('monitoring', id);
    state.setHealth({ inference: 'checking' });
    clearAudioSnapshotBuffer();
    lastInferenceAt.current = Date.now();
    lastAudioAt.current = Date.now();
    const modelReady = initializeOnDeviceAudio()
      .then(() => true)
      .catch(() => false);
    const [, onDeviceModelReady] = await Promise.all([activateSensors(), modelReady]);
    state.setHealth({ inference: onDeviceModelReady ? 'ready' : 'offline' });
    void refreshLocation();
    if (settings.backgroundLocation) {
      void startBackgroundLocation().catch(() => state.setHealth({ location: 'degraded' }));
    }
  }, [activateSensors, clearAudioSnapshotBuffer, db, refreshLocation]);

  const pauseMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (!state.sessionId || state.sessionState !== 'monitoring') return;
    deactivateSensors();
    await stopBackgroundLocation();
    await updateSession(db, state.sessionId, 'paused');
    state.setSession('paused', state.sessionId);
  }, [db, deactivateSensors]);

  const resumeMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (!state.sessionId || state.sessionState !== 'paused') return;
    await updateSession(db, state.sessionId, 'monitoring');
    state.setSession('monitoring', state.sessionId);
    state.setHealth({ inference: 'checking' });
    const modelReady = initializeOnDeviceAudio()
      .then(() => true)
      .catch(() => false);
    await activateSensors();
    state.setHealth({ inference: (await modelReady) ? 'ready' : 'offline' });
    void startBackgroundLocation().catch(() => state.setHealth({ location: 'degraded' }));
  }, [activateSensors, db]);

  const setVoiceTriggerEnabled = useCallback(
    async (enabled: boolean) => {
      voiceTriggerEnabled.current = enabled;
      const state = useMonitorStore.getState();
      if (enabled && state.sessionState === 'monitoring') {
        startVoiceTrigger();
      } else {
        stopVoiceTrigger();
      }
    },
    [startVoiceTrigger, stopVoiceTrigger],
  );

  const stopMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    deactivateSensors();
    await stopBackgroundLocation();
    if (state.sessionId) await updateSession(db, state.sessionId, 'stopped');
    resetLocalSession(state.sessionId ?? undefined);
    clearAudioSnapshotBuffer();
    state.setSession('idle', null);
    state.resetRisk();
  }, [clearAudioSnapshotBuffer, db, deactivateSensors]);

  const triggerDirectSos = useCallback(
    async (source: 'manual' | 'voice') => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId) return;
      await triggerHaptic('sos');
      await refreshLocation();
      const explanation =
        source === 'voice' ? t('monitor.voiceSos') : t('monitor.manualSos');
      const assessment: Assessment = {
        assessmentId: `${source}-${Date.now()}`,
        riskLevel: 'sos',
        confidence: 1,
        fusedScore: 1,
        needsEvidenceCapture: true,
        explanation,
        factors: [explanation],
        matchedPatterns: [],
        modelVersion: `${source}-v1`,
        latencyMs: 0,
      };
      state.setAssessment(assessment);
      const incidentId = await createIncident(
        db,
        assessment,
        state.sessionId,
        latestLocation.current,
        source,
      );
      state.setActiveIncident(incidentId);
      await persistAudioSnapshot(incidentId);
      deactivateSensors();
      router.push({ pathname: '/capture', params: { incidentId } });
    },
    [db, deactivateSensors, persistAudioSnapshot, refreshLocation, router, t],
  );

  const triggerManualSos = useCallback(
    async () => triggerDirectSos('manual'),
    [triggerDirectSos],
  );

  const triggerVoiceSos = useCallback(
    async () => triggerDirectSos('voice'),
    [triggerDirectSos],
  );

  triggerVoiceSosRef.current = triggerVoiceSos;

  flushVoiceAudioRef.current = async (sampleRate: number) => {
    if (
      voiceInferenceBusy.current ||
      !voiceTriggerArmed.current ||
      voicePcmBytes.current < VOICE_TRIGGER_BATCH_BYTES
    ) {
      return;
    }

    voiceInferenceBusy.current = true;
    const chunks = voicePcmChunks.current;
    const byteLength = voicePcmBytes.current;
    voicePcmChunks.current = [];
    voicePcmBytes.current = 0;

    try {
      const pcmBytes = takeLatestBytes(
        chunks,
        byteLength,
        VOICE_TRIGGER_MAX_PENDING_BYTES,
      );
      const detection = await processVoiceTriggerPcm(pcmBytes, sampleRate);
      if (!detection || !voiceTriggerArmed.current || voiceSosBusy.current) return;

      voiceSosBusy.current = true;
      voiceTriggerArmed.current = false;
      useMonitorStore.getState().setTelemetry({
        voiceTriggerTranscript: detection.keyword,
      });
      try {
        await triggerVoiceSosRef.current();
      } finally {
        voiceSosBusy.current = false;
      }
    } catch {
      voiceTriggerArmed.current = false;
      useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'error' });
      void stopVoiceTriggerRecognition().catch(() => undefined);
    } finally {
      voiceInferenceBusy.current = false;
      if (
        voiceTriggerArmed.current &&
        voicePcmBytes.current >= VOICE_TRIGGER_BATCH_BYTES
      ) {
        void flushVoiceAudioRef.current(sampleRate);
      }
    }
  };

  const suspendForEvidence = useCallback(async () => {
    deactivateSensors();
  }, [deactivateSensors]);

  const resumeAfterEvidence = useCallback(async () => {
    const state = useMonitorStore.getState();
    state.setActiveIncident(null);
    clearAudioSnapshotBuffer();
    if (state.sessionState === 'monitoring') await activateSensors();
  }, [activateSensors, clearAudioSnapshotBuffer]);

  useEffect(
    () => () => {
      void releaseVoiceTriggerRecognition().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    void Battery.isLowPowerModeEnabledAsync()
      .then((enabled) => {
        lowPowerMode.current = enabled;
      })
      .catch(() => undefined);
    const subscription = Battery.addLowPowerModeListener(({ lowPowerMode: enabled }) => {
      lowPowerMode.current = enabled;
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const incidentId = response.notification.request.content.data?.incidentId;
      if (typeof incidentId === 'string') {
        router.push({ pathname: '/capture', params: { incidentId } });
      }
    });
    return () => subscription.remove();
  }, [router]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = useMonitorStore.getState();
      if (
        state.sessionState === 'monitoring' &&
        Date.now() - lastAudioAt.current > 2_500 &&
        !inferenceBusy.current &&
        shouldAnalyzeRef.current()
      ) {
        inferenceBusy.current = true;
        lastInferenceAt.current = Date.now();
        void submitWindow(null, YAMNET_SAMPLE_RATE)
          .finally(() => {
            inferenceBusy.current = false;
          });
      }
    }, 1_000);
    return () => clearInterval(interval);
  }, [submitWindow]);

  useEffect(() => () => deactivateSensors(), [deactivateSensors]);

  const actions = useMemo<MonitoringActions>(
    () => ({
      startMonitoring,
      pauseMonitoring,
      resumeMonitoring,
      stopMonitoring,
      triggerManualSos,
      setVoiceTriggerEnabled,
      suspendForEvidence,
      resumeAfterEvidence,
    }),
    [
      pauseMonitoring,
      resumeAfterEvidence,
      resumeMonitoring,
      setVoiceTriggerEnabled,
      startMonitoring,
      stopMonitoring,
      suspendForEvidence,
      triggerManualSos,
    ],
  );

  return <MonitoringContext.Provider value={actions}>{children}</MonitoringContext.Provider>;
}

export function useMonitoring(): MonitoringActions {
  const value = useContext(MonitoringContext);
  if (!value) throw new Error('useMonitoring must be used inside MonitoringProvider');
  return value;
}
