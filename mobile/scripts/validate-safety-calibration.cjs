const assert = require('node:assert/strict');
const path = require('node:path');

const compiledDirectory = process.argv[2];
if (!compiledDirectory) {
  throw new Error('Pass the directory containing the compiled calibration modules.');
}

const {
  extractCalibratedMotionFeatures,
  getAutomaticMotionTrigger,
  scoreCalibratedMotion,
} = require(path.join(compiledDirectory, 'safetyCalibration.js'));
const { conditionOutdoorAudio } = require(path.join(compiledDirectory, 'audioConditioning.js'));

function motionSeries(durationMs, generator) {
  const points = [];
  for (let at = 0; at <= durationMs; at += 20) points.push({ at, ...generator(at) });
  return points;
}

function encodeAudio(sampleRate, durationSeconds, generator) {
  const samples = Math.round(sampleRate * durationSeconds);
  const bytes = new Uint8Array(samples * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples; index += 1) {
    const sample = Math.max(-1, Math.min(1, generator(index / sampleRate)));
    view.setInt16(index * 2, Math.round(sample * 32_767), true);
  }
  return bytes;
}

function pcmRms(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sumSquares = 0;
  const count = Math.floor(bytes.byteLength / 2);
  for (let index = 0; index < count; index += 1) {
    const sample = view.getInt16(index * 2, true) / 32_768;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / Math.max(1, count));
}

const resting = extractCalibratedMotionFeatures(
  motionSeries(5_000, (at) => ({
    magnitudeG: 1 + Math.sin(at / 430) * 0.015,
    rotationDps: 2 + Math.sin(at / 270),
  })),
);
assert.equal(resting.impactAfterFreeFall, false);
assert.ok(scoreCalibratedMotion(resting).score < 0.05);

const walking = extractCalibratedMotionFeatures(
  motionSeries(5_000, (at) => ({
    magnitudeG: 1 + Math.sin((2 * Math.PI * at) / 520) * 0.24,
    rotationDps: 42 + Math.sin((2 * Math.PI * at) / 700) * 28,
  })),
);
assert.equal(walking.impactAfterFreeFall, false);
assert.ok(scoreCalibratedMotion(walking).score < 0.3);

const shortDropLikeBump = extractCalibratedMotionFeatures(
  motionSeries(1_000, (at) => ({
    magnitudeG: at === 500 ? 3.2 : at === 480 ? 0.3 : 1,
    rotationDps: at >= 460 && at <= 520 ? 90 : 5,
  })),
);
assert.equal(shortDropLikeBump.impactAfterFreeFall, false);
assert.ok(scoreCalibratedMotion(shortDropLikeBump).score < 0.55);
assert.equal(getAutomaticMotionTrigger(shortDropLikeBump), null);

const fall = extractCalibratedMotionFeatures(
  motionSeries(1_600, (at) => ({
    magnitudeG:
      at >= 500 && at <= 700 ? 0.24 : at === 720 ? 3.1 : at > 720 ? 1.02 : 1,
    rotationDps: at >= 480 && at <= 760 ? 330 : 8,
  })),
);
assert.equal(fall.freeFallObserved, true);
assert.equal(fall.impactAfterFreeFall, true);
assert.ok(fall.freeFallDurationMs >= 180);
assert.ok(scoreCalibratedMotion(fall).score >= 0.9);
assert.equal(getAutomaticMotionTrigger(fall)?.kind, 'fall');

const violentThrow = extractCalibratedMotionFeatures(
  motionSeries(1_000, (at) => ({
    magnitudeG:
      at === 460 || at === 620 ? 3.5 : at === 440 || at === 600 ? 0.9 : 1,
    rotationDps: at >= 420 && at <= 700 ? 390 : 8,
  })),
);
assert.equal(violentThrow.impactAfterFreeFall, false);
assert.equal(getAutomaticMotionTrigger(violentThrow)?.kind, 'violent-motion');

const sampleRate = 16_000;
const windOnly = encodeAudio(sampleRate, 1, (time) => 0.16 * Math.sin(2 * Math.PI * 45 * time));
const conditionedWind = conditionOutdoorAudio(windOnly, sampleRate);
assert.equal(conditionedWind.metrics.applied, true);
assert.ok(pcmRms(conditionedWind.pcmBytes) < pcmRms(windOnly) * 0.45);

const continuousSpeechTone = encodeAudio(
  sampleRate,
  1,
  (time) => 0.08 * Math.sin(2 * Math.PI * 440 * time),
);
const conditionedSpeechTone = conditionOutdoorAudio(continuousSpeechTone, sampleRate);
assert.ok(conditionedSpeechTone.metrics.suppressionGain >= 0.95);
assert.ok(pcmRms(conditionedSpeechTone.pcmBytes) >= pcmRms(continuousSpeechTone) * 0.9);

const outdoorShout = encodeAudio(sampleRate, 1, (time) => {
  const wind = 0.1 * Math.sin(2 * Math.PI * 45 * time);
  const shout =
    time >= 0.25 && time <= 0.8
      ? 0.24 * Math.sin(2 * Math.PI * 780 * time) +
        0.09 * Math.sin(2 * Math.PI * 1_560 * time)
      : 0;
  return wind + shout;
});
const conditionedShout = conditionOutdoorAudio(outdoorShout, sampleRate);
assert.equal(conditionedShout.metrics.applied, true);
assert.ok(conditionedShout.metrics.suppressionGain >= 0.52);
assert.ok(conditionedShout.metrics.estimatedSnrDb >= 5);
assert.ok(pcmRms(conditionedShout.pcmBytes) >= 0.07);

console.log(
  JSON.stringify(
    {
      fall: {
        durationMs: fall.freeFallDurationMs,
        impact: fall.impactAfterFreeFall,
        angularTravelDegrees: Math.round(fall.angularTravelDegrees),
        score: scoreCalibratedMotion(fall).score,
      },
      motionScores: {
        resting: scoreCalibratedMotion(resting).score,
        walking: scoreCalibratedMotion(walking).score,
        shortDropLikeBump: scoreCalibratedMotion(shortDropLikeBump).score,
        violentThrow: scoreCalibratedMotion(violentThrow).score,
      },
      outdoorAudio: {
        shoutEstimatedSnrDb: Math.round(conditionedShout.metrics.estimatedSnrDb),
        shoutSuppressionGain: Number(conditionedShout.metrics.suppressionGain.toFixed(2)),
        windRmsReductionPercent: Math.round(
          (1 - pcmRms(conditionedWind.pcmBytes) / pcmRms(windOnly)) * 100,
        ),
      },
    },
    null,
    2,
  ),
);
