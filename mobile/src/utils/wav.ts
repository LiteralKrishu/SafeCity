const WAV_HEADER_BYTES = 44;

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

export function encodePcm16Wav(
  pcmBytes: Uint8Array,
  sampleRate: number,
  channelCount = 1,
): Uint8Array {
  const dataLength = pcmBytes.byteLength - (pcmBytes.byteLength % 2);
  const output = new Uint8Array(WAV_HEADER_BYTES + dataLength);
  const view = new DataView(output.buffer);
  const bytesPerSample = 2;
  const byteRate = sampleRate * channelCount * bytesPerSample;

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channelCount * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataLength, true);
  output.set(pcmBytes.subarray(0, dataLength), WAV_HEADER_BYTES);

  return output;
}
