import { create } from 'zustand';

import type {
  Assessment,
  RiskLevel,
  SensorHealth,
  SessionState,
  VoiceTriggerStatus,
} from '@/types/domain';

interface MonitorStore {
  sessionState: SessionState;
  sessionId: string | null;
  riskLevel: RiskLevel;
  score: number;
  latestAssessment: Assessment | null;
  health: SensorHealth;
  activeIncidentId: string | null;
  telemetry: {
    audioLevel: number;
    audioUpdatedAt: number | null;
    motion: { x: number; y: number; z: number; magnitudeG: number } | null;
    motionUpdatedAt: number | null;
    location: { latitude: number; longitude: number; accuracy: number | null } | null;
    locationUpdatedAt: number | null;
    voiceTriggerStatus: VoiceTriggerStatus;
    voiceTriggerTranscript: string | null;
  };
  setSession: (state: SessionState, id?: string | null) => void;
  setAssessment: (assessment: Assessment) => void;
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
  riskLevel: 'safe',
  score: 0,
  latestAssessment: null,
  health: initialHealth,
  activeIncidentId: null,
  telemetry: {
    audioLevel: 0,
    audioUpdatedAt: null,
    motion: null,
    motionUpdatedAt: null,
    location: null,
    locationUpdatedAt: null,
    voiceTriggerStatus: 'disabled',
    voiceTriggerTranscript: null,
  },
  setSession: (sessionState, sessionId) => set({ sessionState, sessionId: sessionId ?? null }),
  setAssessment: (assessment) =>
    set({
      latestAssessment: assessment,
      riskLevel: assessment.riskLevel,
      score: assessment.fusedScore,
    }),
  setHealth: (health) => set((state) => ({ health: { ...state.health, ...health } })),
  setActiveIncident: (activeIncidentId) => set({ activeIncidentId }),
  setTelemetry: (telemetry) =>
    set((state) => ({ telemetry: { ...state.telemetry, ...telemetry } })),
  resetRisk: () => set({ riskLevel: 'safe', score: 0, latestAssessment: null }),
}));
