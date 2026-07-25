import { Asset } from 'expo-asset';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import { TurboModuleRegistry } from 'react-native';

import { conditionOutdoorAudio } from '@/inference/audioConditioning';
import {
  getThreatPhrase,
  isThreatPhraseKeyword,
  THREAT_PHRASES,
  type ThreatPhraseKeyword,
} from '@/inference/threatLanguage';

export const VOICE_TRIGGER_SAMPLE_RATE = 16_000;
export const VOICE_TRIGGER_MODEL_VERSION = 'sherpa-kws-zh-en-3m-int8-2025-12-20-v4';

export type { VoiceTriggerStatus } from '@/types/domain';

export interface VoiceTriggerPreparation {
  ready: boolean;
  message: string;
}

export interface VoiceTriggerDetection {
  display: string;
  kind: 'emergency' | 'threat';
  keyword: VoiceTriggerKeyword;
}

export type EmergencyVoiceTriggerKeyword =
  | 'HELP'
  | 'BACHAO'
  | 'SOS'
  | 'EMERGENCY'
  | 'SAVE_ME';
export type VoiceTriggerKeyword = EmergencyVoiceTriggerKeyword | ThreatPhraseKeyword;

interface BundledModelFile {
  filename: string;
  moduleId: number;
}

const MODEL_DIRECTORY = `voice-trigger-${VOICE_TRIGGER_MODEL_VERSION}`;
const ENCODER_FILE = 'encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx';
const DECODER_FILE = 'decoder-epoch-13-avg-2-chunk-16-left-64.onnx';
const JOINER_FILE = 'joiner-epoch-13-avg-2-chunk-16-left-64.int8.onnx';
const TOKENS_FILE = 'tokens.txt';
const KEYWORDS_FILE = 'keywords.txt';
const MISSING_NATIVE_ENGINE_MESSAGE =
  'This SafeCity installation does not include the offline voice engine. Install the latest app build to enable emergency-word and threat-phrase detection.';
const SUPPORTED_KEYWORDS = new Set<VoiceTriggerKeyword>([
  'HELP',
  'BACHAO',
  'SOS',
  'EMERGENCY',
  'SAVE_ME',
  ...(Object.keys(THREAT_PHRASES) as ThreatPhraseKeyword[]),
]);
const MODEL_FILES: BundledModelFile[] = [
  {
    filename: ENCODER_FILE,
    moduleId: require('../../assets/models/voice-trigger/encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx'),
  },
  {
    filename: DECODER_FILE,
    moduleId: require('../../assets/models/voice-trigger/decoder-epoch-13-avg-2-chunk-16-left-64.onnx'),
  },
  {
    filename: JOINER_FILE,
    moduleId: require('../../assets/models/voice-trigger/joiner-epoch-13-avg-2-chunk-16-left-64.int8.onnx'),
  },
  {
    filename: TOKENS_FILE,
    moduleId: require('../../assets/models/voice-trigger/tokens.txt'),
  },
  {
    filename: KEYWORDS_FILE,
    moduleId: require('../../assets/models/voice-trigger/keywords.txt'),
  },
];

let initializationPromise: Promise<void> | null = null;
let initialized = false;
let listening = false;
let sessionGeneration = 0;
let nativeOperationQueue: Promise<void> = Promise.resolve();
let kwsPromise: Promise<(typeof import('@siteed/sherpa-onnx.rn'))['KWS']> | null = null;

function hasNativeKeywordEngine(): boolean {
  return isSupportedPlatform() && TurboModuleRegistry.get('SherpaOnnx') !== null;
}

function loadKeywordEngine(): Promise<(typeof import('@siteed/sherpa-onnx.rn'))['KWS']> {
  if (!hasNativeKeywordEngine()) {
    return Promise.reject(new Error(MISSING_NATIVE_ENGINE_MESSAGE));
  }

  if (!kwsPromise) {
    kwsPromise = Promise.resolve()
      .then(() => {
        const sherpaModule = require('@siteed/sherpa-onnx.rn') as
          | typeof import('@siteed/sherpa-onnx.rn')
          | undefined;
        if (!sherpaModule?.KWS) {
          throw new Error('The bundled offline voice engine could not be initialized.');
        }
        return sherpaModule.KWS;
      })
      .catch((error) => {
        kwsPromise = null;
        throw error;
      });
  }
  return kwsPromise;
}

function runNativeOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = nativeOperationQueue.then(operation, operation);
  nativeOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isSupportedPlatform(): boolean {
  return process.env.EXPO_OS === 'android' || process.env.EXPO_OS === 'ios';
}

async function copyBundledModelFile(
  directory: Directory,
  modelFile: BundledModelFile,
): Promise<void> {
  const asset = Asset.fromModule(modelFile.moduleId);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`Bundled voice model file is unavailable: ${modelFile.filename}`);
  }

  const source = new File(asset.localUri);
  const destination = new File(directory, modelFile.filename);
  if (destination.exists && destination.size === source.size) return;
  await source.copy(destination, { overwrite: true });
}

async function prepareBundledModelDirectory(): Promise<Directory> {
  const directory = new Directory(Paths.document, MODEL_DIRECTORY);
  directory.create({ idempotent: true, intermediates: true });
  await Promise.all(MODEL_FILES.map((modelFile) => copyBundledModelFile(directory, modelFile)));
  return directory;
}

