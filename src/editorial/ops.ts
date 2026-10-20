import { AppError } from '../core/errors';
import type { Caption, EditPlan, Segment, TimeRange, Word } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { clipJoins, splitAtClips } from '../engine/clips';
import { presetById } from '../core/presets';
import type { StyleDNA } from '../core/style';
import type { CreativeBrief, Hook } from '../core/brief';
import { applyLook, effectiveForbid, sceneOptionsFor, styleForBrief } from './brief-apply';
import { retimeCuts } from './cuts';
import { buildCaptions, captionOptionsFor } from './captions';
import { findHooks, pickHook } from './hooks';
import { proposeScenes } from './selector';
import type { RangeRequest } from './range-interpret';
import { applyRangeRequest, assertCaptionEditable, assertSegmentsKeepLocks, reapplyRanges, type RangeTarget } from './ranges';
import { applyReference } from './reference';
import type { ReferencePalette } from '../core/types';

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

/** Legendas pelas palavras, no tamanho do estilo; texto corrigido volta quando o grupo de palavras é o mesmo. */
function rebuildCaptions(plan: EditPlan, ctx: EditContext, segments: Segment[], style: StyleDNA): Caption[] {
  const edited = new Map(plan.captions.map((c) => [c.wordIds.join('|'), c.text]));
  return buildCaptions(ctx.words, segments, captionOptionsFor(style)).map((c) => {
    const text = edited.get(c.wordIds.join('|'));
    return text === undefined ? c : { ...c, text };
  });
}

/**
 * Cenas são derivadas (palavras + trechos + estilo) enquanto não há edição manual de cenas.
 * Sem palavras (transcrição falhou ou projeto antigo sem cenas novas), mantém as cenas que existem, recortadas.
 */
function rebuildScenes(plan: EditPlan, ctx: EditContext, segments: Segment[], style: StyleDNA, brief: CreativeBrief = plan.brief): EditPlan['scenes'] {
  if (ctx.words.length > 0) return proposeScenes(ctx.words, segments, style, { ...sceneOptionsFor(brief), joins: clipJoins(segments, plan.clips) });
  const total = outputDuration(segments);
  return plan.scenes.map((s) => ({ ...s, end: Math.min(s.end, total) })).filter((s) => s.end > s.start);
}

/**
 * Troca os trechos mantidos e reconstrói legendas e cenas pelas palavras.
 * Legenda cujo grupo de palavras não mudou mantém o texto editado.
 */
export function withSegments(plan: EditPlan, ctx: EditContext, input: Segment[]): EditPlan {
  // um trecho nunca atravessa dois clipes (v0.14): a emenda entre arquivos é sempre uma emenda do plano
  const segments = splitAtClips(input, plan.clips);
  if (segments.length === 0) throw new AppError('CORTE_TOTAL');
  assertSegmentsKeepLocks(plan, segments);
  return reapplyRanges({ ...plan, segments, captions: rebuildCaptions(plan, ctx, segments, plan.style), scenes: rebuildScenes(plan, ctx, segments, plan.style) }, ctx.words);
}

/** Estilo do vídeo: preset ajustado pelo pedido, pelas cores da imagem de referência e pelo look (que vale mais). */
export function planStyle(preset: StyleDNA, brief: CreativeBrief, reference: ReferencePalette | null): StyleDNA {
  return applyLook(applyReference(styleForBrief(preset, brief), reference), brief.look, effectiveForbid(brief));
}

/** Refaz legendas e cenas do vídeo inteiro com o estilo e o pedido atuais (trechos reaplicados por cima). */
export function rebuildAll(plan: EditPlan, ctx: EditContext): EditPlan {
  return reapplyRanges({ ...plan, captions: rebuildCaptions(plan, ctx, plan.segments, plan.style), scenes: rebuildScenes(plan, ctx, plan.segments, plan.style) }, ctx.words);
}

/** Cores de uma imagem de referência (null = voltar às cores do estilo). Mesmas cores = mesmo objeto. */
export function applyReferencePalette(plan: EditPlan, ctx: EditContext, reference: ReferencePalette | null): EditPlan {
  if (JSON.stringify(plan.reference) === JSON.stringify(reference)) return plan;
  const preset = presetById(plan.style.id);
  if (!preset) throw new AppError('ESTILO_DESCONHECIDO', plan.style.id);
  return rebuildAll({ ...plan, reference, style: planStyle(preset, plan.brief, reference) }, ctx);
}

