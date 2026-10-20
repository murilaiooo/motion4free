import type { Caption, Segment, Word } from '../core/types';
import { outputToSource, sourceToOutput } from '../engine/timeline';

/**
 * Transcrição em parágrafo (editor de legendas da v0.10): as palavras na ordem da fala, agrupadas
 * por legenda, com as palavras que ficaram em trechos cortados entre elas (aparecem riscadas).
 * Camada pura: a tela só desenha o que esta função devolve.
 */

export interface TranscriptToken {
  text: string;
  /** início da palavra no vídeo editado */
  start: number;
}

export type TranscriptBlock =
  | { kind: 'caption'; id: string; start: number; end: number; text: string; tokens: TranscriptToken[]; edited: boolean }
  | { kind: 'cut'; key: string; srcStart: number; srcEnd: number; words: string[] };

function tokensOf(c: Caption): TranscriptToken[] {
  const parts = c.text.split(/\s+/).filter(Boolean);
  if (c.wordStarts.length === parts.length) return parts.map((text, i) => ({ text, start: c.wordStarts[i]! }));
  // texto corrigido: tempo distribuído pelo tamanho das palavras
  const total = parts.reduce((a, p) => a + p.length, 0) || 1;
  let acc = 0;
  return parts.map((text) => {
    const start = c.start + ((c.end - c.start) * acc) / total;
    acc += text.length;
    return { text, start };
  });
}

function originalText(c: Caption, byId: Map<string, Word>): string {
  return c.wordIds
    .map((id) => byId.get(id)?.text ?? '')
    .filter(Boolean)
    .join(' ');
}

export function buildTranscript(words: Word[], captions: Caption[], segments: Segment[]): TranscriptBlock[] {
  const byId = new Map(words.map((w) => [w.id, w]));
  const inCaption = new Set(captions.flatMap((c) => c.wordIds));
  const items: { at: number; block: TranscriptBlock }[] = [];

  for (const c of captions) {
    const first = c.wordIds.length ? byId.get(c.wordIds[0]!) : undefined;
    const at = first?.start ?? outputToSource(segments, c.start) ?? 0;
    const orig = originalText(c, byId);
    items.push({ at, block: { kind: 'caption', id: c.id, start: c.start, end: c.end, text: c.text, tokens: tokensOf(c), edited: orig !== '' && orig !== c.text } });
  }

  // palavras que caíram num corte, agrupadas quando seguidas
  let run: Word[] = [];
  const flush = () => {
    if (!run.length) return;
    const a = run[0]!;
    const b = run.at(-1)!;
    items.push({ at: a.start, block: { kind: 'cut', key: `x${a.id}`, srcStart: a.start, srcEnd: b.end, words: run.map((w) => w.text) } });
    run = [];
  };
  for (const w of [...words].sort((a, b) => a.start - b.start)) {
    const mid = (w.start + w.end) / 2;
    const cut = !inCaption.has(w.id) && sourceToOutput(segments, mid) === null;
    if (cut) run.push(w);
    else if (inCaption.has(w.id)) flush();
  }
  flush();

  return items.sort((x, y) => x.at - y.at || (x.block.kind === 'cut' ? -1 : 1)).map((i) => i.block);
}

/** Legenda e palavra faladas no instante `t` (tempo do vídeo editado). */
export function activeToken(blocks: TranscriptBlock[], t: number): { captionId: string; index: number } | null {
  for (const b of blocks) {
    if (b.kind !== 'caption' || t < b.start || t >= b.end) continue;
    let index = 0;
    b.tokens.forEach((tok, i) => {
      if (tok.start <= t) index = i;
    });
    return { captionId: b.id, index };
  }
  return null;
}

/** Páginas com até `perPage` legendas; a parte cortada fica com a legenda que vem depois dela. */
export function paginate(blocks: TranscriptBlock[], perPage: number): TranscriptBlock[][] {
  const pages: TranscriptBlock[][] = [[]];
  let count = 0;
  for (const b of blocks) {
    if (b.kind === 'caption') {
      if (count === perPage) {
        // move os cortes pendentes do fim da página para a próxima
        const cur = pages.at(-1)!;
        const tail: TranscriptBlock[] = [];
        while (cur.length && cur.at(-1)!.kind === 'cut') tail.unshift(cur.pop()!);
        pages.push(tail);
        count = 0;
      }
      count++;
    }
    pages.at(-1)!.push(b);
  }
  return pages;
}

export function pageOfCaption(pages: TranscriptBlock[][], captionId: string): number {
  return pages.findIndex((p) => p.some((b) => b.kind === 'caption' && b.id === captionId));
}
