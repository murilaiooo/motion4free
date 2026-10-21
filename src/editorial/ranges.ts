import type { CreativeBrief } from '../core/brief';
import { AppError } from '../core/errors';
import { presetById } from '../core/presets';
import type { StyleDNA } from '../core/style';
import type { Caption, EditPlan, RangeEdit, SceneInstance, SceneKind, TimeRange, Word } from '../core/types';
import { outputDuration, outputToSource, outputToSourceEnd, rangeOut, sourceToOutput } from '../engine/timeline';
import { applyLook, effectiveForbid, sceneOptionsFor, styleForBrief } from './brief-apply';
import { lookIsEmpty, mergeLook, type Look } from '../core/look';
import { buildCaptions, captionOptionsFor } from './captions';
import { keywordScore } from './detect';
import type { RangeRequest } from './range-interpret';
import { applyReference } from './reference';
import { OVERLAY_KINDS, openingTitle, proposeScenes } from './selector';

/**
 * Trechos (Fase 5): pedidos que valem só num pedaço do vídeo, travas e revisão focal.
 *
 * Garantias (testadas em tests/ranges.test.ts):
 * - pedido de trecho nunca muda trechos mantidos nem legendas; das cenas, só as que começam e
 *   terminam dentro do trecho são recalculadas. Tudo fora do trecho fica idêntico.
 * - trecho travado guarda cópia das cenas e legendas que o tocam e o seu estilo; depois de qualquer
 *   mudança geral a cópia volta exatamente igual (só deslocada se um corte antes dele mudou).
 * - cortes, restauração de corte e correção de legenda dentro de um trecho travado são recusados.
 */

export const MIN_RANGE_SEC = 0.5;
const EPS = 1e-6;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Destino de um pedido: um trecho que já existe ou um pedaço novo (tempo do vídeo editado). */
export type RangeTarget = { id: string } | TimeRange;

type Draft = SceneInstance extends infer S ? (S extends SceneInstance ? Omit<S, 'id'> : never) : never;

export function rangeHasOverrides(r: RangeEdit): boolean {
  return !!(r.tone || r.intensity || r.pace || r.forbid.length || r.emphasize.length || r.quiet || r.accent || r.variant > 0 || !lookIsEmpty(r.look));
}

const styleOverrides = (r: RangeEdit) => !!(r.tone || r.intensity || r.pace || r.forbid.length || r.emphasize.length || !lookIsEmpty(r.look));

/** Pedido geral + pedido do trecho (o do trecho vale mais; proibições e destaques somam). */
export function rangeBrief(plan: EditPlan, r: RangeEdit): CreativeBrief {
  const b = plan.brief;
  return {
    ...b,
    tone: r.tone ?? b.tone,
    intensity: r.intensity ?? b.intensity,
    pace: r.pace ?? b.pace,
    forbid: [...new Set([...b.forbid, ...r.forbid])],
    emphasize: [...new Set([...b.emphasize, ...r.emphasize])].filter((e) => !r.forbid.some((p) => (p === 'numeros' && e === 'numeros') || (p === 'destaques' && e === 'palavras') || p === 'textos')),
    look: r.look ? mergeLook(b.look, r.look) : b.look,
  };
}

/** Estilo do vídeo com o pedido do trecho (null = o trecho usa o estilo do vídeo). */
export function styleForRange(plan: EditPlan, r: RangeEdit): StyleDNA | null {
  if (!styleOverrides(r)) return null;
  const preset = presetById(plan.style.id);
  if (!preset) return null;
  const brief = rangeBrief(plan, r);
  // Mesma precedência do vídeo inteiro: a referência escolhida vence as cores do brief também nos trechos.
  return applyReference(applyLook(styleForBrief(preset, brief), brief.look, effectiveForbid(brief)), plan.reference);
}

/** Estilo usado para desenhar o instante `t`: o do trecho que contém `t`, se tiver; senão o do vídeo. */
export function styleAt(plan: EditPlan, t: number): StyleDNA {
  for (const r of plan.ranges) if (r.style && t >= r.out.start && t < r.out.end) return r.style;
  return plan.style;
}

