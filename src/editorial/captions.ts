import type { Caption, Segment, Word } from '../core/types';
import type { StyleDNA } from '../core/style';
import { placeSpan } from '../engine/timeline';
import { SENTENCE_END, visualLength, wordWeight } from '../core/languages';

export interface CaptionOptions {
  maxChars: number;
  maxDurationSec: number;
  maxWords: number;
}

export const DEFAULT_CAPTIONS: CaptionOptions = { maxChars: 22, maxDurationSec: 1.6, maxWords: 8 };

/** Cada estilo tem seu tamanho de legenda (Pop: 3 palavras; Documental: frases maiores). */
export function captionOptionsFor(style: StyleDNA): CaptionOptions {
  return { maxChars: style.captions.maxChars, maxWords: style.captions.maxWords, maxDurationSec: Math.max(1.2, style.captions.maxWords * 0.45) };
}

/** Agrupa palavras em legendas curtas (estilo Reels) já no tempo do vídeo editado. */
export function buildCaptions(words: Word[], segments: Segment[], opts: CaptionOptions = DEFAULT_CAPTIONS): Caption[] {
  // cada vez que a palavra aparece no vídeo editado (um pedaço colado de novo repete a fala dele)
  const placed = words
    .flatMap((w) => placeSpan(segments, w.start, Math.max(w.start, w.end - 1e-3)).map((o) => ({ ...w, start: o.start, end: o.end + 1e-3 })))
    .sort((a, b) => a.start - b.start);

  const captions: Caption[] = [];
  let group: Word[] = [];
  const flush = () => {
    if (group.length === 0) return;
    captions.push({
      id: `c${captions.length + 1}`,
      text: group.map((g) => g.text.trim()).join(' '),
      start: group[0]!.start,
      end: group[group.length - 1]!.end,
      wordIds: group.map((g) => g.id),
      wordStarts: group.map((g) => g.start),
    });
    group = [];
  };

  // palavras e letras contadas como aparecem na tela (chinês: caractere vale meia palavra e duas letras)
  const weightOf = (g: Word[]) => g.reduce((n, x) => n + wordWeight(x.text), 0);
  placed.forEach((w, k) => {
    const text = [...group, w].map((g) => g.text.trim()).join(' ');
    const len = visualLength(text);
    const count = weightOf(group);
    // a última palavra da frase (ou da fala) não fica sozinha numa legenda: cabe uma a mais
    const closes = SENTENCE_END.test(w.text.trim()) || k === placed.length - 1;
    // vale tanto para o limite de palavras quanto para o de letras ("Três dicas | rápidas." virava uma palavra sozinha)
    const slack = count === opts.maxWords ? 8 : Math.max(4, Math.ceil(opts.maxChars * 0.2));
    const orphanSaved = closes && group.length > 0 && count <= opts.maxWords && len <= opts.maxChars + slack;
    const tooLong = !orphanSaved && (len > opts.maxChars || count >= opts.maxWords);
    const tooSlow = group.length > 0 && w.end - group[0]!.start > opts.maxDurationSec;
    const gap = group.length > 0 && w.start - group[group.length - 1]!.end > 0.6;
    if (group.length > 0 && (tooLong || tooSlow || gap)) flush();
    group.push(w);
    if (SENTENCE_END.test(w.text.trim())) flush();
  });
  flush();
  return captions;
}
