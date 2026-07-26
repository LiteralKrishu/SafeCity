import type { LanguagePreference } from '@/i18n/types';
import type { BehaviorBaselineTelemetry } from '@/inference/behaviorBaseline';

export type RiskLevel = 'safe' | 'watch' | 'alert' | 'sos_pending' | 'sos';
export type SessionState = 'idle' | 'monitoring' | 'paused';
export type HealthState = 'ready' | 'degraded' | 'blocked' | 'offline' | 'checking';
export type InferenceModelPreference = 'auto' | 'lite' | 'yamnet';
export type EmergencyContactRole = 'guardian' | 'police';
export type VoiceTriggerStatus =
  | 'disabled'
  | 'checking'
  | 'listening'
  | 'unavailable'
  | 'error';

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
  role: EmergencyContactRole;
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
  snapshotAudioUri: string | null;
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
  peakRotationDps: number;
  angularTravelDegrees: number;
  freeFallObserved: boolean;
  freeFallDurationMs: number;
  impactAfterFreeFall: boolean;
  impactDelayMs: number | null;
  sampleCount: number;
}

export interface AppSettings {
  onboardingComplete: boolean;
  monitoringEnabled: boolean;
  consentVersion: string | null;
  consentGrantedAt: string | null;
  privacyNoticeVersion: string | null;
  termsVersion: string | null;
  termsAcceptedAt: string | null;
  adultConfirmed: boolean;
  retentionDays: number;
  discreetMode: boolean;
  backgroundLocation: boolean;
  voiceKeywordEnabled: boolean;
  anonymousRiskSharingEnabled: boolean;
  anonymousRiskConsentGrantedAt: string | null;
  automaticSosMessagingEnabled: boolean;
  policeSosEnabled: boolean;
  behaviorBaselineEnabled: boolean;
  inferenceModel: InferenceModelPreference;
  language: LanguagePreference;
  appearance: 'system' | 'dark' | 'light';
}

export type { BehaviorBaselineTelemetry };
