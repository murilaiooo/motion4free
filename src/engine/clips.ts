import type { ClipRef, Segment, TimeRange, Word } from '../core/types';

/**
 * Vários vídeos num "original" virtual (v0.14). Os clipes ficam em sequência, na ordem do plano:
 * o clipe i ocupa [início_i, início_i + duração_i). Palavras, silêncios, trechos mantidos e trechos
 * ajustados usam esse tempo; só o player e a exportação precisam saber de qual arquivo vem cada
 * quadro (`clipSpans`). Puro e testado (tests/clips.test.ts).
 */

export interface ClipSpanLayout {
  id: string;
  start: number;
  end: number;
}

const EPS = 1e-6;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Onde cada clipe começa e termina no original virtual. */
export function clipLayout(clips: readonly Pick<ClipRef, 'id' | 'duration'>[]): ClipSpanLayout[] {
  let acc = 0;
  return clips.map((c) => {
    const start = acc;
    acc += c.duration;
    return { id: c.id, start, end: acc };
  });
}

export function totalDuration(clips: readonly Pick<ClipRef, 'duration'>[]): number {
  return clips.reduce((a, c) => a + c.duration, 0);
}

/** Clipe que contém o instante `src` do original virtual (o fim exato do último conta como dele). */
export function clipAt(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], src: number): { id: string; index: number; local: number } | null {
  const layout = clipLayout(clips);
  for (let i = 0; i < layout.length; i++) {
    const l = layout[i]!;
    if (src >= l.start - EPS && (src < l.end - EPS || (i === layout.length - 1 && src <= l.end + EPS))) return { id: l.id, index: i, local: Math.max(0, Math.min(l.end - l.start, src - l.start)) };
  }
  return null;
}

/** Trechos mantidos partidos nas emendas entre clipes (um trecho nunca atravessa dois arquivos). */
export function splitAtClips(segments: Segment[], clips: readonly Pick<ClipRef, 'id' | 'duration'>[]): Segment[] {
  if (clips.length <= 1) return segments;
  const bounds = clipLayout(clips).slice(0, -1).map((l) => l.end);
  const out: Segment[] = [];
  for (const s of segments) {
    let a = s.srcStart;
    for (const b of bounds) {
      if (b > a + EPS && b < s.srcEnd - EPS) {
        out.push({ srcStart: r3(a), srcEnd: r3(b) });
        a = b;
      }
    }
    out.push({ srcStart: r3(a), srcEnd: s.srcEnd });
  }
  return out.filter((s) => s.srcEnd - s.srcStart > EPS);
}

/** Pedaço do vídeo editado que vem de um arquivo só: tempos locais do clipe e onde ele cai na saída. */
export interface ClipSpan {
  clipId: string;
  clipIndex: number;
  /** início/fim no tempo do próprio clipe */
  localStart: number;
  localEnd: number;
  /** início no vídeo editado */
  outStart: number;
}

/** Pedaços por arquivo, em ordem de saída (para o player e a exportação). */
export function clipSpans(segments: Segment[], clips: readonly Pick<ClipRef, 'id' | 'duration'>[]): ClipSpan[] {
  const layout = clipLayout(clips);
  const spans: ClipSpan[] = [];
  let out = 0;
  for (const s of segments) {
    for (let i = 0; i < layout.length; i++) {
      const l = layout[i]!;
      const a = Math.max(s.srcStart, l.start);
      const b = Math.min(s.srcEnd, l.end);
      if (b - a <= EPS) continue;
      spans.push({ clipId: l.id, clipIndex: i, localStart: a - l.start, localEnd: b - l.start, outStart: out + (a - s.srcStart) });
    }
    out += s.srcEnd - s.srcStart;
  }
  return spans;
}

/** Arquivo e instante local do quadro no tempo `t` do vídeo editado. */
export function outputToClip(segments: Segment[], clips: readonly Pick<ClipRef, 'id' | 'duration'>[], t: number): { clipId: string; clipIndex: number; local: number } | null {
  if (t < 0) return null;
  const spans = clipSpans(segments, clips);
  for (const s of spans) {
    const len = s.localEnd - s.localStart;
    if (t < s.outStart + len - EPS) return t >= s.outStart - EPS ? { clipId: s.clipId, clipIndex: s.clipIndex, local: s.localStart + Math.max(0, t - s.outStart) } : null;
  }
  const last = spans.at(-1);
  // fim exato do vídeo: último quadro do último pedaço
  if (last && t <= last.outStart + (last.localEnd - last.localStart) + EPS) return { clipId: last.clipId, clipIndex: last.clipIndex, local: last.localEnd };
  return null;
}

