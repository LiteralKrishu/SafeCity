import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { SafeCityLocationFix } from '@/services/backgroundLocation';

const RISK_GRID_VERSION = 'r1';
const RISK_GRID_ZOOM = 16;
const WORLD_CELLS = 2 ** RISK_GRID_ZOOM;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const REPORT_SECRET_KEY = 'safecity.anonymous-risk-secret.v1';
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_REPORT_ACCURACY_METERS = 150;
const MAX_QUEUE_ATTEMPTS = 8;
const RISK_API_BASE_URL = process.env.EXPO_PUBLIC_RISK_API_BASE_URL?.trim().replace(/\/+$/u, '');

export type AnonymousDistressSource =
  | 'manual'
  | 'voice'
  | 'motion'
  | 'audio'
  | 'confirmed';

export interface RiskZone {
  cellId: string;
  latitude: number;
  longitude: number;
  intensity: number;
  radiusMeters: number;
  riskBand: 'emerging' | 'elevated' | 'high';
}

export interface RiskZoneSnapshot {
  generatedAt: string;
  windowHours: number;
  zones: RiskZone[];
  privacy: {
    locationPrecision: string;
    timePrecision: string;
    minimumReports: number;
    exactCountsExposed: false;
    rawLocationsStored: false;
  };
}

interface QueuedRiskReport {
  dedupe_token: string;
  cell_id: string;
  time_bucket: string;
  event_kind: string;
  accuracy_band: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function isRiskServiceConfigured(): boolean {
  return Boolean(RISK_API_BASE_URL && /^https?:\/\//u.test(RISK_API_BASE_URL));
}

export function locationToRiskCellId(latitude: number, longitude: number): string {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error('Location is outside geographic bounds.');
  }
  const clippedLatitude = clamp(
    latitude,
    -MAX_MERCATOR_LATITUDE,
    MAX_MERCATOR_LATITUDE,
  );
  const latitudeRadians = (clippedLatitude * Math.PI) / 180;
  const x = clamp(
    Math.floor(((longitude + 180) / 360) * WORLD_CELLS),
    0,
    WORLD_CELLS - 1,
  );
  const y = clamp(
    Math.floor(
      ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) * WORLD_CELLS,
    ),
    0,
    WORLD_CELLS - 1,
  );
  return `${RISK_GRID_VERSION}:${x}:${y}`;
}

export function riskCellCenter(cellId: string): {
  latitude: number;
  longitude: number;
} {
  const [version, rawX, rawY] = cellId.split(':');
  const x = Number(rawX);
  const y = Number(rawY);
  if (
    version !== RISK_GRID_VERSION ||
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 0 ||
    x >= WORLD_CELLS ||
    y < 0 ||
    y >= WORLD_CELLS
  ) {
    throw new Error('Invalid anonymous risk cell.');
  }
  const longitude = ((x + 0.5) / WORLD_CELLS) * 360 - 180;
  const mercatorY = Math.PI * (1 - (2 * (y + 0.5)) / WORLD_CELLS);
  const latitude = (Math.atan(Math.sinh(mercatorY)) * 180) / Math.PI;
  return { latitude, longitude };
}

function sourceToEventKind(source: AnonymousDistressSource): string {
  switch (source) {
    case 'manual':
      return 'manual_sos';
    case 'voice':
      return 'voice_sos';
    case 'motion':
      return 'motion_sos';
    case 'audio':
      return 'audio_sos';
    default:
      return 'confirmed_distress';
  }
}

