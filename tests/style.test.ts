import { describe, expect, it } from 'vitest';
import { DOCUMENTAL, EDITORIAL, POP, PRESETS, presetById } from '../src/core/presets';
import { cssFont, fontsOf, styleSchema } from '../src/core/style';

describe('StyleDNA', () => {
  it('os 3 presets passam no esquema', () => {
    for (const p of PRESETS) expect(styleSchema.safeParse(p).success, p.id).toBe(true);
  });

  it('presets têm personalidades opostas: tipografia, movimento, ritmo e layout diferentes', () => {
    const a = [EDITORIAL, POP, DOCUMENTAL];
    const distinct = (f: (s: (typeof a)[number]) => unknown) => new Set(a.map((s) => JSON.stringify(f(s)))).size;
    expect(distinct((s) => s.type.display.family)).toBe(3);
    expect(distinct((s) => s.type.text.family)).toBe(3);
    expect(distinct((s) => s.motion.enter)).toBe(3);
    expect(distinct((s) => s.motion.ease)).toBe(3);
    expect(distinct((s) => s.captions.highlight)).toBe(3);
    expect(distinct((s) => s.transition)).toBe(3);
    expect(distinct((s) => s.rhythm.overlaysPer10s)).toBe(3);
    expect(distinct((s) => [s.layout.align, s.captions.position])).toBe(3);
    // Pop é o mais denso e o mais intenso; Documental o mais contido
    expect(POP.rhythm.overlaysPer10s).toBeGreaterThan(EDITORIAL.rhythm.overlaysPer10s);
    expect(EDITORIAL.rhythm.overlaysPer10s).toBeGreaterThan(DOCUMENTAL.rhythm.overlaysPer10s);
    expect(POP.motion.intensity).toBeGreaterThan(EDITORIAL.motion.intensity);
    expect(EDITORIAL.motion.intensity).toBeGreaterThan(DOCUMENTAL.motion.intensity);
  });

  it('legendas de todos os estilos são maiores que as da v0.2 (6,2% da largura)', () => {
    for (const p of PRESETS) expect(p.captions.size).toBeGreaterThan(0.062);
  });

  it('cor inválida é recusada', () => {
    expect(styleSchema.safeParse({ ...POP, palette: { ...POP.palette, text: 'red' } }).success).toBe(false);
  });

  it('peso de fonte que não existe no app é recusado', () => {
    expect(styleSchema.safeParse({ ...POP, type: { ...POP.type, display: { ...POP.type.display, weight: 700 } } }).success).toBe(false);
  });

  it('cssFont gera fonte com reserva do sistema', () => {
    expect(cssFont(EDITORIAL.type.emphasis, 80)).toBe('italic 400 80px "Instrument Serif", Georgia, serif');
    expect(cssFont(POP.type.text, 95.04)).toBe('900 95.04px "Montserrat", system-ui, sans-serif');
  });

  it('fontsOf lista cada fonte uma vez', () => {
    expect(fontsOf(POP)).toEqual([
      { family: 'Anton', weight: 400, style: 'normal' },
      { family: 'Montserrat', weight: 900, style: 'normal' },
      { family: 'Montserrat', weight: 800, style: 'normal' },
    ]);
  });

  it('presetById', () => {
    expect(presetById('documental')).toBe(DOCUMENTAL);
    expect(presetById('nada')).toBeUndefined();
  });
});
