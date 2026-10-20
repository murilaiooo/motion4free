import type { Word } from '../core/types';
import { groupPieces, toWords, type AsrChunk } from '../analysis/asr-merge';

export type { AsrChunk };

/**
 * Converte a saída do Whisper (chunks por palavra) em Words com ids estáveis.
 * Palavra nova começa com espaço; chunk sem espaço é pedaço da palavra anterior
 * ("cada" + "j" + "anela") e é colado nela, para a legenda nunca partir uma palavra.
 */
export function chunksToWords(chunks: AsrChunk[], durationSec: number): Word[] {
  return toWords(
    groupPieces(chunks)
      .map((w) => ({ text: w.text, start: Math.max(0, w.start), end: Math.min(durationSec, w.end) }))
      .filter((w) => w.end > w.start),
  );
}