/** Todos os estilos que o plano desenha (para carregar as fontes antes). */
export function stylesOf(plan: EditPlan): StyleDNA[] {
  return [plan.style, ...plan.ranges.map((r) => r.style).filter((s): s is StyleDNA => s !== null)];
}

const isInside = (s: { kind: SceneKind; start: number; end: number }, out: TimeRange) => s.kind !== 'progress-bar' && s.start >= out.start - EPS && s.end <= out.end + EPS;
const overlaps = (s: { start: number; end: number }, r: TimeRange) => s.start < r.end && s.end > r.start;

function placedWordsIn(words: Word[], plan: EditPlan, out: TimeRange): (Word & { outStart: number; outEnd: number })[] {
  const res: (Word & { outStart: number; outEnd: number })[] = [];
  for (const w of words) {
    const a = sourceToOutput(plan.segments, w.start);
    const b = sourceToOutput(plan.segments, Math.max(w.start, w.end - 1e-3));
    if (a === null || b === null || a < out.start - EPS || a >= out.end || !w.text.trim()) continue;
    res.push({ ...w, outStart: a, outEnd: b + 1e-3 });
  }
  return res;
}

const strip = (raw: string) => raw.trim().replace(/^[^\p{L}\p{N}$]+/u, '').replace(/[^\p{L}\p{N}%]+$/u, '');

/** Animações que "troca essa animação" e "destaque isso" sabem fazer, sempre com a fala do trecho. */
export const ACCENT_CYCLE: SceneKind[] = ['highlight-word', 'emphasis-zoom', 'kinetic-title'];
const SWAPPABLE: ReadonlySet<SceneKind> = new Set(['highlight-word', 'emphasis-zoom', 'kinetic-title', 'big-number', 'list', 'quote', 'lower-third']);

export function accentScene(kind: SceneKind, ws: ReturnType<typeof placedWordsIn>, out: TimeRange, style: StyleDNA): Draft | null {
  if (kind === 'emphasis-zoom') {
    const len = out.end - out.start;
    if (len < 0.6) return null;
    const scale = r3(Math.min(1.4, Math.max(1.04, style.zoomScale > 1.02 ? style.zoomScale : 1.08)));
    return { kind, scale, start: r3(out.start), end: r3(Math.min(out.end, out.start + Math.min(3, Math.max(1.2, len)))) };
  }
  if (kind === 'highlight-word') {
    let best: (typeof ws)[number] | null = null;
    let bestScore = -1;
    for (const w of ws) {
      const text = strip(w.text);
      if (text.length < 3) continue;
      const sc = keywordScore(w.text) + text.length / 100;
      if (sc > bestScore) {
        best = w;
        bestScore = sc;
      }
    }
    if (!best) return null;
    const end = Math.min(out.end, best.outEnd + 0.6);
    if (end - best.outStart < 0.3) return null;
    return { kind, text: strip(best.text).slice(0, 30), start: r3(best.outStart), end: r3(end) };
  }
  if (kind === 'kinetic-title') {
    const text = openingTitle(ws);
    if (!text || ws.length === 0) return null;
    const start = ws[0]!.outStart;
    const end = Math.min(out.end, start + Math.max(1.2, text.split(/\s+/).length * 0.45));
    if (end - start < 0.8) return null;
    return { kind, text, start: r3(start), end: r3(end) };
  }
  return null;
}

