import type { StyleDNA } from '../core/style';
import type { Caption } from '../core/types';
import { normalizeToken } from '../editorial/detect';
import type { Ctx2D } from './ctx';
import { clamp01, easeOutBounce, easeOutCubic, progress } from './easing';
import { easeInQuad, easeOutExpo, mix, springIn, stagger, wiggle } from './motion';
import { chromaBehind } from './decor';
import type { Rect } from './layout';
import { onBox } from '../core/color';
import { alphaOf, applyCase, captionFrac, clearShadow, fillBox, setFont, setShadow, type Frame } from './kit';

/** Início de cada palavra: os tempos reais quando batem com o texto, senão proporcional ao tamanho das palavras. */
export function wordTimings(caption: Pick<Caption, 'start' | 'end' | 'wordStarts'>, tokens: string[]): number[] {
  if (caption.wordStarts.length === tokens.length && tokens.length > 0) return caption.wordStarts;
  const lens = tokens.map((t) => t.length + 1);
  const sum = lens.reduce((a, b) => a + b, 0) || 1;
  const span = Math.max(0, caption.end - caption.start);
  let acc = 0;
  return lens.map((l) => {
    const s = caption.start + (acc / sum) * span;
    acc += l;
    return s;
  });
}

/** Índice da palavra sendo falada em `t` (-1 antes da primeira). */
export function activeWord(starts: number[], t: number): number {
  let idx = -1;
  starts.forEach((s, i) => {
    if (t >= s) idx = i;
  });
  return idx;
}

/** Quebra palavras (pelas larguras) em linhas que cabem em maxW; `perLine` > 0 limita as palavras por linha. */
export function layoutLines(widths: number[], space: number, maxW: number, perLine = 0): number[][] {
  const lines: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  widths.forEach((w, i) => {
    const next = cur.length ? curW + space + w : w;
    if (cur.length && (next > maxW || (perLine > 0 && cur.length >= perLine))) {
      lines.push(cur);
      cur = [i];
      curW = w;
    } else {
      cur.push(i);
      curW = next;
    }
  });
  if (cur.length) lines.push(cur);
  return lines;
}

/** Linhas com larguras parecidas (evita uma palavra sozinha na última linha), mesmo número de linhas. */
export function balanceLines(widths: number[], space: number, maxW: number, lines: number[][]): number[][] {
  if (lines.length < 2) return lines;
  let lo = Math.max(...widths);
  let hi = maxW;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (layoutLines(widths, space, mid).length <= lines.length) hi = mid;
    else lo = mid;
  }
  const best = layoutLines(widths, space, hi);
  return best.length === lines.length ? best : lines;
}

/** Cores da legenda: as próprias (pedido) ou as do estilo. */
export function captionColors(style: StyleDNA): { text: string; highlight: string; keyword: string; stroke: string; box: string } {
  const P = style.palette;
  const C = style.captions.colors;
  return {
    text: C.text ?? P.text,
    highlight: C.highlight ?? P.accent,
    keyword: C.highlight ?? P.accent2,
    stroke: C.stroke ?? (alphaOf(P.shadow) > 0 ? P.shadow : '#000000'),
    box: C.box ?? P.panel,
  };
}

/** Topo do bloco da legenda para a posição pedida (sempre dentro da área segura). */
export function captionTop(style: StyleDNA, safe: Rect, blockH: number): number {
  const C = style.captions;
  const at = (frac: number) => safe.y + safe.h * frac - blockH / 2;
  let top: number;
  switch (C.position) {
    case 'bottom':
      return safe.y + safe.h - blockH;
    case 'middle':
      return at(0.7);
    case 'center':
      top = at(0.5);
      break;
    case 'top':
      top = safe.y + safe.h * 0.04;
      break;
    case 'custom':
      top = at(C.y);
      break;
  }
  return Math.min(safe.y + safe.h - blockH, Math.max(safe.y, top));
}

/** Centro vertical aproximado da legenda, em fração da área segura (para os emojis ficarem longe dela). */
export const captionCenterFrac = captionFrac;

