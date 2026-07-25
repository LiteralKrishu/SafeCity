import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  AppSettings,
  Assessment,
  EmergencyContact,
  Incident,
  RiskLevel,
} from '@/types/domain';
import { clearStoredLanguagePreference } from '@/i18n/language-storage';
import { isInferenceModelPreference } from '@/inference/modelProfiles';

const SETTINGS_KEY = 'app-settings';

export const defaultSettings: AppSettings = {
  onboardingComplete: false,
  monitoringEnabled: false,
  consentVersion: null,
  consentGrantedAt: null,
  privacyNoticeVersion: null,
  termsVersion: null,
  termsAcceptedAt: null,
  adultConfirmed: false,
  retentionDays: 30,
  discreetMode: true,
  backgroundLocation: true,
  voiceKeywordEnabled: false,
  anonymousRiskSharingEnabled: false,
  anonymousRiskConsentGrantedAt: null,
  behaviorBaselineEnabled: false,
  inferenceModel: 'auto',
  language: 'system',
  appearance: 'system',
};

export async function readSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    SETTINGS_KEY,
  );
  if (!row) return defaultSettings;

  try {
    const stored = JSON.parse(row.value) as Partial<AppSettings> & { serviceUrl?: string };
    const { serviceUrl: _retiredServiceUrl, ...currentSettings } = stored;
    return {
      ...defaultSettings,
      ...currentSettings,
      // Existing installations monitored automatically after onboarding.
      // Preserve that user-visible behavior when migrating to the explicit
      // background-protection switch.
      monitoringEnabled:
        currentSettings.monitoringEnabled ??
        currentSettings.onboardingComplete ??
        defaultSettings.monitoringEnabled,
      inferenceModel: isInferenceModelPreference(currentSettings.inferenceModel)
        ? currentSettings.inferenceModel
        : defaultSettings.inferenceModel,
    };
  } catch {
    return defaultSettings;
  }
}

export async function writeSettings(db: SQLiteDatabase, settings: AppSettings): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    SETTINGS_KEY,
    JSON.stringify(settings),
    new Date().toISOString(),
  );
}

export async function writeSettingValue(
  db: SQLiteDatabase,
  key: string,
  value: unknown,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    key,
    JSON.stringify(value),
    new Date().toISOString(),
  );
}

export async function addContact(
  db: SQLiteDatabase,
  name: string,
  phone: string,
): Promise<EmergencyContact> {
  const contact: EmergencyContact = {
    id: Crypto.randomUUID(),
    name: name.trim(),
    phone: phone.trim(),
    verified: true,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    'INSERT INTO contacts (id, name, phone, verified, created_at) VALUES (?, ?, ?, ?, ?)',
    contact.id,
    contact.name,
    contact.phone,
    1,
    contact.createdAt,
  );
  return contact;
}

export async function listContacts(db: SQLiteDatabase): Promise<EmergencyContact[]> {
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    phone: string;
    verified: number;
    created_at: string;
  }>('SELECT id, name, phone, verified, created_at FROM contacts ORDER BY created_at ASC');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    verified: row.verified === 1,
    createdAt: row.created_at,
  }));
}

export async function removeContact(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM contacts WHERE id = ?', id);
}

export async function eraseAllLocalData(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM incidents');
    await db.runAsync('DELETE FROM sessions');
    await db.runAsync('DELETE FROM contacts');
    await db.runAsync('DELETE FROM anonymous_risk_queue');
    await db.runAsync('DELETE FROM behavior_baseline');
    await db.runAsync('DELETE FROM behavior_baseline_days');
    await db.runAsync('DELETE FROM settings');
  });
  await clearStoredLanguagePreference();
}

export async function startSession(db: SQLiteDatabase): Promise<string> {
  const id = Crypto.randomUUID();
  await db.runAsync(
    'INSERT INTO sessions (id, started_at, status) VALUES (?, ?, ?)',
    id,
    new Date().toISOString(),
    'monitoring',
  );
  return id;
}

export async function updateSession(
  db: SQLiteDatabase,
  id: string,
  status: 'monitoring' | 'paused' | 'stopped',
): Promise<void> {
  const endedAt = status === 'stopped' ? new Date().toISOString() : null;
  await db.runAsync('UPDATE sessions SET status = ?, ended_at = ? WHERE id = ?', status, endedAt, id);
}

