import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

import {
  conditionOutdoorAudio,
  type OutdoorNoiseMetrics,
} from '@/inference/audioConditioning';
import { getDeviceInferenceCapabilities } from '@/inference/deviceCapabilities';
import {
  inferenceModelName,
  resolveInferenceModel,
  type ActiveInferenceModel,
} from '@/inference/modelProfiles';
import type { InferenceModelPreference } from '@/types/domain';

export const YAMNET_SAMPLE_RATE = 16_000;
export const YAMNET_INPUT_SAMPLES = 15_600;
export const YAMNET_PCM_BYTES = YAMNET_INPUT_SAMPLES * 2;
export const YAMNET_MODEL_VERSION = 'yamnet-tflite-v1';
export const LITE_MODEL_VERSION = 'safecity-lite-audio-v1';
export const ON_DEVICE_MODEL_VERSION = `${YAMNET_MODEL_VERSION}-local-fusion-3.1.0`;
const YAMNET_MODEL_ASSET = require('../../assets/models/yamnet.tflite');
const MODEL_FAILURE_COOLDOWN_MS = 5 * 60 * 1_000;

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
  model: ActiveInferenceModel | 'none';
  modelVersion: string;
  fallbackUsed: boolean;
  noiseSuppressionApplied: boolean;
  estimatedSnrDb: number | null;
}

export interface InferencePreparationResult {
  requestedModel: InferenceModelPreference;
  activeModel: ActiveInferenceModel;
  fallbackUsed: boolean;
  latencyMs: number;
  ready: boolean;
  message: string;
}

let modelPromise: Promise<TfliteModel> | null = null;
let modelUriPromise: Promise<string> | null = null;
let neuralUnavailableUntil = 0;
let lastNeuralFailure: string | null = null;

const NO_NOISE_METRICS: OutdoorNoiseMetrics = {
  applied: false,
  estimatedSnrDb: 0,
  lowFrequencyRatio: 0,
  noiseFloorRms: 0,
  suppressionGain: 1,
};

function tensorSize(shape: number[]): number {
  return shape.reduce((size, dimension) => size * dimension, 1);
}

function readableModelError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('MalformedURL') || message.includes('no protocol')) {
    return 'The bundled model file could not be opened by the phone.';
  }
  if (message.includes('unexpected tensor layout')) {
    return 'The bundled model did not match SafeCity’s expected audio format.';
  }
  return 'The neural audio model could not start on this phone.';
}

async function resolveBundledYamnetUri(): Promise<string> {
  if (!modelUriPromise) {
    modelUriPromise = (async () => {
      const asset = Asset.fromModule(YAMNET_MODEL_ASSET);
      await asset.downloadAsync();
      if (!asset.localUri || !asset.localUri.startsWith('file://')) {
        throw new Error('The bundled YAMNet model does not have a readable local file URI.');
      }
      return asset.localUri;
    })().catch((error) => {
      modelUriPromise = null;
      throw error;
    });
  }
  return modelUriPromise;
}

async function loadYamnetModel(forceRetry = false): Promise<TfliteModel> {
  if (!forceRetry && neuralUnavailableUntil > Date.now()) {
    throw new Error(lastNeuralFailure ?? 'The neural model is cooling down after a load failure.');
  }
  if (!modelPromise) {
    const pending = resolveBundledYamnetUri()
      .then((modelUri) => loadTensorflowModel({ url: modelUri }, []))
      .then(async (model) => {
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
        neuralUnavailableUntil = 0;
        lastNeuralFailure = null;
        return model;
      });
    modelPromise = pending;
    pending.catch((error) => {
      if (modelPromise === pending) modelPromise = null;
      lastNeuralFailure = readableModelError(error);
      neuralUnavailableUntil = Date.now() + MODEL_FAILURE_COOLDOWN_MS;
    });
  }
  return modelPromise;
}

