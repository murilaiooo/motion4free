import type { Segment } from '../core/types';

/**
 * Junta os trechos mantidos de cada canal de áudio, com fade curto
 * em cada emenda para não estalar.
 */
export function spliceAudio(channels: Float32Array[], sampleRate: number, segments: Segment[], fadeSec = 0.008): Float32Array[] {
  const ranges = segments.map((s) => [Math.round(s.srcStart * sampleRate), Math.round(s.srcEnd * sampleRate)] as const);
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
