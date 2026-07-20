import { useAudioStream, setAudioModeAsync, type AudioStreamBuffer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { DeviceMotion } from 'expo-sensors';
import { useSQLiteContext } from 'expo-sqlite';
import {
  AppState,
  type AppStateStatus,
} from 'react-native';
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
import { getDeviceId } from '@/services/deviceIdentity';
import { analyzeSignalWindow, checkInferenceHealth } from '@/services/inferenceApi';
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
const WINDOW_SECONDS = 1.5;

function mergeChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

export function MonitoringProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const router = useRouter();
  const motionWindow = useRef(new MotionWindow());
  const motionSubscription = useRef<ReturnType<typeof DeviceMotion.addListener> | null>(null);
  const audioChunks = useRef<Uint8Array[]>([]);
  const audioBytes = useRef(0);
  const uploading = useRef(false);
  const lastAudioAt = useRef(0);
  const serviceUrl = useRef('http://127.0.0.1:8000');
  const latestLocation = useRef<{ latitude: number; longitude: number } | null>(null);
  const locationUpdatedAt = useRef(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const submitBufferedAudioRef = useRef<(sampleRate: number) => Promise<void>>(async () => undefined);

  const handleAudioBuffer = useCallback((buffer: AudioStreamBuffer) => {
    if (useMonitorStore.getState().sessionState !== 'monitoring') return;
    const chunk = new Uint8Array(buffer.data).slice();
    audioChunks.current.push(chunk);
    audioBytes.current += chunk.byteLength;
    lastAudioAt.current = Date.now();
    const requiredBytes = buffer.sampleRate * WINDOW_SECONDS * 2;
    if (audioBytes.current >= requiredBytes && !uploading.current) {
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
    async (audioFile: File | null, sampleRate: number) => {
      const state = useMonitorStore.getState();
      if (state.sessionState !== 'monitoring' || !state.sessionId) return;
      const motion = motionWindow.current.snapshot();
      let assessment: Assessment;
      try {
        assessment = await analyzeSignalWindow(serviceUrl.current, audioFile, {
          deviceId: await getDeviceId(),
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
    if (uploading.current || audioBytes.current === 0) return;
    uploading.current = true;
    const chunks = audioChunks.current;
    const byteLength = audioBytes.current;
    audioChunks.current = [];
    audioBytes.current = 0;
    const file = new File(Paths.cache, `safecity-window-${Date.now()}.pcm`);
    try {
      file.create({ overwrite: true });
      file.write(mergeChunks(chunks, byteLength));
      await refreshLocation();
      await submitWindow(file, sampleRate);
    } finally {
      if (file.exists) file.delete();
      uploading.current = false;
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
  }, [audioStream.stream]);

  const startMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (state.sessionState !== 'idle') return;
    const settings = await readSettings(db);
    serviceUrl.current = settings.serviceUrl;
    const id = await startSession(db);
    state.setSession('monitoring', id);
    state.setHealth({
      inference: (await checkInferenceHealth(settings.serviceUrl)) ? 'ready' : 'offline',
    });
    await activateSensors();
    await refreshLocation();
    if (settings.backgroundLocation) {
      try {
        await startBackgroundLocation();
      } catch {
        state.setHealth({ location: 'degraded' });
      }
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
    await activateSensors();
    await startBackgroundLocation().catch(() => state.setHealth({ location: 'degraded' }));
  }, [activateSensors, db]);

  const stopMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    deactivateSensors();
    await stopBackgroundLocation();
    if (state.sessionId) await updateSession(db, state.sessionId, 'stopped');
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
      const state = useMonitorStore.getState();
      if (state.sessionState === 'monitoring') {
        state.setHealth({ microphone: nextState === 'active' ? 'ready' : 'degraded' });
      }
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
        Date.now() - lastAudioAt.current > WINDOW_SECONDS * 1_500 &&
        !uploading.current
      ) {
        uploading.current = true;
        void refreshLocation()
          .then(() => submitWindow(null, 16_000))
          .finally(() => {
            uploading.current = false;
          });
      }
    }, WINDOW_SECONDS * 1_000);
    return () => clearInterval(interval);
  }, [refreshLocation, submitWindow]);

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
