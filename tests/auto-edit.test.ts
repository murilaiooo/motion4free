import { describe, expect, it } from 'vitest';
import { parseEditPlan } from '../src/core/schema';
import { autoEdit, openingTitle } from '../src/editorial/auto-edit';

const w = (id: string, text: string, start: number, end: number) => ({ id, text, start, end });

describe('autoEdit', () => {
  const words = [w('1', 'Três', 0.1, 0.4), w('2', 'dicas', 0.4, 0.8), w('3', 'rápidas.', 0.8, 1.2), w('4', 'Primeiro', 2.6, 3.0)];

  it('gera um plano válido pelo schema', () => {
    const plan = autoEdit(4, [{ start: 1.3, end: 2.5 }], words);
    expect(parseEditPlan(plan).ok).toBe(true);
    expect(plan.segments).toHaveLength(2);
    expect(plan.scenes[0]?.text).toBe('Três dicas rápidas');
  });

  it('título para na primeira frase', () => {
    expect(openingTitle([w('1', 'Oi.', 0, 0.2), w('2', 'Tudo', 0.3, 0.5)])).toBe('Oi');
  });

  it('sem fala não cria título', () => {
    expect(autoEdit(3, [], []).scenes).toEqual([]);
  });
});
