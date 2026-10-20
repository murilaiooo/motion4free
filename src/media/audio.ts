import { AudioBufferSink, type InputAudioTrack } from 'mediabunny';

export interface DecodedAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Decodifica o áudio inteiro (limite de 3 min na Fase 1 mantém isso em memória). */
export async function decodeAudio(track: InputAudioTrack, durationSec: number): Promise<DecodedAudio> {
  const sampleRate = track.sampleRate;
  const numCh = Math.min(2, track.numberOfChannels);
  const total = Math.ceil(durationSec * sampleRate);
  const channels = Array.from({ length: numCh }, () => new Float32Array(total));
  const sink = new AudioBufferSink(track);
  for await (const { buffer, timestamp } of sink.buffers()) {
    const offset = Math.round(timestamp * sampleRate);
    for (let c = 0; c < numCh; c++) {
      const data = buffer.getChannelData(Math.min(c, buffer.numberOfChannels - 1));
      const start = Math.max(0, offset);
      const skip = start - offset;
      const len = Math.min(data.length - skip, total - start);
      if (len > 0) channels[c]!.set(data.subarray(skip, skip + len), start);
    }
  }
  return { channels, sampleRate };
}

/** Mono 16 kHz para o Whisper e para a análise de silêncio. */
export async function toMono16k(audio: DecodedAudio): Promise<Float32Array> {
  const len = audio.channels[0]!.length;
  const mono = new Float32Array(len);
  for (const ch of audio.channels) for (let i = 0; i < len; i++) mono[i]! += ch[i]! / audio.channels.length;
  const outLen = Math.ceil((len * 16000) / audio.sampleRate);
  const ctx = new OfflineAudioContext(1, outLen, 16000);
  const buf = ctx.createBuffer(1, len, audio.sampleRate);
  buf.copyToChannel(mono, 0);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start();
  const rendered = await ctx.startRendering();
  return rendered.getChannelData(0).slice();
}
