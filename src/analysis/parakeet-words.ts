import type { AsrChunk } from './asr-merge';

/** Palavra como o parakeet.js devolve com `returnTimestamps: true` (segundos do trecho ouvido). */
export interface ParakeetWord {
  text: string;
  start_time: number;
  end_time: number;
  confidence?: number;
}

/**
 * Converte as palavras do Parakeet no mesmo formato que o Whisper entrega ao resto do app (`AsrChunk`).
 * Cada palavra do Parakeet já é inteira, então ganha o espaço da frente (`groupPieces` trata espaço como
 * "palavra nova" e nunca cola duas palavras do Parakeet). Tempo inválido vira um intervalo curto e
 * válido no lugar de sumir com a palavra; palavra vazia sai.
 */
export function parakeetWordsToChunks(words: readonly ParakeetWord[]): AsrChunk[] {
  const out: AsrChunk[] = [];
  let lastEnd = 0;
  for (const w of words) {
    const text = (w.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = Number.isFinite(w.start_time) && w.start_time >= 0 ? w.start_time : lastEnd;
    const end = Number.isFinite(w.end_time) && w.end_time > start ? w.end_time : start + 0.3;
    out.push({ text: ` ${text}`, timestamp: [start, end] });
    lastEnd = end;
  }
  return out;
}