/** Cenas novas de dentro do trecho, já com o pedido do trecho aplicado (sem ids). */
function proposeInside(plan: EditPlan, words: Word[], r: RangeEdit, out: TimeRange, style: StyleDNA): Draft[] {
  if (r.quiet) return [];
  const opts = sceneOptionsFor(rangeBrief(plan, r));
  const ws = placedWordsIn(words, plan, out);
  let inside: Draft[];
  if (words.length > 0) {
    const inWords = words.filter((w) => ws.some((p) => p.id === w.id));
    inside = proposeScenes(inWords, plan.segments, style, opts)
      .filter((s) => s.kind !== 'progress-bar' && s.start >= out.start - EPS && s.start < out.end)
      .map((s) => ({ ...s, end: r3(Math.min(s.end, out.end)) }) as SceneInstance)
      .filter((s) => s.end - s.start > 0.05)
      .map(({ id: _id, ...rest }) => rest as Draft);
  } else {
    // sem transcrição não há o que propor: fica o que existe, sem o que foi proibido
    inside = plan.scenes.filter((s) => isInside(s, out) && !opts.forbid.has(s.kind)).map(({ id: _id, ...rest }) => rest as Draft);
  }
  const allowed = ACCENT_CYCLE.filter((k) => !opts.forbid.has(k));
  if (r.accent) {
    for (const k of ['highlight-word', 'emphasis-zoom'] as SceneKind[]) {
      if (!allowed.includes(k) || inside.some((s) => s.kind === k)) continue;
      const a = accentScene(k, ws, out, style);
      if (a) inside.push(a);
    }
  }
  if (r.variant > 0) {
    const feasible = allowed.map((k) => accentScene(k, ws, out, style)).filter((s): s is Draft => s !== null);
    if (feasible.length > 0) {
      const present = new Set(inside.filter((s) => SWAPPABLE.has(s.kind)).map((s) => s.kind));
      const order = [...feasible.filter((s) => !present.has(s.kind)), ...feasible.filter((s) => present.has(s.kind))];
      const pick = order[(r.variant - 1) % order.length]!;
      inside = [...inside.filter((s) => !SWAPPABLE.has(s.kind)), pick];
    }
  }
  return inside;
}

/** Ids novos que não colidem com nenhum id já usado. */
function freshIds(drafts: Draft[], used: Set<string>, prefix: string): SceneInstance[] {
  let k = 0;
  return drafts.map((d) => {
    let id: string;
    do id = `${prefix}${++k}`;
    while (used.has(id));
    used.add(id);
    return { ...d, id } as SceneInstance;
  });
}

const byTime = <T extends { start: number; kind?: string }>(a: T, b: T) => a.start - b.start || (a.kind ?? '').localeCompare(b.kind ?? '');

/**
 * Revisão focal: recalcula só as cenas de dentro do trecho `r` (que precisa estar em plan.ranges,
 * destravado). Legendas, trechos mantidos e cenas fora do trecho não mudam. Trecho que sumiu
 * (todo cortado) sai da lista.
 */
export function reviseRange(plan: EditPlan, words: Word[], r: RangeEdit): EditPlan {
  const out = rangeOut(plan.segments, r);
  if (!out) return { ...plan, ranges: plan.ranges.filter((x) => x.id !== r.id) };
  const style = styleForRange(plan, r);
  const range: RangeEdit = { ...r, out, style };
  const kept = plan.scenes.filter((s) => !isInside(s, out));
  const crossing = kept.filter((s) => OVERLAY_KINDS.has(s.kind) && overlaps(s, out));
  const drafts = proposeInside(plan, words, range, out, style ?? plan.style).filter((s) => !(OVERLAY_KINDS.has(s.kind) && crossing.some((c) => overlaps(s, c))));
  const inside = freshIds(drafts, new Set(kept.map((s) => s.id)), `${r.id}-`);
  return { ...plan, scenes: [...kept, ...inside].sort(byTime), ranges: plan.ranges.map((x) => (x.id === r.id ? range : x)) };
}

function shiftScene(s: SceneInstance, d: number): SceneInstance {
  const t = { ...s, start: r3(s.start + d), end: r3(s.end + d) } as SceneInstance;
  if (t.kind === 'cut-transition') return { ...t, at: r3(t.at + d) };
  if (t.kind === 'list') return { ...t, items: t.items.map((i) => ({ ...i, at: r3(i.at + d) })) };
  return t;
}
const shiftCaption = (c: Caption, d: number): Caption => ({ ...c, start: c.start + d, end: c.end + d, wordStarts: c.wordStarts.map((w) => w + d) });

