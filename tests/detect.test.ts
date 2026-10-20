import { describe, expect, it } from 'vitest';
import { findName, isQuestion, keywordScore, normalizeToken, ordinalOf, parseNumberAt, splitSentences } from '../src/editorial/detect';

const toks = (s: string) => s.split(' ');

describe('normalizeToken', () => {
  it('minúsculas, sem pontuação, mantém acentos, % e algarismos', () => {
    expect(normalizeToken('Rápidas.')).toBe('rápidas');
    expect(normalizeToken('"50%,"')).toBe('50%');
    expect(normalizeToken('R$')).toBe('r$');
  });
});

describe('parseNumberAt', () => {
  const at = (s: string, i = 0) => parseNumberAt(toks(s), i);
  it('algarismos', () => {
    expect(at('3 dicas')).toEqual({ value: '3', n: 3, consumed: 1 });
    expect(at('1.000 pessoas')).toEqual({ value: '1.000', n: 1000, consumed: 1 });
    expect(at('2,5 vezes')).toEqual({ value: '2,5', n: 2.5, consumed: 1 });
    expect(at('50% das')).toEqual({ value: '50%', n: 50, consumed: 1 });
    expect(at('10x mais')).toEqual({ value: '10x', n: 10, consumed: 1 });
  });
  it('por extenso em português', () => {
    expect(at('Três dicas')).toEqual({ value: '3', n: 3, consumed: 1 });
    expect(at('vinte e cinco anos')).toEqual({ value: '25', n: 25, consumed: 3 });
    expect(at('cem mil reais')).toEqual({ value: 'R$ 100 mil', n: 100000, consumed: 3 });
    expect(at('dois mil e quinhentos')).toEqual({ value: '2.500', n: 2500, consumed: 4 });
    expect(at('cinquenta por cento')).toEqual({ value: '50%', n: 50, consumed: 3 });
    expect(at('um milhão de')).toEqual({ value: '1 milhão', n: 1e6, consumed: 2 });
    expect(at('duas vezes')).toEqual({ value: '2', n: 2, consumed: 1 });
  });
  it('moeda', () => {
    expect(at('R$ 200')).toEqual({ value: 'R$ 200', n: 200, consumed: 2 });
    expect(at('trezentos reais')).toEqual({ value: 'R$ 300', n: 300, consumed: 2 });
  });
  it('"um/uma" sozinho não é número (é artigo)', () => {
    expect(at('um dia')).toBeNull();
    expect(at('uma coisa')).toBeNull();
    expect(at('e')).toBeNull();
    expect(at('casa')).toBeNull();
  });
});

describe('ordinais de enumeração', () => {
  it('reconhece ordinais e marcadores numerados', () => {
    expect(ordinalOf('Primeiro,')).toBe(1);
    expect(ordinalOf('segunda')).toBe(2);
    expect(ordinalOf('terceiro:')).toBe(3);
    expect(ordinalOf('2.')).toBe(2);
    expect(ordinalOf('3)')).toBe(3);
    expect(ordinalOf('1º')).toBe(1);
    expect(ordinalOf('segunda-feira')).toBeNull();
    expect(ordinalOf('2')).toBeNull();
    expect(ordinalOf('dica')).toBeNull();
  });
});

describe('frases e perguntas', () => {
  it('divide por pontuação final', () => {
    expect(splitSentences(toks('Oi. Tudo bem? Sim'))).toEqual([[0], [1, 2], [3]]);
  });
  it('pergunta por ? ou por palavra interrogativa no início', () => {
    expect(isQuestion(toks('Você sabe por quê?'))).toBe(true);
    expect(isQuestion(toks('Por que isso acontece'))).toBe(true);
    expect(isQuestion(toks('Isso acontece sempre.'))).toBe(false);
  });
});

describe('palavras-chave e nome', () => {
  it('léxico de ênfase e palavras longas pontuam mais que palavras comuns', () => {
    expect(keywordScore('segredo')).toBeGreaterThan(keywordScore('coisa'));
    expect(keywordScore('extraordinário')).toBeGreaterThan(keywordScore('casa'));
    expect(keywordScore('para')).toBe(0);
    expect(keywordScore('Nunca!')).toBeGreaterThan(keywordScore('nunca'));
  });
  it('acha o nome em "meu nome é"/"eu sou o"', () => {
    expect(findName(toks('Oi, meu nome é Ana Souza e hoje'))).toEqual({ index: 4, name: 'Ana Souza' });
    expect(findName(toks('Eu sou o Murilo.'))).toEqual({ index: 3, name: 'Murilo' });
    expect(findName(toks('eu sou muito feliz'))).toBeNull();
  });
});
