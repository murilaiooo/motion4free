import { describe, expect, it } from 'vitest';
import { openingTitleSkippingGreeting } from '../src/editorial/selector';
import { autoEdit } from '../src/editorial/auto-edit';
import { wordsFrom } from './helpers/words';

const ws = (text: string) => text.split(' ').map((t) => ({ text: t }));

describe('título de abertura sem cumprimento genérico', () => {
  it('pula o cumprimento e usa o começo da frase seguinte', () => {
    expect(openingTitleSkippingGreeting(ws('Oi gente, tudo bem? Três erros que travam seu negócio.'))).toBe('Três erros que travam');
    expect(openingTitleSkippingGreeting(ws('Fala, galera! Hoje eu vou mostrar'))).toBe('Hoje eu vou mostrar');
  });

  it('só cumprimento no começo: sem título (nada de "Oi" gigante na tela)', () => {
    expect(openingTitleSkippingGreeting(ws('Oi.'))).toBeNull();
    expect(openingTitleSkippingGreeting(ws('Olá pessoal, bom dia!'))).toBeNull();
  });

  it('sem cumprimento de verdade, o título continua o de sempre', () => {
    expect(openingTitleSkippingGreeting(ws('Hoje vamos falar disso.'))).toBe('Hoje vamos falar disso');
    expect(openingTitleSkippingGreeting(ws('Então, três dicas rápidas.'))).toBe('Então três dicas rápidas');
  });

  it('no plano automático, um vídeo que abre com "Oi gente" não ganha título "Oi gente"', () => {
    const words = wordsFrom('Oi gente. Três dicas para gravar melhor hoje.', 0.1);
    const title = autoEdit(6, [], words).scenes.find((s) => s.kind === 'kinetic-title');
    expect(title && 'text' in title ? title.text : '').not.toMatch(/^oi/i);
  });
});
