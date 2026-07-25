import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
  type AudioStatus,
} from 'expo-audio';
import { File, Paths } from 'expo-file-system';

const SAMPLE_RATE = 16_000;
const DURATION_SECONDS = 2;
const SIREN_FILE_SIZE = 44 + SAMPLE_RATE * DURATION_SECONDS * 2;
const LOAD_TIMEOUT_MS = 4_000;
const PLAY_TIMEOUT_MS = 2_000;
let player: AudioPlayer | null = null;
let startInFlight: Promise<void> | null = null;
let operationId = 0;
let cancelStatusWait: (() => void) | null = null;

class SirenStartCancelledError extends Error {
  constructor() {
    super('Siren start was cancelled.');
    this.name = 'SirenStartCancelledError';
  }
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createSirenWave(): Uint8Array {
  const sampleCount = SAMPLE_RATE * DURATION_SECONDS;
  const bytes = new Uint8Array(44 + sampleCount * 2);
  const view = new DataView(bytes.buffer);
  const dataSize = sampleCount * 2;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let phase = 0;
  for (let sample = 0; sample < sampleCount; sample += 1) {
    const seconds = sample / SAMPLE_RATE;
    const sweep = (seconds % 1) < 0.5 ? (seconds % 0.5) * 2 : 1 - (seconds % 0.5) * 2;
    const frequency = 680 + sweep * 520;
    phase += (Math.PI * 2 * frequency) / SAMPLE_RATE;
    const envelope = Math.min(1, sample / 240, (sampleCount - sample) / 240);
    const value = Math.round(Math.sin(phase) * 0.82 * envelope * 32_767);
    view.setInt16(44 + sample * 2, value, true);
  }
  return bytes;
}

function ensureSirenFile(forceRewrite = false): File {
  const file = new File(Paths.cache, 'safecity-danger-siren.wav');
  if (!file.exists) {
    file.create({ overwrite: true, intermediates: true });
  }
  if (forceRewrite || file.size !== SIREN_FILE_SIZE) {
    file.write(createSirenWave());
  }
  return file;
}

function releasePlayer(audioPlayer: AudioPlayer | null): void {
  if (!audioPlayer) return;
  try {
    audioPlayer.pause();
  } catch {
    // The native player may already have been released.
  }
  try {
    audioPlayer.remove();
  } catch {
    // The native player may already have been released.
  }
  if (player === audioPlayer) player = null;
}

function waitForStatus(
  audioPlayer: AudioPlayer,
  currentOperationId: number,
  predicate: (status: AudioStatus) => boolean,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let subscription: ReturnType<AudioPlayer['addListener']> | undefined;

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      subscription?.remove();
      if (cancelStatusWait === cancel) cancelStatusWait = null;
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const check = (status: AudioStatus) => {
      if (currentOperationId !== operationId || player !== audioPlayer) {
        finish(new SirenStartCancelledError());
      } else if (status.error) {
        finish(new Error(status.error));
      } else if (predicate(status)) {
        finish();
      }
    };

    const cancel = () => finish(new SirenStartCancelledError());
    cancelStatusWait = cancel;
    subscription = audioPlayer.addListener('playbackStatusUpdate', check);
    check(audioPlayer.currentStatus);
    if (settled) return;

    timeout = setTimeout(() => {
      check(audioPlayer.currentStatus);
      if (!settled) finish(new Error(timeoutMessage));
    }, timeoutMs);
  });
}

async function startSirenAttempt(
  currentOperationId: number,
  forceRewrite: boolean,
): Promise<void> {
  if (currentOperationId !== operationId) throw new SirenStartCancelledError();

  const file = ensureSirenFile(forceRewrite);
  const nextPlayer = createAudioPlayer(file.uri, { updateInterval: 100 });
  player = nextPlayer;
  nextPlayer.loop = true;
  nextPlayer.volume = 1;

  await waitForStatus(
    nextPlayer,
    currentOperationId,
    (status) => status.isLoaded,
    LOAD_TIMEOUT_MS,
    'The siren audio took too long to load.',
  );
  nextPlayer.play();
  await waitForStatus(
    nextPlayer,
    currentOperationId,
    (status) => status.playing,
    PLAY_TIMEOUT_MS,
    'The phone did not start siren playback.',
  );
}

async function startSirenInternal(currentOperationId: number): Promise<void> {
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    allowsBackgroundRecording: false,
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await startSirenAttempt(currentOperationId, attempt > 0);
      return;
    } catch (error) {
      const failedPlayer = player;
      releasePlayer(failedPlayer);
      if (error instanceof SirenStartCancelledError) throw error;
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'Unknown audio error.';
  throw new Error(`The siren could not start. ${detail}`);
}

export function isSirenStartCancelled(error: unknown): boolean {
  return error instanceof SirenStartCancelledError;
}

export function startSiren(): Promise<void> {
  if (player?.playing) return Promise.resolve();
  if (startInFlight) return startInFlight;

  const currentOperationId = ++operationId;
  const start = startSirenInternal(currentOperationId);
  const trackedStart = start.finally(() => {
    if (startInFlight === trackedStart) startInFlight = null;
  });
  startInFlight = trackedStart;
  return trackedStart;
}

export function stopSiren(): void {
  operationId += 1;
  cancelStatusWait?.();
  cancelStatusWait = null;
  releasePlayer(player);
}