type Enter = 'none' | 'fade' | 'pop' | 'rise' | 'slide' | 'bounce' | 'typewriter';
/**
 * Entrada efetiva: 'auto' segue a entrada do estilo (pop cresce, rise sobe, wipe só aparece; desde a v0.9
 * slide desliza, drop quica, zoom aparece suave e type digita palavra a palavra).
 */
export function captionEnter(style: StyleDNA): Enter {
  const e = style.captions.enter;
  if (e !== 'auto') return e;
  const AUTO: Record<StyleDNA['motion']['enter'], Enter> = { pop: 'pop', rise: 'rise', wipe: 'none', slide: 'slide', drop: 'bounce', zoom: 'fade', type: 'typewriter' };
  return AUTO[style.motion.enter];
}

/** Tremor de fita (decor.jitter): pequeno balanço contínuo e um salto curto a cada ~1,7 s. Em px de 1080. */
export function captionJitter(style: StyleDNA, t: number): number {
  const k = style.decor.jitter * (0.35 + 0.65 * style.motion.intensity);
  if (k <= 0) return 0;
  const jump = (t * 0.6) % 1 < 0.045 ? 16 : 0;
  return (wiggle(t, 5, 3) * 4 + jump) * k;
}


/** Lado esquerdo dos botões do Reels (curtir, comentar, compartilhar), na metade de baixo da tela. */
export const REELS_BUTTONS_X = 0.87;

/**
 * Largura máxima da legenda: na metade de baixo ela fica centralizada e sem passar por baixo dos
 * botões da direita (v0.7); em cima, usa a área segura inteira.
 */
export function captionMaxWidth(f: Pick<Frame, 'w' | 'h' | 'safe' | 'style'>): number {
  const full = f.safe.w * 0.94;
  if (captionCenterFrac(f.style) < 0.45) return full;
  return Math.min(full, 2 * (f.w * REELS_BUTTONS_X - f.w / 2) - 12 * (f.w / 1080));
}

export interface CaptionOpts {
  /** a legenda sai animando no fim (há uma pausa antes da próxima) */
  exit?: boolean;
  /** posição escolhida à mão (v0.13): centro normalizado do bloco, tamanho e giro (graus) */
  place?: { x: number; y: number; scale: number; rotate: number } | null;
  /** alinhamento das linhas dentro do bloco (padrão: centro) */
  align?: 'left' | 'center' | 'right';
  /** largura máxima da linha em px (padrão: a do modelo) */
  maxW?: number;
  /** false = sem sombra atrás das letras */
  shadow?: boolean;
  /** marca o começo do desenho da legenda já transformada (medida das caixas, v0.13) */
  onBegin?: () => void;
}

/** Entrada de cada palavra em sequência (pop/rise): atraso da palavra i. */
export const WORD_STAGGER = 0.035;
const WORD_STAGGER_MAX = 0.2;
const EXIT_SEC = 0.12;
const POP_SPRING = { freq: 1.35, zeta: 0.48 };
const ACTIVE_SPRING = { freq: 1.6, zeta: 0.42 };

/**
 * Legenda no estilo Reels: grande, em negrito, com a palavra falada em destaque (caixa que desliza de
 * palavra em palavra, cor, sublinhado que cresce ou "revelação") e palavras-chave na fonte/cor de ênfase.
 * Entrada palavra a palavra com mola, saída curta quando há pausa, contorno nítido com sombra suave.
 * Devolve o retângulo ocupado (para os emojis ficarem perto sem cobrir).
 */
