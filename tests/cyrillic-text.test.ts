import { describe, expect, it } from 'vitest';
import { CYRILLIC_FAMILIES, cssFont, cyrillicFallback, FONT_FAMILIES, hasCyrillic } from '../src/core/style';
import { checkPortugueseTranslation, sourceLooksEnglish } from '../src/editorial/translation-check';
import { buildCaptions } from '../src/editorial/captions';

describe('#171: legenda em russo', () => {
  it('toda família tem letras cirílicas próprias ou uma parecida no lugar', () => {
    for (const f of FONT_FAMILIES) {
      const fb = cyrillicFallback(f);
      if (CYRILLIC_FAMILIES.has(f)) expect(fb).toBeNull();
      else expect(CYRILLIC_FAMILIES.has(fb!), f).toBe(true);
    }
    expect(cssFont({ family: 'Anton', weight: 400, style: 'normal' }, 100)).toBe('400 100px "Anton", "Inter", system-ui, sans-serif');
    expect(cssFont({ family: 'Montserrat', weight: 900, style: 'normal' }, 100)).toBe('900 100px "Montserrat", system-ui, sans-serif');
    expect(cssFont({ family: 'Instrument Serif', weight: 400, style: 'italic' }, 50)).toContain('"Cormorant Garamond", Georgia');
  });

  it('detecta cirílico e agrupa legendas em russo normalmente', () => {
    expect(hasCyrillic('Привет, как дела?')).toBe(true);
    expect(hasCyrillic('Olá, tudo bem?')).toBe(false);
    const w = (id: string, text: string, start: number) => ({ id, text, start, end: start + 0.4 });
    const caps = buildCaptions([w('1', 'Привет,', 0), w('2', 'как', 0.4), w('3', 'дела?', 0.8), w('4', 'Хорошо.', 1.6)], [{ srcStart: 0, srcEnd: 3 }]);
    expect(caps.map((c) => c.text)).toEqual(['Привет, как дела?', 'Хорошо.']);
  });

  it('tradutor local só aceita fala em inglês e recusa saída em outro alfabeto', () => {
    expect(sourceLooksEnglish('Hello, how are you? This is the first tip and it is very simple.')).toBe(true);
    expect(sourceLooksEnglish('Привет, как дела? Это первый совет.')).toBe(false);
    expect(sourceLooksEnglish('Três dicas rápidas. Primeira dica: você não precisa de nada.')).toBe(false);
    expect(sourceLooksEnglish('Hola, ¿cómo estás? Esto es muy simple y también fácil.')).toBe(false);
    expect(sourceLooksEnglish('Ok.')).toBe(false);
    expect(checkPortugueseTranslation('Hello friend', 'Привет друг')).toBe('outro-idioma');
  });
});