/** Legendas pelas palavras fora das travas; texto corrigido volta quando o grupo de palavras é o mesmo. */
function freeCaptions(plan: EditPlan, words: Word[], lockedWordIds: Set<string>, lockedIds: Set<string>): Caption[] {
  const edited = new Map(plan.captions.map((c) => [c.wordIds.join('|'), c.text]));
  const built = buildCaptions(
    words.filter((w) => !lockedWordIds.has(w.id)),
    plan.segments,
    captionOptionsFor(plan.style),
  );
  let k = 0;
  return built.map((c) => {
    let id: string;
    do id = `c${++k}`;
    while (lockedIds.has(id));
    const text = edited.get(c.wordIds.join('|'));
    return { ...c, id, text: text ?? c.text };
  });
}

/** Coloca de volta as cópias dos trechos travados (deslocadas se o trecho mudou de lugar no vídeo editado). */
export function restoreLocks(plan: EditPlan, words: Word[]): EditPlan {
  const locked = plan.ranges.filter((r) => r.locked);
  if (locked.length === 0) return plan;
  let scenes = plan.scenes;
  const lockedScenes: SceneInstance[] = [];
  const lockedCaps: Caption[] = [];
  for (const r of locked) {
    const lock = r.locked!;
    const d = r.out.start - lock.outStart;
    const own = Math.abs(d) < 1e-9 ? lock.scenes : lock.scenes.map((s) => shiftScene(s, d));
    const caps = Math.abs(d) < 1e-9 ? lock.captions : lock.captions.map((c) => shiftCaption(c, d));
    const fp = { start: Math.min(r.out.start, ...own.map((s) => s.start)), end: Math.max(r.out.end, ...own.map((s) => s.end)) };
    scenes = scenes.filter((s) => s.kind === 'progress-bar' || !overlaps(s, fp));
    lockedScenes.push(...own);
    lockedCaps.push(...caps);
  }
  // ids das cenas travadas não mudam nunca; as outras são renomeadas se colidirem
  const used = new Set(lockedScenes.map((s) => s.id));
  scenes = scenes.map((s) => {
    if (!used.has(s.id)) {
      used.add(s.id);
      return s;
    }
    let k = 1;
    while (used.has(`${s.id}.${k}`)) k++;
    used.add(`${s.id}.${k}`);
    return { ...s, id: `${s.id}.${k}` };
  });
  let captions = plan.captions;
  if (lockedCaps.length > 0) {
    const lockedWordIds = new Set(lockedCaps.flatMap((c) => c.wordIds));
    const lockedIds = new Set(lockedCaps.map((c) => c.id));
    const windows = locked.map((r) => r.out);
    const free = words.length > 0 ? freeCaptions(plan, words, lockedWordIds, lockedIds) : plan.captions.filter((c) => !lockedIds.has(c.id) && !windows.some((w) => overlaps(c, w)));
    captions = [...free.filter((c) => !c.wordIds.some((id) => lockedWordIds.has(id))), ...lockedCaps].sort((a, b) => a.start - b.start);
  }
  return { ...plan, scenes: [...scenes, ...lockedScenes].sort(byTime), captions };
}

/**
 * Depois de uma mudança geral (estilo, pedido geral, gancho, cores, cortes): recalcula a posição de
 * cada trecho, refaz os trechos com pedido (revisão focal por cima do novo plano) e devolve as cópias
 * dos trechos travados.
 */
export function reapplyRanges(plan: EditPlan, words: Word[]): EditPlan {
  if (plan.ranges.length === 0) return plan;
  let next: EditPlan = { ...plan, ranges: plan.ranges.flatMap((r) => {
    const out = rangeOut(plan.segments, r);
    return out ? [{ ...r, out }] : [];
  }) };
  for (const r of next.ranges) if (!r.locked && rangeHasOverrides(r)) next = reviseRange(next, words, r);
  return restoreLocks(next, words);
}

