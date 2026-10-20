import type { TimeRange, Word } from '../core/types';
import type { AsrWindow } from './asr-windows';

/** Saída crua do Whisper por palavra (ou pedaço de palavra), em segundos da janela. */
export interface AsrChunk {
  text: string;
  timestamp: [number, number | null];
}

export interface RawWord {
  text: string;
  start: number;
  end: number;
}

/** Palavra para comparar: minúsculas, sem pontuação, acentos mantidos ("é" ≠ "e"). */
export function normalizeWord(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export function foldAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}+/gu, '');
}

/**
 * Junta os pedaços do Whisper em palavras. Palavra nova começa com espaço; pedaço sem espaço
 * ("cada" + "j" + "anela") é colado na anterior, para a legenda nunca partir uma palavra.
 * `firstIsNew`: o primeiro pedaço é palavra nova mesmo sem espaço (início de janela).
 */
export function groupPieces(chunks: AsrChunk[], offset = 0, firstIsNew = true): RawWord[] {
  const words: RawWord[] = [];
  for (const [i, c] of chunks.entries()) {
    const text = c.text.trim();
    if (!text) continue;
    const start = c.timestamp[0] + offset;
    const end = c.timestamp[1] === null ? start + 0.3 : c.timestamp[1] + offset;
    const prev = words[words.length - 1];
    const isNew = /^\s/.test(c.text) || (firstIsNew && i === 0);
    if (prev && !isNew) {
      prev.text += text;
      prev.end = Math.max(prev.end, end);
      continue;
    }
    words.push({ text, start, end });
  }
  return words;
}

export interface WindowResult {
  window: AsrWindow;
  chunks: AsrChunk[];
}

/**
 * Junta as janelas numa transcrição só, em segundos do vídeo.
 * Cada janela ouviu uma folga de cada lado (`feed`), mas só responde pelas palavras cujo meio cai
 * no seu pedaço (`own`): a palavra da junção entra uma vez só. Se mesmo assim a mesma palavra aparecer
 * dos dois lados da junção (tempos estimados diferentes), a repetida sai.
 */
export function mergeWindows(results: WindowResult[], durationSec: number): RawWord[] {
  const out: RawWord[] = [];
  const last = results.length - 1;
  for (const [i, { window, chunks }] of results.entries()) {
    const { own, feed } = window;
    const words = groupPieces(chunks, feed.start).filter((w) => {
      const mid = (w.start + w.end) / 2;
      return mid >= own.start && (i === last ? mid <= own.end + 0.5 : mid < own.end);
    });
    for (const [k, w] of words.entries()) {
      const prev = out[out.length - 1];
      // Só na junção: a primeira palavra desta janela igual à última da anterior, no mesmo instante.
      if (k === 0 && prev && normalizeWord(prev.text) === normalizeWord(w.text) && w.start < prev.end + 0.15) continue;
      out.push({ text: w.text, start: Math.max(0, w.start), end: Math.min(durationSec, w.end) });
    }
  }
  return out.filter((w) => w.end > w.start);
}

export function toWords(raw: RawWord[]): Word[] {
  return raw.map((w, i) => ({ id: `w${i + 1}`, text: w.text, start: w.start, end: w.end }));
}

// ---------------------------------------------------------------------------------------------
// Limpeza: alucinações típicas do Whisper

/** Frases que o Whisper inventa no silêncio (vêm de legendas de vídeos usadas no treino). Sempre saem. */
const ALWAYS_HALLUCINATION: string[][] = [
  ['legendas', 'pela', 'comunidade', 'amaraorg'],
  ['legendas', 'pela', 'comunidade', 'amara', 'org'],
  ['legenda', 'pela', 'comunidade', 'amaraorg'],
  ['amaraorg'],
  ['legenda', 'adriana', 'zanotto'],
  ['legendas', 'adriana', 'zanotto'],
  ['subtitles', 'by', 'the', 'amaraorg', 'community'],
  ['subtitles', 'by'],
  ['legendas', 'em', 'português', 'brasileiro'],
];

/** Frases que podem ser fala de verdade: só saem quando caem quase todas dentro de um silêncio. */
const SILENCE_HALLUCINATION: string[][] = [
  ['obrigado', 'por', 'assistir'],
  ['obrigada', 'por', 'assistir'],
  ['obrigado', 'por', 'assistirem'],
  ['inscrevase', 'no', 'canal'],
  ['legendado', 'por'],
  ['legendas', 'por'],
  ['tchau', 'tchau'],
  ['obrigado'],
  ['tchau'],
];

/** Marcação de som, não fala: "♪", "[Música]", "(risos)", "*aplausos*". */
function isNonSpeech(text: string): boolean {
  const t = text.trim();
  return /♪|♫/.test(t) || /^[[(*].*[\])*][.,!?]*$/.test(t) || normalizeWord(t) === '';
}

function matchAt(norm: string[], i: number, pattern: string[]): boolean {
  return pattern.every((p, k) => norm[i + k] === p);
}

