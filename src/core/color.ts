/**
 * Cores: conversão, contraste (fórmula do WCAG 2) e paleta de uma imagem por median-cut.
 * Tudo puro: recebe números, devolve números. A imagem é lida pelo navegador e só os pixels chegam aqui.
 */
export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const n = hex.replace('#', '');
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

const h2 = (x: number) =>
  Math.round(Math.min(255, Math.max(0, x)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();
export const rgbToHex = ([r, g, b]: RGB) => `#${h2(r)}${h2(g)}${h2(b)}`;

/** Alfa do #RRGGBBAA como sufixo ("" se não houver). */
export const alphaSuffix = (hex: string) => (hex.length === 9 ? hex.slice(7, 9) : '');

/** Luminância relativa (WCAG 2). */
export function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contraste entre duas cores (1 a 21). 4,5 = mínimo do WCAG para texto normal. */
export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map((x) => Math.round(x)) as RGB;
}

/** "Vivacidade" 0..1 (croma): 0 = cinza, 1 = cor pura. */
export const chroma = ([r, g, b]: RGB) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;

export interface PaletteColor {
  hex: string;
  /** fração dos pixels (0..1) */
  share: number;
}

/**
 * Paleta por median-cut: começa com todos os pixels numa caixa e divide sempre a caixa com o maior
 * intervalo num canal, na mediana desse canal, até ter `max` caixas. Cada caixa vira a média dos seus pixels.
 * `pixels` = RGBA em sequência (como ImageData.data). Pixels quase transparentes são ignorados.
 * Determinístico: a mesma imagem dá sempre a mesma paleta, em ordem de tamanho.
 */
export function medianCut(pixels: ArrayLike<number>, max = 6): PaletteColor[] {
  const all: RGB[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) if (pixels[i + 3]! >= 128) all.push([pixels[i]!, pixels[i + 1]!, pixels[i + 2]!]);
  if (all.length === 0) return [];
  const range = (box: RGB[], c: number) => {
    let lo = 255;
    let hi = 0;
    for (const p of box) {
      lo = Math.min(lo, p[c]!);
      hi = Math.max(hi, p[c]!);
    }
    return hi - lo;
  };
  const boxes: RGB[][] = [all];
  while (boxes.length < max) {
    let best = -1;
    let bestRange = 0;
    let bestChannel = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) {
        const r = range(b, c);
        if (r > bestRange) {
          bestRange = r;
          best = i;
          bestChannel = c;
        }
      }
    });
    if (best < 0 || bestRange === 0) break;
    const box = [...boxes[best]!].sort((p, q) => p[bestChannel]! - q[bestChannel]! || p[0] - q[0] || p[1] - q[1] || p[2] - q[2]);
    const mid = Math.floor(box.length / 2);
    boxes.splice(best, 1, box.slice(0, mid), box.slice(mid));
  }
  // a divisão na mediana pode partir uma cor só em duas caixas: cores iguais são somadas
  const merged = new Map<string, number>();
  for (const b of boxes) {
    const sum = b.reduce<RGB>((acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]], [0, 0, 0]);
    const hex = rgbToHex([sum[0] / b.length, sum[1] / b.length, sum[2] / b.length]);
    merged.set(hex, (merged.get(hex) ?? 0) + b.length);
  }
  return [...merged]
    .map(([hex, n]) => ({ hex, share: n / all.length }))
    .sort((a, b) => b.share - a.share || a.hex.localeCompare(b.hex));
}

/** Texto sobre uma caixa colorida: `preferred` se contrastar (≥ 3:1), senão preto ou branco, o que contrastar mais. */
export function onBox(boxColor: string, preferred: string): string {
  const bg = hexToRgb(boxColor);
  if (contrast(bg, hexToRgb(preferred)) >= 3) return preferred;
  return contrast(bg, [11, 11, 11]) >= contrast(bg, [255, 255, 255]) ? '#0B0B0B' : '#FFFFFF';
}
