import { describe, expect, it } from 'vitest';
import { AppError } from '../src/core/errors';
import { checkPortugueseTranslation, dominantLanguage } from '../src/editorial/translation-check';
import { translatedCaptions } from '../src/editorial/subtitle-translation';

describe('conferência da tradução para PT-BR (#175)', () => {
  it('recusa as saídas reais do relato: código interno, francês e espanhol', () => {
    expect(checkPortugueseTranslation('This is bizarre.', ">>pt_BR<< C'est bizarre.")).toBe('marcador');
    expect(checkPortugueseTranslation('This is bizarre.', '>>PT_BR<< Isso é bizarro.')).toBe('marcador');
    expect(checkPortugueseTranslation('This is bizarre.', "C'est bizarre.")).toBe('outro-idioma');
    expect(checkPortugueseTranslation('Some like you giant', 'Algunos como tú gigantes')).toBe('outro-idioma');
    expect(checkPortugueseTranslation('If you want', 'Si vous voulez')).toBe('outro-idioma');
    expect(checkPortugueseTranslation('I have a lot of things to do', 'Tengo muchas cosas que hacer, pero no hay tiempo')).toBe('outro-idioma');
    expect(checkPortugueseTranslation('This is very good', 'Questo è molto buono')).toBe('outro-idioma');
  });

  it('recusa vazio, tokens internos, inglês não traduzido, laços e texto inflado', () => {
    expect(checkPortugueseTranslation('Hello', '   ')).toBe('vazia');
    expect(checkPortugueseTranslation('Hello', '...')).toBe('vazia');
    expect(checkPortugueseTranslation('Hello', 'Olá <unk>')).toBe('marcador');
    expect(checkPortugueseTranslation('Hello', '▁Olá')).toBe('marcador');
    expect(checkPortugueseTranslation('How are you doing today?', 'How are you doing today?')).toBe('ingles');
    expect(checkPortugueseTranslation('And this is what we do', 'And this is what we do')).toBe('ingles');
    expect(checkPortugueseTranslation('Go', 'vai vai vai vai vai')).toBe('repeticao');
    expect(checkPortugueseTranslation('Yes.', 'Sim, e então ele disse que ia voltar para casa amanhã cedo com a família inteira.')).toBe('tamanho');
  });

  it('aceita português natural, inclusive frases curtas, nomes e números', () => {
    const ok: [string, string][] = [
      ['Hello, how are you?', 'Olá, como você está?'],
      ['This is bizarre.', 'Isso é bizarro.'],
      ["I don't know what you're talking about.", 'Não sei do que você está falando.'],
      ['We sold 3,000 units in 2025.', 'Vendemos 3.000 unidades em 2025.'],
      ['John and Mary went to Paris.', 'John e Mary foram para Paris.'],
      ['Okay.', 'Ok.'],
      ['Thank you!', 'Obrigado!'],
      ['Some people like you are giants.', 'Algumas pessoas como você são gigantes.'],
      ['The show was great, the light was perfect.', 'O show foi ótimo, a luz estava perfeita.'],
      ['Hello world.', 'Olá mundo'],
    ];
    for (const [src, pt] of ok) expect(checkPortugueseTranslation(src, pt), pt).toBeNull();
  });

  it('identifica o idioma dominante só quando há sinal claro', () => {
    expect(dominantLanguage('Isso não é o que você pensa')).toBe('pt');
    expect(dominantLanguage("C'est très bizarre, vous savez")).toBe('fr');
    expect(dominantLanguage('Pero usted también lo sabe')).toBe('es');
    expect(dominantLanguage('Paris 2025')).toBeNull();
  });

  it('um trecho ruim recusa a faixa inteira com M4F-318, sem montar legendas parciais', () => {
    const groups = [
      { source: 'Hello, how are you?', start: 0, end: 1 },
      { source: 'This is bizarre.', start: 1.2, end: 2 },
    ];
    let err: unknown;
    try { translatedCaptions(groups, ['Olá, como você está?', ">>pt_BR<< C'est bizarre."]); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('M4F-318');
    expect((err as AppError).detail).toContain('trecho 2 de 2');
    expect(translatedCaptions(groups, ['Olá, como você está?', 'Isso é bizarro.']).map((c) => c.text)).toEqual(['Olá, como você está?', 'Isso é bizarro.']);
  });
});
