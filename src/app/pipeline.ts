import type { EditPlan } from '../core/types';
import { findSilences } from '../analysis/silence';
import { autoEdit } from '../editorial/auto-edit';
import { decodeAudio, toMono16k, type DecodedAudio } from '../media/audio';
import { openMedia, type OpenedMedia } from '../media/input';
import type { Transcriber } from '../asr/transcriber';

export interface Analysis {
  media: OpenedMedia;
  audio: DecodedAudio | null;
  plan: EditPlan;
  wordCount: number;
}

/** Passo a passo da Fase 1: abrir -> áudio -> silêncios -> transcrição -> plano automático. */
export async function analyze(file: File, transcriber: Transcriber, onStep: (label: string, fraction: number) => void): Promise<Analysis> {
  onStep('Abrindo o vídeo', 0);
  const media = await openMedia(file);
  if (!media.audio) {
    const plan = autoEdit(media.durationSec, [], []);
    return { media, audio: null, plan, wordCount: 0 };
  }
  onStep('Lendo o áudio', 0);
  const audio = await decodeAudio(media.audio, media.durationSec);
  const mono = await toMono16k(audio);
  onStep('Procurando silêncios', 0);
  const silences = findSilences(mono, 16000);
  const words = await transcriber.transcribe(mono.slice(), media.durationSec, onStep);
  const plan = autoEdit(media.durationSec, silences, words);
  return { media, audio, plan, wordCount: words.length };
}
