export type RiskLevel = 'safe' | 'watch' | 'alert' | 'sos_pending' | 'sos';
export type SessionState = 'idle' | 'monitoring' | 'paused';
export type HealthState = 'ready' | 'degraded' | 'blocked' | 'offline' | 'checking';

export interface SensorHealth {
  microphone: HealthState;
  motion: HealthState;
  location: HealthState;
  camera: HealthState;
  inference: HealthState;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  verified: boolean;
  createdAt: string;
}

export interface RetrievedPattern {
  id: string;
  name: string;
  similarity: number;
  rationale: string;
}

export interface Assessment {
  assessmentId: string;
  riskLevel: RiskLevel;
  confidence: number;
  fusedScore: number;
  needsEvidenceCapture: boolean;
  explanation: string;
  factors: string[];
  matchedPatterns: RetrievedPattern[];
  modelVersion: string;
  latencyMs: number;
}

export interface Incident {
  id: string;
  sessionId: string | null;
  createdAt: string;
  state: RiskLevel | 'resolved';
  riskScore: number;
  summary: string;
  factors: string[];
  matchedPatterns: RetrievedPattern[];
  latitude: number | null;
  longitude: number | null;
  rearPhotoUri: string | null;
  frontPhotoUri: string | null;
  audioUri: string | null;
  evidenceStatus: 'pending' | 'capturing' | 'secured' | 'partial' | 'unavailable';
  modelVersion: string;
  feedback: 'correct' | 'false_positive' | 'missed' | null;
  resolvedAt: string | null;
}

export interface MotionFeatures {
  peakAccelerationG: number;
  jerkRms: number;
  rotationRms: number;
  freeFallObserved: boolean;
  impactAfterFreeFall: boolean;
  sampleCount: number;
}

export interface AppSettings {
  onboardingComplete: boolean;
  consentVersion: string | null;
  serviceUrl: string;
  retentionDays: number;
  discreetMode: boolean;
  backgroundLocation: boolean;
}

