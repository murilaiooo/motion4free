import { describe, expect, it } from 'vitest';
import { chroma, contrast, hexToRgb, luminance, medianCut, rgbToHex, type RGB } from '../src/core/color';
import { PRESETS } from '../src/core/presets';
import { styleSchema } from '../src/core/style';
import { applyReference, MIN_CONTRAST, readable, referenceFromPixels } from '../src/editorial/reference';

/** Imagem sintética: blocos de cores com tantos pixels cada. */
function image(blocks: [RGB, number][], alpha = 255): Uint8ClampedArray {
  const total = blocks.reduce((a, [, n]) => a + n, 0);
  const data = new Uint8ClampedArray(total * 4);
  let i = 0;
  for (const [c, n] of blocks) {
    for (let k = 0; k < n; k++) {
      data.set([c[0], c[1], c[2], alpha], i);
      i += 4;
    }
  }
  return data;
}

describe('cores', () => {
  it('contraste do WCAG: preto × branco = 21, igual × igual = 1', () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrast([120, 30, 200], [120, 30, 200])).toBe(1);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 6);
  });

  it('hex vai e volta', () => {
    expect(rgbToHex(hexToRgb('#1A2B3C'))).toBe('#1A2B3C');
    expect(rgbToHex([300, -5, 127.6])).toBe('#FF0080');
  });
});

describe('medianCut', () => {
  it('imagem de duas cores devolve as duas, na ordem de tamanho', () => {
    const p = medianCut(image([[[200, 30, 40], 300], [[20, 40, 200], 100]]), 4);
    expect(p[0]).toEqual({ hex: '#C81E28', share: 0.75 });
    expect(p[1]).toEqual({ hex: '#1428C8', share: 0.25 });
  });

  it('ignora pixels transparentes e imagem vazia dá lista vazia', () => {
    expect(medianCut(image([[[200, 30, 40], 10]], 0))).toEqual([]);
    expect(medianCut([])).toEqual([]);
  });

  it('é determinística e respeita o máximo de cores', () => {
    const blocks: [RGB, number][] = Array.from({ length: 12 }, (_, i) => [[(i * 37) % 256, (i * 91) % 256, (i * 53) % 256], 10 + i]);
    const a = medianCut(image(blocks), 5);
    expect(a).toHaveLength(5);
    expect(medianCut(image(blocks), 5)).toEqual(a);
    expect(a.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 9);
  });
});

describe('referenceFromPixels', () => {
  it('imagem cinza não tem cor de destaque', () => {
    expect(referenceFromPixels(image([[[128, 128, 128], 50], [[20, 20, 20], 50], [[240, 240, 240], 50]]))).toBeNull();
  });
  it('imagem colorida devolve só cores (hex), nada da imagem', () => {
    const ref = referenceFromPixels(image([[[10, 10, 30], 500], [[230, 60, 90], 120]]))!;
    expect(ref.colors.every((c) => /^#[0-9A-F]{6}$/.test(c))).toBe(true);
    expect(ref.colors.some((c) => chroma(hexToRgb(c)) > 0.5)).toBe(true);
  });
});

describe('applyReference: contraste garantido em todos os estilos', () => {
  const refs: [string, RGB[]][] = [
    ['azul-marinho', [[12, 24, 80], [30, 60, 160]]],
    ['amarelo puro', [[255, 230, 0]]],
    ['vermelho e verde', [[200, 20, 30], [20, 160, 60]]],
    ['pastel', [[250, 170, 190], [170, 210, 250]]],
    ['roxo escuro', [[40, 0, 60], [90, 20, 140]]],
  ];
  for (const preset of PRESETS) {
    for (const [name, cols] of refs) {
      it(`${preset.id} + ${name}`, () => {
        const ref = { colors: cols.map(rgbToHex) };
        const s = applyReference(preset, ref);
        expect(styleSchema.safeParse(s).success).toBe(true);
        const P = s.palette;
        // legenda: texto, sombra e degradê não mudam
        expect([P.text, P.muted, P.scrim, P.shadow]).toEqual([preset.palette.text, preset.palette.muted, preset.palette.scrim, preset.palette.shadow]);
        expect(P.accent).not.toBe(preset.palette.accent);
        for (const c of [P.accent, P.accent2]) expect(contrast(hexToRgb(c), [0, 0, 0])).toBeGreaterThanOrEqual(MIN_CONTRAST);
        // texto do painel sempre legível sobre o painel
        expect(contrast(hexToRgb(P.onPanel), hexToRgb(P.panel))).toBeGreaterThanOrEqual(MIN_CONTRAST);
        // palavra falada em caixa (Pop): texto do painel sobre a cor de destaque
        if (preset.captions.highlight === 'box') for (const c of [P.accent, P.accent2]) expect(contrast(hexToRgb(P.onPanel), hexToRgb(c))).toBeGreaterThanOrEqual(MIN_CONTRAST);
      });
    }
  }

  it('sem referência ou sem cor viva = estilo igual', () => {
    expect(applyReference(PRESETS[0]!, null)).toBe(PRESETS[0]);
    expect(applyReference(PRESETS[0]!, { colors: ['#808080'] })).toBe(PRESETS[0]);
  });

  it('readable devolve null quando nenhum tom passa', () => {
    // contraste ≥ 4,5 contra preto E contra branco é impossível
    expect(readable([128, 0, 0], [[0, 0, 0], [255, 255, 255]])).toBeNull();
  });
});
