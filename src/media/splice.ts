import type { Segment } from '../core/types';

/**
 * Junta os trechos mantidos de cada canal de áudio, com fade curto
 * em cada emenda para não estalar.
 */
export function spliceAudio(channels: Float32Array[], sampleRate: number, segments: Segment[], fadeSec = 0.008): Float32Array[] {
  // pedaços encostados (vídeo dividido na agulha, v0.13) tocam como um só: sem fade no meio da fala
  const ranges: (readonly [number, number])[] = [];
  for (const s of segments) {
    const a = Math.round(s.srcStart * sampleRate);
    const b = Math.round(s.srcEnd * sampleRate);
    const last = ranges.at(-1);
    if (last && Math.abs(last[1] - a) <= 1) ranges[ranges.length - 1] = [last[0], b];
    else ranges.push([a, b]);
  }
  const total = ranges.reduce((acc, [a, b]) => acc + (b - a), 0);
  const fade = Math.round(fadeSec * sampleRate);
  return channels.map((ch) => {
    const out = new Float32Array(total);
    let o = 0;
    for (const [a, b] of ranges) {
      const len = Math.max(0, Math.min(b, ch.length) - a);
      out.set(ch.subarray(a, a + len), o);
      for (let i = 0; i < Math.min(fade, len); i++) {
        const g = i / fade;
        out[o + i]! *= g;
        out[o + len - 1 - i]! *= g;
      }
      o += b - a;
    }
    return out;
  });
}
