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
  writeSettings,
} from '@/db/repository';
import {
  getCurrentLocation,
  getRecentBackgroundLocation,
  type SafeCityLocationFix,
  startBackgroundLocation,
  stopBackgroundLocation,
} from '@/services/backgroundLocation';
import {
  assessBehaviorDeviation,
  BEHAVIOR_OBSERVATION_INTERVAL_MS,
  createBehaviorObservation,
  disabledBehaviorBaselineTelemetry,
  getBehaviorBaselineStatus,
  learnBehaviorObservation,
  resetBehaviorBaseline,
  type BehaviorBaselineStatus,
  type BehaviorDeviationSignal,
  type BehaviorLocationSample,
  type BehaviorObservation,
} from '@/inference/behaviorBaseline';
import {
  assessLocalSignalWindow,
  calculateMotionScore,
  recordThreatLanguageMatch,
  resetLocalSession,
} from '@/inference/localFusion';
import { getAutomaticMotionTrigger } from '@/inference/safetyCalibration';
import {
  getThreatPhrase,
  isThreatPhraseKeyword,
} from '@/inference/threatLanguage';
import {
  initializeOnDeviceAudio,
  LITE_MODEL_VERSION,
  YAMNET_INPUT_SAMPLES,
  YAMNET_SAMPLE_RATE,
} from '@/inference/onDeviceAudio';
import { resolveInferenceModel } from '@/inference/modelProfiles';
import { useLocalization } from '@/i18n/localization-provider';
import {
  PRIVACY_NOTICE_VERSION,
  PROCESSING_CONSENT_VERSION,
  TERMS_VERSION,
} from '@/legal/content';
import { triggerHaptic } from '@/services/haptics';
import { encryptEvidenceBytes } from '@/services/evidence';
import {
  allCorePermissionsGranted,
  getCorePermissionSnapshot,
  getSensorHealth,
} from '@/services/permissions';
import {
  addPersistentSafetyTriggerListener,
  addPersistentVoiceTriggerListener,
  disablePersistentProtection,
  disablePersistentVoiceTrigger,
  enablePersistentProtection,
  enableVoiceTrigger,
  getPersistentVoiceTriggerState,
  isPersistentVoiceTriggerAvailable,
  rearmPersistentVoiceTrigger,
  setPersistentProtectionActive,
  setPersistentVoiceTriggerListening,
} from '@/services/persistent-voice-trigger';
import {
  isVoiceTriggerAvailable,
  processVoiceTriggerPcm,
  releaseVoiceTriggerRecognition,
  startVoiceTriggerRecognition,
  stopVoiceTriggerRecognition,
  type EmergencyVoiceTriggerKeyword,
} from '@/services/voice-trigger';
import {
  queueAnonymousDistressReport,
  type AnonymousDistressSource,
} from '@/services/riskZones';
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
  triggerVoiceSos: () => Promise<void>;
  triggerMotionSos: () => Promise<void>;
  triggerAudioSos: () => Promise<void>;
  rearmVoiceTrigger: () => Promise<void>;
  setBehaviorBaselineEnabled: (enabled: boolean) => Promise<void>;
  setVoiceTriggerEnabled: (enabled: boolean) => Promise<void>;
  suspendForEvidence: () => Promise<void>;
  resumeAfterEvidence: () => Promise<void>;
  suspendForSiren: () => Promise<void>;
  resumeAfterSiren: () => Promise<void>;
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
const AUDIO_SPECTRUM_BAR_COUNT = 36;
const AUDIO_SPECTRUM_MIN_HZ = 80;
const AUDIO_SPECTRUM_MAX_HZ = 4_000;
const AUDIO_SPECTRUM_FRAME_SIZE = 512;
const ACTIVE_MOTION_INTERVAL_MS = 20;
const LOW_POWER_MOTION_INTERVAL_MS = 40;
const audioSpectrumWindows = new Map<number, number[]>();

function hasCurrentMonitoringConsent(settings: {
  consentVersion: string | null;
  privacyNoticeVersion: string | null;
  termsVersion: string | null;
}): boolean {
  return (
    settings.consentVersion === PROCESSING_CONSENT_VERSION &&
    settings.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
    settings.termsVersion === TERMS_VERSION
  );
}

function behaviorTelemetry(
  enabled: boolean,
  status?: BehaviorBaselineStatus,
  signal?: BehaviorDeviationSignal | null,
) {
  if (!enabled) return disabledBehaviorBaselineTelemetry();
  const resolvedStatus = status ?? signal?.status;
  return {
    enabled: true,
    phase: resolvedStatus?.phase ?? 'warming',
    ready: resolvedStatus?.ready ?? false,
    sampleCount: resolvedStatus?.sampleCount ?? 0,
    dayCount: resolvedStatus?.dayCount ?? 0,
    profileCount: resolvedStatus?.profileCount ?? 0,
    locationProfileCount: resolvedStatus?.locationProfileCount ?? 0,
    progress: resolvedStatus?.progress ?? 0,
    lastLearnedAt: resolvedStatus?.lastLearnedAt ?? null,
    deviationScore: signal?.score ?? 0,
    factors: signal?.factors ?? [],
  };
}

interface AudioSignalAnalysis {
  level: number;
  dbFs: number;
  spectrum: number[];
  dominantFrequencyHz: number | null;
}

function spectrumWindow(frameSize: number): number[] {
  const cached = audioSpectrumWindows.get(frameSize);
  if (cached) return cached;
  const window = Array.from(
    { length: frameSize },
    (_, index) => 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (frameSize - 1)),
  );
  audioSpectrumWindows.set(frameSize, window);
  return window;
}

