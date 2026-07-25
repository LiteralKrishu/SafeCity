export interface OutdoorNoiseMetrics {
  applied: boolean;
  estimatedSnrDb: number;
  lowFrequencyRatio: number;
  noiseFloorRms: number;
  suppressionGain: number;
}

export interface ConditionedAudio {
  pcmBytes: Uint8Array;
  metrics: OutdoorNoiseMetrics;
}

const HIGH_PASS_CUTOFF_HZ = 90;
const FRAME_DURATION_MS = 20;
const MINIMUM_GAIN = 0.52;

function clip(value: number, minimum = 0, maximum = 1): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function percentile(sortedValues: number[], percentileValue: number): number {
  if (!sortedValues.length) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * percentileValue)),
  );
  return sortedValues[index] ?? 0;
}

export function conditionOutdoorAudio(
  pcmBytes: Uint8Array,
  sampleRate: number,
): ConditionedAudio {
  const sampleCount = Math.floor(pcmBytes.byteLength / 2);
  const emptyMetrics: OutdoorNoiseMetrics = {
    applied: false,
    estimatedSnrDb: 0,
    lowFrequencyRatio: 0,
    noiseFloorRms: 0,
    suppressionGain: 1,
  };
  if (!sampleCount || !Number.isFinite(sampleRate) || sampleRate < 1_000) {
    return { pcmBytes: pcmBytes.slice(), metrics: emptyMetrics };
  }

  const source = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount * 2);
  const filtered = new Float32Array(sampleCount);
  const timeStep = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * HIGH_PASS_CUTOFF_HZ);
  const alpha = rc / (rc + timeStep);
  let previousInput = 0;
  let previousOutput = 0;
  let rawEnergy = 0;
  let removedLowFrequencyEnergy = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const input = source.getInt16(index * 2, true) / 32_768;
    const output = alpha * (previousOutput + input - previousInput);
    previousInput = input;
    previousOutput = output;
    filtered[index] = output;
    rawEnergy += input * input;
    const removed = input - output;
    removedLowFrequencyEnergy += removed * removed;
  }

  const frameSamples = Math.max(1, Math.round((sampleRate * FRAME_DURATION_MS) / 1_000));
  const frameRms: number[] = [];
  for (let start = 0; start < sampleCount; start += frameSamples) {
    const end = Math.min(sampleCount, start + frameSamples);
    let sumSquares = 0;
    for (let index = start; index < end; index += 1) {
      const sample = filtered[index] ?? 0;
      sumSquares += sample * sample;
    }
    frameRms.push(Math.sqrt(sumSquares / Math.max(1, end - start)));
  }

  const sortedRms = [...frameRms].sort((left, right) => left - right);
  const noiseFloorRms = percentile(sortedRms, 0.2);
  const signalRms = percentile(sortedRms, 0.9);
  const estimatedSnrDb = clip(
    20 * Math.log10((signalRms + 0.000_1) / (noiseFloorRms + 0.000_1)),
    0,
    40,
  );
  const lowFrequencyRatio = clip(
    removedLowFrequencyEnergy / Math.max(rawEnergy, 0.000_001),
  );
  const shouldGate =
    lowFrequencyRatio >= 0.08 ||
    (noiseFloorRms >= 0.008 && estimatedSnrDb >= 2);
  const outputBytes = new Uint8Array(sampleCount * 2);
  const output = new DataView(outputBytes.buffer);
  let smoothedGain = 1;
  let gainTotal = 0;

  for (let frameIndex = 0; frameIndex < frameRms.length; frameIndex += 1) {
    const rms = frameRms[frameIndex] ?? 0;
    const start = frameIndex * frameSamples;
    const end = Math.min(sampleCount, start + frameSamples);
    const excessRatio =
      (rms - noiseFloorRms * 1.2) / Math.max(noiseFloorRms * 2.2, 0.012);
    const targetGain = shouldGate
      ? MINIMUM_GAIN + (1 - MINIMUM_GAIN) * clip(excessRatio)
      : 1;
    // Open quickly for a shout or emergency word; close slowly so speech is not chopped.
    const blend = targetGain >= smoothedGain ? 0.78 : 0.18;
    smoothedGain += (targetGain - smoothedGain) * blend;
    gainTotal += smoothedGain;
    for (let index = start; index < end; index += 1) {
      const conditioned = clip((filtered[index] ?? 0) * smoothedGain, -1, 1);
      output.setInt16(
        index * 2,
        Math.round(conditioned * (conditioned < 0 ? 32_768 : 32_767)),
        true,
      );
    }
  }

  return {
    pcmBytes: outputBytes,
    metrics: {
      applied: shouldGate || lowFrequencyRatio >= 0.04,
      estimatedSnrDb,
      lowFrequencyRatio,
      noiseFloorRms,
      suppressionGain: gainTotal / Math.max(1, frameRms.length),
    },
  };
}
