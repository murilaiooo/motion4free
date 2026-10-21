import { sceneEditIsEmpty } from '../core/edits';
import type { EditPlan } from '../core/types';
import { sceneKeys, sceneText } from './elements';

export function preserveManualScenes(base: EditPlan, next: EditPlan): EditPlan {
  const originalKeys = sceneKeys(base);
  const proposedKeys = sceneKeys(next);
  const entries: { scene: EditPlan['scenes'][number]; oldKey: string | null }[] = next.scenes.map(scene => ({ scene, oldKey: null }));
  for (const [index, scene] of base.scenes.entries()) {
    const key = originalKeys[index]!;
    const edit = base.edits.scenes[key];
    if (!edit || sceneEditIsEmpty(edit)) continue;
    const candidates = entries.map((entry, position) => ({ entry, position }))
      .filter(candidate => candidate.entry.oldKey === null && candidate.entry.scene.kind === scene.kind);
    const sameKey = candidates.find(candidate => proposedKeys[candidate.position] === key);
    const sameText = candidates.filter(candidate => sceneText(scene) !== null && sceneText(candidate.entry.scene) === sceneText(scene));
    const singleton = ['end-cta', 'kinetic-title', 'progress-bar'].includes(scene.kind) ? candidates : [];
    const closest = [...sameText, ...singleton].sort((left, right) => Math.abs(left.entry.scene.start - scene.start) - Math.abs(right.entry.scene.start - scene.start))[0];
    const target = sameKey ?? closest;
    const retained = { scene, oldKey: key };
    if (target) entries[target.position] = retained;
    else entries.push(retained);
  }
  const ids = new Set<string>();
  const scenes = entries.map(({ scene }, index) => {
    const id = ids.has(scene.id) ? `retained-${index}` : scene.id;
    ids.add(id);
    return id === scene.id ? scene : { ...scene, id };
  });
  const result = { ...next, scenes };
  const keys = sceneKeys(result);
  const edits = { ...base.edits.scenes };
  for (const entry of entries) if (entry.oldKey) delete edits[entry.oldKey];
  entries.forEach((entry, index) => { if (entry.oldKey) edits[keys[index]!] = base.edits.scenes[entry.oldKey]!; });
  return { ...result, edits: { ...base.edits, scenes: edits } };
}
