import type { Word } from '../core/types';

export interface AsrChunk {
  text: string;
  timestamp: [number, number | null];
}

/**
 * Converte a saída do Whisper (chunks por palavra) em Words com ids estáveis.
 * Palavra nova começa com espaço; chunk sem espaço é pedaço da palavra anterior
 * ("cada" + "j" + "anela") e é colado nela, para a legenda nunca partir uma palavra.
 */
export function chunksToWords(chunks: AsrChunk[], durationSec: number): Word[] {
  const words: Word[] = [];
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text) continue;
    const start = Math.max(0, c.timestamp[0]);
    const end = Math.min(durationSec, c.timestamp[1] ?? start + 0.3);
    const prev = words[words.length - 1];
    if (prev && !/^\s/.test(c.text)) {
      prev.text += text;
      prev.end = Math.max(prev.end, end);
      continue;
    }
    if (end <= start) continue;
    words.push({ id: `w${words.length + 1}`, text, start, end });
  }
  return words;
}
