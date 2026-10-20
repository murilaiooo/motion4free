import { describe, expect, it } from 'vitest';
import { DOCUMENTAL } from '../src/core/presets';
import { parseEditPlan } from '../src/core/schema';
import { autoEdit, openingTitle } from '../src/editorial/auto-edit';

const w = (id: string, text: string, start: number, end: number) => ({ id, text, start, end });

describe('autoEdit', () => {
  const words = [w('1', 'Três', 0.1, 0.4), w('2', 'dicas', 0.4, 0.8), w('3', 'rápidas.', 0.8, 1.2), w('4', 'Primeiro', 2.6, 3.0)];

  it('gera um plano válido pelo schema', () => {
    const plan = autoEdit(4, [{ start: 1.3, end: 2.5 }], words);
    expect(parseEditPlan(plan).ok).toBe(true);
    expect(plan.segments).toHaveLength(2);
    // abre com número falado: o número grande substitui o título
    expect(plan.scenes.find((s) => s.kind === 'big-number')).toMatchObject({ value: '3', label: 'dicas rápidas' });
    expect(plan.style.id).toBe('pop');
  });

  it('sem número nem apresentação, abre com título cinético', () => {
    const plan = autoEdit(4, [], [w('1', 'Hoje', 0.1, 0.4), w('2', 'vamos', 0.4, 0.8), w('3', 'falar', 0.8, 1.2), w('4', 'disso.', 1.2, 1.6)]);
    expect(plan.scenes.find((s) => s.kind === 'kinetic-title')).toMatchObject({ text: 'Hoje vamos falar disso', start: 0 });
  });

  it('estilo escolhido muda legendas e cenas', () => {
    const plan = autoEdit(4, [], words, DOCUMENTAL);
    expect(plan.style.id).toBe('documental');
    expect(plan.scenes.some((s) => s.kind === 'progress-bar')).toBe(false);
  });

  it('título para na primeira frase', () => {
    expect(openingTitle([w('1', 'Oi.', 0, 0.2), w('2', 'Tudo', 0.3, 0.5)])).toBe('Oi');
  });

  it('sem fala não cria texto na tela (só a barra de progresso do estilo)', () => {
    expect(autoEdit(3, [], []).scenes.map((s) => s.kind)).toEqual(['progress-bar']);
  });
});
