import { AppError } from '../core/errors';
import { profileFor, type OutputFormatId } from '../core/formats';
import { DEFAULT_STYLE } from '../core/presets';
import type { StyleDNA } from '../core/style';
import { DEFAULT_FRAMING, type ClipRef, type EditPlan, type Framing, type OutputProfile, type Segment, type TimeRange, type Word } from '../core/types';
import { clipLayout, placeRanges, placeWords, remapSegments, remapTime, totalDuration, withinOneClip } from '../engine/clips';
import { outputDuration, sourceToOutput } from '../engine/timeline';
import { autoEdit } from './auto-edit';
import { DEFAULT_CUTS, planKeepSegments } from './cuts';
import { findHooks, pickHook } from './hooks';
import { applyHook, withSegments, type EditContext } from './ops';
import { findRetakes, retakeCuts, type Retake } from './retakes';

/**
 * Montagem com vários vídeos (v0.14), toda por regras: ordem dos clipes, silêncios e tentativas
 * repetidas fora, gancho tirado da melhor frase e o modelo aplicado. Depois a pessoa pode reordenar,
 * tirar e devolver clipes; cada mudança é uma operação pura (entra no desfazer).
 */

/** O que a análise sabe de cada clipe, no tempo do próprio clipe. Não muda durante a edição. */
export interface ClipData {
  id: string;
  name: string;
  duration: number;
  words: Word[];
  silences: TimeRange[];
}

export type ClipLibrary = Readonly<Record<string, ClipData>>;

/** Palavras e duração do original virtual para a ordem de clipes do plano. */
export function contextFor(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], lib: ClipLibrary): EditContext {
  const byClip: Record<string, Word[]> = {};
  for (const c of clips) byClip[c.id] = lib[c.id]?.words ?? [];
  return { durationSec: totalDuration(clips), words: placeWords(clips, byClip) };
}

/** Silêncios no original virtual; os que encostam no começo/fim do clipe passam da borda para o corte chegar nela. */
function placedSilences(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], lib: ClipLibrary): TimeRange[] {
  const byClip: Record<string, TimeRange[]> = {};
  for (const c of clips) byClip[c.id] = lib[c.id]?.silences ?? [];
  const pad = DEFAULT_CUTS.padSec;
  const layout = clipLayout(clips);
  return placeRanges(clips, byClip).map((s) => {
    const l = layout.find((x) => s.start >= x.start - 1e-6 && s.end <= x.end + 1e-6);
    if (!l) return s;
    return { start: s.start <= l.start + 0.05 ? s.start - pad : s.start, end: s.end >= l.end - 0.05 ? s.end + pad : s.end };
  });
}

/** Tira intervalos dos trechos mantidos. */
export function subtractRanges(segments: Segment[], cuts: TimeRange[]): Segment[] {
  let out = segments;
  for (const c of cuts) {
    const next: Segment[] = [];
    for (const s of out) {
      if (c.end <= s.srcStart || c.start >= s.srcEnd) {
        next.push(s);
        continue;
      }
      if (c.start > s.srcStart) next.push({ srcStart: s.srcStart, srcEnd: c.start });
      if (c.end < s.srcEnd) next.push({ srcStart: c.end, srcEnd: s.srcEnd });
    }
    out = next;
  }
  return out;
}

export interface AssembleOptions {
  style?: StyleDNA;
  output?: OutputProfile;
  framing?: Framing;
  /** tirar tentativas repetidas e começos falsos (padrão: sim) */
  retakes?: boolean;
  /** escolher o gancho pela melhor frase (padrão: só com 2 clipes ou mais) */
  hook?: boolean;
}

export interface Assembly {
  plan: EditPlan;
  retakes: Retake[];
}

/** Trechos curtos sem nenhuma palavra que sobram depois de tirar frases (respiros soltos) saem. */
const MIN_SILENT_KEEP = 0.35;

