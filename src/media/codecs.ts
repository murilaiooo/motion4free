import { AppError } from '../core/errors';
import { canEncodeAudio, canEncodeVideo, type VideoCodec } from 'mediabunny';

export interface CodecChoice {
  video: VideoCodec;
  /** true quando caímos fora do H.264: o MP4 abre no navegador, mas alguns apps podem recusar. */
  degraded: boolean;
}

let aacReady = false;

export async function chooseCodecs(width: number, height: number): Promise<CodecChoice> {
  if (!aacReady && !(await canEncodeAudio('aac'))) {
    // encoder AAC em WebAssembly, carregado só quando o navegador não tem um nativo
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
  }
  aacReady = true;
  for (const video of ['avc', 'vp9', 'av1'] as const) {
    if (await canEncodeVideo(video, { width, height })) return { video, degraded: video !== 'avc' };
  }
  throw new AppError('SEM_ENCODER', `${width}x${height}: nenhum de avc, vp9, av1`);
}
