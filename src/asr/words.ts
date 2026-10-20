import type { Word } from '../core/types';

export interface AsrChunk {
  text: string;
  timestamp: [number, number | null];
}

/** Converte a saída do Whisper (chunks por palavra) em Words com ids estáveis. */
export function chunksToWords(chunks: AsrChunk[], durationSec: number): Word[] {
  const words: Word[] = [];
  for (const c of chunks) {
    const text = c.text.trim();
    if (!text) continue;
    const start = Math.max(0, c.timestamp[0]);
    const end = Math.min(durationSec, c.timestamp[1] ?? start + 0.3);
    if (end <= start) continue;
    words.push({ id: `w${words.length + 1}`, text, start, end });
  }
  return words;
}
