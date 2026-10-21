import type { SceneEvidence } from '../core/production';
import type { EditPlan, Word } from '../core/types';
import { SCENE_CATALOG } from '../motion/catalog';
import { CONTEXT_LABELS, contextFlags } from './context-policy';

/** Derived from the CURRENT plan, never a claim about historical generator provenance.
 * No text copies, telemetry, console logging or storage. The UI owns this transient report. */
export function sceneEvidence(plan: EditPlan, words: Word[]): SceneEvidence[] {
  return plan.scenes.slice(0, 32).map(scene => {
    const nearby: Word[] = [];
    let out = 0;
    for (const segment of plan.segments) {
      const length = segment.srcEnd - segment.srcStart;
      const a = Math.max(out, scene.start), b = Math.min(out + length, scene.end);
      if (b > a) nearby.push(...words.filter(word => word.start < segment.srcStart + b - out && word.end > segment.srcStart + a - out));
      out += length;
    }
    const unique = [...new Map(nearby.map(word => [word.id, word])).values()];
    const card = SCENE_CATALOG[scene.kind];
    return {
      sceneId: scene.id, name: card.name, start: scene.start, end: scene.end,
      wordIds: unique.slice(0, 40).map(word => word.id),
      coverage: unique.length ? 'nearby-speech' : 'configured-or-manual',
      notes: [card.whenToUse, ...contextFlags(unique.map(word => word.text).join(' ')).map(flag => CONTEXT_LABELS[flag]),
        ...(card.faceSafety !== 'edge-overlay' ? ['Confira se o elemento ou recorte encobre o rosto ou informações.'] : []),
        'Fala próxima indica contexto temporal; não prova que a cena representa uma afirmação verdadeira.'],
    };
  });
}
