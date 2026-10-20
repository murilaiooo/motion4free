import { ALL_FORMATS, BlobSource, Input, type InputAudioTrack, type InputVideoTrack } from 'mediabunny';

export interface OpenedMedia {
  input: Input;
  video: InputVideoTrack;
  audio: InputAudioTrack | null;
  durationSec: number;
  width: number;
  height: number;
}

export class MediaError extends Error {}

/** Abre o arquivo local sem enviar nada para servidor nenhum. */
export async function openMedia(file: Blob): Promise<OpenedMedia> {
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  if (!(await input.canRead())) throw new MediaError('Formato de arquivo não reconhecido.');
  const video = await input.getPrimaryVideoTrack();
  if (!video) throw new MediaError('O arquivo não tem vídeo.');
  if (!(await video.canDecode())) throw new MediaError('Este navegador não consegue ler o vídeo deste arquivo.');
  const audio = await input.getPrimaryAudioTrack();
  const durationSec = await input.computeDuration();
  if (durationSec > 180) throw new MediaError('Nesta versão de teste o vídeo pode ter no máximo 3 minutos.');
  return { input, video, audio, durationSec, width: video.displayWidth, height: video.displayHeight };
}
