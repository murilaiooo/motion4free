import { AppError } from '../core/errors';
import type { EditPlan, SemanticWordCue, Word } from '../core/types';
import { scheduleSemanticCues, type ScheduledSemanticCue } from './semantic-cues';

/** Deep, pure seam shared by UI, preview and export (no browser or AI involved).
 * Source words are immutable snapshots; original transcriptions remain in SavedProject.
 * Words removed by trimming are not scheduled. Copied segments get one occurrence each.
 */
export interface ScheduledWordCue extends ScheduledSemanticCue { text: string; effect: NonNullable<SemanticWordCue['effect']> }

const MAX_CUES = 60;
const cache = new WeakMap<EditPlan, ScheduledWordCue[]>();
const approx = (a: number, b: number) => Math.abs(a - b) < 0.0005;
const sourceExists = (p: EditPlan, w: Word) =>
  p.captions.some(c => c.wordIds.includes(w.id)) &&
  w.start >= 0 && w.end > w.start && w.end - w.start <= 10 &&
  w.end <= p.clips.reduce((sum, clip) => sum + clip.duration, 0) + 0.01 &&
  !!w.id && w.id.length <= 200 && !!w.text.trim() && w.text.trim().length <= 30;
const nextId = (cues: readonly SemanticWordCue[]) =>
  'sw' + (Math.max(0, ...cues.map(c => Number(c.id.slice(2)) || 0)) + 1);

function unlocked(p: EditPlan, w: Word): boolean {
  // Locked editing ranges must not change after explicit manual approval.
  const schedule = scheduleSemanticCues([w], p.segments,
    [{ id: 'probe', wordId: w.id, edge: 'start', durationFrames: 1, offsetFrames: 0 }], p.output.fps);
  return schedule.every(hit =>
    !p.ranges.some(r => r.locked && r.out.start < hit.endFrameExclusive / p.output.fps &&
      r.out.end > hit.startFrame / p.output.fps));
}

function checkedWord(plan: EditPlan, word: Word) {
  if (!sourceExists(plan, word)) throw new AppError('PALAVRA_SEM_ANCORA');
  if (!unlocked(plan, word)) throw new AppError('TRECHO_TRAVADO');
}

/** User action: highlight a verified, spoken word (no implicit generation). */
export function addSemanticWord(plan: EditPlan, word: Word): EditPlan {
  checkedWord(plan, word);
  const existing = plan.semanticCues ?? [];
  if (existing.some(c => c.wordId === word.id && approx(c.source.start, word.start))) return plan;
  if (existing.length >= MAX_CUES) throw new AppError('LIMITE_DESTAQUES');
  return { ...plan, semanticCues: [...existing, {
    id: nextId(existing), wordId: word.id, source: { ...word, text: word.text.trim() },
    edge: 'start', offsetFrames: 0,
    durationFrames: Math.max(3, Math.min(30, Math.round(plan.output.fps * Math.max(0.18, word.end - word.start)))),
  }] };
}

/** The same stored event can be explicitly reassigned; old selection is untouched. */
export function reanchorSemanticWord(plan: EditPlan, cueId: string, word: Word): EditPlan {
  const cues = plan.semanticCues ?? [];
  const current = cues.find(c => c.id === cueId);
  if (!current) throw new AppError('PALAVRA_SEM_ANCORA');
  checkedWord(plan, current.source);
  checkedWord(plan, word);
  if (cues.some(c => c.id !== cueId && c.wordId === word.id && approx(c.source.start, word.start)))
    throw new AppError('PALAVRA_SEM_ANCORA', 'A palavra já tem destaque.');
  if (current.wordId === word.id && approx(current.source.start, word.start)) return plan;
  return { ...plan, semanticCues: cues.map(c => c.id === cueId
    ? { ...c, wordId: word.id, source: { ...word, text: word.text.trim() } } : c) };
}

export function removeSemanticWord(plan: EditPlan, cueId: string): EditPlan {
  const cues = plan.semanticCues ?? [];
  const original = cues.find(c => c.id === cueId);
  if (!original) return plan;
  if (!unlocked(plan, original.source)) throw new AppError('TRECHO_TRAVADO');
  return { ...plan, semanticCues: cues.filter(c => c.id !== cueId) };
}

/** Apply a bounded manual frame offset; no changes to the transcript or cut. */
export function offsetSemanticWord(plan: EditPlan, cueId: string, offsetFrames: number): EditPlan {
  if (!Number.isSafeInteger(offsetFrames) || offsetFrames < -30 || offsetFrames > 30)
    throw new AppError('EDICAO_INVALIDA', 'Deslocamento deve ficar entre -30 e 30 quadros.');
  const cue = plan.semanticCues?.find(c => c.id === cueId);
  if (!cue) throw new AppError('PALAVRA_SEM_ANCORA');
  if (!unlocked(plan, cue.source)) throw new AppError('TRECHO_TRAVADO');
  if (cue.offsetFrames === offsetFrames) return plan;
  return { ...plan, semanticCues: plan.semanticCues!.map(c => c.id === cueId ? { ...c, offsetFrames } : c) };
}

