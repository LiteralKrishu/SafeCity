import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';

const SAMPLE_RATE = 16_000;
const DURATION_SECONDS = 2;
let player: AudioPlayer | null = null;

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

function ensureSirenFile(): File {
  const file = new File(Paths.cache, 'safecity-danger-siren.wav');
  if (!file.exists) {
    file.create({ overwrite: true, intermediates: true });
    file.write(createSirenWave());
  }
  return file;
}

export async function startSiren(): Promise<void> {
  if (player?.playing) return;
  await setAudioModeAsync({
    playsInSilentMode: true,
    interruptionMode: 'doNotMix',
    allowsRecording: false,
    shouldPlayInBackground: false,
    shouldRouteThroughEarpiece: false,
    allowsBackgroundRecording: false,
  });
  const file = ensureSirenFile();
  player?.remove();
  player = createAudioPlayer(file.uri, { updateInterval: 500 });
  player.loop = true;
  player.volume = 1;
  player.play();
}

export function stopSiren(): void {
  if (!player) return;
  player.pause();
  player.remove();
  player = null;
}
