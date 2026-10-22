import { contextFlags } from './context-policy';
import type { Hook } from '../core/brief';
import type { HookStyle } from '../core/look';
import type { Word } from '../core/types';
import { isQuestion, keywordScore, parseNumberAt } from './detect';

/**
 * Ganchos: frases completas da própria fala que servem de abertura forte.
 * Nunca inventa texto: cada candidato é uma sequência de palavras transcritas, exatamente como faladas.
 * Fronteiras de frase: pontuação final (. ! ? …) ou pausa longa entre palavras.
 * Pontuação: pergunta, número, palavras fortes, exclamação, posição (começo do vídeo) e tamanho.
 */

export interface HookCandidate extends Hook {
  score: number;
  /** início no vídeo original (s) */
  start: number;
  /** por que foi sugerida (para mostrar na tela) */
  reasons: string[];
}

export const HOOK_PAUSE_SEC = 0.7;
export const HOOK_MAX_CHARS = 60;
export const HOOK_MIN_WORDS = 2;
export const HOOK_MAX_WORDS = 14;

/** Divide as palavras em frases por pontuação ou pausa. `byPause` marca a frase que terminou só por pausa. */
export function sentencesOf(words: Word[]): { words: Word[]; byPause: boolean }[] {
  const out: { words: Word[]; byPause: boolean }[] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    if (!w.text.trim()) return;
    cur.push(w);
    const next = words[i + 1];
    const punct = /[.!?…]["”']?$/.test(w.text.trim());
    const pause = !!next && next.start - w.end >= HOOK_PAUSE_SEC;
    if (punct || pause || !next) {
      out.push({ words: cur, byPause: !punct });
      cur = [];
    }
  });
  return out;
}

export function findHooks(words: Word[], max = 5): HookCandidate[] {
  const sentences = sentencesOf(words);
  const candidates: HookCandidate[] = [];
  sentences.forEach((s, idx) => {
    const toks = s.words.map((w) => w.text.trim());
    const text = toks.join(' ');
    // Keep full negations/conditions in a hook, but do not detach a referring sentence.
    if (contextFlags(text).includes('reference') || s.byPause) return;
    if (toks.length < HOOK_MIN_WORDS || toks.length > HOOK_MAX_WORDS || text.length > HOOK_MAX_CHARS) return;
    const reasons: string[] = [];
    let score = 0;
    if (isQuestion(toks)) {
      score += 3;
      reasons.push('pergunta');
    }
    if (toks.some((_, k) => parseNumberAt(toks, k) !== null)) {
      score += 2;
      reasons.push('número');
    }
    const strong = toks.filter((t) => keywordScore(t) >= 1).length;
    if (strong > 0) {
      score += Math.min(2, strong) * 1.5;
      reasons.push('palavra forte');
    }
    if (/!["”']?$/.test(toks.at(-1)!)) {
      score += 1;
      reasons.push('exclamação');
    }
    if (idx < 3) {
      score += (3 - idx) * 0.5;
      if (idx === 0) reasons.push('começo do vídeo');
    }
    if (toks.length >= 4 && toks.length <= 12) score += 1;
    if (toks.length < 3) score -= 1;
    if (s.byPause) score -= 0.5;
    candidates.push({ text, wordIds: s.words.map((w) => w.id), score: Math.round(score * 100) / 100, start: s.words[0]!.start, reasons });
  });
  return candidates.sort((a, b) => b.score - a.score || a.start - b.start).slice(0, max);
}

/**
 * Escolhe o gancho pelo estilo pedido, sempre entre os candidatos (frases faladas):
 * - auto/null: o de maior pontuação;
 * - pergunta / número / impacto: o melhor com essa característica (senão o melhor geral);
 * - criativo ("diferente", "diferenciado"): o melhor que NÃO é o óbvio — de preferência uma frase com
 *   outra característica que a do primeiro colocado, fora do começo do vídeo; com um só candidato, ele.
 */
export function pickHook(cands: HookCandidate[], style: HookStyle | null): HookCandidate | null {
  const best = cands[0] ?? null;
  if (!best || !style || style === 'auto') return best;
  const has = (r: string) => cands.find((c) => c.reasons.includes(r)) ?? best;
  if (style === 'pergunta') return has('pergunta');
  if (style === 'numero') return has('número');
  if (style === 'impacto') return cands.find((c) => c.reasons.includes('exclamação') || c.reasons.includes('palavra forte')) ?? best;
  const rest = cands.slice(1);
  const kind = (c: HookCandidate) => c.reasons.filter((r) => r !== 'começo do vídeo').sort().join('|');
  return rest.find((c) => kind(c) !== kind(best) && !c.reasons.includes('começo do vídeo')) ?? rest.find((c) => kind(c) !== kind(best)) ?? rest[0] ?? best;
}
