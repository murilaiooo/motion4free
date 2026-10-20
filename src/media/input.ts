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

/** Abre o arquivo local sem enviar nada para servidor nenhum. */
export async function openMedia(file: Blob): Promise<OpenedMedia> {
  try {
    return await openMediaUnsafe(file);
  } catch (err) {
    throw toAppError(err, 'ABRIR_FALHOU');
  }
}

async function openMediaUnsafe(file: Blob): Promise<OpenedMedia> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  if (!(await input.canRead())) throw new AppError('FORMATO_DESCONHECIDO', file.type || 'tipo vazio');
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new AppError('SEM_VIDEO');
  if (!(await video.canDecode())) throw new AppError('VIDEO_NAO_DECODIFICA', `codec ${video.codec ?? 'desconhecido'}`);
  const audio = await input.getPrimaryAudioTrack();
  const durationSec = await input.computeDuration();
  if (durationSec > 180) throw new AppError('VIDEO_LONGO', `duração ${durationSec.toFixed(1)} s`);
  return { input, video, audio, durationSec, width: video.displayWidth, height: video.displayHeight };
}
