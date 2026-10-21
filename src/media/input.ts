import { AppError, toAppError } from '../core/errors';
import { ALL_FORMATS, BlobSource, Input, type InputAudioTrack, type InputVideoTrack } from 'mediabunny';

export interface OpenedMedia {
  input: Input;
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  durationSec: number;
  width: number;
  height: number;
}

/** Limite do editor (Reels); o criador de clipes abre vídeos longos com o próprio limite (ADR-0023). */
export const EDITOR_MAX_SEC = 180;

/** Abre o arquivo local sem enviar nada para servidor nenhum. */
export async function openMedia(file: Blob, opts: { maxSec?: number } = {}): Promise<OpenedMedia> {
  try {
    return await openMediaUnsafe(file, opts.maxSec ?? EDITOR_MAX_SEC);
  } catch (err) {
    throw toAppError(err, 'ABRIR_FALHOU');
  }
}

async function openMediaUnsafe(file: Blob, maxSec: number): Promise<OpenedMedia> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  if (!(await input.canRead())) throw new AppError('FORMATO_DESCONHECIDO', file.type || 'tipo vazio');
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new AppError('SEM_VIDEO');
  if (!(await video.canDecode())) throw new AppError('VIDEO_NAO_DECODIFICA', `codec ${video.codec ?? 'desconhecido'}`);
  const audio = await input.getPrimaryAudioTrack();
  const durationSec = await input.computeDuration();
  if (durationSec > maxSec) throw new AppError(maxSec > EDITOR_MAX_SEC ? 'LONGO_DEMAIS' : 'VIDEO_LONGO', `duração ${durationSec.toFixed(1)} s`);
  return { input, video, audio, durationSec, width: video.displayWidth, height: video.displayHeight };
}
