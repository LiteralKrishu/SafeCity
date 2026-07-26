const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const countdownSourcePath = path.join(
  projectRoot,
  'src/inference/sosCountdown.ts',
);
const countdownSource = fs.readFileSync(countdownSourcePath, 'utf8');
const compiled = ts.transpileModule(countdownSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: countdownSourcePath,
});
const countdownModule = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputText)(
  require,
  countdownModule,
  countdownModule.exports,
);

const {
  resolveSosCountdownDeadline,
  SOS_COUNTDOWN_MS,
  sosCountdownSecondsRemaining,
} = countdownModule.exports;

const detectedAt = 100_000;
const deadline = resolveSosCountdownDeadline(String(detectedAt), 999_999);
assert.equal(deadline, detectedAt + 10_000);
assert.equal(sosCountdownSecondsRemaining(deadline, detectedAt), 10);
assert.equal(sosCountdownSecondsRemaining(deadline, detectedAt + 3_200), 7);
assert.equal(sosCountdownSecondsRemaining(deadline, deadline - 1), 1);
assert.equal(sosCountdownSecondsRemaining(deadline, deadline), 0);
assert.equal(sosCountdownSecondsRemaining(deadline, deadline + 30_000), 0);
assert.equal(resolveSosCountdownDeadline(undefined, detectedAt), deadline);

const nativeServicePath = path.join(
  projectRoot,
  'modules/safecity-voice-trigger/android/src/main/java/com/safecity/voicetrigger/SafeCityVoiceTriggerService.kt',
);
const nativeService = fs.readFileSync(nativeServicePath, 'utf8');
const nativeCountdownMs = Number(
  nativeService
    .match(/SOS_COUNTDOWN_MS\s*=\s*([0-9_]+)L/)?.[1]
    ?.replaceAll('_', ''),
);
assert.equal(nativeCountdownMs, SOS_COUNTDOWN_MS);
assert.match(nativeService, /PREF_PENDING_DETECTION_STARTED_AT/);
assert.match(nativeService, /&startedAt=\$startedAtEpochMs/);
assert.match(nativeService, /attemptCountdownLaunch\(fullScreenIntent\)/);
assert.match(nativeService, /scheduleCountdownExpiry\(/);

const configPlugin = fs.readFileSync(
  path.join(projectRoot, 'plugins/with-safecity-theme-colors.js'),
  'utf8',
);
assert.match(configPlugin, /android:showWhenLocked/);
assert.match(configPlugin, /android:turnScreenOn/);

console.log(
  JSON.stringify(
    {
      countdownSeconds: SOS_COUNTDOWN_MS / 1_000,
      lateOpenUsesOriginalDeadline: true,
      nativeDetectionStatePersisted: true,
      immediateLaunchRequested: true,
      lockScreenPresentationConfigured: true,
    },
    null,
    2,
  ),
);