/** Remove sequências de alucinação; `inSilence(a, b)` diz se as palavras a..b-1 caem num silêncio. */
export function removeHallucinations(words: RawWord[], silences: TimeRange[]): RawWord[] {
  const kept = words.filter((w) => !isNonSpeech(w.text));
  const norm = kept.map((w) => normalizeWord(w.text));
  const drop = new Set<number>();
  for (let i = 0; i < kept.length; i++) {
    for (const p of ALWAYS_HALLUCINATION) {
      if (matchAt(norm, i, p)) for (let k = 0; k < p.length; k++) drop.add(i + k);
    }
    for (const p of SILENCE_HALLUCINATION) {
      if (!matchAt(norm, i, p)) continue;
      const span = { start: kept[i]!.start, end: kept[i + p.length - 1]!.end };
      if (silentFractionOf(span, silences) >= 0.6) for (let k = 0; k < p.length; k++) drop.add(i + k);
    }
  }
  return kept.filter((_, i) => !drop.has(i));
}

function silentFractionOf(range: TimeRange, silences: TimeRange[]): number {
  const len = range.end - range.start;
  if (len <= 0) return 0;
  let covered = 0;
  for (const s of silences) covered += Math.max(0, Math.min(s.end, range.end) - Math.max(s.start, range.start));
  return covered / len;
}

/**
 * Laço de repetição ("e aí e aí e aí e aí…"): o Whisper às vezes repete a mesma frase várias vezes.
 * Uma palavra repetida 4+ vezes seguidas, ou um grupo de 2 a 8 palavras repetido 3+ vezes seguidas,
 * fica uma vez só. "não, não, não" (3 vezes) é fala normal e fica.
 */
export function collapseLoops(words: RawWord[]): RawWord[] {
  let cur = words;
  for (let n = 8; n >= 1; n--) {
    const minRepeats = n === 1 ? 4 : 3;
    const norm = cur.map((w) => normalizeWord(w.text));
    const out: RawWord[] = [];
    let i = 0;
    while (i < cur.length) {
      let reps = 1;
      if (i + 2 * n <= cur.length) {
        while (i + (reps + 1) * n <= cur.length && norm.slice(i, i + n).every((t, k) => t === norm[i + reps * n + k])) reps++;
      }
      if (reps >= minRepeats) {
        out.push(...cur.slice(i, i + n).map((w, k) => (k === n - 1 ? { ...w, end: Math.max(w.end, Math.min(cur[i + reps * n - 1]!.end, w.end + 0.6)) } : w)));
        i += reps * n;
      } else {
        out.push(cur[i]!);
        i++;
      }
    }
    cur = out;
  }
  return cur;
}

/**
 * Janela com cara de laço ou de texto inventado: muitas palavras por segundo, ou o laço tomou boa parte
 * do texto. O Worker transcreve essa janela de novo proibindo repetições (no_repeat_ngram_size).
 */
export function looksDegenerate(words: RawWord[], speechSec: number): boolean {
  if (words.length < 8) return false;
  const collapsed = collapseLoops(words).length;
  return words.length / Math.max(1, speechSec) > 6 || collapsed / words.length < 0.75;
}

/**
 * Acerta o tempo das palavras com os silêncios medidos no áudio. O alinhamento do Whisper às vezes estica
 * a última palavra antes de uma pausa até o fim da pausa, ou começa a primeira palavra cedo demais; aí a
 * legenda aparece antes da voz ou fica na tela depois dela. A palavra é recortada para fora do silêncio,
 * com uma margem (consoantes finais são baixas e caem abaixo do limiar).
 */
export function snapToSpeech(words: RawWord[], silences: TimeRange[], margin = 0.08, minDur = 0.12): RawWord[] {
  const out = words.map((w) => ({ ...w }));
  for (const w of out) {
    for (const s of silences) {
      if (s.end <= w.start || s.start >= w.end) continue;
      const before = s.start - w.start; // parte da palavra antes do silêncio
      const after = w.end - s.end; // parte depois
      if (before <= 0 && after <= 0) continue; // palavra toda dentro do silêncio: fala baixa, fica como está
      if (after <= 0) w.end = Math.max(w.start + minDur, Math.min(w.end, s.start + margin));
      else if (before <= 0) w.start = Math.min(w.end - minDur, Math.max(w.start, s.end - margin));
      else if (before >= after) w.end = Math.max(w.start + minDur, s.start + margin);
      else w.start = Math.min(w.end - minDur, s.end - margin);
    }
  }
  // Ordem e sem sobreposição: uma palavra termina quando a próxima começa.
  for (let i = 1; i < out.length; i++) {
    const prev = out[i - 1]!;
    const w = out[i]!;
    if (w.start < prev.start) w.start = prev.start;
    if (prev.end > w.start) prev.end = Math.max(prev.start + 0.01, w.start);
    if (w.end <= w.start) w.end = w.start + minDur;
  }
  return out;
}

/** Limpeza completa depois da junção das janelas. */
export function cleanTranscript(words: RawWord[], silences: TimeRange[]): RawWord[] {
  return snapToSpeech(collapseLoops(removeHallucinations(words, silences)), silences);
}
