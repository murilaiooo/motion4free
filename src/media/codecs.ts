import { AppError } from '../core/errors';
import { canEncodeAudio, canEncodeVideo, type VideoCodec } from 'mediabunny';

export interface CodecChoice {
  video: VideoCodec;
  /** true quando caímos fora do H.264: o MP4 abre no navegador, mas alguns apps podem recusar. */
  degraded: boolean;
}

/** Não distribuir um FFmpeg WASM sem fonte correspondente verificável (#2).
 * O MP4 com áudio só usa o AAC nativo do navegador. Sem áudio, não exige AAC.
 */
export async function chooseCodecs(width: number, height: number, needsAudio = true): Promise<CodecChoice> {
  if (needsAudio && !(await canEncodeAudio('aac'))) {
    throw new AppError('SEM_AAC');
  }
  for (const video of ['avc', 'vp9', 'av1'] as const) {
    if (await canEncodeVideo(video, { width, height })) return { video, degraded: video !== 'avc' };
  }
  throw new AppError('SEM_ENCODER', `${width}x${height}: nenhum de avc, vp9, av1`);
}