/** Pedido para um trecho (revisão focal). Devolve o plano e o trecho afetado (null = trecho removido). */
export function applyRange(plan: EditPlan, ctx: EditContext, target: RangeTarget, req: RangeRequest): { plan: EditPlan; rangeId: string | null } {
  return applyRangeRequest(plan, ctx.words, target, req, (p) => rebuildAll(p, ctx));
}

/**
 * Troca o estilo (preset): legendas reagrupadas no tamanho do novo estilo e cenas propostas de novo
 * com o ritmo dele. Mesmo estilo = mesmo objeto (não cria entrada no histórico). Estilo desconhecido = M4F-802.
 */
export function applyStyle(plan: EditPlan, ctx: EditContext, styleId: string): EditPlan {
  if (plan.style.id === styleId) return plan;
  const preset = presetById(styleId);
  if (!preset) throw new AppError('ESTILO_DESCONHECIDO', styleId);
  // a escolha manual vira o estilo do pedido; os outros ajustes do pedido (calmo, proibições...) continuam valendo
  const brief = plan.brief.preset ? { ...plan.brief, preset: preset.id as CreativeBrief['preset'] } : plan.brief;
  const style = planStyle(preset, brief, plan.reference);
  return reapplyRanges({ ...plan, style, brief, captions: rebuildCaptions(plan, ctx, plan.segments, style), scenes: rebuildScenes(plan, ctx, plan.segments, style, brief) }, ctx.words);
}

/**
 * Aplica um pedido já entendido (regras ou IA): estilo pedido (ou o atual) ajustado pelo pedido,
 * legendas no tamanho do estilo e cenas propostas de novo com proibições e destaques.
 * Gancho: mantém o que a pessoa escolheu antes; se o pedido quer gancho e não há escolha, usa o melhor candidato.
 */
export function applyBrief(plan: EditPlan, ctx: EditContext, incoming: CreativeBrief): EditPlan {
  const presetId = incoming.preset ?? plan.style.id;
  const preset = presetById(presetId);
  if (!preset) throw new AppError('ESTILO_DESCONHECIDO', presetId);
  // estilo de gancho novo ("gancho criativo") escolhe de novo; senão mantém a escolha anterior
  const restyled = !!incoming.hookStyle && incoming.hookStyle !== plan.brief.hookStyle;
  let hook: Hook | null = incoming.hook ?? (restyled ? null : plan.brief.hook);
  if (!hook && incoming.wantsHook) {
    const best = pickHook(findHooks(ctx.words), incoming.hookStyle);
    hook = best ? { text: best.text, wordIds: best.wordIds } : null;
  }
  const brief: CreativeBrief = { ...incoming, hook, locked: plan.brief.locked };
  const style = planStyle(preset, brief, plan.reference);
  // ritmo dos cortes: só quando o pedido muda o nível (respeita cortes feitos à mão depois)
  let segments = plan.segments;
  const level = incoming.look.cuts;
  if (level && level !== (plan.brief.look.cuts ?? 'normal') && ctx.words.length > 0) {
    const locked = plan.ranges.filter((r) => r.locked).map((r) => ({ start: r.srcStart, end: r.srcEnd }));
    segments = splitAtClips(retimeCuts(plan.segments, ctx.words, ctx.durationSec, level, locked), plan.clips);
  }
  return reapplyRanges({ ...plan, segments, style, brief, captions: rebuildCaptions(plan, ctx, segments, style), scenes: rebuildScenes(plan, ctx, segments, style, brief) }, ctx.words);
}

/** Escolhe (ou tira, com null) o gancho de abertura. Mesmo gancho = mesmo objeto. */
export function applyHook(plan: EditPlan, ctx: EditContext, hook: Hook | null): EditPlan {
  const same = (a: Hook | null, b: Hook | null) => (a === null && b === null) || (!!a && !!b && a.wordIds.join('|') === b.wordIds.join('|') && a.text === b.text);
  if (same(plan.brief.hook, hook)) return plan;
  const brief: CreativeBrief = { ...plan.brief, hook, wantsHook: hook === null ? false : plan.brief.wantsHook };
  return reapplyRanges({ ...plan, brief, scenes: rebuildScenes(plan, ctx, plan.segments, plan.style, brief) }, ctx.words);
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
  assertCaptionEditable(plan, captionId);
  return { ...plan, captions: plan.captions.map((c) => (c.id === captionId ? { ...c, text: clean } : c)) };
}
