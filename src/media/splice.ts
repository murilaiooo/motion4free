import type { EditPlan, Segment, TimeRange } from '../core/types';
import { clipLayout } from '../engine/clips';

export interface SpliceJoins {
  /** duração total da mistura nas emendas entre clipes (s) */
  crossfadeSec: number;
  /** extensão de cada clipe no original virtual: a mistura só lê material do mesmo clipe */
  clips: readonly TimeRange[];
}

/**
 * Junta os trechos mantidos de cada canal de áudio, com fade curto em cada emenda para não estalar.
 * Com `joins` (v0.14), a emenda entre dois clipes vira uma mistura curta (cosseno, potência constante):
 * o fim do clipe anterior continua um pouco além do corte enquanto o começo do próximo entra um pouco
 * antes, sem mudar a duração. Onde não há material do mesmo clipe (borda do arquivo), aquele lado só
 * some suave. Puro (roda na tela e no Worker) e testado em tests/splice.test.ts.
 */
export function spliceAudio(channels: Float32Array[], sampleRate: number, segments: Segment[], fadeSec = 0.008, joins?: SpliceJoins): Float32Array[] {
  const ranges = segments.map((s) => [Math.round(s.srcStart * sampleRate), Math.round(s.srcEnd * sampleRate)] as const);
  const total = ranges.reduce((acc, [a, b]) => acc + (b - a), 0);
  const fade = Math.round(fadeSec * sampleRate);
  const clipBounds = (joins?.clips ?? []).map((c) => [Math.round(c.start * sampleRate), Math.round(c.end * sampleRate)] as const);
  const clipOf = (sample: number) => clipBounds.findIndex(([a, b]) => sample >= a && sample < b);
  // emenda k (entre o trecho k e o k+1) é troca de clipe?
  const isJoin = ranges.map((r, k) => {
    const next = ranges[k + 1];
    if (!joins || !next || joins.crossfadeSec <= 0) return false;
    return clipOf(r[1] - 1) !== clipOf(next[0]);
  });
  const half = joins ? Math.max(1, Math.round((joins.crossfadeSec * sampleRate) / 2)) : 0;
  return channels.map((ch) => {
    const out = new Float32Array(total);
    let o = 0;
    ranges.forEach(([a, b], k) => {
      const len = Math.max(0, Math.min(b, ch.length) - a);
      out.set(ch.subarray(a, a + len), o);
      const joinBefore = k > 0 && isJoin[k - 1]!;
      const joinAfter = isJoin[k]!;
      for (let i = 0; i < Math.min(fade, len); i++) {
        const g = i / fade;
        if (!joinBefore) out[o + i]! *= g;
        if (!joinAfter) out[o + len - 1 - i]! *= g;
      }
      o += b - a;
    });
    // misturas nas trocas de clipe
    let pos = 0;
    ranges.forEach(([a, b], k) => {
      pos += b - a;
      if (!isJoin[k]) return;
      const next = ranges[k + 1]!;
      const [ca0, ca1] = clipBounds[clipOf(b - 1)] ?? [a, b];
      const [cb0, cb1] = clipBounds[clipOf(next[0])] ?? [next[0], next[1]];
      const h = Math.min(half, b - a, next[1] - next[0]);
      for (let n = -h; n < h; n++) {
        const idx = pos + n;
        if (idx < 0 || idx >= total) continue;
        const g = (n + h) / (2 * h); // 0 → 1 ao longo da mistura
        const fin = Math.sin((g * Math.PI) / 2);
        const fout = Math.cos((g * Math.PI) / 2);
        const sa = b + n; // material do clipe anterior (passa do corte quando n ≥ 0)
        const sb = next[0] + n; // material do próximo (antes do corte quando n < 0)
        const va = sa >= ca0 && sa < ca1 && sa < ch.length ? ch[sa]! : 0;
        const vb = sb >= cb0 && sb < cb1 && sb < ch.length ? ch[sb]! : 0;
        out[idx] = va * fout + vb * fin;
      }
    });
    return out;
  });
}

/** Mistura padrão nas trocas de clipe: 40 ms (curta o bastante para não embolar a fala, longa para não estalar). */
export const CLIP_CROSSFADE_SEC = 0.04;

/** Áudio do vídeo editado a partir do áudio do original virtual (todos os clipes, já com o volume acertado). */
export function splicePlan(channels: Float32Array[], sampleRate: number, plan: Pick<EditPlan, 'segments' | 'clips'>, segments: Segment[] = plan.segments): Float32Array[] {
  const clips = clipLayout(plan.clips).map((l) => ({ start: l.start, end: l.end }));
  return spliceAudio(channels, sampleRate, segments, 0.008, clips.length > 1 ? { crossfadeSec: CLIP_CROSSFADE_SEC, clips } : undefined);
}