function toHourBucket(timestamp = Date.now()): string {
  const bucket = new Date(timestamp);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

async function getOrCreateAnonymousSecret(): Promise<string> {
  const existing = await SecureStore.getItemAsync(REPORT_SECRET_KEY, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (existing && /^[a-f0-9]{64}$/u.test(existing)) return existing;

  const bytes = await Crypto.getRandomBytesAsync(32);
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(REPORT_SECRET_KEY, secret, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return secret;
}

async function dailyCellToken(cellId: string, timestamp: number): Promise<string> {
  const secret = await getOrCreateAnonymousSecret();
  const day = new Date(timestamp).toISOString().slice(0, 10);
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${secret}|${day}|${cellId}`,
  );
}

async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function queueAnonymousDistressReport(
  db: SQLiteDatabase,
  location: SafeCityLocationFix | null,
  source: AnonymousDistressSource,
): Promise<boolean> {
  if (!location || !isRiskServiceConfigured()) return false;
  const accuracy = location.accuracy;
  if (
    accuracy === null ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > MAX_REPORT_ACCURACY_METERS
  ) {
    return false;
  }

  const cellId = locationToRiskCellId(location.latitude, location.longitude);
  const dedupeToken = await dailyCellToken(cellId, location.timestamp);
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO anonymous_risk_queue (
       dedupe_token, cell_id, time_bucket, event_kind, accuracy_band,
       queued_at, attempts, last_attempt_at
     ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
    dedupeToken,
    cellId,
    toHourBucket(location.timestamp),
    sourceToEventKind(source),
    accuracy <= 50 ? 'good' : 'fair',
    new Date().toISOString(),
  );

  if (result.changes > 0) {
    void flushAnonymousRiskQueue(db).catch(() => undefined);
  }
  return result.changes > 0;
}

export async function flushAnonymousRiskQueue(
  db: SQLiteDatabase,
): Promise<{ uploaded: number; remaining: number }> {
  if (!RISK_API_BASE_URL || !isRiskServiceConfigured()) {
    const pending = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM anonymous_risk_queue',
    );
    return { uploaded: 0, remaining: pending?.count ?? 0 };
  }

  const reports = await db.getAllAsync<QueuedRiskReport>(
    `SELECT dedupe_token, cell_id, time_bucket, event_kind, accuracy_band
       FROM anonymous_risk_queue
      WHERE attempts < ?
      ORDER BY queued_at ASC
      LIMIT 8`,
    MAX_QUEUE_ATTEMPTS,
  );
  let uploaded = 0;
  for (const report of reports) {
    try {
      const response = await fetchWithTimeout(`${RISK_API_BASE_URL}/v1/risk/reports`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schemaVersion: 1,
          cellId: report.cell_id,
          timeBucket: report.time_bucket,
          eventKind: report.event_kind,
          accuracyBand: report.accuracy_band,
          dedupeToken: report.dedupe_token,
        }),
      });
      const permanentClientError =
        response.status >= 400 && response.status < 500 && response.status !== 429;
      if (response.ok || permanentClientError) {
        await db.runAsync(
          'DELETE FROM anonymous_risk_queue WHERE dedupe_token = ?',
          report.dedupe_token,
        );
        uploaded += response.ok ? 1 : 0;
        continue;
      }
      await markQueueAttempt(db, report.dedupe_token);
      break;
    } catch {
      await markQueueAttempt(db, report.dedupe_token);
      break;
    }
  }

  const pending = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM anonymous_risk_queue',
  );
  return { uploaded, remaining: pending?.count ?? 0 };
}

async function markQueueAttempt(db: SQLiteDatabase, dedupeToken: string): Promise<void> {
  await db.runAsync(
    `UPDATE anonymous_risk_queue
        SET attempts = attempts + 1, last_attempt_at = ?
      WHERE dedupe_token = ?`,
    new Date().toISOString(),
    dedupeToken,
  );
}

export async function fetchRiskZones(
  location: Pick<SafeCityLocationFix, 'latitude' | 'longitude'>,
  hours = 48,
): Promise<RiskZoneSnapshot | null> {
  if (!RISK_API_BASE_URL || !isRiskServiceConfigured()) return null;

  // The query is centred on a coarse cell, not the user's pinpoint position.
  const coarseCenter = riskCellCenter(
    locationToRiskCellId(location.latitude, location.longitude),
  );
  const latitudeSpan = 0.06;
  const longitudeSpan =
    latitudeSpan /
    Math.max(0.25, Math.cos((coarseCenter.latitude * Math.PI) / 180));
  const query = new URLSearchParams({
    south: (coarseCenter.latitude - latitudeSpan).toFixed(5),
    west: (coarseCenter.longitude - longitudeSpan).toFixed(5),
    north: (coarseCenter.latitude + latitudeSpan).toFixed(5),
    east: (coarseCenter.longitude + longitudeSpan).toFixed(5),
    hours: String(hours),
  });
  const response = await fetchWithTimeout(`${RISK_API_BASE_URL}/v1/risk/zones?${query}`);
  if (!response.ok) throw new Error('Community risk zones are temporarily unavailable.');
  const snapshot = (await response.json()) as RiskZoneSnapshot;
  if (!Array.isArray(snapshot.zones) || snapshot.privacy?.rawLocationsStored !== false) {
    throw new Error('The risk service returned an invalid privacy contract.');
  }
  return {
    ...snapshot,
    zones: snapshot.zones.filter(
      (zone) =>
        Number.isFinite(zone.latitude) &&
        Number.isFinite(zone.longitude) &&
        Number.isFinite(zone.intensity) &&
        zone.intensity >= 0 &&
        zone.intensity <= 1,
    ),
  };
}

export async function resetAnonymousRiskIdentity(): Promise<void> {
  await SecureStore.deleteItemAsync(REPORT_SECRET_KEY);
}
