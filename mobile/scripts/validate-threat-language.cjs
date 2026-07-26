const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'src/inference/threatLanguage.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: sourcePath,
});
const threatModule = { exports: {} };
new Function('require', 'module', 'exports', compiled.outputText)(
  require,
  threatModule,
  threatModule.exports,
);

const {
  THREAT_PHRASES,
  scoreThreatLanguageSignal,
} = threatModule.exports;
const phrases = Object.values(THREAT_PHRASES);

const loudnessSourcePath = path.join(
  projectRoot,
  'src/inference/voiceTriggerLoudness.ts',
);
const loudnessSource = fs.readFileSync(loudnessSourcePath, 'utf8');
const compiledLoudness = ts.transpileModule(loudnessSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: loudnessSourcePath,
});
const loudnessModule = { exports: {} };
new Function('require', 'module', 'exports', compiledLoudness.outputText)(
  require,
  loudnessModule,
  loudnessModule.exports,
);
const {
  emergencyKeywordPassesLoudnessGate,
  HELP_BACHAO_LOUDNESS_WINDOW_MS,
  HELP_BACHAO_MIN_RMS,
} = loudnessModule.exports;

assert.equal(phrases.length, 13);
assert.deepEqual(
  [...new Set(phrases.map((phrase) => phrase.language))].sort(),
  ['bn', 'en', 'hi'],
);
assert.ok(THREAT_PHRASES.THREAT_DONT_SHOUT);
assert.ok(THREAT_PHRASES.THREAT_GIVE_PHONE);
assert.ok(THREAT_PHRASES.THREAT_PHONE_DE_DO);
assert.ok(THREAT_PHRASES.THREAT_PHONE_DAO);

assert.ok(HELP_BACHAO_MIN_RMS >= 0.05);
assert.ok(HELP_BACHAO_MIN_RMS <= 0.1);
assert.ok(HELP_BACHAO_LOUDNESS_WINDOW_MS >= 1_000);
assert.ok(HELP_BACHAO_LOUDNESS_WINDOW_MS <= 2_000);
assert.equal(
  emergencyKeywordPassesLoudnessGate('HELP', HELP_BACHAO_MIN_RMS - 0.001),
  false,
);
assert.equal(
  emergencyKeywordPassesLoudnessGate('BACHAO', HELP_BACHAO_MIN_RMS - 0.001),
  false,
);
assert.equal(
  emergencyKeywordPassesLoudnessGate('HELP', HELP_BACHAO_MIN_RMS),
  true,
);
assert.equal(
  emergencyKeywordPassesLoudnessGate('BACHAO', HELP_BACHAO_MIN_RMS + 0.001),
  true,
);
for (const keyword of ['SOS', 'EMERGENCY', 'SAVE_ME']) {
  assert.equal(emergencyKeywordPassesLoudnessGate(keyword, 0), true);
}

const nativeVoiceService = fs.readFileSync(
  path.join(
    projectRoot,
    'modules/safecity-voice-trigger/android/src/main/java/com/safecity/voicetrigger/SafeCityVoiceTriggerService.kt',
  ),
  'utf8',
);
const nativeMinimumRms = Number(
  nativeVoiceService.match(/HELP_BACHAO_MIN_RMS\s*=\s*([0-9.]+)/)?.[1],
);
const nativeWindowMs = Number(
  nativeVoiceService
    .match(/EMERGENCY_LOUDNESS_WINDOW_MS\s*=\s*([0-9_]+)L/)?.[1]
    ?.replaceAll('_', ''),
);
assert.equal(nativeMinimumRms, HELP_BACHAO_MIN_RMS);
assert.equal(nativeWindowMs, HELP_BACHAO_LOUDNESS_WINDOW_MS);
assert.match(
  nativeVoiceService,
  /LOUDNESS_GATED_KEYWORDS\s*=\s*setOf\("HELP",\s*"BACHAO"\)/,
);

const now = 100_000;
const singleThreat = scoreThreatLanguageSignal({
  matches: [{ keyword: 'THREAT_KILL_YOU', detectedAt: now }],
  now,
  audioDistressScore: 0,
  motionScore: 0,
  mediaScore: 0,
});
assert.equal(singleThreat.active, true);
assert.equal(singleThreat.confirmed, false);

const repeatedWithoutPhysicalEvidence = scoreThreatLanguageSignal({
  matches: [
    { keyword: 'THREAT_GIVE_PHONE', detectedAt: now - 8_000 },
    { keyword: 'THREAT_GIVE_PHONE', detectedAt: now },
  ],
  now,
  audioDistressScore: 0.2,
  motionScore: 0.2,
  mediaScore: 0,
});
assert.equal(repeatedWithoutPhysicalEvidence.confirmed, false);

const repeatedWithAudioEvidence = scoreThreatLanguageSignal({
  matches: [
    { keyword: 'THREAT_MAAR_DUNGA', detectedAt: now - 7_000 },
    { keyword: 'THREAT_MAAR_DUNGA', detectedAt: now },
  ],
  now,
  audioDistressScore: 0.65,
  motionScore: 0.1,
  mediaScore: 0.1,
});
assert.equal(repeatedWithAudioEvidence.confirmed, true);

const playedMedia = scoreThreatLanguageSignal({
  matches: [
    { keyword: 'THREAT_DONT_MOVE', detectedAt: now - 6_000 },
    { keyword: 'THREAT_DONT_MOVE', detectedAt: now },
  ],
  now,
  audioDistressScore: 0.3,
  motionScore: 0.2,
  mediaScore: 0.8,
});
assert.equal(playedMedia.confirmed, false);
assert.ok(playedMedia.score < repeatedWithoutPhysicalEvidence.score);

const modelDirectory = path.join(projectRoot, 'assets/models/voice-trigger');
const tokens = new Set(
  fs
    .readFileSync(path.join(modelDirectory, 'tokens.txt'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.trim().split(/\s+/)[0]),
);
const keywordLines = fs
  .readFileSync(path.join(modelDirectory, 'keywords.txt'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);
const keywordIds = new Set();

for (const line of keywordLines) {
  const [definition, keywordId] = line.split('@');
  assert.ok(keywordId, `Missing stable keyword ID: ${line}`);
  keywordIds.add(keywordId);
  const phoneSequence = definition.split(':')[0].trim().split(/\s+/);
  for (const token of phoneSequence) {
    assert.ok(tokens.has(token), `Unknown token ${token} in @${keywordId}`);
  }
  if (keywordId.startsWith('THREAT_')) {
    const threshold = Number(definition.match(/#([0-9.]+)/)?.[1]);
    assert.ok(threshold >= 0.3, `Threat threshold is too permissive: @${keywordId}`);
  }
}

for (const keywordId of Object.keys(THREAT_PHRASES)) {
  assert.ok(keywordIds.has(keywordId), `Missing acoustic phrase: @${keywordId}`);
}

console.log(
  JSON.stringify(
    {
      catalog: {
        languages: 3,
        phrases: phrases.length,
      },
      policy: {
        helpAndBachaoRequireRaisedVoice: true,
        softHelpStartsSos: false,
        softBachaoStartsSos: false,
        explicitEmergencyKeywordsRemainImmediate: true,
        singleThreatStartsSos: false,
        repeatedThreatWithoutPhysicalEvidenceStartsSos: false,
        repeatedThreatWithPhysicalEvidenceStartsSos: true,
        mediaSuppressionChecked: true,
      },
      acousticDefinitions: keywordLines.filter((line) => line.includes('@THREAT_')).length,
    },
    null,
    2,
  ),
);
