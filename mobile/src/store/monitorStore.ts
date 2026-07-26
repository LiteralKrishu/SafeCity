import { create } from 'zustand';

import type {
  Assessment,
  BehaviorBaselineTelemetry,
  InferenceModelPreference,
  RiskLevel,
  SensorHealth,
  SessionState,
  VoiceTriggerStatus,
} from '@/types/domain';

interface MonitorStore {
  sessionState: SessionState;
  sessionId: string | null;
  stealthModeActive: boolean;
  power: {
    batteryLevel: number | null;
    survivalMode: boolean;
  };
  riskLevel: RiskLevel;
  score: number;
  latestAssessment: Assessment | null;
  inferenceModelPreference: InferenceModelPreference;
  health: SensorHealth;
  activeIncidentId: string | null;
  telemetry: {
    audioLevel: number;
    audioDbFs: number;
    audioSpectrum: number[];
    dominantFrequencyHz: number | null;
    audioUpdatedAt: number | null;
    motion: {
      x: number;
      y: number;
      z: number;
      magnitudeG: number;
      rotationXDegPerSecond: number;
      rotationYDegPerSecond: number;
      rotationZDegPerSecond: number;
      rotationMagnitudeDegPerSecond: number;
    } | null;
    motionUpdatedAt: number | null;
    location: { latitude: number; longitude: number; accuracy: number | null } | null;
    locationUpdatedAt: number | null;
    voiceTriggerStatus: VoiceTriggerStatus;
    voiceTriggerTranscript: string | null;
    behaviorBaseline: BehaviorBaselineTelemetry;
  };
  setSession: (state: SessionState, id?: string | null) => void;
  setStealthModeActive: (active: boolean) => void;
  setPower: (power: Partial<MonitorStore['power']>) => void;
  setAssessment: (assessment: Assessment) => void;
  setInferenceModelPreference: (preference: InferenceModelPreference) => void;
  setHealth: (health: Partial<SensorHealth>) => void;
  setActiveIncident: (id: string | null) => void;
  setTelemetry: (telemetry: Partial<MonitorStore['telemetry']>) => void;
  resetRisk: () => void;
}

const initialHealth: SensorHealth = {
  microphone: 'checking',
  motion: 'checking',
  location: 'checking',
  camera: 'checking',
  inference: 'checking',
};

export const useMonitorStore = create<MonitorStore>((set) => ({
  sessionState: 'idle',
  sessionId: null,
  stealthModeActive: false,
  power: {
    batteryLevel: null,
    survivalMode: false,
  },
  riskLevel: 'safe',
  score: 0,
  latestAssessment: null,
  inferenceModelPreference: 'auto',
  health: initialHealth,
  activeIncidentId: null,
  telemetry: {
    audioLevel: 0,
    audioDbFs: -96,
    audioSpectrum: Array.from({ length: 36 }, () => 0),
    dominantFrequencyHz: null,
    audioUpdatedAt: null,
    motion: null,
    motionUpdatedAt: null,
    location: null,
    locationUpdatedAt: null,
    voiceTriggerStatus: 'disabled',
    voiceTriggerTranscript: null,
    behaviorBaseline: {
      enabled: false,
      phase: 'off',
      ready: false,
      sampleCount: 0,
      dayCount: 0,
      profileCount: 0,
      locationProfileCount: 0,
      progress: 0,
      lastLearnedAt: null,
      deviationScore: 0,
      factors: [],
    },
  },
  setSession: (sessionState, sessionId) => set({ sessionState, sessionId: sessionId ?? null }),
  setStealthModeActive: (stealthModeActive) => set({ stealthModeActive }),
  setPower: (power) => set((state) => ({ power: { ...state.power, ...power } })),
  setAssessment: (assessment) =>
    set({
      latestAssessment: assessment,
      riskLevel: assessment.riskLevel,
      score: assessment.fusedScore,
    }),
  setInferenceModelPreference: (inferenceModelPreference) => set({ inferenceModelPreference }),
  setHealth: (health) => set((state) => ({ health: { ...state.health, ...health } })),
  setActiveIncident: (activeIncidentId) => set({ activeIncidentId }),
  setTelemetry: (telemetry) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...telemetry } })),
  resetRisk: () => set({ riskLevel: 'safe', score: 0, latestAssessment: null }),
}));