function analyzeAudioSignal(
  samples: Int16Array,
  sampleRate: number,
  previousSpectrum: number[],
): AudioSignalAnalysis {
  if (samples.length < 32) {
    return {
      level: 0,
      dbFs: -96,
      spectrum: Array.from({ length: AUDIO_SPECTRUM_BAR_COUNT }, () => 0),
      dominantFrequencyHz: null,
    };
  }

  let sumSquares = 0;
  let sampleCount = 0;
  for (let index = 0; index < samples.length; index += 4) {
    const sample = (samples[index] ?? 0) / 32_768;
    sumSquares += sample * sample;
    sampleCount += 1;
  }
  const rms = sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0;
  const dbFs = rms > 0 ? Math.max(-96, 20 * Math.log10(rms)) : -96;
  const frameSize = Math.min(AUDIO_SPECTRUM_FRAME_SIZE, samples.length);
  const frameStart = samples.length - frameSize;
  const window = spectrumWindow(frameSize);
  const maxFrequency = Math.min(AUDIO_SPECTRUM_MAX_HZ, sampleRate * 0.45);
  const spectrum: number[] = [];
  let dominantMagnitude = 0;
  let dominantFrequencyHz: number | null = null;

  for (let barIndex = 0; barIndex < AUDIO_SPECTRUM_BAR_COUNT; barIndex += 1) {
    const progress = barIndex / (AUDIO_SPECTRUM_BAR_COUNT - 1);
    const frequency =
      AUDIO_SPECTRUM_MIN_HZ *
      Math.pow(maxFrequency / AUDIO_SPECTRUM_MIN_HZ, progress);
    const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
    let q1 = 0;
    let q2 = 0;

    for (let sampleIndex = 0; sampleIndex < frameSize; sampleIndex += 1) {
      const sample =
        ((samples[frameStart + sampleIndex] ?? 0) / 32_768) *
        (window[sampleIndex] ?? 0);
      const q0 = coefficient * q1 - q2 + sample;
      q2 = q1;
      q1 = q0;
    }

    const power = Math.max(0, q1 * q1 + q2 * q2 - coefficient * q1 * q2);
    const magnitude = Math.sqrt(power) / Math.max(1, frameSize * 0.5);
    const bandDb = 20 * Math.log10(Math.max(magnitude, 0.000_001));
    const normalized = Math.max(0, Math.min(1, (bandDb + 96) / 78));
    const previous = previousSpectrum[barIndex] ?? 0;
    spectrum.push(previous * 0.62 + Math.pow(normalized, 0.78) * 0.38);

    if (magnitude > dominantMagnitude) {
      dominantMagnitude = magnitude;
      dominantFrequencyHz = Math.round(frequency);
    }
  }

  return {
    level: Math.min(1, rms * 5),
    dbFs,
    spectrum,
    dominantFrequencyHz: dbFs > -90 ? dominantFrequencyHz : null,
  };
}

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
  const audioSpectrum = useRef<number[]>(
    Array.from({ length: AUDIO_SPECTRUM_BAR_COUNT }, () => 0),
  );
  const snapshotChunks = useRef<Uint8Array[]>([]);
  const snapshotBytes = useRef(0);
  const inferenceBusy = useRef(false);
  const lastAudioAt = useRef(0);
  const lastAudioTelemetryAt = useRef(0);
  const lastMotionTelemetryAt = useRef(0);
  const lastInferenceAt = useRef(0);
  const lowPowerMode = useRef(false);
  const systemLowPowerMode = useRef(false);
  const batteryLevel = useRef<number | null>(null);
  const lowBatterySurvivalMode = useRef(false);
  const latestLocation = useRef<SafeCityLocationFix | null>(null);
  const locationUpdatedAt = useRef(0);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const sensorSuspensions = useRef(new Set<'evidence' | 'siren'>());
  const submitBufferedAudioRef = useRef<(sampleRate: number) => Promise<void>>(async () => undefined);
  const shouldAnalyzeRef = useRef<() => boolean>(() => false);
  const voiceTriggerEnabled = useRef(false);
  const voiceTriggerArmed = useRef(false);
  const voiceSosBusy = useRef(false);
  const voiceInferenceBusy = useRef(false);
  const voicePcmChunks = useRef<Uint8Array[]>([]);
  const voicePcmBytes = useRef(0);
  const behaviorBaselineEnabled = useRef(false);
  const lastBehaviorObservationAt = useRef(0);
  const previousBehaviorLocation = useRef<BehaviorLocationSample | null>(null);
  const behaviorDeviation = useRef<BehaviorDeviationSignal | null>(null);
  const flushVoiceAudioRef = useRef<(sampleRate: number) => Promise<void>>(
    async () => undefined,
  );
  const showVoiceCountdownRef = useRef<
    (keyword: EmergencyVoiceTriggerKeyword, startedAt?: number) => Promise<void>
  >(
    async () => undefined,
  );
  const showSafetyCountdownRef = useRef<
    (
      source: 'motion' | 'audio' | 'threat',
      label: string,
      startedAt?: number,
    ) => Promise<void>
  >(async () => undefined);
  const syncPersistentVoiceTriggerRef = useRef<() => Promise<void>>(
    async () => undefined,
  );

  shouldAnalyzeRef.current = () => {
    if (
      sensorSuspensions.current.size > 0 ||
      lowBatterySurvivalMode.current
    ) {
      return false;
    }
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
    if (
      sensorSuspensions.current.size > 0 ||
      lowBatterySurvivalMode.current ||
      useMonitorStore.getState().sessionState !== 'monitoring'
    ) {
      return;
    }
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
      const analysis = analyzeAudioSignal(samples, buffer.sampleRate, audioSpectrum.current);
      audioSpectrum.current = analysis.spectrum;
      useMonitorStore.getState().setTelemetry({
        audioLevel: analysis.level,
        audioDbFs: analysis.dbFs,
        audioSpectrum: analysis.spectrum,
        dominantFrequencyHz: analysis.dominantFrequencyHz,
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

  const refreshLocation = useCallback(async (force = false) => {
    if (!force && Date.now() - locationUpdatedAt.current < 30_000) return;
    try {
      const refreshedLocation = await getCurrentLocation();
      if (refreshedLocation) {
        latestLocation.current = refreshedLocation;
      }
      if (latestLocation.current) {
        locationUpdatedAt.current = latestLocation.current.timestamp;
        useMonitorStore.getState().setTelemetry({
          location: {
            latitude: latestLocation.current.latitude,
            longitude: latestLocation.current.longitude,
            accuracy: latestLocation.current.accuracy,
          },
          locationUpdatedAt: locationUpdatedAt.current,
        });
        useMonitorStore.getState().setHealth({
          location:
            latestLocation.current.accuracy === null ||
            latestLocation.current.accuracy <= 100
              ? 'ready'
              : 'degraded',
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

  const refreshBehaviorBaselineStatus = useCallback(async () => {
    if (!behaviorBaselineEnabled.current) {
      useMonitorStore.getState().setTelemetry({
        behaviorBaseline: disabledBehaviorBaselineTelemetry(),
      });
      return;
    }
    const status = await getBehaviorBaselineStatus(db);
    useMonitorStore.getState().setTelemetry({
      behaviorBaseline: behaviorTelemetry(
        true,
        status,
        behaviorDeviation.current,
      ),
    });
  }, [db]);

  const stopVoiceTrigger = useCallback(() => {
    voiceTriggerArmed.current = false;
    voicePcmChunks.current = [];
    voicePcmBytes.current = 0;
    void stopVoiceTriggerRecognition().catch(() => undefined);
    useMonitorStore.getState().setTelemetry({
      voiceTriggerStatus: voiceTriggerEnabled.current ? 'listening' : 'disabled',
      voiceTriggerTranscript: null,
    });
  }, []);

  const startVoiceTrigger = useCallback(() => {
    const state = useMonitorStore.getState();
    if (
      !voiceTriggerEnabled.current ||
      state.sessionState !== 'monitoring' ||
      sensorSuspensions.current.size > 0 ||
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
          sensorSuspensions.current.size > 0 ||
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

  const syncPersistentVoiceTrigger = useCallback(async () => {
    if (!isPersistentVoiceTriggerAvailable() || !voiceTriggerEnabled.current) return;
    const state = useMonitorStore.getState();
    if (lowBatterySurvivalMode.current) {
      await setPersistentVoiceTriggerListening(false);
      state.setTelemetry({
        voiceTriggerStatus: 'disabled',
        voiceTriggerTranscript: null,
      });
      return;
    }
    const shouldListenNatively =
      !state.activeIncidentId &&
      sensorSuspensions.current.size === 0 &&
      (appState.current !== 'active' || state.sessionState !== 'monitoring');
    await setPersistentVoiceTriggerListening(shouldListenNatively);
    state.setTelemetry({
      voiceTriggerStatus: shouldListenNatively ? 'listening' : state.telemetry.voiceTriggerStatus,
    });
  }, []);

  syncPersistentVoiceTriggerRef.current = syncPersistentVoiceTrigger;

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

  const shareAnonymousDistress = useCallback(
    async (source: AnonymousDistressSource) => {
      try {
        const settings = await readSettings(db);
        if (!settings.anonymousRiskSharingEnabled) return;
        await queueAnonymousDistressReport(db, latestLocation.current, source);
      } catch {
        // Community reporting is best-effort and must never delay or block SOS.
      }
    },
    [db],
  );

  const openEvidenceCapture = useCallback(
    async (assessment: Assessment) => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId) return;
      await triggerHaptic('sos');
      await refreshLocation(true);
      const incidentId = await createIncident(
        db,
        assessment,
        state.sessionId,
        latestLocation.current,
      );
      state.setActiveIncident(incidentId);
      await shareAnonymousDistress('confirmed');
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
    [
      audioStream.stream,
      db,
      persistAudioSnapshot,
      refreshLocation,
      router,
      shareAnonymousDistress,
      t,
    ],
  );

  const submitWindow = useCallback(
    async (pcmBytes: Uint8Array | null, sampleRate: number) => {
      const state = useMonitorStore.getState();
      if (
        sensorSuspensions.current.size > 0 ||
        lowBatterySurvivalMode.current ||
        state.sessionState !== 'monitoring' ||
        !state.sessionId
      ) {
        return;
      }
      const motion = motionWindow.current.snapshot();
      const automaticMotionTrigger = getAutomaticMotionTrigger(motion);
      if (automaticMotionTrigger) {
        await showSafetyCountdownRef.current(
          'motion',
          automaticMotionTrigger.label,
        );
        return;
      }
      let observationToLearn: BehaviorObservation | null = null;
      const observedAt = Date.now();
      if (
        behaviorBaselineEnabled.current &&
        appState.current === 'active' &&
        observedAt - lastBehaviorObservationAt.current >=
          BEHAVIOR_OBSERVATION_INTERVAL_MS
      ) {
        lastBehaviorObservationAt.current = observedAt;
        const recentLocation = await getRecentBackgroundLocation().catch(
          () => null,
        );
        if (
          recentLocation &&
          (!latestLocation.current ||
            recentLocation.timestamp > latestLocation.current.timestamp)
        ) {
          latestLocation.current = recentLocation;
        }
        const behaviorLocation: BehaviorLocationSample | null =
          latestLocation.current &&
          observedAt - latestLocation.current.timestamp <= 3 * 60_000
            ? latestLocation.current
            : null;
        observationToLearn = createBehaviorObservation({
          observedAt,
          motionScore: calculateMotionScore(motion).score,
          location: behaviorLocation,
          previousLocation: previousBehaviorLocation.current,
        });
        if (
          behaviorLocation &&
          behaviorLocation.accuracy !== null &&
          behaviorLocation.accuracy <= 120
        ) {
          previousBehaviorLocation.current = behaviorLocation;
        }
        try {
          behaviorDeviation.current = await assessBehaviorDeviation(
            db,
            observationToLearn,
          );
          state.setTelemetry({
            behaviorBaseline: behaviorTelemetry(
              true,
              behaviorDeviation.current.status,
              behaviorDeviation.current,
            ),
          });
        } catch {
          behaviorDeviation.current = null;
        }
      }
      let assessment: Assessment;
      try {
        assessment = await assessLocalSignalWindow({
          audioBytes: pcmBytes,
          sessionId: state.sessionId,
          sampleRate,
          motion,
          modelPreference: state.inferenceModelPreference,
          behaviorDeviation: behaviorDeviation.current,
          context: {
            hour: new Date().getHours(),
            appState: appState.current,
          },
        });
        const expectedModel = resolveInferenceModel(state.inferenceModelPreference);
        const usedLiteFallback =
          expectedModel === 'yamnet' &&
          assessment.modelVersion.includes(LITE_MODEL_VERSION);
        state.setHealth({ inference: usedLiteFallback ? 'degraded' : 'ready' });
      } catch {
        assessment = localFallbackAssessment(motion);
        state.setHealth({ inference: 'degraded' });
      }

      if (sensorSuspensions.current.size > 0) return;
      state.setAssessment(assessment);
      if (
        observationToLearn &&
        assessment.riskLevel === 'safe' &&
        !assessment.needsEvidenceCapture
      ) {
        void learnBehaviorObservation(db, observationToLearn)
          .then((status) => {
            useMonitorStore.getState().setTelemetry({
              behaviorBaseline: behaviorTelemetry(
                true,
                status,
                behaviorDeviation.current,
              ),
            });
          })
          .catch(() => undefined);
      }
      if (assessment.riskLevel === 'alert') {
        await triggerHaptic('warning');
      }
      if (assessment.needsEvidenceCapture) await openEvidenceCapture(assessment);
    },
    [db, openEvidenceCapture],
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
    if (lowBatterySurvivalMode.current) {
      state.setHealth({
        microphone: 'degraded',
        motion: 'degraded',
        inference: 'degraded',
      });
      state.setTelemetry({
        voiceTriggerStatus: 'disabled',
        voiceTriggerTranscript: null,
      });
      return;
    }
    if (isPersistentVoiceTriggerAvailable()) {
      // The visible app owns motion analysis while active. Pause the native
      // copy to avoid duplicate sensor work; onTaskRemoved and the AppState
      // handoff restore it before the UI goes away.
      await setPersistentProtectionActive(false);
    }
    if (voiceTriggerEnabled.current && isPersistentVoiceTriggerAvailable()) {
      await setPersistentVoiceTriggerListening(false);
    }
    const health = await getSensorHealth();
    state.setHealth(health);

    if (health.motion === 'ready' && !motionSubscription.current) {
      DeviceMotion.setUpdateInterval(
        lowPowerMode.current ? LOW_POWER_MOTION_INTERVAL_MS : ACTIVE_MOTION_INTERVAL_MS,
      );
      motionSubscription.current = DeviceMotion.addListener((measurement) => {
        motionWindow.current.add(measurement);
        const now = Date.now();
        if (now - lastMotionTelemetryAt.current >= 250) {
          const acceleration = measurement.accelerationIncludingGravity ?? measurement.acceleration;
          if (acceleration) {
            const rotation = measurement.rotationRate;
            const rotationXDegPerSecond = rotation?.alpha ?? 0;
            const rotationYDegPerSecond = rotation?.beta ?? 0;
            const rotationZDegPerSecond = rotation?.gamma ?? 0;
            useMonitorStore.getState().setTelemetry({
              motion: {
                x: acceleration.x / DeviceMotion.Gravity,
                y: acceleration.y / DeviceMotion.Gravity,
                z: acceleration.z / DeviceMotion.Gravity,
                magnitudeG:
                  Math.sqrt(acceleration.x ** 2 + acceleration.y ** 2 + acceleration.z ** 2) /
                  DeviceMotion.Gravity,
                rotationXDegPerSecond,
                rotationYDegPerSecond,
                rotationZDegPerSecond,
                rotationMagnitudeDegPerSecond: Math.sqrt(
                  rotationXDegPerSecond ** 2 +
                    rotationYDegPerSecond ** 2 +
                    rotationZDegPerSecond ** 2,
                ),
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
    audioSpectrum.current = Array.from({ length: AUDIO_SPECTRUM_BAR_COUNT }, () => 0);
    useMonitorStore.getState().setTelemetry({
      audioLevel: 0,
      audioDbFs: -96,
      audioSpectrum: audioSpectrum.current,
      dominantFrequencyHz: null,
    });
  }, [audioStream.stream, clearAudioSnapshotBuffer, stopVoiceTrigger]);

  const applyBatteryPolicy = useCallback(
    async (nextBatteryLevel: number | null, phoneLowPowerMode: boolean) => {
      batteryLevel.current = nextBatteryLevel;
      systemLowPowerMode.current = phoneLowPowerMode;
      const survivalMode =
        nextBatteryLevel !== null &&
        nextBatteryLevel >= 0 &&
        nextBatteryLevel < 0.1;
      lowPowerMode.current = phoneLowPowerMode || survivalMode;
      DeviceMotion.setUpdateInterval(
        lowPowerMode.current
          ? LOW_POWER_MOTION_INTERVAL_MS
          : ACTIVE_MOTION_INTERVAL_MS,
      );
      useMonitorStore.getState().setPower({
        batteryLevel:
          nextBatteryLevel === null ? null : Math.round(nextBatteryLevel * 100),
        survivalMode,
      });

      if (lowBatterySurvivalMode.current === survivalMode) return;
      lowBatterySurvivalMode.current = survivalMode;

      const state = useMonitorStore.getState();
      if (state.sessionState !== 'monitoring') return;

      if (survivalMode) {
        deactivateSensors();
        await setPersistentProtectionActive(false).catch(() => undefined);
        await setPersistentVoiceTriggerListening(false).catch(() => undefined);
        state.setHealth({
          microphone: 'degraded',
          motion: 'degraded',
          inference: 'degraded',
        });
        state.setTelemetry({
          voiceTriggerStatus: 'disabled',
          voiceTriggerTranscript: null,
        });
        await startBackgroundLocation().catch(() =>
          state.setHealth({ location: 'degraded' }),
        );
        await refreshLocation(true);
        return;
      }

      await enablePersistentProtection();
      state.setHealth({ inference: 'checking' });
      if (
        appState.current === 'active' &&
        !state.activeIncidentId &&
        sensorSuspensions.current.size === 0
      ) {
        const [, preparation] = await Promise.all([
          activateSensors(),
          initializeOnDeviceAudio(state.inferenceModelPreference),
        ]);
        state.setHealth({
          inference: preparation.fallbackUsed ? 'degraded' : 'ready',
        });
      } else {
        await setPersistentProtectionActive(
          !state.activeIncidentId && sensorSuspensions.current.size === 0,
        );
        await syncPersistentVoiceTrigger();
      }
    },
    [
      activateSensors,
      deactivateSensors,
      refreshLocation,
      syncPersistentVoiceTrigger,
    ],
  );

  const startMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (state.sessionState !== 'idle') return;
    sensorSuspensions.current.clear();
    let settings = await readSettings(db);
    if (!hasCurrentMonitoringConsent(settings)) {
      throw new Error('Complete the updated onboarding consent before monitoring starts.');
    }
    if (settings.voiceKeywordEnabled && isPersistentVoiceTriggerAvailable()) {
      const persistentState = await getPersistentVoiceTriggerState();
      if (persistentState.configured && !persistentState.enabled) {
        settings = { ...settings, voiceKeywordEnabled: false };
        await writeSettings(db, settings);
      }
    }
    voiceTriggerEnabled.current = settings.voiceKeywordEnabled;
    behaviorBaselineEnabled.current = settings.behaviorBaselineEnabled;
    behaviorDeviation.current = null;
    lastBehaviorObservationAt.current = 0;
    previousBehaviorLocation.current = null;
    await refreshBehaviorBaselineStatus();
    if (!settings.monitoringEnabled) {
      settings = { ...settings, monitoringEnabled: true };
      await writeSettings(db, settings);
    }
    if (!lowBatterySurvivalMode.current) {
      await enablePersistentProtection();
    }
    state.setInferenceModelPreference(settings.inferenceModel);
    const id = await startSession(db);
    state.setSession('monitoring', id);
    state.setHealth({
      inference: lowBatterySurvivalMode.current ? 'degraded' : 'checking',
    });
    clearAudioSnapshotBuffer();
    lastInferenceAt.current = Date.now();
    lastAudioAt.current = Date.now();
    if (lowBatterySurvivalMode.current) {
      state.setHealth({ microphone: 'degraded', motion: 'degraded' });
      state.setTelemetry({
        voiceTriggerStatus: 'disabled',
        voiceTriggerTranscript: null,
      });
    } else {
      const modelReady = initializeOnDeviceAudio(settings.inferenceModel);
      const [, preparation] = await Promise.all([activateSensors(), modelReady]);
      state.setHealth({ inference: preparation.fallbackUsed ? 'degraded' : 'ready' });
    }
    void refreshLocation();
    if (settings.backgroundLocation) {
      void startBackgroundLocation().catch(() => state.setHealth({ location: 'degraded' }));
    }
  }, [
    activateSensors,
    clearAudioSnapshotBuffer,
    db,
    refreshBehaviorBaselineStatus,
    refreshLocation,
  ]);

  const pauseMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (!state.sessionId || state.sessionState !== 'monitoring') return;
    deactivateSensors();
    await disablePersistentProtection();
    await stopBackgroundLocation();
    await updateSession(db, state.sessionId, 'paused');
    state.setSession('paused', state.sessionId);
    await syncPersistentVoiceTrigger();
  }, [db, deactivateSensors, syncPersistentVoiceTrigger]);

  const resumeMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    if (!state.sessionId || state.sessionState !== 'paused') return;
    await updateSession(db, state.sessionId, 'monitoring');
    if (!lowBatterySurvivalMode.current) {
      await enablePersistentProtection();
    }
    state.setSession('monitoring', state.sessionId);
    if (lowBatterySurvivalMode.current) {
      state.setHealth({
        microphone: 'degraded',
        motion: 'degraded',
        inference: 'degraded',
      });
      state.setTelemetry({
        voiceTriggerStatus: 'disabled',
        voiceTriggerTranscript: null,
      });
    } else {
      state.setHealth({ inference: 'checking' });
      const modelReady = initializeOnDeviceAudio(state.inferenceModelPreference);
      await activateSensors();
      const preparation = await modelReady;
      state.setHealth({ inference: preparation.fallbackUsed ? 'degraded' : 'ready' });
    }
    void startBackgroundLocation().catch(() => state.setHealth({ location: 'degraded' }));
  }, [activateSensors, db]);

  const setVoiceTriggerEnabled = useCallback(
    async (enabled: boolean) => {
      voiceTriggerEnabled.current = enabled;
      const state = useMonitorStore.getState();
      if (!enabled) {
        stopVoiceTrigger();
        await disablePersistentVoiceTrigger();
        state.setTelemetry({
          voiceTriggerStatus: 'disabled',
          voiceTriggerTranscript: null,
        });
        return;
      }
      if (lowBatterySurvivalMode.current) {
        stopVoiceTrigger();
        state.setTelemetry({
          voiceTriggerStatus: 'disabled',
          voiceTriggerTranscript: null,
        });
        return;
      }

      if (isPersistentVoiceTriggerAvailable()) {
        const nativeState = await getPersistentVoiceTriggerState();
        if (!nativeState.enabled) {
          const preparation = await enableVoiceTrigger(
            appState.current !== 'active' || state.sessionState !== 'monitoring',
          );
          if (!preparation.ready) {
            voiceTriggerEnabled.current = false;
            state.setTelemetry({ voiceTriggerStatus: 'error' });
            throw new Error(preparation.message);
          }
        }
        await syncPersistentVoiceTrigger();
      } else if (state.sessionState === 'monitoring') {
        startVoiceTrigger();
      } else {
        stopVoiceTrigger();
      }
    },
    [startVoiceTrigger, stopVoiceTrigger, syncPersistentVoiceTrigger],
  );

  const setBehaviorBaselineEnabled = useCallback(
    async (enabled: boolean) => {
      behaviorBaselineEnabled.current = enabled;
      behaviorDeviation.current = null;
      lastBehaviorObservationAt.current = 0;
      previousBehaviorLocation.current = null;
      if (!enabled) {
        await resetBehaviorBaseline(db);
        useMonitorStore.getState().setTelemetry({
          behaviorBaseline: disabledBehaviorBaselineTelemetry(),
        });
        return;
      }
      await refreshBehaviorBaselineStatus();
    },
    [db, refreshBehaviorBaselineStatus],
  );

  const stopMonitoring = useCallback(async () => {
    const state = useMonitorStore.getState();
    sensorSuspensions.current.clear();
    deactivateSensors();
    await stopBackgroundLocation();
    if (state.sessionId) await updateSession(db, state.sessionId, 'stopped');
    resetLocalSession(state.sessionId ?? undefined);
    lastBehaviorObservationAt.current = 0;
    previousBehaviorLocation.current = null;
    behaviorDeviation.current = null;
    clearAudioSnapshotBuffer();
    state.setSession('idle', null);
    state.resetRisk();
    await disablePersistentProtection();
    const settings = await readSettings(db);
    await writeSettings(db, { ...settings, monitoringEnabled: false });
    await syncPersistentVoiceTrigger();
  }, [clearAudioSnapshotBuffer, db, deactivateSensors, syncPersistentVoiceTrigger]);

  const triggerDirectSos = useCallback(
    async (source: 'manual' | 'voice' | 'motion' | 'audio') => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId) return;
      await triggerHaptic('sos');
      await refreshLocation(true);
      const explanation =
        source === 'voice'
          ? t('monitor.voiceSos')
          : source === 'motion'
            ? t('monitor.motionSos')
            : source === 'audio'
              ? t('monitor.audioSos')
              : t('monitor.manualSos');
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
        source === 'motion' || source === 'audio' ? 'automatic' : source,
      );
      state.setActiveIncident(incidentId);
      await shareAnonymousDistress(source);
      await persistAudioSnapshot(incidentId);
      deactivateSensors();
      await syncPersistentVoiceTrigger();
      router.push({ pathname: '/capture', params: { incidentId } });
    },
    [
      db,
      deactivateSensors,
      persistAudioSnapshot,
      refreshLocation,
      router,
      shareAnonymousDistress,
      syncPersistentVoiceTrigger,
      t,
    ],
  );

  const triggerManualSos = useCallback(
    async () => triggerDirectSos('manual'),
    [triggerDirectSos],
  );

  const triggerVoiceSos = useCallback(
    async () => triggerDirectSos('voice'),
    [triggerDirectSos],
  );

  const triggerMotionSos = useCallback(
    async () => triggerDirectSos('motion'),
    [triggerDirectSos],
  );

  const triggerAudioSos = useCallback(
    async () => triggerDirectSos('audio'),
    [triggerDirectSos],
  );

  const showVoiceCountdown = useCallback(
    async (keyword: EmergencyVoiceTriggerKeyword, startedAt?: number) => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId || voiceSosBusy.current) return;
      voiceSosBusy.current = true;
      voiceTriggerArmed.current = false;
      await stopVoiceTriggerRecognition().catch(() => undefined);
      state.setTelemetry({
        voiceTriggerStatus: 'listening',
        voiceTriggerTranscript: keyword.replace(/_/g, ' '),
      });
      router.push({
        pathname: '/sos-countdown',
        params: {
          source: 'voice',
          keyword,
          ...(startedAt ? { startedAt: String(startedAt) } : {}),
        },
      });
    },
    [router],
  );

  showVoiceCountdownRef.current = showVoiceCountdown;

  const showSafetyCountdown = useCallback(
    async (
      source: 'motion' | 'audio' | 'threat',
      label: string,
      startedAt?: number,
    ) => {
      const state = useMonitorStore.getState();
      if (state.activeIncidentId || voiceSosBusy.current) return;
      voiceSosBusy.current = true;
      voiceTriggerArmed.current = false;
      await stopVoiceTriggerRecognition().catch(() => undefined);
      router.push({
        pathname: '/sos-countdown',
        params: {
          source,
          keyword: label,
          ...(startedAt ? { startedAt: String(startedAt) } : {}),
        },
      });
    },
    [router],
  );

  showSafetyCountdownRef.current = showSafetyCountdown;

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

      if (detection.kind === 'threat' && isThreatPhraseKeyword(detection.keyword)) {
        const state = useMonitorStore.getState();
        state.setTelemetry({
          voiceTriggerStatus: 'listening',
          voiceTriggerTranscript: getThreatPhrase(detection.keyword).display,
        });
        if (state.sessionId) {
          const recorded = recordThreatLanguageMatch(
            state.sessionId,
            detection.keyword,
          );
          if (recorded) {
            await triggerHaptic('warning');
            await submitWindow(pcmBytes, sampleRate);
          }
        }
        return;
      }

      voiceTriggerArmed.current = false;
      useMonitorStore.getState().setTelemetry({
        voiceTriggerTranscript: detection.display,
      });
      await showVoiceCountdownRef.current(
        detection.keyword as EmergencyVoiceTriggerKeyword,
      );
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

  const rearmVoiceTrigger = useCallback(async () => {
    voiceSosBusy.current = false;
    useMonitorStore.getState().setTelemetry({ voiceTriggerTranscript: null });
    if (isPersistentVoiceTriggerAvailable()) {
      const persistentState = await getPersistentVoiceTriggerState();
      if (persistentState.enabled || persistentState.protectionEnabled) {
        await rearmPersistentVoiceTrigger();
        await syncPersistentVoiceTrigger();
      }
    }
    if (!voiceTriggerEnabled.current) return;
    const state = useMonitorStore.getState();
    if (
      appState.current === 'active' &&
      state.sessionState === 'monitoring' &&
      !state.activeIncidentId &&
      sensorSuspensions.current.size === 0
    ) {
      startVoiceTrigger();
    }
  }, [startVoiceTrigger, syncPersistentVoiceTrigger]);

  const suspendSensorsFor = useCallback(
    async (reason: 'evidence' | 'siren') => {
      sensorSuspensions.current.add(reason);
      deactivateSensors();
      await syncPersistentVoiceTrigger();
    },
    [deactivateSensors, syncPersistentVoiceTrigger],
  );

  const resumeSensorsAfter = useCallback(
    async (reason: 'evidence' | 'siren') => {
      sensorSuspensions.current.delete(reason);
      const state = useMonitorStore.getState();
      if (sensorSuspensions.current.size === 0 && state.sessionState === 'monitoring') {
        await activateSensors();
      } else {
        await syncPersistentVoiceTrigger();
      }
    },
    [activateSensors, syncPersistentVoiceTrigger],
  );

  const suspendForEvidence = useCallback(
    async () => suspendSensorsFor('evidence'),
    [suspendSensorsFor],
  );

  const resumeAfterEvidence = useCallback(async () => {
    const state = useMonitorStore.getState();
    state.setActiveIncident(null);
    clearAudioSnapshotBuffer();
    await rearmVoiceTrigger();
    await resumeSensorsAfter('evidence');
  }, [clearAudioSnapshotBuffer, rearmVoiceTrigger, resumeSensorsAfter]);

  const suspendForSiren = useCallback(
    async () => suspendSensorsFor('siren'),
    [suspendSensorsFor],
  );

  const resumeAfterSiren = useCallback(
    async () => resumeSensorsAfter('siren'),
    [resumeSensorsAfter],
  );

  useEffect(() => {
    let cancelled = false;
    void readSettings(db)
      .then(async (settings) => {
        if (cancelled) return;
        behaviorBaselineEnabled.current =
          hasCurrentMonitoringConsent(settings) &&
          settings.behaviorBaselineEnabled;
        await refreshBehaviorBaselineStatus();
      })
      .catch(() => {
        if (!cancelled) {
          behaviorBaselineEnabled.current = false;
          useMonitorStore.getState().setTelemetry({
            behaviorBaseline: disabledBehaviorBaselineTelemetry(),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, refreshBehaviorBaselineStatus]);

  useEffect(() => {
    let cancelled = false;
    void readSettings(db)
      .then(async (settings) => {
        if (cancelled) return;
        if (!hasCurrentMonitoringConsent(settings)) {
          voiceTriggerEnabled.current = false;
          useMonitorStore.getState().setTelemetry({
            voiceTriggerStatus: 'disabled',
          });
          return;
        }
        voiceTriggerEnabled.current = settings.voiceKeywordEnabled;
        if (!settings.voiceKeywordEnabled) {
          useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'disabled' });
          return;
        }

        if (process.env.EXPO_OS === 'android') {
          if (!isPersistentVoiceTriggerAvailable()) {
            useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'unavailable' });
            return;
          }
          const persistentState = await getPersistentVoiceTriggerState();
          if (persistentState.configured && !persistentState.enabled) {
            const nextSettings = { ...settings, voiceKeywordEnabled: false };
            await writeSettings(db, nextSettings);
            voiceTriggerEnabled.current = false;
            useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'disabled' });
            return;
          }
          // Refresh the private model directory on every app-version start.
          // This migrates an already-enabled listener to newly bundled phrase
          // definitions without asking the user to toggle protection off/on.
          useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'checking' });
          const preparation = await enableVoiceTrigger(true);
          if (!preparation.ready) {
            const nextSettings = { ...settings, voiceKeywordEnabled: false };
            await writeSettings(db, nextSettings);
            voiceTriggerEnabled.current = false;
            useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'error' });
            return;
          }
          await syncPersistentVoiceTriggerRef.current();
          useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'listening' });
        }
      })
      .catch(() => {
        if (!cancelled) {
          useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    void readSettings(db)
      .then(async (settings) => {
        if (
          cancelled ||
          !settings.onboardingComplete ||
          !settings.monitoringEnabled ||
          !hasCurrentMonitoringConsent(settings)
        ) {
          return;
        }
        const permissions = await getCorePermissionSnapshot();
        if (!allCorePermissionsGranted(permissions)) {
          useMonitorStore.getState().setHealth({
            microphone: permissions.microphone ? 'ready' : 'blocked',
            motion: permissions.motion ? 'ready' : 'blocked',
            location:
              permissions.locationForeground &&
              permissions.locationPrecise &&
              permissions.locationBackground
                ? 'ready'
                : 'blocked',
            camera: permissions.camera ? 'ready' : 'blocked',
          });
          return;
        }
        await enablePersistentProtection();
        if (cancelled || useMonitorStore.getState().sessionState !== 'idle') return;
        await startMonitoring();
      })
      .catch(() => {
        if (!cancelled) {
          useMonitorStore.getState().setHealth({
            microphone: 'blocked',
            motion: 'blocked',
            location: 'blocked',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [db, startMonitoring]);

  useEffect(
    () => () => {
      void releaseVoiceTriggerRecognition().catch(() => undefined);
    },
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appState.current = nextState;
      const state = useMonitorStore.getState();
      if (nextState !== 'active') {
        behaviorDeviation.current = null;
        previousBehaviorLocation.current = null;
        stopVoiceTrigger();
        motionSubscription.current?.remove();
        motionSubscription.current = null;
        try {
          if (audioStream.stream.isStreaming) audioStream.stream.stop();
        } catch {
          // The stream may already be released during an app-state transition.
        }
        if (isPersistentVoiceTriggerAvailable()) {
          void setPersistentProtectionActive(
            state.sessionState === 'monitoring' &&
              !state.activeIncidentId &&
              sensorSuspensions.current.size === 0 &&
              !lowBatterySurvivalMode.current,
          );
          if (
            voiceTriggerEnabled.current &&
            !lowBatterySurvivalMode.current
          ) {
            void syncPersistentVoiceTriggerRef.current();
          } else if (lowBatterySurvivalMode.current) {
            void setPersistentVoiceTriggerListening(false);
          }
        }
        return;
      }
      if (
        state.sessionState === 'monitoring' &&
        !state.activeIncidentId &&
        sensorSuspensions.current.size === 0 &&
        !lowBatterySurvivalMode.current
      ) {
        void activateSensors();
      } else {
        void syncPersistentVoiceTriggerRef.current();
      }
    });
    return () => subscription.remove();
  }, [activateSensors, audioStream.stream, stopVoiceTrigger]);

  useEffect(() => {
    const subscription = addPersistentVoiceTriggerListener(({ keyword, startedAt }) => {
      if (!voiceTriggerEnabled.current) return;
      if (isThreatPhraseKeyword(keyword)) {
        const state = useMonitorStore.getState();
        state.setTelemetry({
          voiceTriggerStatus: 'listening',
          voiceTriggerTranscript: getThreatPhrase(keyword).display,
        });
        if (state.sessionId) {
          recordThreatLanguageMatch(state.sessionId, keyword);
        }
        return;
      }
      void showVoiceCountdownRef.current(
        keyword as EmergencyVoiceTriggerKeyword,
        startedAt,
      );
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    const subscription = addPersistentSafetyTriggerListener(({ source, label, startedAt }) => {
      void showSafetyCountdownRef.current(source, label, startedAt);
    });
    return () => subscription?.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      Battery.getBatteryLevelAsync().catch(() => -1),
      Battery.isLowPowerModeEnabledAsync().catch(() => false),
    ]).then(([level, phoneLowPowerMode]) => {
      if (!active) return;
      void applyBatteryPolicy(level < 0 ? null : level, phoneLowPowerMode);
    });

    const levelSubscription = Battery.addBatteryLevelListener(({ batteryLevel: level }) => {
      if (!active) return;
      void applyBatteryPolicy(
        level < 0 ? null : level,
        systemLowPowerMode.current,
      );
    });
    const lowPowerSubscription = Battery.addLowPowerModeListener(
      ({ lowPowerMode: enabled }) => {
        if (!active) return;
        void applyBatteryPolicy(batteryLevel.current, enabled);
      },
    );
    return () => {
      active = false;
      levelSubscription.remove();
      lowPowerSubscription.remove();
    };
  }, [applyBatteryPolicy]);

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
        sensorSuspensions.current.size === 0 &&
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
      triggerVoiceSos,
      triggerMotionSos,
      triggerAudioSos,
      rearmVoiceTrigger,
      setBehaviorBaselineEnabled,
      setVoiceTriggerEnabled,
      suspendForEvidence,
      resumeAfterEvidence,
      suspendForSiren,
      resumeAfterSiren,
    }),
    [
      pauseMonitoring,
      rearmVoiceTrigger,
      resumeAfterEvidence,
      resumeAfterSiren,
      resumeMonitoring,
      setBehaviorBaselineEnabled,
      setVoiceTriggerEnabled,
      startMonitoring,
      stopMonitoring,
      suspendForEvidence,
      suspendForSiren,
      triggerManualSos,
      triggerMotionSos,
      triggerAudioSos,
      triggerVoiceSos,
    ],
  );

  return <MonitoringContext.Provider value={actions}>{children}</MonitoringContext.Provider>;
}

export function useMonitoring(): MonitoringActions {
  const value = useContext(MonitoringContext);
  if (!value) throw new Error('useMonitoring must be used inside MonitoringProvider');
  return value;
}