export async function getBundledVoiceTriggerModelDirectoryUri(): Promise<string> {
  return (await prepareBundledModelDirectory()).uri;
}

async function initializeVoiceTriggerModel(): Promise<void> {
  if (initialized) return;
  if (!isSupportedPlatform()) {
    throw new Error('The bundled voice trigger is available only on Android and iOS.');
  }
  if (!initializationPromise) {
    initializationPromise = prepareBundledModelDirectory()
      .then(async (directory) => {
        const keywordEngine = await loadKeywordEngine();
        const validation = await runNativeOperation(() => keywordEngine.validateLibrary());
        if (!validation.loaded) {
          throw new Error(validation.status || 'The offline voice engine did not load.');
        }

        const result = await runNativeOperation(() =>
          keywordEngine.init({
            modelDir: directory.uri,
            modelType: 'zipformer2',
            modelFiles: {
              encoder: ENCODER_FILE,
              decoder: DECODER_FILE,
              joiner: JOINER_FILE,
              tokens: TOKENS_FILE,
            },
            keywordsFile: KEYWORDS_FILE,
            numThreads: 1,
            provider: 'cpu',
            maxActivePaths: 4,
            keywordsScore: 2.0,
            keywordsThreshold: 0.2,
            numTrailingBlanks: 1,
          }),
        );
        if (!result.success) {
          throw new Error(result.error || 'The bundled voice model could not be initialized.');
        }
        initialized = true;
      })
      .catch((error) => {
        initializationPromise = null;
        throw error;
      });
  }
  await initializationPromise;
}

export function isVoiceTriggerAvailable(): boolean {
  return hasNativeKeywordEngine();
}

export async function prepareVoiceTrigger(): Promise<VoiceTriggerPreparation> {
  if (!hasNativeKeywordEngine()) {
    return {
      ready: false,
      message: MISSING_NATIVE_ENGINE_MESSAGE,
    };
  }

  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) {
    return {
      ready: false,
      message: 'Microphone permission is required for the voice SOS trigger.',
    };
  }

  try {
    await initializeVoiceTriggerModel();
    return {
      ready: true,
      message: 'The bundled offline emergency-word and threat-phrase model is ready.',
    };
  } catch (error) {
    return {
      ready: false,
      message:
        error instanceof Error
          ? error.message
          : 'SafeCity could not prepare its bundled offline voice model.',
    };
  }
}

export async function startVoiceTriggerRecognition(): Promise<void> {
  const generation = ++sessionGeneration;
  await initializeVoiceTriggerModel();
  if (generation !== sessionGeneration) return;
  const keywordEngine = await loadKeywordEngine();
  await runNativeOperation(() => keywordEngine.resetStream());
  if (generation !== sessionGeneration) return;
  listening = true;
}

export async function stopVoiceTriggerRecognition(): Promise<void> {
  sessionGeneration += 1;
  listening = false;
  if (initialized) {
    const keywordEngine = await loadKeywordEngine();
    await runNativeOperation(() => keywordEngine.resetStream());
  }
}

export async function releaseVoiceTriggerRecognition(): Promise<void> {
  sessionGeneration += 1;
  listening = false;
  if (!initialized) return;
  const keywordEngine = await loadKeywordEngine();
  const result = await runNativeOperation(() => keywordEngine.release());
  if (result.released) {
    initialized = false;
    initializationPromise = null;
  }
}

function normalizedSamples(pcmBytes: Uint8Array): number[] {
  const sampleCount = Math.floor(pcmBytes.byteLength / 2);
  const samples = new Array<number>(sampleCount);
  const view = new DataView(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32_768;
  }
  return samples;
}

export async function processVoiceTriggerPcm(
  pcmBytes: Uint8Array,
  sampleRate: number,
): Promise<VoiceTriggerDetection | null> {
  if (!listening || !initialized || pcmBytes.byteLength < 2) return null;
  if (sampleRate !== VOICE_TRIGGER_SAMPLE_RATE) {
    throw new Error(`Voice trigger expected ${VOICE_TRIGGER_SAMPLE_RATE} Hz PCM.`);
  }

  const generation = sessionGeneration;
  const conditioned = conditionOutdoorAudio(pcmBytes, sampleRate);
  const samples = normalizedSamples(conditioned.pcmBytes);
  const keywordEngine = await loadKeywordEngine();
  const result = await runNativeOperation(() => keywordEngine.acceptWaveform(sampleRate, samples));
  if (!result.success) {
    throw new Error(result.error || 'Offline keyword inference failed.');
  }
  if (!listening || generation !== sessionGeneration || !result.detected) return null;

  const keyword = result.keyword
    .toLocaleUpperCase()
    .replace(/[^A-Z]+/g, '_')
    .replace(/^_+|_+$/g, '') as VoiceTriggerKeyword;
  if (!SUPPORTED_KEYWORDS.has(keyword)) return null;
  await runNativeOperation(() => keywordEngine.resetStream());
  if (isThreatPhraseKeyword(keyword)) {
    return {
      display: getThreatPhrase(keyword).display,
      kind: 'threat',
      keyword,
    };
  }

  sessionGeneration += 1;
  listening = false;
  return {
    display: keyword === 'SAVE_ME' ? 'Save me' : keyword === 'BACHAO' ? 'Bachao' : keyword,
    kind: 'emergency',
    keyword,
  };
}