function keepSegments(clips: readonly ClipRef[], lib: ClipLibrary, ctx: EditContext, withRetakes: boolean): { segments: Segment[]; retakes: Retake[] } {
  const silences = placedSilences(clips, lib);
  let segments = planKeepSegments(ctx.durationSec, silences, ctx.words);
  const retakes = withRetakes ? findRetakes(ctx.words, clips) : [];
  if (retakes.length > 0) {
    const hasWord = (s: Segment) => ctx.words.some((w) => w.start < s.srcEnd && w.end > s.srcStart);
    const trimmed = subtractRanges(segments, retakeCuts(retakes)).filter((s) => s.srcEnd - s.srcStart >= 0.1 && (hasWord(s) || s.srcEnd - s.srcStart >= MIN_SILENT_KEEP));
    if (trimmed.length > 0) segments = trimmed;
  }
  return { segments, retakes };
}

/** Monta o vídeo com os clipes na ordem dada. */
export function assemble(order: readonly ClipData[], opts: AssembleOptions = {}): Assembly {
  if (order.length === 0) throw new AppError('NENHUM_CLIPE');
  const clips: ClipRef[] = order.map((c) => ({ id: c.id, name: c.name, duration: c.duration, framing: null }));
  const lib: ClipLibrary = Object.fromEntries(order.map((c) => [c.id, c]));
  const ctx = contextFor(clips, lib);
  const base = autoEdit(ctx.durationSec, placedSilences(clips, lib), ctx.words, opts.style ?? DEFAULT_STYLE, { clips, output: opts.output, framing: opts.framing ?? DEFAULT_FRAMING });
  const { segments, retakes } = keepSegments(clips, lib, ctx, opts.retakes ?? true);
  let plan = retakes.length > 0 ? withSegments(base, ctx, segments) : base;
  if (opts.hook ?? clips.length > 1) {
    const kept = ctx.words.filter((w) => sourceToOutput(plan.segments, w.start) !== null);
    const best = pickHook(findHooks(kept), null);
    if (best) plan = applyHook(plan, ctx, { text: best.text, wordIds: best.wordIds });
  }
  return { plan, retakes };
}

/** Monta de novo (ordem atual dos clipes do plano), mantendo modelo, pedido, cores, formato e enquadramento. */
export function reassemble(plan: EditPlan, lib: ClipLibrary): Assembly {
  const ctx = contextFor(plan.clips, lib);
  const { segments, retakes } = keepSegments(plan.clips, lib, ctx, true);
  const next = withSegments({ ...plan, ranges: [], segments }, ctx, segments);
  return { plan: next, retakes };
}

/** Trechos ajustados levados para a nova ordem; os que atravessam clipes (ou de clipes que saíram) somem. */
function remapRanges(plan: EditPlan, to: readonly ClipRef[]): EditPlan['ranges'] {
  return plan.ranges
    .filter((r) => withinOneClip(plan.clips, r))
    .flatMap((r) => {
      const a = remapTime(plan.clips, to, r.srcStart);
      const b = remapTime(plan.clips, to, r.srcEnd, true);
      return a === null || b === null || b <= a ? [] : [{ ...r, srcStart: a, srcEnd: b }];
    })
    .sort((x, y) => x.srcStart - y.srcStart);
}

function withClips(plan: EditPlan, lib: ClipLibrary, to: ClipRef[], extra: Segment[] = []): EditPlan {
  const segments = [...remapSegments(plan.segments, plan.clips, to), ...extra].sort((a, b) => a.srcStart - b.srcStart);
  if (segments.length === 0) throw new AppError('CORTE_TOTAL');
  const next: EditPlan = { ...plan, clips: to, ranges: remapRanges(plan, to), segments };
  return withSegments(next, contextFor(to, lib), segments);
}

/** Nova ordem dos clipes (lista de ids). Mesma ordem = mesmo objeto. */
export function reorderClips(plan: EditPlan, lib: ClipLibrary, order: readonly string[]): EditPlan {
  if (order.join('|') === plan.clips.map((c) => c.id).join('|')) return plan;
  const to = order.map((id) => plan.clips.find((c) => c.id === id)).filter((c): c is ClipRef => !!c);
  if (to.length !== plan.clips.length) return plan;
  return withClips(plan, lib, to);
}

