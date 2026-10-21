import { AudioBufferSink, type InputAudioTrack } from 'mediabunny';
import { Mono16kWriter } from '../analysis/downmix';
import { AppError, describeError } from '../core/errors';

/**
 * Áudio do vídeo longo direto em mono 16 kHz (v0.22, ADR-0023): cada pedaço decodificado é reduzido na
 * hora, então o áudio original nunca fica inteiro na memória (1 hora ≈ 230 MB em vez de ≈ 1,4 GB).
 */
export async function decodeMono16k(track: InputAudioTrack, durationSec: number, onProgress: (fraction: number) => void): Promise<Float32Array> {
  let writer: Mono16kWriter;
  try {
    writer = new Mono16kWriter(track.sampleRate, durationSec);
  } catch (err) {
    throw new AppError('MEMORIA_LONGO', `${durationSec.toFixed(0)} s: ${describeError(err)}`);
  }
  const sink = new AudioBufferSink(track);
  let shown = -1;
  try {
    for await (const { buffer, timestamp } of sink.buffers()) {
      const n = Math.min(2, buffer.numberOfChannels);
      const channels: Float32Array[] = [];
      for (let c = 0; c < n; c++) channels.push(buffer.getChannelData(c));
      writer.write(channels, Math.round(timestamp * track.sampleRate));
      const pct = Math.floor((timestamp / Math.max(1, durationSec)) * 100);
      if (pct !== shown) {
        shown = pct;
        onProgress(Math.min(1, pct / 100));
      }
    }
  } catch (err) {
    if (err instanceof RangeError || /memory|allocation/i.test(describeError(err))) throw new AppError('MEMORIA_LONGO', describeError(err));
    throw new AppError('AUDIO_FALHOU', describeError(err));
  }
  return writer.finish();
}
