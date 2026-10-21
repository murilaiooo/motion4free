import { describe, expect, it } from 'vitest';
import { MB } from '../src/core/bytes';
import { bestFittingModel, modelFit } from '../src/core/llm-models';

/** Issue #72: 1,7 GB livres não comportam o modelo Forte (~2,3 GB), mas comportam o Padrão. */
describe('modelo de IA cabe no espaço do navegador', () => {
  const free = 1700 * MB;
  it('marca o Forte como "não cabe" e o Padrão como "cabe" com 1,7 GB livres', () => {
    expect(modelFit('forte', free, false)).toBe('nao-cabe');
    expect(modelFit('padrao', free, false)).toBe('cabe');
    expect(modelFit('leve', free, false)).toBe('cabe');
  });
  it('modelo já baixado nunca é bloqueado por espaço', () => {
    expect(modelFit('forte', 0, true)).toBe('baixado');
    expect(bestFittingModel('forte', 0, new Set(['forte']))).toBe('forte');
  });
  it('sem saber o espaço, não bloqueia', () => {
    expect(modelFit('forte', null, false)).toBe('desconhecido');
    expect(bestFittingModel('forte', null, new Set())).toBe('forte');
  });
  it('sugere o maior modelo que cabe, ou nenhum', () => {
    expect(bestFittingModel('forte', free, new Set())).toBe('padrao');
    expect(bestFittingModel('forte', 400 * MB, new Set())).toBe('leve');
    expect(bestFittingModel('padrao', 100 * MB, new Set())).toBeNull();
    expect(bestFittingModel('forte', 100 * MB, new Set(['padrao']))).toBe('padrao');
  });
});
