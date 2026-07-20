import { create } from 'zustand';

import type { Assessment, RiskLevel, SensorHealth, SessionState } from '@/types/domain';

interface MonitorStore {
  sessionState: SessionState;
  sessionId: string | null;
  riskLevel: RiskLevel;
  score: number;
  latestAssessment: Assessment | null;
  health: SensorHealth;
  activeIncidentId: string | null;
  setSession: (state: SessionState, id?: string | null) => void;
  setAssessment: (assessment: Assessment) => void;
  setHealth: (health: Partial<SensorHealth>) => void;
  setActiveIncident: (id: string | null) => void;
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
  setSession: (sessionState, sessionId) => set({ sessionState, sessionId: sessionId ?? null }),
  setAssessment: (assessment) =>
    set({
      latestAssessment: assessment,
      riskLevel: assessment.riskLevel,
      score: assessment.fusedScore,
    }),
  setHealth: (health) => set((state) => ({ health: { ...state.health, ...health } })),
  setActiveIncident: (activeIncidentId) => set({ activeIncidentId }),
  resetRisk: () => set({ riskLevel: 'safe', score: 0, latestAssessment: null }),
}));

