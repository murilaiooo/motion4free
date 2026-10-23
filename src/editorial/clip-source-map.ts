import { clipLayout } from '../engine/clips';
import type { EditPlan } from '../core/types';

/** Provenance of a derived clip; original media remains untouched and local. */
export interface ClipOrigin { version: 1; sourceId: string; sourceOffset: number; sourceEnd?: number; sourceDuration: number; derivedDuration: number }
export type ClipOrigins = Record<string, ClipOrigin>;
export interface OriginalSpan { sourceId: string; sourceStart: number; sourceEnd: number; outputStart: number; outputEnd: number }

/** Compose current non-destructive EDL with clip provenance; reordered/trimmed pieces keep their source clock. */
export function originalOutputSpans(plan: Pick<EditPlan, 'clips' | 'segments'>, origins: ClipOrigins): OriginalSpan[] {
  const layouts = clipLayout(plan.clips);
  const result: OriginalSpan[] = [];
  let output = 0;
  for (const segment of plan.segments) {
    for (const clip of layouts) {
      const start = Math.max(segment.srcStart, clip.start);
      const end = Math.min(segment.srcEnd, clip.end);
      if (end <= start) continue;
      const origin = origins[clip.id];
      if (origin) {
        // Encoder padding beyond the original or recorded derived duration has no source span.
        const localStart = start - clip.start;
        const localEnd = Math.min(end - clip.start, (origin.sourceEnd ?? origin.sourceDuration) - origin.sourceOffset, origin.derivedDuration, origin.sourceDuration - origin.sourceOffset);
        if (localEnd <= localStart) continue;
        result.push({ sourceId: origin.sourceId,
          sourceStart: origin.sourceOffset + localStart, sourceEnd: origin.sourceOffset + localEnd,
          outputStart: output + start - segment.srcStart,
          outputEnd: output + start - segment.srcStart + localEnd - localStart });
      }
    }
    output += segment.srcEnd - segment.srcStart;
  }
  return result;
}
