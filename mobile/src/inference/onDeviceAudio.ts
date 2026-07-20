import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

export const YAMNET_SAMPLE_RATE = 16_000;
export const YAMNET_INPUT_SAMPLES = 15_600;
export const YAMNET_PCM_BYTES = YAMNET_INPUT_SAMPLES * 2;
export const ON_DEVICE_MODEL_VERSION = 'yamnet-tflite-local-fusion-3.0.0';

interface WeightedClass {
  index: number;
  label: string;
  weight: number;
}

const DISTRESS_CLASSES: WeightedClass[] = [
  { index: 6, label: 'Shout', weight: 0.78 },
  { index: 9, label: 'Yell', weight: 0.8 },
  { index: 11, label: 'Screaming', weight: 1 },
  { index: 19, label: 'Crying or sobbing', weight: 0.72 },
  { index: 21, label: 'Whimper', weight: 0.62 },
  { index: 22, label: 'Wail or moan', weight: 0.7 },
  { index: 420, label: 'Explosion', weight: 0.9 },
  { index: 421, label: 'Gunshot or gunfire', weight: 0.95 },
  { index: 435, label: 'Glass', weight: 0.62 },
];

const MEDIA_CLASSES: WeightedClass[] = [
  { index: 132, label: 'Music', weight: 1 },
  { index: 267, label: 'Video game music', weight: 1 },
  { index: 498, label: 'Sound effect', weight: 1 },
  { index: 518, label: 'Television', weight: 1 },
  { index: 519, label: 'Radio', weight: 1 },
];

export interface LocalAudioInference {
  distressScore: number;
  persistentRatio: number;
  mediaScore: number;
  factors: string[];
  available: boolean;
  inferenceSkipped: boolean;
}

let modelPromise: Promise<TfliteModel> | null = null;
const modelInput = new Float32Array(YAMNET_INPUT_SAMPLES);

function tensorSize(shape: number[]): number {
  return shape.reduce((size, dimension) => size * dimension, 1);
}

export async function initializeOnDeviceAudio(): Promise<void> {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(require('../../assets/models/yamnet.tflite'), []).then(
      async (model) => {
        const input = model.inputs[0];
        const output = model.outputs[0];
        if (
          !input ||
          input.dataType !== 'float32' ||
          tensorSize(input.shape) !== YAMNET_INPUT_SAMPLES ||
          !output ||
          output.dataType !== 'float32' ||
          tensorSize(output.shape) < 521
        ) {
          throw new Error('Bundled YAMNet model has an unexpected tensor layout.');
        }
        // Execute once at session start so READY means the interpreter and all
        // operators have run successfully, and the first real window has no cold-start cost.
        const warmup = new Float32Array(YAMNET_INPUT_SAMPLES);
        const warmupOutputs = await model.run([warmup.buffer as ArrayBuffer]);
        if (!warmupOutputs[0] || new Float32Array(warmupOutputs[0]).length < 521) {
          throw new Error('Bundled YAMNet model failed its local warm-up inference.');
        }
        return model;
      },
    );
    modelPromise.catch(() => {
      modelPromise = null;
    });
  }
  await modelPromise;
}

export function unavailableAudioInference(): LocalAudioInference {
  return {
    distressScore: 0,
    persistentRatio: 0,
    mediaScore: 0,
    factors: [],
    available: false,
    inferenceSkipped: true,
  };
}

function prepareWaveform(pcmBytes: Uint8Array, sampleRate: number): { rms: number; peak: number } {
  modelInput.fill(0);
  const sourceSamples = Math.floor(pcmBytes.byteLength / 2);
  if (sourceSamples === 0 || sampleRate <= 0) return { rms: 0, peak: 0 };

  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sourceSamples * 2);
  let sumSquares = 0;
  let peak = 0;

  if (sampleRate === YAMNET_SAMPLE_RATE) {
    const copyCount = Math.min(sourceSamples, YAMNET_INPUT_SAMPLES);
    const sourceStart = sourceSamples - copyCount;
    const targetStart = YAMNET_INPUT_SAMPLES - copyCount;
    for (let offset = 0; offset < copyCount; offset += 1) {
      const value = view.getInt16((sourceStart + offset) * 2, true) / 32_768;
      modelInput[targetStart + offset] = value;
      sumSquares += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
  } else {
    for (let target = 0; target < YAMNET_INPUT_SAMPLES; target += 1) {
      const sourcePosition =
        sourceSamples - ((YAMNET_INPUT_SAMPLES - target) * sampleRate) / YAMNET_SAMPLE_RATE;
      if (sourcePosition < 0 || sourcePosition >= sourceSamples) continue;
      const lower = Math.floor(sourcePosition);
      const upper = Math.min(lower + 1, sourceSamples - 1);
      const fraction = sourcePosition - lower;
      const lowerValue = view.getInt16(lower * 2, true);
      const upperValue = view.getInt16(upper * 2, true);
      const value = (lowerValue + (upperValue - lowerValue) * fraction) / 32_768;
      modelInput[target] = value;
      sumSquares += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
  }

  return { rms: Math.sqrt(sumSquares / YAMNET_INPUT_SAMPLES), peak };
}

export async function inferOnDeviceAudio(
  pcmBytes: Uint8Array,
  sampleRate: number,
): Promise<LocalAudioInference> {
  const energy = prepareWaveform(pcmBytes, sampleRate);

  // A conservative silence gate avoids invoking the neural network for empty or
  // near-silent buffers. It is deliberately low so ordinary quiet speech still runs.
  if (energy.rms < 0.006 && energy.peak < 0.025) {
    return {
      distressScore: 0,
      persistentRatio: 0,
      mediaScore: 0,
      factors: [],
      available: true,
      inferenceSkipped: true,
    };
  }

  await initializeOnDeviceAudio();
  const model = await modelPromise;
  if (!model) throw new Error('Bundled audio model is unavailable.');

  const outputs = await model.run([modelInput.buffer as ArrayBuffer]);
  const output = outputs[0];
  if (!output) throw new Error('Bundled audio model returned no scores.');
  const scores = new Float32Array(output);
  if (scores.length < 521) throw new Error('Bundled audio model returned incomplete scores.');

  const rankedDistress = DISTRESS_CLASSES.map((audioClass) => ({
    ...audioClass,
    score: (scores[audioClass.index] ?? 0) * audioClass.weight,
  })).sort((left, right) => right.score - left.score);
  const rawDistress = rankedDistress[0]?.score ?? 0;
  const mediaScore = MEDIA_CLASSES.reduce(
    (highest, audioClass) => Math.max(highest, scores[audioClass.index] ?? 0),
    0,
  );
  const persistenceGain = rawDistress >= 0.42 ? 1 : 0.75;
  const mediaPenalty = Math.max(
    0.55,
    1 - Math.max(mediaScore - rawDistress * 0.65, 0) * 0.75,
  );
  const distressScore = Math.min(Math.max(rawDistress * persistenceGain * mediaPenalty, 0), 1);

  const factors = rankedDistress
    .filter((item) => item.score >= 0.18)
    .slice(0, 3)
    .map((item) => `Audio: ${item.label} (${Math.round(item.score * 100)}%)`);
  if (mediaScore >= 0.35) {
    factors.push(`Possible media playback (${Math.round(mediaScore * 100)}%)`);
  }

  return {
    distressScore,
    persistentRatio: rawDistress >= 0.42 ? 1 : 0,
    mediaScore,
    factors,
    available: true,
    inferenceSkipped: false,
  };
}
