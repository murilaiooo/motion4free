import { describe, expect, it } from 'vitest';
import { count, planSummary } from '../src/core/text';

describe('textos da tela', () => {
  it('conta no singular e no plural', () => {
    expect(count(0, 'legenda', 'legendas')).toBe('0 legendas');
    expect(count(1, 'legenda', 'legendas')).toBe('1 legenda');
    expect(count(2, 'trecho', 'trechos')).toBe('2 trechos');
  });

  it('resumo do plano concorda o número', () => {
    expect(planSummary(1, 1, 1)).toBe('1 trecho · 1 legenda · 1 palavra reconhecida');
    expect(planSummary(2, 0, 5)).toBe('2 trechos · 0 legendas · 5 palavras reconhecidas');
  });
});
