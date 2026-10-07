import lamejs from 'lamejs';

/**
 * Converts an audio Blob (e.g. audio/webm from MediaRecorder) to an MP3 Blob.
 * Uses the Web Audio API to decode the source, then lamejs to encode PCM to MP3.
 */
export async function convertToMp3(inputBlob: Blob): Promise<Blob> {
  const arrayBuffer = await inputBlob.arrayBuffer();
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);

  const blockSize = 1152;
  const data: number[] = [];

  // Interleave channels if stereo
  if (channels === 2) {
    const left = audioBuffer.getChannelData(0);
    const right = audioBuffer.getChannelData(1);
    for (let i = 0; i < left.length; i += blockSize) {
      const leftChunk = convertFloatToInt16(left.subarray(i, i + blockSize));
      const rightChunk = convertFloatToInt16(right.subarray(i, i + blockSize));
      const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
      if (mp3buf.length > 0) data.push(...mp3buf);
    }
  } else {
    const mono = audioBuffer.getChannelData(0);
    for (let i = 0; i < mono.length; i += blockSize) {
      const chunk = convertFloatToInt16(mono.subarray(i, i + blockSize));
      const mp3buf = encoder.encodeBuffer(chunk);
      if (mp3buf.length > 0) data.push(...mp3buf);
    }
  }

  const end = encoder.flush();
  if (end.length > 0) data.push(...end);

  audioCtx.close();

  return new Blob(new Uint8Array(data), { type: 'audio/mpeg' });
}

function convertFloatToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}