export async function initializeOnDeviceAudio(
  preference: InferenceModelPreference = 'auto',
  forceRetry = false,
): Promise<InferencePreparationResult> {
  const startedAt = Date.now();
  const requested = resolveInferenceModel(preference, getDeviceInferenceCapabilities());
  if (requested === 'lite') {
    return {
      requestedModel: preference,
      activeModel: 'lite',
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      ready: true,
      message: 'Lite Fusion is ready. It does not need a neural model file.',
    };
  }

  try {
    await loadYamnetModel(forceRetry);
    return {
      requestedModel: preference,
      activeModel: 'yamnet',
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      ready: true,
      message: 'YAMNet Neural loaded from the bundled offline model and passed warm-up.',
    };
  } catch (error) {
    return {
      requestedModel: preference,
      activeModel: 'lite',
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
      ready: true,
      message: `${readableModelError(error)} Lite Fusion is active instead.`,
    };
  }
}

export function unavailableAudioInference(): LocalAudioInference {
  return {
    distressScore: 0,
    persistentRatio: 0,
    mediaScore: 0,
    factors: [],
    available: false,
    inferenceSkipped: true,
    model: 'none',
    modelVersion: 'motion-only-v1',
    fallbackUsed: false,
    noiseSuppressionApplied: false,
    estimatedSnrDb: null,
  };
}

function prepareWaveform(
  pcmBytes: Uint8Array,
  sampleRate: number,
): { rms: number; peak: number; input: Float32Array } {
  const input = new Float32Array(YAMNET_INPUT_SAMPLES);
  const sourceSamples = Math.floor(pcmBytes.byteLength / 2);
  if (sourceSamples === 0 || sampleRate <= 0) return { rms: 0, peak: 0, input };

  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sourceSamples * 2);
  let sumSquares = 0;
  let peak = 0;

  if (sampleRate === YAMNET_SAMPLE_RATE) {
    const copyCount = Math.min(sourceSamples, YAMNET_INPUT_SAMPLES);
    const sourceStart = sourceSamples - copyCount;
    const targetStart = YAMNET_INPUT_SAMPLES - copyCount;
    for (let offset = 0; offset < copyCount; offset += 1) {
      const value = view.getInt16((sourceStart + offset) * 2, true) / 32_768;
      input[targetStart + offset] = value;
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
      input[target] = value;
      sumSquares += value * value;
      peak = Math.max(peak, Math.abs(value));
    }
  }

  return { rms: Math.sqrt(sumSquares / YAMNET_INPUT_SAMPLES), peak, input };
}

