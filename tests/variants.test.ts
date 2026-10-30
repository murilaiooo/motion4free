import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';
import { autoEdit } from '../src/editorial/auto-edit';
import { editCaptionText, type EditContext } from '../src/editorial/ops';
import { makeVariants } from '../src/editorial/variants';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const words = wordsFrom(SAMPLE_TEXT);
const duration = words.at(-1)!.end + 0.5;
const ctx: EditContext = { durationSec: duration, words };
const plan = autoEdit(duration, [], words);

describe('issue #118: variações do mesmo vídeo', () => {
  it('cria três variações válidas com estilos de famílias diferentes, sem mexer no plano atual', () => {
    const before = JSON.stringify(plan);
    const variants = makeVariants(plan, ctx);
    expect(variants).toHaveLength(3);
    expect(new Set(variants.map((v) => v.plan.style.id)).size).toBe(3);
    for (const v of variants) {
      expect(parseEditPlan(v.plan).ok).toBe(true);
      expect(v.plan.style.id).not.toBe(plan.style.id);
      expect(v.plan.segments).toBe(plan.segments);
    }
    expect(JSON.stringify(plan)).toBe(before);
  });

  it('ganchos novos são sempre frases da própria fala', () => {
    const spoken = new Set(words.map((w) => w.id));
    for (const v of makeVariants(plan, ctx)) for (const id of v.plan.brief.hook?.wordIds ?? []) expect(spoken.has(id)).toBe(true);
  });

  it('correção manual de legenda continua em todas as variações', () => {
    const first = plan.captions[0]!;
    const edited = editCaptionText(plan, first.id, 'Texto corrigido');
    for (const v of makeVariants(edited, ctx)) {
      const same = v.plan.captions.find((c) => c.wordIds.join() === first.wordIds.join());
      if (same) expect(same.text).toBe('Texto corrigido');
    }
  });
});
