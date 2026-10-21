import { AppError } from '../core/errors';
import type { EditPlan, Segment, TimeRange } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { MIN_KEEP_SEC, withSegments, type EditContext } from './ops';

/**
 * Pedaços do vídeo na linha do tempo Edição (v0.17, ADR-0020): mover, duplicar, colar e apagar um
 * trecho, como num editor profissional. Puras: recebem o plano e devolvem outro (ou o mesmo objeto
 * quando nada muda). Os pedaços podem ficar fora da ordem da gravação e um pedaço pode aparecer
 * duas vezes; legendas e animações acompanham a fala de cada pedaço.
 */

const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Leva o pedaço `from` para a posição `to` (índices do resultado). */
export function moveSegment(plan: EditPlan, ctx: EditContext, from: number, to: number): EditPlan {
  const n = plan.segments.length;
  if (!plan.segments[from]) return plan;
  const j = Math.max(0, Math.min(n - 1, to));
  if (j === from) return plan;
  const list = [...plan.segments];
  const [s] = list.splice(from, 1);
  list.splice(j, 0, s!);
  return withSegments(plan, ctx, list);
}

/** Onde colar no instante `outT`: na emenda mais próxima, ou dividindo o pedaço se a agulha está no meio dele. */
function insertionPoint(segments: Segment[], outT: number): { segments: Segment[]; at: number } {
  let offset = 0;
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i]!;
    const len = s.srcEnd - s.srcStart;
    if (outT < offset + len) {
      const local = outT - offset;
      if (local < MIN_KEEP_SEC) return { segments, at: i };
      if (len - local < MIN_KEEP_SEC) return { segments, at: i + 1 };
      const mid = r3(s.srcStart + local);
      return { segments: [...segments.slice(0, i), { srcStart: s.srcStart, srcEnd: mid }, { srcStart: mid, srcEnd: s.srcEnd }, ...segments.slice(i + 1)], at: i + 1 };
    }
    offset += len;
  }
  return { segments, at: segments.length };
}

/** Cola pedaços copiados no instante `outT` (o que vem depois anda para a frente). Devolve onde eles ficaram. */
export function insertSegments(plan: EditPlan, ctx: EditContext, pieces: Segment[], outT: number): { plan: EditPlan; index: number; count: number } {
  if (pieces.length === 0) throw new AppError('NADA_COPIADO');
  const { segments, at } = insertionPoint(plan.segments, Math.max(0, outT));
  const next = withSegments(plan, ctx, [...segments.slice(0, at), ...pieces, ...segments.slice(at)]);
  return { plan: next, index: at, count: next.segments.length - segments.length };
}

/** Cópia do pedaço logo depois dele. */
export function duplicateSegment(plan: EditPlan, ctx: EditContext, index: number): { plan: EditPlan; index: number } {
  const s = plan.segments[index];
  if (!s) throw new AppError('NADA_SELECIONADO');
  const segments = [...plan.segments.slice(0, index + 1), { ...s }, ...plan.segments.slice(index + 1)];
  return { plan: withSegments(plan, ctx, segments), index: index + 1 };
}

/** Início de cada pedaço no vídeo editado. */
export function segmentOffsets(segments: Segment[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const s of segments) {
    out.push(acc);
    acc += s.srcEnd - s.srcStart;
  }
  return out;
}

/**
 * Tira do vídeo editado o trecho [start, end) (tempo do vídeo editado) e encosta o resto, mesmo que
 * o pedaço apareça duas vezes (só esta vez sai). Sobras menores que 0,1 s saem junto.
 */
export function deleteOutRange(plan: EditPlan, ctx: EditContext, range: TimeRange): EditPlan {
  const a = Math.max(0, Math.min(range.start, range.end));
  const b = Math.min(outputDuration(plan.segments), Math.max(range.start, range.end));
  if (b - a < 1e-3) return plan;
  const offsets = segmentOffsets(plan.segments);
  const segments: Segment[] = [];
  plan.segments.forEach((s, i) => {
    const o = offsets[i]!;
    const len = s.srcEnd - s.srcStart;
    if (b <= o + 1e-6 || a >= o + len - 1e-6) return void segments.push(s);
    if (a - o >= MIN_KEEP_SEC) segments.push({ srcStart: s.srcStart, srcEnd: r3(s.srcStart + (a - o)) });
    if (o + len - b >= MIN_KEEP_SEC) segments.push({ srcStart: r3(s.srcStart + (b - o)), srcEnd: s.srcEnd });
  });
  if (segments.length === 0) throw new AppError('CORTE_TOTAL');
  return withSegments(plan, ctx, segments);
}