function inferLiteAudio(
  pcmBytes: Uint8Array,
  sampleRate: number,
  fallbackUsed = false,
  noiseMetrics: OutdoorNoiseMetrics = NO_NOISE_METRICS,
): LocalAudioInference {
  const sourceSamples = Math.floor(pcmBytes.byteLength / 2);
  if (!sourceSamples || sampleRate <= 0) {
    return {
      distressScore: 0,
      persistentRatio: 0,
      mediaScore: 0,
      factors: [],
      available: true,
      inferenceSkipped: true,
      model: 'lite',
      modelVersion: LITE_MODEL_VERSION,
      fallbackUsed,
      noiseSuppressionApplied: noiseMetrics.applied,
      estimatedSnrDb: noiseMetrics.estimatedSnrDb,
    };
  }

  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sourceSamples * 2);
  const stride = Math.max(1, Math.floor(sampleRate / 8_000));
  const frameSamples = Math.max(1, Math.floor(sampleRate / 8));
  const frameEnergy: number[] = [];
  let frameSquares = 0;
  let frameCount = 0;
  let sumSquares = 0;
  let sampled = 0;
  let peak = 0;
  let crossings = 0;
  let previous = 0;

  for (let sampleIndex = 0; sampleIndex < sourceSamples; sampleIndex += stride) {
    const value = view.getInt16(sampleIndex * 2, true) / 32_768;
    const square = value * value;
    sumSquares += square;
    frameSquares += square;
    peak = Math.max(peak, Math.abs(value));
    if (sampled > 0 && (value >= 0) !== (previous >= 0)) crossings += 1;
    previous = value;
    sampled += 1;
    frameCount += 1;
    if (frameCount >= Math.max(1, Math.floor(frameSamples / stride))) {
      frameEnergy.push(Math.sqrt(frameSquares / frameCount));
      frameSquares = 0;
      frameCount = 0;
    }
  }
  if (frameCount) frameEnergy.push(Math.sqrt(frameSquares / frameCount));

  const rms = sampled ? Math.sqrt(sumSquares / sampled) : 0;
  if (rms < 0.006 && peak < 0.025) {
    return {
      distressScore: 0,
      persistentRatio: 0,
      mediaScore: 0,
      factors: [],
      available: true,
      inferenceSkipped: true,
      model: 'lite',
      modelVersion: LITE_MODEL_VERSION,
      fallbackUsed,
      noiseSuppressionApplied: noiseMetrics.applied,
      estimatedSnrDb: noiseMetrics.estimatedSnrDb,
    };
  }

  const loudFrames = frameEnergy.filter((energy) => energy >= 0.065).length;
  const persistentRatio = frameEnergy.length ? loudFrames / frameEnergy.length : 0;
  const meanFrameEnergy =
    frameEnergy.reduce((sum, energy) => sum + energy, 0) / Math.max(1, frameEnergy.length);
  const frameVariation = Math.sqrt(
    frameEnergy.reduce(
      (sum, energy) => sum + Math.pow(energy - meanFrameEnergy, 2),
      0,
    ) / Math.max(1, frameEnergy.length),
  );
  const zeroCrossingRate = crossings / Math.max(1, sampled - 1);
  const energyScore = Math.min(Math.max((rms - 0.025) / 0.16, 0), 1);
  const peakScore = Math.min(Math.max((peak - 0.18) / 0.72, 0), 1);
  const broadbandScore = Math.min(Math.max((zeroCrossingRate - 0.025) / 0.22, 0), 1);
  const variationScore = Math.min(frameVariation / 0.12, 1);
  const rawDistressScore = Math.min(
    (energyScore * 0.38 +
      peakScore * 0.24 +
      broadbandScore * 0.18 +
      persistentRatio * 0.12 +
      variationScore * 0.08) *
      0.78,
    0.76,
  );
  const lowSnrPenalty =
    noiseMetrics.suppressionGain < 0.95 && noiseMetrics.noiseFloorRms >= 0.012
      ? 0.72 + Math.min(noiseMetrics.estimatedSnrDb / 8, 1) * 0.28
      : 1;
  const distressScore = rawDistressScore * lowSnrPenalty;
  const steadySignal = Math.max(0, 1 - variationScore);
  const mediaScore = Math.min(
    steadySignal * Math.max(0, 0.28 - zeroCrossingRate) * energyScore * 2.2,
    0.65,
  );
  const factors: string[] = [];
  if (distressScore >= 0.28) {
    factors.push(`Lite audio distress signature (${Math.round(distressScore * 100)}%)`);
  }
  if (peak >= 0.72) factors.push('Very loud audio peak');
  if (persistentRatio >= 0.5) factors.push('Loud audio persisted across the window');
  if (noiseMetrics.applied) {
    factors.push(
      `Outdoor noise suppression active (${Math.round(noiseMetrics.estimatedSnrDb)} dB estimated SNR)`,
    );
  }
  if (fallbackUsed) factors.push('Neural model unavailable; Lite Fusion used');

  return {
    distressScore,
    persistentRatio,
    mediaScore,
    factors,
    available: true,
    inferenceSkipped: false,
    model: 'lite',
    modelVersion: LITE_MODEL_VERSION,
    fallbackUsed,
    noiseSuppressionApplied: noiseMetrics.applied,
    estimatedSnrDb: noiseMetrics.estimatedSnrDb,
  };
}