/** Choose a bounded visual treatment for a word without changing its timestamp. */
export function setSemanticWordEffect(plan: EditPlan, cueId: string, effect: NonNullable<SemanticWordCue['effect']>): EditPlan {
  if (effect !== 'emphasis' && effect !== 'underline' && effect !== 'pulse')
    throw new AppError('EDICAO_INVALIDA', 'Movimento visual desconhecido.');
  const cue = plan.semanticCues?.find(c => c.id === cueId);
  if (!cue) throw new AppError('PALAVRA_SEM_ANCORA');
  if (!unlocked(plan, cue.source)) throw new AppError('TRECHO_TRAVADO');
  if ((cue.effect ?? 'emphasis') === effect) return plan;
  return { ...plan, semanticCues: plan.semanticCues!.map(c => c.id === cueId
    ? { ...c, effect } : c) };
}

/** Pure projection cached by immutable EditPlan identity. */
export function scheduledPlanCues(plan: EditPlan): ScheduledWordCue[] {
  const cached = cache.get(plan);
  if (cached) return cached;
  const cues = plan.semanticCues ?? [];
  if (!cues.length) return [];
  const sources = [...new Map(cues.map(c => [c.wordId, c.source] as const)).values()];
  const byCue = new Map(cues.map(c => [c.id, c] as const));
  const projected = scheduleSemanticCues(sources, plan.segments, cues, plan.output.fps)
    .map(hit => ({ ...hit, text: byCue.get(hit.cueId)!.source.text, effect: byCue.get(hit.cueId)!.effect ?? 'emphasis' }));
  cache.set(plan, projected);
  return projected;
}

/** Frame-quantized, range-safe active events. Both preview and export invoke this. */
export function activeSemanticCues(plan: EditPlan, t: number): ScheduledWordCue[] {
  if (!Number.isFinite(t) || t < 0) return [];
  if (plan.ranges.some(r => (r.quiet || r.locked) && r.out.start <= t && t < r.out.end)) return [];
  const f = Math.floor(t * plan.output.fps + 1e-7);
  return scheduledPlanCues(plan).filter(c => c.startFrame <= f && f < c.endFrameExclusive);
}
export function activeSemanticWords(plan: EditPlan, t: number): string[] {
  return activeSemanticCues(plan, t).map(c => c.text);
}

const QUALIFIER = /^(nao|nunca|jamais|nem|sem|se|caso|talvez|not|never|no|without|if|unless)$/;
const plain = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * #117: sugere palavras fortes da própria fala para destacar (no máximo `max`, uma a cada `minGapSec`).
 * Só palavras confirmadas na legenda; nunca depois de "não"/"se" na mesma frase (para não destacar a
 * parte negada como afirmação). A pessoa pode remover qualquer uma; desfazer volta tudo.
 */
export function suggestSemanticWords(plan: EditPlan, words: readonly Word[], score: (raw: string) => number, max = 8, minGapSec = 4): Word[] {
  const byId = new Map(words.map(w => [w.id, w]));
  const blocked = new Set<string>();
  // Por frase (do início até o ponto final), não por legenda: a legenda pode quebrar no meio da frase.
  let after = false;
  for (const id of plan.captions.flatMap(c => c.wordIds)) {
    const w = byId.get(id);
    if (!w) continue;
    if (after) blocked.add(id);
    if (QUALIFIER.test(plain(w.text))) after = true;
    if (/[.!?…]["”']?$/.test(w.text.trim())) after = false;
  }
  const taken = new Set((plan.semanticCues ?? []).map(c => c.wordId));
  const candidates = plan.captions.flatMap(c => c.wordIds).map(id => byId.get(id)).filter((w): w is Word =>
    !!w && !blocked.has(w.id) && !taken.has(w.id) && score(w.text) >= 1 &&
    plan.segments.some(s => w.start >= s.srcStart - 1e-6 && w.end <= s.srcEnd + 1e-6));
  const chosen: Word[] = [];
  for (const w of [...candidates].sort((a, b) => score(b.text) - score(a.text) || a.start - b.start)) {
    if (chosen.length >= max) break;
    if (chosen.some(c => Math.abs(c.start - w.start) < minGapSec)) continue;
    try { checkedWord(plan, w); chosen.push(w); } catch { /* trecho travado ou palavra inválida: pula */ }
  }
  return chosen.sort((a, b) => a.start - b.start);
}