/** Recusa mudar os trechos mantidos dentro de um trecho travado (M4F-504). */
export function assertSegmentsKeepLocks(plan: EditPlan, segments: EditPlan['segments']): void {
  const clip = (segs: EditPlan['segments'], r: RangeEdit) =>
    segs
      .map((s) => ({ a: Math.max(s.srcStart, r.srcStart), b: Math.min(s.srcEnd, r.srcEnd) }))
      .filter((x) => x.b - x.a > EPS)
      .map((x) => `${x.a.toFixed(4)}-${x.b.toFixed(4)}`)
      .join(',');
  for (const r of plan.ranges) {
    if (r.locked && clip(plan.segments, r) !== clip(segments, r)) throw new AppError('TRECHO_TRAVADO', `trecho de ${r.out.start.toFixed(2)} s a ${r.out.end.toFixed(2)} s`);
  }
}

/** Legenda dentro de um trecho travado não pode ser corrigida (M4F-504). */
export function assertCaptionEditable(plan: EditPlan, captionId: string): void {
  if (plan.ranges.some((r) => r.locked?.captions.some((c) => c.id === captionId))) throw new AppError('TRECHO_TRAVADO', `legenda ${captionId}`);
}

/** Valida um pedaço novo (tempo do vídeo editado) e devolve o trecho ainda fora do plano. */
export function newRange(plan: EditPlan, sel: TimeRange): RangeEdit {
  const total = outputDuration(plan.segments);
  const a = Math.max(0, Math.min(sel.start, sel.end));
  const b = Math.min(total, Math.max(sel.start, sel.end));
  if (!(b - a >= MIN_RANGE_SEC - EPS)) throw new AppError('TRECHO_CURTO', `de ${a.toFixed(2)} s a ${b.toFixed(2)} s (vídeo editado com ${total.toFixed(2)} s)`);
  const other = plan.ranges.find((r) => a < r.out.end - EPS && r.out.start < b - EPS);
  if (other) throw new AppError('TRECHO_SOBREPOSTO', `trecho existente de ${other.out.start.toFixed(2)} s a ${other.out.end.toFixed(2)} s`);
  const srcStart = outputToSource(plan.segments, a);
  const srcEnd = outputToSourceEnd(plan.segments, b);
  if (srcStart === null || srcEnd === null || srcEnd <= srcStart) throw new AppError('TRECHO_CURTO', `de ${a.toFixed(2)} s a ${b.toFixed(2)} s`);
  const n = Math.max(0, ...plan.ranges.map((r) => Number(r.id.slice(1)))) + 1;
  return {
    id: `r${n}`,
    srcStart,
    srcEnd,
    out: rangeOut(plan.segments, { srcStart, srcEnd })!,
    prompt: '',
    tone: null,
    intensity: null,
    pace: null,
    forbid: [],
    emphasize: [],
    quiet: false,
    accent: false,
    variant: 0,
    look: null,
    style: null,
    locked: null,
  };
}

/** Trava: guarda as cenas e legendas que tocam o trecho e o estilo dele. Não muda nada na tela. */
export function lockRange(plan: EditPlan, r: RangeEdit): RangeEdit {
  const out = r.out;
  return {
    ...r,
    style: r.style ?? plan.style,
    locked: {
      outStart: out.start,
      scenes: plan.scenes.filter((s) => s.kind !== 'progress-bar' && overlaps(s, out)),
      captions: plan.captions.filter((c) => overlaps(c, out)),
      captionEdits: { placement: plan.edits.captionPlacement, look: plan.edits.captionLook },
    },
  };
}

const insideKey = (plan: EditPlan, out: TimeRange) =>
  JSON.stringify(
    plan.scenes
      .filter((s) => isInside(s, out))
      .map(({ id: _id, ...rest }) => rest)
      .sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind)),
  );