export function drawCaption(ctx: Ctx2D, f: Frame, caption: Caption, t: number, keywords: ReadonlySet<string>, opts: CaptionOpts = {}): Rect | null {
  const { style, u, safe } = f;
  const C = style.captions;
  const K = captionColors(style);
  const enterKind = captionEnter(style);
  const spec = style.type.text;
  const em = style.type.emphasis;
  const tokens = caption.text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  const shown = tokens.map((tk) => applyCase(spec, tk));
  const starts = wordTimings(caption, tokens);
  const active = activeWord(starts, t);
  const isKw = tokens.map((tk) => keywords.has(normalizeToken(tk)));
  const emScale = em.family !== spec.family ? 1.16 : 1;
  const maxW = opts.maxW ?? captionMaxWidth(f);
  const place = opts.place ?? null;
  const align = opts.align ?? 'center';

  let size = C.size * f.w;
  let widths: number[] = [];
  let lines: number[][] = [];
  let space = 0;
  const perLine = C.wordsPerLine;
  const maxLines = perLine > 0 ? Math.min(6, Math.max(C.maxLines, Math.ceil(tokens.length / perLine))) : C.maxLines;
  for (let attempt = 0; attempt < 6; attempt++) {
    setFont(ctx, spec, size);
    // com caixa na palavra falada, o espaço precisa caber o respiro da caixa
    space = ctx.measureText(' ').width + size * (C.box === 'word' ? 0.3 : C.highlight === 'box' || C.highlight === 'marker' ? 0.18 : 0.06);
    widths = shown.map((s, i) => {
      if (isKw[i]) setFont(ctx, em, size * emScale);
      else setFont(ctx, spec, size);
      return ctx.measureText(s).width;
    });
    lines = layoutLines(widths, space, maxW, perLine);
    if (lines.length <= maxLines && Math.max(...widths) <= maxW) break;
    size *= 0.88;
  }
  if (perLine === 0) lines = balanceLines(widths, space, maxW, lines);

  const lineH = size * 1.2;
  const blockH = lines.length * lineH;
  const top = place ? place.y * f.h - blockH / 2 : captionTop(style, safe, blockH);
  const cx = place ? place.x * f.w : f.w / 2;

  // posição de cada palavra (centro x, linha)
  const wordX: number[] = [];
  const wordLine: number[] = [];
  const lineWidths = lines.map((line) => line.reduce((acc, i) => acc + widths[i]!, 0) + space * (line.length - 1));
  const blockW = Math.max(...lineWidths);
  lines.forEach((line, li) => {
    const lineW = lineWidths[li]!;
    let x = align === 'left' ? cx - blockW / 2 : align === 'right' ? cx + blockW / 2 - lineW : cx - lineW / 2;
    for (const i of line) {
      wordX[i] = x + widths[i]! / 2;
      wordLine[i] = li;
      x += widths[i]! + space;
    }
  });
  const lineY = (li: number) => top + lineH * (li + 0.5);

  ctx.save();
  if (place && (place.scale !== 1 || place.rotate !== 0)) {
    const cy = top + blockH / 2;
    ctx.translate(cx, cy);
    if (place.rotate) ctx.rotate((place.rotate * Math.PI) / 180);
    if (place.scale !== 1) ctx.scale(place.scale, place.scale);
    ctx.translate(-cx, -cy);
  }
  opts.onBegin?.();
  const jx = captionJitter(style, t) * u;
  if (jx !== 0) ctx.translate(jx, 0);
  // saída curta quando há uma pausa antes da próxima legenda
  const out = opts.exit ? easeInQuad(progress(t, caption.end - EXIT_SEC, EXIT_SEC)) : 0;
  if (out > 0) {
    ctx.globalAlpha *= 1 - out;
    const s = 1 - 0.06 * out;
    ctx.translate(cx, top + blockH / 2 - 8 * u * out);
    ctx.scale(s, s);
    ctx.translate(-cx, -(top + blockH / 2));
  }
  // entradas do bloco inteiro (as de palavra a palavra ficam por palavra, abaixo)
  const enter = progress(t, caption.start, enterKind === 'bounce' ? 0.4 : 0.22);
  if (enterKind === 'fade') {
    ctx.globalAlpha *= enter;
  } else if (enterKind === 'slide') {
    ctx.translate(-(1 - easeOutExpo(enter)) * 70 * u, 0);
    ctx.globalAlpha *= clamp01(enter * 2);
  } else if (enterKind === 'bounce') {
    ctx.translate(0, -(1 - easeOutBounce(enter)) * 70 * u);
    ctx.globalAlpha *= clamp01(enter * 4);
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  /** entrada da palavra i (pop: mola na escala; rise: sobe um pouco) */
  const wordEnter = (i: number) => {
    const ws = caption.start + stagger(i, WORD_STAGGER, WORD_STAGGER_MAX, tokens.length);
    if (enterKind === 'pop') {
      const k = progress(t, ws, 0.34);
      return { scale: 0.55 + 0.45 * springIn(k, POP_SPRING), dy: 0, alpha: clamp01(k * 5) };
    }
    if (enterKind === 'rise') {
      const k = progress(t, ws, 0.3);
      return { scale: 1, dy: (1 - easeOutExpo(k)) * 26 * u, alpha: clamp01(k * 3) };
    }
    return { scale: 1, dy: 0, alpha: 1 };
  };
  /** a palavra falada cresce com mola; a anterior volta ao tamanho em 0,1 s */
  // palavra-chave falada ganha um "soco" extra, proporcional à intensidade do estilo
  const gainOf = (i: number) => C.activeScale - 1 + (isKw[i] ? 0.14 * style.motion.intensity : 0);
  const activeScaleOf = (i: number) => {
    const gain = gainOf(i);
    if (gain <= 0) return 1;
    if (i === active) return 1 + gain * springIn(progress(t, starts[i]!, 0.28), ACTIVE_SPRING);
    if (i === active - 1) return 1 + gain * (1 - easeOutCubic(progress(t, starts[active]!, 0.1)));
    return 1;
  };
  // a palavra que cresce empurra as vizinhas da mesma linha (a linha "respira" sem encavalar letras)
  const growth = tokens.map((_, i) => Math.max(0, wordEnter(i).scale * activeScaleOf(i) - 1) * widths[i]!);
  const xOf = (i: number) => {
    let dx = 0;
    for (const j of lines[wordLine[i]!]!) {
      if (j < i) dx += growth[j]! / 2;
      else if (j > i) dx -= growth[j]! / 2;
    }
    return wordX[i]! + dx;
  };
  const withWord = (i: number, draw: () => void) => {
    const we = wordEnter(i);
    if (we.alpha <= 0) return;
    const y = lineY(wordLine[i]!) + we.dy;
    const sc = we.scale * activeScaleOf(i);
    ctx.save();
    ctx.globalAlpha *= we.alpha;
    if (sc !== 1) {
      ctx.translate(xOf(i), y);
      ctx.scale(sc, sc);
      ctx.translate(-xOf(i), -y);
    }
    draw();
    ctx.restore();
  };

  // 1) caixa atrás de cada linha (digitando: a caixa cresce junto com as palavras que já apareceram)
  const typing = enterKind === 'typewriter';
  if (C.box === 'line') {
    clearShadow(ctx);
    lines.forEach((line, li) => {
      const padX = size * 0.34;
      const padY = size * 0.14;
      const boxH = lineH - 2 + padY;
      const lw = lineWidths[li]!;
      const left = align === 'left' ? cx - blockW / 2 : align === 'right' ? cx + blockW / 2 - lw : cx - lw / 2;
      let w = lw;
      if (typing) {
        const shownIdx = line.filter((i) => i <= active);
        if (shownIdx.length === 0) return;
        const last = shownIdx[shownIdx.length - 1]!;
        w = wordX[last]! + widths[last]! / 2 - left;
      }
      fillBox(ctx, { x: left - padX, y: lineY(li) - boxH / 2, w: w + 2 * padX, h: boxH }, style.shape.radius * boxH, K.box);
    });
  }
  // caixa em cada palavra (v0.9): blocos que entram junto com a palavra
  const wordBoxes = C.box === 'word';
  if (wordBoxes) {
    for (let i = 0; i < tokens.length; i++) {
      if (typing && i > active) continue;
      withWord(i, () => {
        const padX = size * 0.16;
        const h = size * 1.12;
        const y = lineY(wordLine[i]!);
        setShadow(ctx, f, 'hard', 0.6);
        fillBox(ctx, { x: xOf(i) - widths[i]! / 2 - padX, y: y - h / 2, w: widths[i]! + 2 * padX, h }, style.shape.radius * h, K.box);
        clearShadow(ctx);
      });
    }
  }

  // 2) caixa da palavra falada: desliza da palavra anterior (mesma linha) ou cresce com mola
  // enquanto a caixa desliza, o texto escuro "de dentro da caixa" fica na palavra que ela cobre mais
  const slideK = active >= 0 ? easeOutExpo(progress(t, starts[active]!, 0.16)) : 1;
  const sliding = active > 0 && wordLine[active - 1] === wordLine[active] && slideK < 1;
  const boxedIdx = sliding && slideK < 0.5 ? active - 1 : active;
  const boxed = (i: number) => C.highlight === 'box' && i === boxedIdx;
  if (C.highlight === 'box' && active >= 0) {
    const i = active;
    const we = wordEnter(i);
    const padX = size * 0.12;
    const h = size * 1.14;
    const rectOf = (k: number) => ({ x: xOf(k) - widths[k]! / 2 - padX, w: widths[k]! + 2 * padX });
    let r = rectOf(i);
    let grow = 1;
    const prev = i - 1;
    const k = easeOutExpo(progress(t, starts[i]!, 0.16));
    if (prev >= 0 && wordLine[prev] === wordLine[i] && k < 1) {
      const a = rectOf(prev);
      r = { x: mix(a.x, r.x, k), w: mix(a.w, r.w, k) };
    } else {
      grow = 0.6 + 0.4 * springIn(progress(t, starts[i]!, 0.3), ACTIVE_SPRING);
    }
    const y = lineY(wordLine[i]!) + we.dy;
    const sc = grow * we.scale * activeScaleOf(i);
    const bx = r.x + r.w / 2;
    ctx.save();
    ctx.globalAlpha *= we.alpha;
    ctx.translate(bx, y);
    ctx.scale(sc, sc);
    ctx.translate(-bx, -y);
    setShadow(ctx, f, 'hard');
    fillBox(ctx, { x: r.x, y: y - h / 2, w: r.w, h }, style.shape.radius * h, isKw[boxedIdx] ? K.keyword : K.highlight);
    clearShadow(ctx);
    ctx.restore();
  }

  // 2b) marca-texto (v0.9): traço inclinado que se desenha da esquerda para a direita atrás da palavra falada
  const markK = C.highlight === 'marker' && active >= 0 ? easeOutExpo(progress(t, starts[active]!, 0.2)) : 0;
  if (markK > 0) {
    const i = active;
    const we = wordEnter(i);
    const y = lineY(wordLine[i]!) + we.dy + size * 0.06;
    const padX = size * 0.14;
    const x0 = xOf(i) - widths[i]! / 2 - padX;
    const w = (widths[i]! + 2 * padX) * markK;
    const h = size * 0.86;
    ctx.save();
    ctx.globalAlpha *= we.alpha * 0.94;
    ctx.translate(x0, y);
    ctx.rotate(-0.035);
    ctx.fillStyle = isKw[i] ? K.keyword : K.highlight;
    markerPath(ctx, w, h);
    ctx.fill();
    ctx.restore();
  }
  const marked = (i: number) => markK > 0.35 && i === active;

  // 3) contorno (com sombra suave embaixo) e 4) preenchimento, em passadas separadas:
  // o contorno de uma palavra nunca cobre o preenchimento da vizinha
  const visible = (i: number) => !(enterKind === 'typewriter' && i > active);
  const fontOf = (i: number) => (isKw[i] ? em : spec);
  const sizeOf = (i: number) => (isKw[i] ? size * emScale : size);
  const upcoming = (i: number) => {
    if (C.highlight !== 'reveal') return 1;
    if (i > active) return C.upcomingAlpha;
    return mix(C.upcomingAlpha, 1, easeOutCubic(progress(t, starts[i]!, 0.12)));
  };
  if (C.stroke > 0) {
    for (let i = 0; i < tokens.length; i++) {
      if (!visible(i) || boxed(i) || marked(i) || wordBoxes) continue;
      withWord(i, () => {
        ctx.globalAlpha *= upcoming(i);
        setFont(ctx, fontOf(i), sizeOf(i));
        ctx.lineWidth = C.stroke * u;
        ctx.strokeStyle = K.stroke;
        if (opts.shadow !== false) setTextShadow(ctx, f);
        ctx.strokeText(shown[i]!, xOf(i), lineY(wordLine[i]!));
        clearShadow(ctx);
      });
    }
  }
  for (let i = 0; i < tokens.length; i++) {
    if (!visible(i)) continue;
    withWord(i, () => {
      const y = lineY(wordLine[i]!);
      ctx.globalAlpha *= upcoming(i);
      setFont(ctx, fontOf(i), sizeOf(i));
      let color: string | CanvasGradient = isKw[i] ? K.keyword : K.text;
      const lit = (C.highlight === 'color' && i === active) || isKw[i];
      if (C.highlight === 'color' && i === active && !isKw[i]) color = K.highlight;
      if (wordBoxes) color = onBox(K.box, isKw[i] ? K.keyword : K.text);
      // texto sobre a caixa da linha continua legível (caixa clara do Jornal e da Datilografia: letra escura)
      if (C.box === 'line') color = onBox(K.box, color);
      if (boxed(i)) color = onBox(isKw[i] ? K.keyword : K.highlight, style.palette.onPanel);
      if (marked(i)) color = onBox(isKw[i] ? K.keyword : K.highlight, style.palette.onPanel);
      // degradê (v0.9) na palavra acesa, só com as cores do estilo (cor pedida pela pessoa vale mais)
      const plain = !wordBoxes && !boxed(i) && !marked(i);
      if (style.decor.gradient && lit && plain && C.colors.highlight === null) {
        const g = ctx.createLinearGradient(xOf(i) - widths[i]! / 2, y - size / 2, xOf(i) + widths[i]! / 2, y + size / 2);
        g.addColorStop(0, style.palette.accent);
        g.addColorStop(1, style.palette.accent2);
        color = g;
      }
      if (C.highlight === 'underline' && i === active) {
        const grow = easeOutExpo(progress(t, starts[i]!, 0.18));
        ctx.fillStyle = K.highlight;
        ctx.fillRect(xOf(i) - widths[i]! / 2, y + size * 0.52, widths[i]! * grow, Math.max(2, size * 0.08));
      }
      if (C.stroke === 0 && plain && C.box === 'none' && opts.shadow !== false) setShadow(ctx, f, 'soft', 0.9);
      if (plain) chromaBehind(ctx, f, shown[i]!, xOf(i), y);
      ctx.fillStyle = color;
      ctx.fillText(shown[i]!, xOf(i), y);
      clearShadow(ctx);
    });
  }
  // 5) cursor de digitação (v0.9) depois da última palavra que apareceu: firme enquanto digita, piscando na pausa
  if (style.decor.cursor && typing) {
    const last = Math.min(active, tokens.length - 1);
    const li = last >= 0 ? wordLine[last]! : 0;
    const x = last >= 0 ? xOf(last) + widths[last]! / 2 + size * 0.14 : (wordX[lines[0]![0]!] ?? cx) - widths[lines[0]![0]!]! / 2;
    const since = last >= 0 ? t - starts[last]! : t - caption.start;
    const on = since < 0.45 || Math.floor(since * 2.4) % 2 === 0;
    if (on) {
      ctx.fillStyle = K.highlight;
      ctx.fillRect(x, lineY(li) - size * 0.5, Math.max(2, size * 0.1), size * 0.98);
    }
  }
  ctx.restore();
  if (place && (place.scale !== 1 || place.rotate !== 0)) {
    const s = place.scale;
    return { x: cx - (blockW * s) / 2, y: top + blockH / 2 - (blockH * s) / 2, w: blockW * s, h: blockH * s };
  }
  return { x: cx - blockW / 2, y: top, w: blockW, h: blockH };
}

/** Traço de marca-texto (origem no canto esquerdo, no meio da altura): pontas irregulares, como caneta de verdade. */
function markerPath(ctx: Ctx2D, w: number, h: number): void {
  const j = h * 0.12;
  ctx.beginPath();
  ctx.moveTo(j * 0.6, -h / 2 + j * 0.3);
  ctx.lineTo(w - j * 0.4, -h / 2);
  ctx.lineTo(w + j * 0.5, -h * 0.18);
  ctx.lineTo(w - j * 0.2, h * 0.12);
  ctx.lineTo(w + j * 0.3, h / 2 - j * 0.2);
  ctx.lineTo(j * 0.2, h / 2);
  ctx.lineTo(-j * 0.5, h * 0.16);
  ctx.lineTo(0, -h * 0.14);
  ctx.closePath();
}

/** Sombra do contorno da legenda: suave e um pouco para baixo (descola do vídeo sem "borrar" a letra). */
function setTextShadow(ctx: Ctx2D, f: Frame): void {
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 14 * f.u;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 6 * f.u;
}
