import type { EditPlan, TimeRange, Word } from '../core/types';
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
  words: Word[];
  silences: TimeRange[];
  /** Problemas que não impedem a edição (ex.: transcrição falhou → sem legendas). */
  warnings: AppError[];
}

/** Abre o vídeo e decodifica o áudio (usado na primeira análise e ao reabrir um projeto). */
export async function openWithAudio(file: Blob, onStep: (label: string, fraction: number) => void): Promise<{ media: OpenedMedia; audio: DecodedAudio | null }> {
  onStep('Abrindo o vídeo', 0);
  const media = await openMedia(file);
  if (!media.audio) return { media, audio: null };
  onStep('Lendo o áudio', 0);
  try {
    return { media, audio: await decodeAudio(media.audio, media.durationSec) };
  } catch (err) {
    throw toAppError(err, 'AUDIO_FALHOU');
  }
}

/** Passo a passo da edição automática: abrir -> áudio -> silêncios -> transcrição -> plano. */
export async function analyze(file: File, transcriber: Transcriber, onStep: (label: string, fraction: number) => void): Promise<Analysis> {
  const { media, audio } = await openWithAudio(file, onStep);
  if (!audio) {
    const plan = autoEdit(media.durationSec, [], []);
    return { media, audio: null, plan, words: [], silences: [], warnings: [new AppError('SEM_AUDIO', `${media.durationSec.toFixed(1)} s sem faixa de áudio`)] };
  }

  let mono: Float32Array;
  try {
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
  if (warnings.length === 0 && words.length === 0) warnings.push(new AppError('SEM_FALA', `${silences.length} silêncios em ${media.durationSec.toFixed(1)} s`));

  const plan = autoEdit(media.durationSec, silences, words);
  return { media, audio, plan, words, silences, warnings };
}
