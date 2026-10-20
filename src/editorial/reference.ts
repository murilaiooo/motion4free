import { alphaSuffix, chroma, contrast, hexToRgb, luminance, medianCut, mix, rgbToHex, type RGB } from '../core/color';
import type { StyleDNA } from '../core/style';
import type { ReferencePalette } from '../core/types';

/**
 * Imagem de referência → cores do estilo. Só as cores de destaque (`accent`, `accent2`) e o painel
 * mudam; texto da legenda, sombra e degradê ficam os do estilo, para a legenda continuar legível.
 * Toda cor nova passa por contraste mínimo (WCAG 4,5:1) contra o que fica por cima dela.
 */

export const MIN_CONTRAST = 4.5;
/** abaixo disto a cor é "cinza" e não serve de destaque */
export const MIN_CHROMA = 0.22;

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

/** Paleta guardada no projeto (só as cores, nunca a imagem). null = imagem sem cor viva. */
export function referenceFromPixels(pixels: ArrayLike<number>): ReferencePalette | null {
  const palette = medianCut(pixels, 6);
  if (!palette.some((c) => chroma(hexToRgb(c.hex)) >= MIN_CHROMA)) return null;
  return { colors: palette.map((c) => c.hex) };
}

/** Cores vivas da referência, da mais forte para a mais fraca (a ordem guardada é por tamanho). */
export function vividColors(ref: ReferencePalette): RGB[] {
  return ref.colors
    .map((hex, i) => ({ rgb: hexToRgb(hex), score: chroma(hexToRgb(hex)) - 0.06 * i }))
    .filter((c) => chroma(c.rgb) >= MIN_CHROMA)
    .sort((a, b) => b.score - a.score)
    .map((c) => c.rgb);
}

/** Clareia (ou, se não der, escurece) a cor até passar em todos os contrastes pedidos; null se nenhuma passar. */
export function readable(color: RGB, against: RGB[], min = MIN_CONTRAST): RGB | null {
  const ok = (c: RGB) => against.every((b) => contrast(c, b) >= min);
  for (const target of [WHITE, BLACK]) {
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const c = mix(color, target, t);
      if (ok(c)) return c;
    }
  }
  return null;
}

/** Contra o que cada cor de destaque precisa ter contraste: o preto (vídeo escuro, sombra) e, se o texto do painel é escuro, ele. */
function accentAgainst(style: StyleDNA): RGB[] {
  const onPanel = hexToRgb(style.palette.onPanel);
  const darkOnPanel = luminance(onPanel) < 0.2;
  return darkOnPanel || style.captions.highlight === 'box' ? [BLACK, onPanel] : [BLACK];
}

export function applyReference(style: StyleDNA, ref: ReferencePalette | null): StyleDNA {
  if (!ref) return style;
  const vivid = vividColors(ref);
  if (vivid.length === 0) return style;
  const against = accentAgainst(style);
  const accent = readable(vivid[0]!, against);
  const accent2 = readable(vivid[1] ?? vivid[0]!, against);
  if (!accent || !accent2) return style;
  const P = { ...style.palette, accent: rgbToHex(accent), accent2: rgbToHex(accent2) };
  const onPanel = hexToRgb(style.palette.onPanel);
  if (alphaSuffix(style.palette.panel) === '' || alphaSuffix(style.palette.panel).toUpperCase() === 'FF') {
    // painel sólido (ex.: caixa amarela do Pop): vira a cor de destaque, com contraste contra o texto do painel
    const panel = readable(vivid[0]!, [onPanel]);
    if (panel) P.panel = rgbToHex(panel);
  } else {
    // painel escuro translúcido: ganha o tom da cor mais escura da imagem, bem escurecido
    const darkest = ref.colors.map(hexToRgb).sort((a, b) => luminance(a) - luminance(b))[0]!;
    let panel = darkest;
    for (let t = 0; t <= 1.0001 && (luminance(panel) > 0.02 || contrast(panel, onPanel) < MIN_CONTRAST); t += 0.05) panel = mix(darkest, BLACK, t);
    P.panel = `${rgbToHex(panel)}${alphaSuffix(style.palette.panel)}`;
  }
  return { ...style, palette: P };
}
