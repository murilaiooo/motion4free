export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Recorte do quadro de origem que preenche o destino sem distorcer (object-fit: cover, centralizado). */
export function coverCrop(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const w = srcH * dstRatio;
    return { x: (srcW - w) / 2, y: 0, w, h: srcH };
  }
  const h = srcW / dstRatio;
  return { x: 0, y: (srcH - h) / 2, w: srcW, h };
}

/** Área onde texto não é coberto pela interface do Instagram Reels (margens conservadoras). */
export function reelsSafeArea(w: number, h: number): Rect {
  const top = Math.round(h * 0.12);
  const bottom = Math.round(h * 0.22);
  const side = Math.round(w * 0.06);
  return { x: side, y: top, w: w - 2 * side, h: h - top - bottom };
}

/** Proporção "em pé" do Reels/TikTok/Shorts (9:16 ou mais alta): vale a área segura do Reels. */
export function isTall(w: number, h: number): boolean {
  return h / w >= 1.5;
}

/**
 * Área segura por formato (v0.14). 9:16: a do Reels (botões e textos do app por cima). 4:5 e 1:1 (feed):
 * a imagem aparece inteira, sobra uma margem pequena. 16:9 (YouTube/TV): margem de "título seguro"
 * de TV, um pouco maior embaixo (barra do player).
 */
export function safeAreaFor(w: number, h: number): Rect {
  if (isTall(w, h)) return reelsSafeArea(w, h);
  const landscape = w > h * 1.2;
  const side = Math.round(w * (landscape ? 0.06 : 0.07));
  const top = Math.round(h * (landscape ? 0.07 : 0.07));
  const bottom = Math.round(h * (landscape ? 0.1 : 0.09));
  return { x: side, y: top, w: w - 2 * side, h: h - top - bottom };
}

/** Unidade de tamanho: 1 px de um quadro cujo lado curto tem 1080 px (letras do mesmo tamanho em todo formato). */
export function unitFor(w: number, h: number): number {
  return Math.min(w, h) / 1080;
}

/** Quebra texto em linhas que cabem em maxWidth, usando a função de medida do canvas. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
