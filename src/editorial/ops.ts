import { AppError } from '../core/errors';
import type { Caption, EditPlan, Segment, TimeRange, Word } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { buildCaptions } from './captions';

/**
 * Operações de edição da Fase 2. Todas são puras: recebem um plano e devolvem outro
 * (ou o mesmo objeto quando nada muda, para não criar entrada vazia no histórico).
 */

/** Dados que não mudam durante a edição e que as operações precisam consultar. */
export interface EditContext {
  durationSec: number;
  words: Word[];
}

/** Menor trecho mantido entre dois cortes, e menor corte que vale a pena manter. */
export const MIN_KEEP_SEC = 0.1;
export const MIN_CUT_SEC = 0.05;
const EPS = 0.0005;
const MAX_CAPTION_CHARS = 120;

const ms = (x: number) => Math.round(x * 1000) / 1000;

/** Cortes = partes do original fora de todos os trechos mantidos, em ordem. */
export function listCuts(segments: Segment[], durationSec: number): TimeRange[] {
  const cuts: TimeRange[] = [];
  let cursor = 0;
  for (const s of segments) {
    if (s.srcStart - cursor > EPS) cuts.push({ start: cursor, end: s.srcStart });
    cursor = Math.max(cursor, s.srcEnd);
  }
  if (durationSec - cursor > EPS) cuts.push({ start: cursor, end: durationSec });
  return cuts;
}

/** Inverso de listCuts: os trechos mantidos são o que sobra entre os cortes. */
export function segmentsFromCuts(cuts: TimeRange[], durationSec: number): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const c of [...cuts].sort((a, b) => a.start - b.start)) {
    if (c.start - cursor > EPS) segments.push({ srcStart: ms(cursor), srcEnd: ms(c.start) });
    cursor = Math.max(cursor, c.end);
  }
  if (durationSec - cursor > EPS) segments.push({ srcStart: ms(cursor), srcEnd: ms(durationSec) });
  return segments;
}

/**
 * Troca os trechos mantidos e reconstrói as legendas pelas palavras.
 * Legenda cujo grupo de palavras não mudou mantém o texto editado.
 */
export function withSegments(plan: EditPlan, ctx: EditContext, segments: Segment[]): EditPlan {
  if (segments.length === 0) throw new AppError('CORTE_TOTAL');
  const edited = new Map(plan.captions.map((c) => [c.wordIds.join('|'), c.text]));
  const captions: Caption[] = buildCaptions(ctx.words, segments).map((c) => {
    const text = edited.get(c.wordIds.join('|'));
    return text === undefined ? c : { ...c, text };
  });
  const total = outputDuration(segments);
  const scenes = plan.scenes.map((s) => ({ ...s, end: Math.min(s.end, total) })).filter((s) => s.end > s.start);
  return { ...plan, segments, captions, scenes };
}

/**
 * Muda início/fim do corte `index`. O corte não pode encostar nos cortes vizinhos
 * (sobra sempre um trecho de MIN_KEEP_SEC entre eles); corte menor que MIN_CUT_SEC some.
 */
export function adjustCut(plan: EditPlan, ctx: EditContext, index: number, range: TimeRange): EditPlan {
  const cuts = listCuts(plan.segments, ctx.durationSec);
  if (!cuts[index]) return plan;
  const prev = cuts[index - 1];
  const next = cuts[index + 1];
  const lower = prev ? prev.end + MIN_KEEP_SEC : 0;
  const upper = next ? next.start - MIN_KEEP_SEC : ctx.durationSec;
  const clamp = (x: number) => ms(Math.min(upper, Math.max(lower, x)));
  const start = clamp(Math.min(range.start, range.end));
  const end = clamp(Math.max(range.start, range.end));
  const others = cuts.filter((_, i) => i !== index);
  const updated = end - start >= MIN_CUT_SEC ? [...others, { start, end }] : others;
  return withSegments(plan, ctx, segmentsFromCuts(updated, ctx.durationSec));
}

/** Devolve ao vídeo o trecho cortado `index`. */
export function restoreCut(plan: EditPlan, ctx: EditContext, index: number): EditPlan {
  const cuts = listCuts(plan.segments, ctx.durationSec);
  if (!cuts[index]) return plan;
  return withSegments(
    plan,
    ctx,
    segmentsFromCuts(
      cuts.filter((_, i) => i !== index),
      ctx.durationSec,
    ),
  );
}

/** Corrige o texto de uma legenda. Vazio é M4F-501; acima de 120 caracteres, M4F-502. */
export function editCaptionText(plan: EditPlan, captionId: string, text: string): EditPlan {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) throw new AppError('LEGENDA_VAZIA');
  if (clean.length > MAX_CAPTION_CHARS) throw new AppError('LEGENDA_LONGA', `${clean.length} caracteres`);
  const target = plan.captions.find((c) => c.id === captionId);
  if (!target || target.text === clean) return plan;
  return { ...plan, captions: plan.captions.map((c) => (c.id === captionId ? { ...c, text: clean } : c)) };
}