/**
 * Aplica um pedido de trecho já entendido. `rebuild` refaz o vídeo inteiro (usado ao tirar uma trava
 * ou voltar o trecho ao normal, para ele seguir de novo o resto do vídeo).
 */
/** Look do trecho: o novo pedido vale mais campo a campo; "sem animação" tira os emojis do trecho. */
function mergedRangeLook(prev: Look | null, add: Look, quiet: boolean): Look | null {
  const merged = mergeLook(prev ?? {}, add);
  if (quiet && merged.emoji) delete merged.emoji;
  return lookIsEmpty(merged) ? null : merged;
}

export function applyRangeRequest(plan: EditPlan, words: Word[], target: RangeTarget, req: RangeRequest, rebuild: (p: EditPlan) => EditPlan): { plan: EditPlan; rangeId: string | null } {
  const existing = 'id' in target ? plan.ranges.find((r) => r.id === target.id) : undefined;
  if ('id' in target && !existing) return { plan, rangeId: null };
  let r = existing ?? newRange(plan, target as TimeRange);
  const changes = req.reset || req.swap || req.accent || req.quiet || !!req.tone || !!req.intensity || !!req.pace || req.forbid.length > 0 || req.emphasize.length > 0 || !lookIsEmpty(req.look);

  if (r.locked) {
    if (req.lock !== false) {
      if (changes) throw new AppError('TRECHO_TRAVADO', `trecho de ${r.out.start.toFixed(2)} s a ${r.out.end.toFixed(2)} s`);
      return { plan, rangeId: r.id };
    }
    r = { ...r, locked: null, style: styleForRange(plan, r) };
  }

  if (req.reset) {
    if (!existing) return { plan, rangeId: null };
    return { plan: rebuild({ ...plan, ranges: plan.ranges.filter((x) => x.id !== r.id) }), rangeId: null };
  }

  const prompt = [r.prompt, req.prompt].filter(Boolean).join(' · ');
  r = {
    ...r,
    prompt: prompt.length > 200 ? prompt.slice(-200) : prompt,
    tone: req.tone ?? r.tone,
    intensity: req.intensity ?? r.intensity,
    pace: req.pace ?? r.pace,
    forbid: [...new Set([...r.forbid, ...req.forbid])],
    emphasize: [...new Set([...r.emphasize, ...req.emphasize])],
    quiet: req.quiet ? true : req.accent || req.swap || req.emphasize.length > 0 ? false : r.quiet,
    accent: req.quiet ? false : req.accent || r.accent,
    variant: req.quiet ? 0 : req.swap ? Math.min(999, r.variant + 1) : r.variant,
    look: mergedRangeLook(r.look, req.look, req.quiet),
  };

  const ranges = [...plan.ranges.filter((x) => x.id !== r.id), r].sort((a, b) => a.srcStart - b.srcStart);
  let next: EditPlan = { ...plan, ranges };
  const wasLocked = !!existing?.locked;
  if (wasLocked) {
    // destravou: o trecho volta a seguir o vídeo (e o seu pedido, se tiver)
    next = rebuild(rangeHasOverrides(r) ? next : { ...next, ranges: ranges.filter((x) => x.id !== r.id) });
    if (!rangeHasOverrides(r)) return { plan: next, rangeId: null };
  } else if (rangeHasOverrides(r)) {
    next = reviseRange(next, words, r);
    if (req.swap && insideKey(next, r.out) === insideKey(plan, r.out)) throw new AppError('TRECHO_SEM_ALTERNATIVA');
  }

  if (req.lock === true) {
    const current = next.ranges.find((x) => x.id === r.id) ?? r;
    const locked = lockRange(next, current);
    next = { ...next, ranges: [...next.ranges.filter((x) => x.id !== r.id), locked].sort((a, b) => a.srcStart - b.srcStart) };
  } else if (!rangeHasOverrides(r) && !existing) {
    // pedido que não muda nada (ex.: "destrava" num trecho novo)
    return { plan, rangeId: null };
  }
  return { plan: next, rangeId: r.id };
}