/** Instantes (vídeo editado) em que a imagem passa de um clipe para outro. */
export function clipJoins(segments: Segment[], clips: readonly Pick<ClipRef, 'id' | 'duration'>[]): number[] {
  const spans = clipSpans(segments, clips);
  const joins: number[] = [];
  for (let i = 1; i < spans.length; i++) if (spans[i]!.clipId !== spans[i - 1]!.clipId) joins.push(r3(spans[i]!.outStart));
  return joins;
}

/** Palavras de cada clipe (tempo local) postas no original virtual, na ordem dos clipes. */
export function placeWords(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], byClip: Readonly<Record<string, readonly Word[]>>): Word[] {
  const out: Word[] = [];
  for (const l of clipLayout(clips)) for (const w of byClip[l.id] ?? []) out.push({ ...w, start: r3(w.start + l.start), end: r3(w.end + l.start) });
  return out;
}

/** Intervalos de cada clipe (tempo local) postos no original virtual. */
export function placeRanges(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], byClip: Readonly<Record<string, readonly TimeRange[]>>): TimeRange[] {
  const out: TimeRange[] = [];
  for (const l of clipLayout(clips)) for (const r of byClip[l.id] ?? []) out.push({ start: r3(r.start + l.start), end: r3(Math.min(l.end, r.end + l.start)) });
  return out;
}

/**
 * Leva um instante do original virtual de uma ordem de clipes para outra (o mesmo ponto do mesmo
 * arquivo). null = o clipe não está na ordem nova.
 */
export function remapTime(from: readonly Pick<ClipRef, 'id' | 'duration'>[], to: readonly Pick<ClipRef, 'id' | 'duration'>[], src: number, isEnd = false): number | null {
  const lf = clipLayout(from);
  const lt = new Map(clipLayout(to).map((l) => [l.id, l]));
  // fim de intervalo exatamente na emenda pertence ao clipe anterior
  const owner = lf.find((l, i) => (isEnd ? src > l.start + EPS && src <= l.end + EPS : src >= l.start - EPS && (src < l.end - EPS || i === lf.length - 1)));
  if (!owner) return null;
  const target = lt.get(owner.id);
  if (!target) return null;
  return r3(target.start + Math.min(owner.end - owner.start, Math.max(0, src - owner.start)));
}

/** Trechos mantidos levados para outra ordem de clipes, ordenados de novo. Pedaços de clipes que saíram somem. */
export function remapSegments(segments: Segment[], from: readonly Pick<ClipRef, 'id' | 'duration'>[], to: readonly Pick<ClipRef, 'id' | 'duration'>[]): Segment[] {
  const out: Segment[] = [];
  for (const s of splitAtClips(segments, from)) {
    const a = remapTime(from, to, s.srcStart);
    const b = remapTime(from, to, s.srcEnd, true);
    if (a === null || b === null || b - a <= EPS) continue;
    out.push({ srcStart: a, srcEnd: b });
  }
  return out.sort((x, y) => x.srcStart - y.srcStart);
}

/** Intervalo do original inteiro dentro de um clipe só? (trechos ajustados que atravessam clipes não sobrevivem a reordenar) */
export function withinOneClip(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], r: { srcStart: number; srcEnd: number }): boolean {
  const a = clipAt(clips, r.srcStart);
  const b = clipAt(clips, Math.max(r.srcStart, r.srcEnd - 1e-3));
  return !!a && !!b && a.id === b.id;
}


/** Recupera tempos locais da transcrição salva para que desfazer/reordenar nunca use a ordem antiga. */
export function unplaceWords(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], words: readonly Word[]): Record<string, Word[]> {
  const byClip: Record<string, Word[]> = Object.fromEntries(clips.map((c) => [c.id, []]));
  for (const w of words) {
    const at = clipAt(clips, Math.min(w.start, Math.max(0, totalDuration(clips) - 1e-4)));
    if (!at) continue;
    const start = Math.max(0, Math.round(at.local * 1000) / 1000);
    const end = Math.min(clips[at.index]!.duration, Math.round((w.end - clipLayout(clips)[at.index]!.start) * 1000) / 1000);
    if (end > start) byClip[at.id]!.push({ ...w, start, end });
  }
  return byClip;
}

/** Recupera intervalos por clipe, partindo silêncios que eventualmente atravessam emendas. */
export function unplaceRanges(clips: readonly Pick<ClipRef, 'id' | 'duration'>[], ranges: readonly TimeRange[]): Record<string, TimeRange[]> {
  const byClip: Record<string, TimeRange[]> = Object.fromEntries(clips.map((c) => [c.id, []]));
  for (const l of clipLayout(clips)) {
    for (const r of ranges) {
      const a = Math.max(r.start, l.start);
      const b = Math.min(r.end, l.end);
      if (b > a) byClip[l.id]!.push({ start: r3(a - l.start), end: r3(b - l.start) });
    }
  }
  return byClip;
}
