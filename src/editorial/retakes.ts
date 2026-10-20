import { foldAccents, normalizeWord } from '../analysis/asr-merge';
import { clipLayout } from '../engine/clips';
import type { ClipRef, TimeRange, Word } from '../core/types';
import { sentencesOf } from './hooks';

/**
 * Tentativas repetidas e começos falsos (v0.14). Quem grava vários vídeos curtos costuma repetir a
 * mesma frase até sair boa ("Oi gente, hoje… / Oi gente, hoje eu vou mostrar três dicas"). Pela
 * transcrição, frases seguidas (no mesmo clipe ou no clipe seguinte) que são a mesma fala ficam só na
 * última tentativa completa. Puro, determinístico e testado (tests/retakes.test.ts). Nunca inventa nem
 * corta dentro de palavra: só tira frases inteiras.
 */

export type RetakeReason = 'repetida' | 'comeco-falso';

export interface Retake {
  /** pedaço tirado (original virtual) */
  start: number;
  end: number;
  reason: RetakeReason;
  /** frase tirada e a tentativa que ficou, para mostrar na tela */
  dropped: string;
  kept: string;
  clipId: string;
}

export interface RetakeOptions {
  /** quantas frases à frente procurar a nova tentativa */
  lookahead: number;
  /** semelhança mínima (subsequência comum / frase maior) para contar como a mesma frase */
  similarity: number;
  /** frases com menos palavras não contam como tentativa repetida ("Sim." "Sim." pode ser de propósito) */
  minWords: number;
  /** frase solta entre duas tentativas, até este tamanho, sai junto ("pera", "de novo") */
  fumbleWords: number;
  /** margem em volta da frase tirada (s), sem encostar nas palavras vizinhas */
  padSec: number;
}

export const DEFAULT_RETAKES: RetakeOptions = { lookahead: 2, similarity: 0.6, minWords: 3, fumbleWords: 3, padSec: 0.1 };

/** Palavra para comparar: sem pontuação, sem acento, minúsculas. */
export function retakeToken(text: string): string {
  return foldAccents(normalizeWord(text));
}

/** Tamanho da maior subsequência comum entre duas listas de palavras. */
export function lcs(a: readonly string[], b: readonly string[]): number {
  const prev = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]!;
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j]!, prev[j - 1]!);
      diag = up;
    }
  }
  return prev[b.length]!;
}

/** `a` é um começo falso de `b`: `b` começa com `a` (uma palavra diferente é tolerada em começos longos) e vai além. */
export function isFalseStart(a: readonly string[], b: readonly string[]): boolean {
  if (a.length < 2 || a.length >= b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  if (a[0] !== b[0]) return false;
  return diff === 0 || (a.length >= 4 && diff <= 1);
}

/** `a` e `b` são duas tentativas da mesma frase. */
export function isRepeat(a: readonly string[], b: readonly string[], opts: RetakeOptions = DEFAULT_RETAKES): boolean {
  if (Math.min(a.length, b.length) < opts.minWords) return false;
  const sim = lcs(a, b) / Math.max(a.length, b.length);
  if (sim < opts.similarity) return false;
  // começam do mesmo jeito (uma das duas primeiras palavras em comum)
  return a.slice(0, 2).some((w) => b.slice(0, 3).includes(w));
}

interface Sentence {
  words: Word[];
  tokens: string[];
  clipIndex: number;
  clipId: string;
}

/**
 * Frases a tirar, em ordem. Compara cada frase com as próximas (`lookahead`) no mesmo clipe ou no
 * seguinte; quando acha outra tentativa (repetida ou começo falso), a anterior sai e fica a última.
 */
export function findRetakes(words: readonly Word[], clips: readonly Pick<ClipRef, 'id' | 'duration'>[], opts: RetakeOptions = DEFAULT_RETAKES): Retake[] {
  const layout = clipLayout(clips);
  const sentences: Sentence[] = [];
  layout.forEach((l, clipIndex) => {
    const inClip = words.filter((w) => w.start >= l.start - 1e-6 && w.start < l.end - 1e-6).sort((a, b) => a.start - b.start);
    for (const s of sentencesOf(inClip)) {
      const tokens = s.words.map((w) => retakeToken(w.text)).filter(Boolean);
      if (tokens.length > 0) sentences.push({ words: s.words, tokens, clipIndex, clipId: l.id });
    }
  });
  const dropped = new Map<number, { reason: RetakeReason; kept: number }>();
  for (let i = 0; i < sentences.length; i++) {
    if (dropped.has(i)) continue;
    const a = sentences[i]!;
    for (let j = i + 1; j <= Math.min(sentences.length - 1, i + opts.lookahead); j++) {
      const b = sentences[j]!;
      if (b.clipIndex - a.clipIndex > 1) break;
      const reason: RetakeReason | null = isFalseStart(a.tokens, b.tokens) ? 'comeco-falso' : isRepeat(a.tokens, b.tokens, opts) ? 'repetida' : null;
      if (!reason) continue;
      dropped.set(i, { reason, kept: j });
      // frase curta solta entre as duas tentativas ("pera", "de novo") sai junto
      for (let k = i + 1; k < j; k++) if (sentences[k]!.tokens.length <= opts.fumbleWords) dropped.set(k, { reason, kept: j });
      break;
    }
  }
  const out: Retake[] = [];
  const all = [...words].sort((a, b) => a.start - b.start);
  for (const [i, d] of [...dropped].sort((x, y) => x[0] - y[0])) {
    const s = sentences[i]!;
    const l = layout[s.clipIndex]!;
    const first = s.words[0]!;
    const last = s.words.at(-1)!;
    const before = all.filter((w) => w.end <= first.start + 1e-6 && w.start >= l.start - 1e-6).at(-1);
    const after = all.find((w) => w.start >= last.end - 1e-6 && w.start < l.end - 1e-6 && !s.words.includes(w));
    const start = Math.max(l.start, before ? Math.min(first.start, (before.end + first.start) / 2) : first.start - opts.padSec, first.start - opts.padSec);
    const end = Math.min(l.end, after ? Math.max(last.end, (last.end + after.start) / 2) : last.end + opts.padSec, last.end + opts.padSec);
    out.push({ start: r3(start), end: r3(end), reason: d.reason, dropped: s.words.map((w) => w.text).join(' '), kept: sentences[d.kept]!.words.map((w) => w.text).join(' '), clipId: s.clipId });
  }
  return out;
}

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Intervalos (para tirar dos trechos mantidos) das frases repetidas. */
export function retakeCuts(retakes: readonly Retake[]): TimeRange[] {
  return retakes.map((r) => ({ start: r.start, end: r.end }));
}