export async function createIncident(
  db: SQLiteDatabase,
  assessment: Assessment,
  sessionId: string | null,
  location: { latitude: number; longitude: number } | null,
  source: 'automatic' | 'manual' | 'voice' = 'automatic',
): Promise<string> {
  const id = Crypto.randomUUID();
  const summary =
    source === 'manual'
      ? 'Manual SOS activated'
      : source === 'voice'
        ? 'Voice keyword SOS activated'
        : assessment.explanation || 'Possible distress detected';
  const directSos = source !== 'automatic';
  await db.runAsync(
    `INSERT INTO incidents (
       id, session_id, created_at, state, risk_score, summary, factors_json, patterns_json,
       latitude, longitude, snapshot_audio_uri, rear_photo_uri, front_photo_uri, audio_uri,
       evidence_status, model_version
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    sessionId,
    new Date().toISOString(),
    directSos ? 'sos' : assessment.riskLevel,
    directSos ? 1 : assessment.fusedScore,
    summary,
    JSON.stringify(assessment.factors),
    JSON.stringify(directSos ? [] : assessment.matchedPatterns),
    location?.latitude ?? null,
    location?.longitude ?? null,
    null,
    null,
    null,
    null,
    'pending',
    assessment.modelVersion,
  );
  return id;
}

export async function updateIncidentSnapshotUri(
  db: SQLiteDatabase,
  incidentId: string,
  snapshotAudioUri: string | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE incidents SET snapshot_audio_uri = ? WHERE id = ?',
    snapshotAudioUri,
    incidentId,
  );
}

export async function updateIncidentEvidence(
  db: SQLiteDatabase,
  incidentId: string,
  evidence: {
    rearPhotoUri: string | null;
    frontPhotoUri: string | null;
    audioUri: string | null;
    status: Incident['evidenceStatus'];
  },
): Promise<void> {
  await db.runAsync(
    `UPDATE incidents
       SET rear_photo_uri = ?, front_photo_uri = ?, audio_uri = ?, evidence_status = ?, state = 'sos'
     WHERE id = ?`,
    evidence.rearPhotoUri,
    evidence.frontPhotoUri,
    evidence.audioUri,
    evidence.status,
    incidentId,
  );
}

export async function updateIncidentLocation(
  db: SQLiteDatabase,
  incidentId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  await db.runAsync(
    'UPDATE incidents SET latitude = ?, longitude = ? WHERE id = ?',
    latitude,
    longitude,
    incidentId,
  );
}

interface IncidentRow {
  id: string;
  session_id: string | null;
  created_at: string;
  state: RiskLevel | 'resolved';
  risk_score: number;
  summary: string;
  factors_json: string;
  patterns_json: string;
  latitude: number | null;
  longitude: number | null;
  snapshot_audio_uri: string | null;
  rear_photo_uri: string | null;
  front_photo_uri: string | null;
  audio_uri: string | null;
  evidence_status: Incident['evidenceStatus'];
  model_version: string;
  feedback: Incident['feedback'];
  resolved_at: string | null;
}

function mapIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    state: row.state,
    riskScore: row.risk_score,
    summary: row.summary,
    factors: JSON.parse(row.factors_json) as string[],
    matchedPatterns: JSON.parse(row.patterns_json) as Incident['matchedPatterns'],
    latitude: row.latitude,
    longitude: row.longitude,
    snapshotAudioUri: row.snapshot_audio_uri,
    rearPhotoUri: row.rear_photo_uri,
    frontPhotoUri: row.front_photo_uri,
    audioUri: row.audio_uri,
    evidenceStatus: row.evidence_status,
    modelVersion: row.model_version,
    feedback: row.feedback,
    resolvedAt: row.resolved_at,
  };
}

export async function listIncidents(db: SQLiteDatabase, limit = 100): Promise<Incident[]> {
  const rows = await db.getAllAsync<IncidentRow>(
    'SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?',
    limit,
  );
  return rows.map(mapIncident);
}

export async function listIncidentsBefore(
  db: SQLiteDatabase,
  beforeIso: string,
): Promise<Incident[]> {
  const rows = await db.getAllAsync<IncidentRow>(
    'SELECT * FROM incidents WHERE created_at < ? ORDER BY created_at ASC',
    beforeIso,
  );
  return rows.map(mapIncident);
}

export async function getIncident(db: SQLiteDatabase, id: string): Promise<Incident | null> {
  const row = await db.getFirstAsync<IncidentRow>('SELECT * FROM incidents WHERE id = ?', id);
  return row ? mapIncident(row) : null;
}

export async function resolveIncident(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync(
    `UPDATE incidents SET state = 'resolved', resolved_at = ? WHERE id = ?`,
    new Date().toISOString(),
    id,
  );
}

export async function setIncidentFeedback(
  db: SQLiteDatabase,
  id: string,
  feedback: NonNullable<Incident['feedback']>,
): Promise<void> {
  await db.runAsync('UPDATE incidents SET feedback = ? WHERE id = ?', feedback, id);
}

export async function deleteIncidentRecord(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM incidents WHERE id = ?', id);
}
