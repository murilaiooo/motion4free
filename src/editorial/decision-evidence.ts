import { resolvePlan } from './elements';
import type { SceneEvidence } from '../core/production';
import type { EditPlan, Word } from '../core/types';
import { SCENE_CATALOG } from '../motion/catalog';
import { CONTEXT_LABELS, contextFlags } from './context-policy';

/** Derived from the CURRENT plan, never a claim about historical generator provenance.
 * No text copies, telemetry, console logging or storage. The UI owns this transient report. */
export function sceneEvidence(plan: EditPlan, words: Word[]): SceneEvidence[] {
  const ordered = [...words].sort((a, b) => a.start - b.start);
  const ends: number[] = []; let latestEnd = 0;
  for (const word of ordered) { latestEnd = Math.max(latestEnd, word.end); ends.push(latestEnd); }
  const firstOverlap = (start: number) => {
    let low = 0, high = ends.length;
    while (low < high) { const mid = (low + high) >>> 1; if (ends[mid]! <= start) low = mid + 1; else high = mid; }
    return low;
  };
  return resolvePlan(plan).scenes.slice(0, 32).map(({ scene }) => {
    const nearby = new Map<string, Word>();
    let out = 0, inspected = 0, truncated = false;
    for (const segment of plan.segments) {
      if (out >= scene.end) break;
      const length = segment.srcEnd - segment.srcStart;
      const a = Math.max(out, scene.start), b = Math.min(out + length, scene.end);
      if (b > a) {
        const start = segment.srcStart + a - out, end = segment.srcStart + b - out;
        for (let i = firstOverlap(start); i < ordered.length && ordered[i]!.start < end; i++) {
          if (++inspected > 512) { truncated = true; break; }
          const word = ordered[i]!;
          if (word.end > start) nearby.set(word.id, word);
        }
      }
      if (truncated) break;
      out += length;
    }
    const unique = [...nearby.values()];
    const card = SCENE_CATALOG[scene.kind];
    return {
      sceneId: scene.id, name: card.name, start: scene.start, end: scene.end,
      wordIds: unique.slice(0, 40).map(word => word.id),
      coverage: unique.length ? 'nearby-speech' : 'configured-or-manual',
      notes: [card.whenToUse, ...(truncated ? ['Contexto limitado às primeiras 512 palavras examinadas; revise o restante da fala.'] : []), ...contextFlags(unique.map(word => word.text).join(' ')).map(flag => CONTEXT_LABELS[flag]),
        ...(card.faceSafety !== 'edge-overlay' ? ['Confira se o elemento ou recorte encobre o rosto ou informações.'] : []),
        'Fala próxima indica contexto temporal; não prova que a cena representa uma afirmação verdadeira.'],
    };
  });
}
