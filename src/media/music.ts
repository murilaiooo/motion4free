import { AppError, describeError } from '../core/errors';
import type { DecodedAudio } from './audio';

/** Limite do arquivo de música: a música inteira é decodificada na memória para tocar com a prévia. */
export const MUSIC_MAX_BYTES = 60 * 1024 * 1024;
/** Os vídeos montados têm no máximo 10 minutos: o resto da música nunca tocaria. */
const MUSIC_MAX_SEC = 600;
const MUSIC_RATE = 48000;

/** Música de fundo pronta para tocar: o arquivo (para salvar no projeto) e o som decodificado. */
export interface LoadedMusic {
  file: Blob;
  audio: DecodedAudio;
}

/**
 * Lê MP3, M4A/AAC, WAV ou OGG com o decodificador do próprio navegador (sem upload).
 * Sai em até 2 canais a 48 kHz, cortada em 10 minutos.
 */
export async function decodeMusic(file: Blob): Promise<DecodedAudio> {
  if (file.size > MUSIC_MAX_BYTES) throw new AppError('MUSICA_GRANDE', `${(file.size / 1024 / 1024).toFixed(1)} MB`);
  let buffer: AudioBuffer;
  try {
    const ctx = new OfflineAudioContext(2, 1, MUSIC_RATE);
    buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  } catch (err) {
    throw new AppError('MUSICA_ILEGIVEL', describeError(err));
  }
  const length = Math.min(buffer.length, Math.round(MUSIC_MAX_SEC * buffer.sampleRate));
  if (length <= 0) throw new AppError('MUSICA_ILEGIVEL', 'arquivo sem som');
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c).slice(0, length));
  return { channels, sampleRate: buffer.sampleRate };
}
