import type { EditPlan, Word } from '../core/types';
import { AppError, toAppError } from '../core/errors';
import { planAsrWindows } from '../analysis/asr-windows';
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
  /** Problemas que não impedem a edição (ex.: transcrição falhou → sem legendas). */
  warnings: AppError[];
}

/** Passo a passo da Fase 1: abrir -> áudio -> silêncios -> transcrição -> plano automático. */
export async function analyze(file: File, transcriber: Transcriber, onStep: (label: string, fraction: number) => void): Promise<Analysis> {
  onStep('Abrindo o vídeo', 0);
  const media = await openMedia(file);
  if (!media.audio) {
    const plan = autoEdit(media.durationSec, [], []);
    return { media, audio: null, plan, wordCount: 0, warnings: [] };
  }

  onStep('Lendo o áudio', 0);
  let audio: DecodedAudio;
  let mono: Float32Array;
  try {
    audio = await decodeAudio(media.audio, media.durationSec);
    mono = await toMono16k(audio);
  } catch (err) {
    throw toAppError(err, 'AUDIO_FALHOU');
  }

  onStep('Procurando silêncios', 0);
  const silences = findSilences(mono, 16000);

  // Sem transcrição o vídeo ainda pode ser cortado e exportado, só sem legendas e sem título.
  const warnings: AppError[] = [];
  let words: Word[] = [];
  try {
    words = await transcriber.transcribe(mono.slice(), media.durationSec, planAsrWindows(silences, media.durationSec), onStep);
  } catch (err) {
    warnings.push(toAppError(err, 'TRANSCRICAO_FALHOU'));
  }

  const plan = autoEdit(media.durationSec, silences, words);
  return { media, audio, plan, wordCount: words.length, warnings };
}
