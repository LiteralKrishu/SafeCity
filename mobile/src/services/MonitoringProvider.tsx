import { useAudioStream, setAudioModeAsync, type AudioStreamBuffer } from 'expo-audio';
import * as Battery from 'expo-battery';
import * as Haptics from 'expo-haptics';
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
import { getSensorHealth } from '@/services/permissions';
import { useMonitorStore } from '@/store/monitorStore';
import type { Assessment } from '@/types/domain';
import { localFallbackAssessment } from '@/utils/fallbackAssessment';
import { MotionWindow } from '@/utils/motion';

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
  suspendForEvidence: () => Promise<void>;
  resumeAfterEvidence: () => Promise<void>;
}

const MonitoringContext = createContext<MonitoringActions | null>(null);
const ACTIVE_INTERVAL_MS = 3_000;
const ELEVATED_INTERVAL_MS = 1_200;
const BACKGROUND_INTERVAL_MS = 5_000;
const LOW_POWER_INTERVAL_MS = 6_000;
const LOW_POWER_ELEVATED_INTERVAL_MS = 2_000;

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
  const motionWindow = useRef(new MotionWindow());
  const motionSubscription = useRef<ReturnType<typeof DeviceMotion.addListener> | null>(null);
  const audioChunks = useRef<Uint8Array[]>([]);
  const audioBytes = useRef(0);
  const inferenceBusy = useRef(false);
  const lastAudioAt = useRef(0);
  const lastInferenceAt = useRef(0);
  const lowPowerMode = useRef(false);
  const latestLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const locationUpdatedAt = useRef(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const submitBufferedAudioRef = useRef<(sampleRate: number) => Promise<void>>(async () => undefined);
  const shouldAnalyzeRef = useRef<() => boolean>(() => false);

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
    lastAudioAt.current = Date.now();
    const requiredBytes = requiredPcmBytes(buffer.sampleRate);
    if (audioBytes.current > requiredBytes * 2) {
      const tail = takeLatestBytes(audioChunks.current, audioBytes.current, requiredBytes);
      audioChunks.current = [tail];
      audioBytes.current = tail.byteLength;
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
    } catch {
      useMonitorStore.getState().setHealth({ location: 'degraded' });
    }
  }, []);

  const openEvidenceCapture = useCallback(
    async (assessment: Assessment) => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId) return;
      await refreshLocation();
      const incidentId = await createIncident(
        db,
        assessment,
        state.sessionId,
        latestLocation.current,
      );
      state.setActiveIncident(incidentId);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      if (appState.current === 'active') {
        audioStream.stream.stop();
        router.push({ pathname: '/capture', params: { incidentId } });
      } else {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Possible distress detected',
            body: 'Open SafeCity to complete the protected evidence capture.',
            data: { incidentId },
            categoryIdentifier: 'safety-status',
          },
          trigger: null,
        });
      }
    },
    [audioStream.stream, db, refreshLocation, router],
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
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
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
  }, [audioStream.stream]);

  const deactivateSensors = useCallback(() => {
    if (audioStream.stream.isStreaming) audioStream.stream.stop();
    motionSubscription.current?.remove();
    motionSubscription.current = null;
    audioChunks.current = [];
    audioBytes.current = 0;
    lastAudioAt.current = 0;
  }, [audioStream.stream]);

  const startMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (state.sessionState !== 'idle') return;
    const settings = await readSettings(db);
    const id = await startSession(db);
    state.setSession('monitoring', id);
    state.setHealth({ inference: 'checking' });
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
  }, [activateSensors, db, refreshLocation]);

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

  const stopMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    deactivateSensors();
    await stopBackgroundLocation();
    if (state.sessionId) await updateSession(db, state.sessionId, 'stopped');
    resetLocalSession(state.sessionId ?? undefined);
    state.setSession('idle', null);
    state.resetRisk();
  }, [db, deactivateSensors]);

  const triggerManualSos = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (state.activeIncidentId) return;
    await refreshLocation();
    const manualAssessment: Assessment = {
      assessmentId: `manual-${Date.now()}`,
      riskLevel: 'sos',
      confidence: 1,
      fusedScore: 1,
      needsEvidenceCapture: true,
      explanation: 'Manual SOS activated',
      factors: ['Manual SOS'],
      matchedPatterns: [],
      modelVersion: 'manual-v1',
      latencyMs: 0,
    };
    state.setAssessment(manualAssessment);
    const incidentId = await createIncident(
      db,
      manualAssessment,
      state.sessionId,
      latestLocation.current,
      'manual',
    );
    state.setActiveIncident(incidentId);
    deactivateSensors();
    router.push({ pathname: '/capture', params: { incidentId } });
  }, [db, deactivateSensors, refreshLocation, router]);

  const suspendForEvidence = useCallback(async () => {
    deactivateSensors();
  }, [deactivateSensors]);

  const resumeAfterEvidence = useCallback(async () => {
    const state = useMonitorStore.getState();
    state.setActiveIncident(null);
    if (state.sessionState === 'monitoring') await activateSensors();
  }, [activateSensors]);

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
      suspendForEvidence,
      resumeAfterEvidence,
    }),
    [
      pauseMonitoring,
      resumeAfterEvidence,
      resumeMonitoring,
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
