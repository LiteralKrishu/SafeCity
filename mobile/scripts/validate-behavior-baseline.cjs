const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'src/inference/behaviorBaseline.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
});
const baselineModule = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputText)(
  require,
  baselineModule,
  baselineModule.exports,
);

const {
  BEHAVIOR_OBSERVATION_INTERVAL_MS,
  createBehaviorObservation,
  scoreBehaviorDeviationFromProfiles,
} = baselineModule.exports;

assert.equal(BEHAVIOR_OBSERVATION_INTERVAL_MS, 60_000);

const observedAt = new Date(2026, 6, 21, 9, 0, 0).getTime();
const normalObservation = createBehaviorObservation({
  observedAt,
  motionScore: 0.12,
  location: {
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 12,
    timestamp: observedAt,
  },
  previousLocation: null,
});
assert.ok(normalObservation.cellX >= 0);
assert.ok(normalObservation.cellY >= 0);
assert.equal(normalObservation.timeBucket, 2);

const inaccurateObservation = createBehaviorObservation({
  observedAt,
  motionScore: 0.1,
  location: {
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 250,
    timestamp: observedAt,
  },
  previousLocation: null,
});
assert.equal(inaccurateObservation.cellX, -1);
assert.equal(inaccurateObservation.cellY, -1);

const stationaryObservation = createBehaviorObservation({
  observedAt: observedAt + 60_000,
  motionScore: 0.1,
  location: {
    latitude: 28.61391,
    longitude: 77.20901,
    accuracy: 15,
    timestamp: observedAt + 60_000,
  },
  previousLocation: {
    latitude: 28.6139,
    longitude: 77.209,
    accuracy: 15,
    timestamp: observedAt,
  },
});
assert.equal(stationaryObservation.speedMetersPerSecond, 0);

const readyStatus = {
  phase: 'ready',
  ready: true,
  sampleCount: 60,
  dayCount: 3,
  profileCount: 1,
  locationProfileCount: 1,
  progress: 1,
  lastLearnedAt: new Date(observedAt).toISOString(),
};
const routineProfile = {
  profile_key: 'routine',
  day_type: normalObservation.dayType,
  time_bucket: normalObservation.timeBucket,
  cell_x: normalObservation.cellX,
  cell_y: normalObservation.cellY,
  sample_count: 60,
  mean_motion: 0.11,
  variance_motion: 0.0025,
  speed_count: 30,
  mean_speed: 0.8,
  variance_speed: 0.25,
  last_seen_at: new Date(observedAt).toISOString(),
};

const routine = scoreBehaviorDeviationFromProfiles(
  normalObservation,
  readyStatus,
  [routineProfile],
);
assert.equal(routine.ready, true);
assert.equal(routine.active, false);
assert.ok(routine.score <= 0.1);

const unfamiliarArea = scoreBehaviorDeviationFromProfiles(
  {
    ...normalObservation,
    cellX: normalObservation.cellX + 50,
    cellY: normalObservation.cellY + 50,
  },
  readyStatus,
  [routineProfile],
);
assert.equal(unfamiliarArea.active, true);
assert.ok(unfamiliarArea.score >= 0.7);
assert.ok(unfamiliarArea.factors.some((factor) => factor.includes('coarse area')));

const unusualMovement = scoreBehaviorDeviationFromProfiles(
  { ...normalObservation, motionScore: 0.65 },
  readyStatus,
  [routineProfile],
);
assert.equal(unusualMovement.active, true);
assert.ok(
  unusualMovement.factors.some((factor) =>
    factor.includes('Movement intensity'),
  ),
);

const warming = scoreBehaviorDeviationFromProfiles(
  normalObservation,
  { ...readyStatus, phase: 'warming', ready: false, dayCount: 1, progress: 0.33 },
  [routineProfile],
);
assert.equal(warming.active, false);
assert.equal(warming.score, 0);

const fusionSource = fs.readFileSync(
  path.join(projectRoot, 'src/inference/localFusion.ts'),
  'utf8',
);
assert.match(fusionSource, /supporting evidence only/i);
assert.doesNotMatch(
  fusionSource,
  /multiSignal\s*=[^;]*behaviorDeviation/s,
  'Behavior deviation must never count as independent SOS confirmation.',
);

const migrationSource = fs.readFileSync(
  path.join(projectRoot, 'src/db/migrations.ts'),
  'utf8',
);
assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS behavior_baseline/);
assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS behavior_baseline_days/);

console.log(
  JSON.stringify(
    {
      cadenceSeconds: BEHAVIOR_OBSERVATION_INTERVAL_MS / 1_000,
      warmup: { minimumObservations: 24, minimumDays: 3 },
      routineScore: Number(routine.score.toFixed(2)),
      unfamiliarAreaScore: Number(unfamiliarArea.score.toFixed(2)),
      unusualMovementScore: Number(unusualMovement.score.toFixed(2)),
      safetyGate: 'Deviation is supporting evidence and cannot confirm SOS.',
      privacy: 'Coarse aggregate profiles only; no breadcrumb route table.',
    },
    null,
    2,
  ),
);