/** Sobe (−1) ou desce (+1) um clipe na ordem. */
export function moveClip(plan: EditPlan, lib: ClipLibrary, id: string, delta: number): EditPlan {
  const ids = plan.clips.map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return plan;
  ids.splice(i, 1);
  ids.splice(j, 0, id);
  return reorderClips(plan, lib, ids);
}

/** Tira um clipe da montagem (ele continua na lista para voltar). O último não sai (M4F-507). */
export function removeClip(plan: EditPlan, lib: ClipLibrary, id: string): EditPlan {
  if (!plan.clips.some((c) => c.id === id)) return plan;
  if (plan.clips.length <= 1) throw new AppError('CLIPE_UNICO');
  return withClips(plan, lib, plan.clips.filter((c) => c.id !== id));
}

/** Devolve um clipe à montagem, no fim, com os silêncios dele cortados. */
export function addClip(plan: EditPlan, lib: ClipLibrary, id: string): EditPlan {
  const data = lib[id];
  if (!data || plan.clips.some((c) => c.id === id)) return plan;
  const ref: ClipRef = { id, name: data.name, duration: data.duration, framing: null };
  const to = [...plan.clips, ref];
  const offset = totalDuration(plan.clips);
  const own = planKeepSegments(data.duration, placedSilences([ref], { [id]: data }), data.words).map((s) => ({ srcStart: s.srcStart + offset, srcEnd: s.srcEnd + offset }));
  return withClips(plan, lib, to, own.length > 0 ? own : [{ srcStart: offset, srcEnd: offset + data.duration }]);
}

/** Troca o formato de saída. Legendas e cenas não mudam (o desenho se adapta); mesmo formato = mesmo objeto. */
export function setOutputFormat(plan: EditPlan, id: OutputFormatId): EditPlan {
  const p = profileFor(id, plan.output.fps);
  if (p.width === plan.output.width && p.height === plan.output.height) return plan;
  return { ...plan, output: p };
}

/** Enquadramento do vídeo (clipId null) ou de um clipe (framing null = volta ao do vídeo). */
export function setFraming(plan: EditPlan, clipId: string | null, framing: Framing | null): EditPlan {
  if (clipId === null) {
    if (!framing || JSON.stringify(framing) === JSON.stringify(plan.framing)) return plan;
    return { ...plan, framing };
  }
  const clip = plan.clips.find((c) => c.id === clipId);
  if (!clip || JSON.stringify(clip.framing) === JSON.stringify(framing)) return plan;
  return { ...plan, clips: plan.clips.map((c) => (c.id === clipId ? { ...c, framing } : c)) };
}

/** Quanto de cada clipe ficou no vídeo editado (s). */
export function keptByClip(plan: EditPlan): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of clipLayout(plan.clips)) {
    let kept = 0;
    for (const s of plan.segments) kept += Math.max(0, Math.min(s.srcEnd, l.end) - Math.max(s.srcStart, l.start));
    out[l.id] = Math.round(kept * 1000) / 1000;
  }
  return out;
}

/**
 * Ordem automática dos clipes: data do arquivo (quem grava em sequência), depois nome com números em
 * ordem natural ("clipe 2" antes de "clipe 10"). Devolve os índices na nova ordem.
 */
export function autoOrder(files: readonly { name: string; lastModified: number }[]): number[] {
  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  return files
    .map((f, i) => ({ f, i }))
    .sort((a, b) => a.f.lastModified - b.f.lastModified || collator.compare(a.f.name, b.f.name) || a.i - b.i)
    .map((x) => x.i);
}

/** Duração máxima do vídeo final (Reels: 3 min). Passar disso é aviso (M4F-508), não bloqueio. */
export const MAX_OUTPUT_SEC = 180;

export function assemblyTooLong(plan: EditPlan): boolean {
  return outputDuration(plan.segments) > MAX_OUTPUT_SEC + 0.05;
}
