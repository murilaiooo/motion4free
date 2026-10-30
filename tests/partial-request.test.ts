import { describe, expect, it } from 'vitest';
import { nextOf, partialRequest } from '../src/editorial/partial-request';

describe('issue #11: pedidos de troca parcial', () => {
  it.each([
    ['troque só o gancho', 'next-hook'],
    ['outro gancho', 'next-hook'],
    ['Quero outra abertura', 'next-hook'],
    ['muda o gancho por outro', 'next-hook'],
    ['tira o gancho', 'no-hook'],
    ['sem gancho', 'no-hook'],
    ['outro estilo', 'next-style'],
    ['troca só o visual'.replace('troca só o visual', 'quero um visual diferente'), 'next-style'],
  ])('%s → %s', (text, kind) => {
    expect(partialRequest(text)?.kind).toBe(kind);
  });

  it.each(['gancho forte e legenda amarela', 'gancho', 'estilo pop', 'sem emojis', ''])('pedido completo não é troca parcial: %s', (text) => {
    expect(partialRequest(text)).toBeNull();
  });

  it('próximo da lista dá a volta', () => {
    expect(nextOf([1, 2, 3], (x) => x === 3)).toBe(1);
    expect(nextOf([1, 2, 3], () => false)).toBe(1);
    expect(nextOf([], () => true)).toBeNull();
  });
});