async function inferYamnetAudio(
  pcmBytes: Uint8Array,
  sampleRate: number,
  noiseMetrics: OutdoorNoiseMetrics = NO_NOISE_METRICS,
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
      model: 'yamnet',
      modelVersion: YAMNET_MODEL_VERSION,
      fallbackUsed: false,
      noiseSuppressionApplied: noiseMetrics.applied,
      estimatedSnrDb: noiseMetrics.estimatedSnrDb,
    };
  }

  const model = await loadYamnetModel();

  const outputs = await model.run([energy.input.buffer as ArrayBuffer]);
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
  const lowSnrPenalty =
    noiseMetrics.suppressionGain < 0.95 && noiseMetrics.noiseFloorRms >= 0.012
      ? 0.8 + Math.min(noiseMetrics.estimatedSnrDb / 8, 1) * 0.2
      : 1;
  const distressScore = Math.min(
    Math.max(rawDistress * persistenceGain * mediaPenalty * lowSnrPenalty, 0),
    1,
  );

  const factors = rankedDistress
    .filter((item) => item.score >= 0.18)
    .slice(0, 3)
    .map((item) => `Audio: ${item.label} (${Math.round(item.score * 100)}%)`);
  if (mediaScore >= 0.35) {
    factors.push(`Possible media playback (${Math.round(mediaScore * 100)}%)`);
  }
  if (noiseMetrics.applied) {
    factors.push(
      `Outdoor noise suppression active (${Math.round(noiseMetrics.estimatedSnrDb)} dB estimated SNR)`,
    );
  }

  return {
    distressScore,
    persistentRatio: rawDistress >= 0.42 ? 1 : 0,
    mediaScore,
    factors,
    available: true,
    inferenceSkipped: false,
    model: 'yamnet',
    modelVersion: YAMNET_MODEL_VERSION,
    fallbackUsed: false,
    noiseSuppressionApplied: noiseMetrics.applied,
    estimatedSnrDb: noiseMetrics.estimatedSnrDb,
  };
}

export async function inferOnDeviceAudio(
  pcmBytes: Uint8Array,
  sampleRate: number,
  preference: InferenceModelPreference = 'auto',
): Promise<LocalAudioInference> {
  const conditioned = conditionOutdoorAudio(pcmBytes, sampleRate);
  const requested = resolveInferenceModel(preference, getDeviceInferenceCapabilities());
  if (requested === 'lite') {
    return inferLiteAudio(
      conditioned.pcmBytes,
      sampleRate,
      false,
      conditioned.metrics,
    );
  }
  try {
    return await inferYamnetAudio(
      conditioned.pcmBytes,
      sampleRate,
      conditioned.metrics,
    );
  } catch {
    return inferLiteAudio(
      conditioned.pcmBytes,
      sampleRate,
      true,
      conditioned.metrics,
    );
  }
}

function createSelfCheckAudio(): Uint8Array {
  const samples = new Int16Array(YAMNET_INPUT_SAMPLES);
  for (let index = 0; index < samples.length; index += 1) {
    const envelope = index > samples.length * 0.2 && index < samples.length * 0.8 ? 0.18 : 0.04;
    const tone = Math.sin((2 * Math.PI * 440 * index) / YAMNET_SAMPLE_RATE);
    const overtone = Math.sin((2 * Math.PI * 1_320 * index) / YAMNET_SAMPLE_RATE) * 0.28;
    samples[index] = Math.round((tone + overtone) * envelope * 32_767);
  }
  return new Uint8Array(samples.buffer);
}

export async function runInferenceSelfCheck(
  preference: InferenceModelPreference,
): Promise<InferencePreparationResult> {
  const startedAt = Date.now();
  const preparation = await initializeOnDeviceAudio(preference, true);
  const testAudio = conditionOutdoorAudio(createSelfCheckAudio(), YAMNET_SAMPLE_RATE);
  let inference: LocalAudioInference;
  try {
    inference =
      preparation.activeModel === 'yamnet'
        ? await inferYamnetAudio(
            testAudio.pcmBytes,
            YAMNET_SAMPLE_RATE,
            testAudio.metrics,
          )
        : inferLiteAudio(
            testAudio.pcmBytes,
            YAMNET_SAMPLE_RATE,
            preparation.fallbackUsed,
            testAudio.metrics,
          );
  } catch (error) {
    inference = inferLiteAudio(
      testAudio.pcmBytes,
      YAMNET_SAMPLE_RATE,
      true,
      testAudio.metrics,
    );
    return {
      requestedModel: preference,
      activeModel: 'lite',
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
      ready: true,
      message: `${readableModelError(error)} Lite Fusion passed the offline test instead.`,
    };
  }
  const activeName = inferenceModelName(inference.model === 'none' ? 'lite' : inference.model);
  return {
    ...preparation,
    activeModel: inference.model === 'none' ? 'lite' : inference.model,
    latencyMs: Date.now() - startedAt,
    message: preparation.fallbackUsed
      ? preparation.message
      : `${activeName} loaded and completed a full offline test inference.`,
  };
}
