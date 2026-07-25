import type { SQLiteDatabase } from 'expo-sqlite';

export type BehaviorBaselinePhase = 'off' | 'warming' | 'ready' | 'limited';

export interface BehaviorBaselineStatus {
  phase: BehaviorBaselinePhase;
  ready: boolean;
  sampleCount: number;
  dayCount: number;
  profileCount: number;
  locationProfileCount: number;
  progress: number;
  lastLearnedAt: string | null;
}

export interface BehaviorBaselineTelemetry extends BehaviorBaselineStatus {
  enabled: boolean;
  deviationScore: number;
  factors: string[];
}

export interface BehaviorLocationSample {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface BehaviorObservation {
  observedAt: number;
  dayKey: string;
  dayType: 0 | 1;
  timeBucket: number;
  cellX: number;
  cellY: number;
  motionScore: number;
  speedMetersPerSecond: number | null;
}

export interface BehaviorDeviationSignal {
  active: boolean;
  ready: boolean;
  score: number;
  factors: string[];
  status: BehaviorBaselineStatus;
}

interface BehaviorProfileRow {
  profile_key: string;
  day_type: number;
  time_bucket: number;
  cell_x: number;
  cell_y: number;
  sample_count: number;
  mean_motion: number;
  variance_motion: number;
  speed_count: number;
  mean_speed: number;
  variance_speed: number;
  last_seen_at: string;
}

interface WeightedStats {
  count: number;
  mean: number;
  variance: number;
}

const GRID_ZOOM = 16;
const GRID_CELLS = 2 ** GRID_ZOOM;
const MAX_MERCATOR_LATITUDE = 85.05112878;
const MAX_LOCATION_ACCURACY_METERS = 120;
const MINIMUM_BASELINE_SAMPLES = 24;
const MINIMUM_BASELINE_DAYS = 3;
const MAXIMUM_PROFILES = 256;
const MAXIMUM_DAYS = 35;
const PROFILE_ADAPTATION_ALPHA = 0.04;
const MINIMUM_SPEED_INTERVAL_MS = 15_000;
const MAXIMUM_SPEED_INTERVAL_MS = 5 * 60_000;
const MAXIMUM_PLAUSIBLE_SPEED_MPS = 55;

export const BEHAVIOR_BASELINE_VERSION = 'behavior-baseline-v1';
export const BEHAVIOR_OBSERVATION_INTERVAL_MS = 60_000;

function clip(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function finite(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function toBehaviorCell(latitude: number, longitude: number): {
  x: number;
  y: number;
} {
  const clippedLatitude = Math.min(
    Math.max(latitude, -MAX_MERCATOR_LATITUDE),
    MAX_MERCATOR_LATITUDE,
  );
  const latitudeRadians = (clippedLatitude * Math.PI) / 180;
  const x = Math.min(
    Math.max(Math.floor(((longitude + 180) / 360) * GRID_CELLS), 0),
    GRID_CELLS - 1,
  );
  const y = Math.min(
    Math.max(
      Math.floor(
        ((1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2) *
          GRID_CELLS,
      ),
      0,
    ),
    GRID_CELLS - 1,
  );
  return { x, y };
}

function haversineMeters(
  first: Pick<BehaviorLocationSample, 'latitude' | 'longitude'>,
  second: Pick<BehaviorLocationSample, 'latitude' | 'longitude'>,
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (second.latitude - first.latitude) * radians;
  const longitudeDelta = (second.longitude - first.longitude) * radians;
  const firstLatitude = first.latitude * radians;
  const secondLatitude = second.latitude * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

function estimateSpeed(
  current: BehaviorLocationSample | null,
  previous: BehaviorLocationSample | null,
): number | null {
  if (!current || !previous) return null;
  const elapsedMs = current.timestamp - previous.timestamp;
  if (
    elapsedMs < MINIMUM_SPEED_INTERVAL_MS ||
    elapsedMs > MAXIMUM_SPEED_INTERVAL_MS
  ) {
    return null;
  }
  const distance = haversineMeters(previous, current);
  const uncertainty =
    Math.max(0, previous.accuracy ?? 0) + Math.max(0, current.accuracy ?? 0);
  const effectiveDistance = Math.max(0, distance - uncertainty);
  const speed = effectiveDistance / (elapsedMs / 1_000);
  return Number.isFinite(speed) && speed <= MAXIMUM_PLAUSIBLE_SPEED_MPS
    ? speed
    : null;
}

export function createBehaviorObservation(input: {
  observedAt: number;
  motionScore: number;
  location: BehaviorLocationSample | null;
  previousLocation: BehaviorLocationSample | null;
}): BehaviorObservation {
  const date = new Date(input.observedAt);
  const accurateLocation =
    input.location &&
    input.location.accuracy !== null &&
    Number.isFinite(input.location.accuracy) &&
    input.location.accuracy >= 0 &&
    input.location.accuracy <= MAX_LOCATION_ACCURACY_METERS
      ? input.location
      : null;
  const cell = accurateLocation
    ? toBehaviorCell(accurateLocation.latitude, accurateLocation.longitude)
    : { x: -1, y: -1 };
  return {
    observedAt: input.observedAt,
    dayKey: localDayKey(input.observedAt),
    dayType: date.getDay() === 0 || date.getDay() === 6 ? 1 : 0,
    timeBucket: Math.floor(date.getHours() / 4),
    cellX: cell.x,
    cellY: cell.y,
    motionScore: clip(finite(input.motionScore)),
    speedMetersPerSecond: estimateSpeed(accurateLocation, input.previousLocation),
  };
}

function emptyStatus(): BehaviorBaselineStatus {
  return {
    phase: 'warming',
    ready: false,
    sampleCount: 0,
    dayCount: 0,
    profileCount: 0,
    locationProfileCount: 0,
    progress: 0,
    lastLearnedAt: null,
  };
}

export function disabledBehaviorBaselineTelemetry(): BehaviorBaselineTelemetry {
  return {
    ...emptyStatus(),
    enabled: false,
    phase: 'off',
    deviationScore: 0,
    factors: [],
  };
}

function statusFromCounts(input: {
  sampleCount: number;
  dayCount: number;
  profileCount: number;
  locationProfileCount: number;
  lastLearnedAt: string | null;
}): BehaviorBaselineStatus {
  const sampleProgress = input.sampleCount / MINIMUM_BASELINE_SAMPLES;
  const dayProgress = input.dayCount / MINIMUM_BASELINE_DAYS;
  const ready =
    input.sampleCount >= MINIMUM_BASELINE_SAMPLES &&
    input.dayCount >= MINIMUM_BASELINE_DAYS;
  return {
    ...input,
    ready,
    phase: ready
      ? input.locationProfileCount > 0
        ? 'ready'
        : 'limited'
      : 'warming',
    progress: clip(Math.min(sampleProgress, dayProgress)),
  };
}

export async function getBehaviorBaselineStatus(
  db: SQLiteDatabase,
): Promise<BehaviorBaselineStatus> {
  const [profileSummary, daySummary] = await Promise.all([
    db.getFirstAsync<{
      sample_count: number;
      profile_count: number;
      location_profile_count: number;
      last_learned_at: string | null;
    }>(
      `SELECT
         COALESCE(SUM(sample_count), 0) AS sample_count,
         COUNT(*) AS profile_count,
         COALESCE(SUM(CASE WHEN cell_x >= 0 AND cell_y >= 0 THEN 1 ELSE 0 END), 0)
           AS location_profile_count,
         MAX(last_seen_at) AS last_learned_at
       FROM behavior_baseline`,
    ),
    db.getFirstAsync<{ day_count: number }>(
      'SELECT COUNT(*) AS day_count FROM behavior_baseline_days',
    ),
  ]);
  return statusFromCounts({
    sampleCount: profileSummary?.sample_count ?? 0,
    dayCount: daySummary?.day_count ?? 0,
    profileCount: profileSummary?.profile_count ?? 0,
    locationProfileCount: profileSummary?.location_profile_count ?? 0,
    lastLearnedAt: profileSummary?.last_learned_at ?? null,
  });
}

function combineStats(
  profiles: BehaviorProfileRow[],
  value: 'motion' | 'speed',
): WeightedStats {
  const entries = profiles
    .map((profile) => ({
      count: value === 'motion' ? profile.sample_count : profile.speed_count,
      mean: value === 'motion' ? profile.mean_motion : profile.mean_speed,
      variance:
        value === 'motion'
          ? profile.variance_motion
          : profile.variance_speed,
    }))
    .filter((entry) => entry.count > 0);
  const count = entries.reduce((sum, entry) => sum + entry.count, 0);
  if (!count) return { count: 0, mean: 0, variance: 0 };
  const mean =
    entries.reduce((sum, entry) => sum + entry.mean * entry.count, 0) / count;
  const variance =
    entries.reduce(
      (sum, entry) =>
        sum +
        entry.count *
          (Math.max(0, entry.variance) + (entry.mean - mean) ** 2),
      0,
    ) / count;
  return { count, mean, variance };
}

function highSideDeviation(
  value: number,
  baseline: WeightedStats,
  standardDeviationFloor: number,
): { score: number; z: number } {
  if (baseline.count < 8) return { score: 0, z: 0 };
  const deviation = Math.max(
    Math.sqrt(Math.max(0, baseline.variance)),
    standardDeviationFloor,
  );
  const z = Math.max(0, (value - baseline.mean) / deviation);
  return {
    z,
    score: clip((z - 1.5) / 3),
  };
}

export function scoreBehaviorDeviationFromProfiles(
  observation: BehaviorObservation,
  status: BehaviorBaselineStatus,
  profiles: BehaviorProfileRow[],
): Omit<BehaviorDeviationSignal, 'status'> {
  if (!status.ready) {
    return { active: false, ready: false, score: 0, factors: [] };
  }

  const locationAvailable = observation.cellX >= 0 && observation.cellY >= 0;
  const near = (profile: BehaviorProfileRow) =>
    locationAvailable &&
    profile.cell_x >= 0 &&
    profile.cell_y >= 0 &&
    Math.abs(profile.cell_x - observation.cellX) <= 1 &&
    Math.abs(profile.cell_y - observation.cellY) <= 1;
  const sameTimeProfiles = profiles.filter(
    (profile) =>
      profile.day_type === observation.dayType &&
      profile.time_bucket === observation.timeBucket,
  );
  const familiarAtTime = sameTimeProfiles
    .filter(near)
    .reduce((sum, profile) => sum + profile.sample_count, 0);
  const familiarAnyTime = profiles
    .filter(near)
    .reduce((sum, profile) => sum + profile.sample_count, 0);

  let locationScore = 0;
  if (locationAvailable && status.locationProfileCount > 0) {
    locationScore =
      familiarAnyTime === 0
        ? 0.72
        : familiarAtTime === 0
          ? 0.5
          : familiarAtTime < 3
            ? 0.34
            : 0.08;
  }

  const localProfiles = sameTimeProfiles.filter(near);
  const referenceProfiles =
    localProfiles.length > 0
      ? localProfiles
      : sameTimeProfiles.length > 0
        ? sameTimeProfiles
        : profiles;
  const motionDeviation = highSideDeviation(
    observation.motionScore,
    combineStats(referenceProfiles, 'motion'),
    0.08,
  );
  const speedDeviation =
    observation.speedMetersPerSecond === null
      ? { score: 0, z: 0 }
      : highSideDeviation(
          observation.speedMetersPerSecond,
          combineStats(referenceProfiles, 'speed'),
          0.75,
        );

  const score = clip(
    Math.max(
      locationScore,
      motionDeviation.score * 0.82,
      speedDeviation.score * 0.72,
      locationScore * 0.5 +
        motionDeviation.score * 0.32 +
        speedDeviation.score * 0.18,
    ),
  );
  const factors: string[] = [];
  if (locationScore >= 0.65) {
    factors.push('Current coarse area is outside the learned routine');
  } else if (locationScore >= 0.45) {
    factors.push('Current area is unusual for this time block');
  }
  if (motionDeviation.z >= 2.25) {
    factors.push(
      `Movement intensity is ${motionDeviation.z.toFixed(1)}× the learned deviation`,
    );
  }
  if (speedDeviation.z >= 2.5) {
    factors.push('Travel speed is above the learned routine');
  }

  return {
    active: score >= 0.25,
    ready: true,
    score,
    factors,
  };
}

export async function assessBehaviorDeviation(
  db: SQLiteDatabase,
  observation: BehaviorObservation,
): Promise<BehaviorDeviationSignal> {
  const [status, profiles] = await Promise.all([
    getBehaviorBaselineStatus(db),
    db.getAllAsync<BehaviorProfileRow>(
      `SELECT profile_key, day_type, time_bucket, cell_x, cell_y,
              sample_count, mean_motion, variance_motion,
              speed_count, mean_speed, variance_speed, last_seen_at
         FROM behavior_baseline`,
    ),
  ]);
  return {
    ...scoreBehaviorDeviationFromProfiles(observation, status, profiles),
    status,
  };
}

function updateRunningStats(
  count: number,
  mean: number,
  variance: number,
  value: number,
): { count: number; mean: number; variance: number } {
  const nextCount = count + 1;
  const alpha = count < 24 ? 1 / nextCount : PROFILE_ADAPTATION_ALPHA;
  const delta = value - mean;
  return {
    count: nextCount,
    mean: count === 0 ? value : mean + alpha * delta,
    variance:
      count === 0
        ? 0
        : Math.max(0, (1 - alpha) * (variance + alpha * delta * delta)),
  };
}

export async function learnBehaviorObservation(
  db: SQLiteDatabase,
  observation: BehaviorObservation,
): Promise<BehaviorBaselineStatus> {
  const profileKey = [
    observation.dayType,
    observation.timeBucket,
    observation.cellX,
    observation.cellY,
  ].join(':');
  const existing = await db.getFirstAsync<BehaviorProfileRow>(
    'SELECT * FROM behavior_baseline WHERE profile_key = ?',
    profileKey,
  );
  const motion = updateRunningStats(
    existing?.sample_count ?? 0,
    existing?.mean_motion ?? 0,
    existing?.variance_motion ?? 0,
    observation.motionScore,
  );
  const speed =
    observation.speedMetersPerSecond === null
      ? {
          count: existing?.speed_count ?? 0,
          mean: existing?.mean_speed ?? 0,
          variance: existing?.variance_speed ?? 0,
        }
      : updateRunningStats(
          existing?.speed_count ?? 0,
          existing?.mean_speed ?? 0,
          existing?.variance_speed ?? 0,
          observation.speedMetersPerSecond,
        );
  const observedAt = new Date(observation.observedAt).toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO behavior_baseline (
         profile_key, day_type, time_bucket, cell_x, cell_y,
         sample_count, mean_motion, variance_motion,
         speed_count, mean_speed, variance_speed, last_seen_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(profile_key) DO UPDATE SET
         sample_count = excluded.sample_count,
         mean_motion = excluded.mean_motion,
         variance_motion = excluded.variance_motion,
         speed_count = excluded.speed_count,
         mean_speed = excluded.mean_speed,
         variance_speed = excluded.variance_speed,
         last_seen_at = excluded.last_seen_at`,
      profileKey,
      observation.dayType,
      observation.timeBucket,
      observation.cellX,
      observation.cellY,
      motion.count,
      motion.mean,
      motion.variance,
      speed.count,
      speed.mean,
      speed.variance,
      observedAt,
    );
    await db.runAsync(
      `INSERT INTO behavior_baseline_days (day_key, sample_count, last_seen_at)
       VALUES (?, 1, ?)
       ON CONFLICT(day_key) DO UPDATE SET
         sample_count = MIN(1440, behavior_baseline_days.sample_count + 1),
         last_seen_at = excluded.last_seen_at`,
      observation.dayKey,
      observedAt,
    );
  });

  const profileCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM behavior_baseline',
  );
  const overflow = Math.max(0, (profileCount?.count ?? 0) - MAXIMUM_PROFILES);
  if (overflow > 0) {
    await db.runAsync(
      `DELETE FROM behavior_baseline
       WHERE profile_key IN (
         SELECT profile_key FROM behavior_baseline
         ORDER BY last_seen_at ASC
         LIMIT ?
       )`,
      overflow,
    );
  }
  const dayRows = await db.getAllAsync<{ day_key: string }>(
    'SELECT day_key FROM behavior_baseline_days ORDER BY day_key DESC',
  );
  if (dayRows.length > MAXIMUM_DAYS) {
    const oldestRetained = dayRows[MAXIMUM_DAYS - 1]?.day_key;
    if (oldestRetained) {
      await db.runAsync(
        'DELETE FROM behavior_baseline_days WHERE day_key < ?',
        oldestRetained,
      );
    }
  }
  return getBehaviorBaselineStatus(db);
}

export async function resetBehaviorBaseline(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM behavior_baseline');
    await db.runAsync('DELETE FROM behavior_baseline_days');
  });
}
