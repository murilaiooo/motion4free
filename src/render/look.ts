import { lookIsEmptyText, resolveFont, type ElementEnter, type TextLook } from '../core/edits';
import type { FontSpec, MotionEnter, StyleDNA } from '../core/style';

/**
 * Aparência escolhida à mão (v0.13) aplicada sobre o StyleDNA do vídeo, só para um elemento.
 * Função pura e memorizada: o mesmo estilo + a mesma aparência devolvem o mesmo objeto (o desenho
 * não cria objetos novos a cada quadro).
 */

const TRANSPARENT = '#00000000';

function font(spec: FontSpec, look: TextLook): FontSpec {
  let out = spec;
  if (look.font || look.weight !== undefined || look.italic !== undefined) {
    const f = resolveFont(look.font ?? spec.family, look.weight ?? spec.weight, look.italic ?? spec.style === 'italic');
    out = { ...out, family: f.family, weight: f.weight, style: f.style };
  }
  if (look.case) out = { ...out, case: look.case };
  return out;
}

/** Entrada pedida → entrada das cenas (as cenas usam o vocabulário do movimento do estilo). */
const SCENE_ENTER: Record<Exclude<ElementEnter, 'auto' | 'none'>, MotionEnter> = { fade: 'zoom', pop: 'pop', rise: 'rise', slide: 'slide', bounce: 'drop', typewriter: 'type' };

function motion(style: StyleDNA, look: TextLook): StyleDNA['motion'] {
  let m = style.motion;
  if (look.intensity !== undefined) m = { ...m, intensity: look.intensity };
  if (look.enter && look.enter !== 'auto') {
    m = look.enter === 'none' ? { ...m, inSec: 0.05, enter: 'wipe' } : { ...m, enter: SCENE_ENTER[look.enter] };
    if (look.enter === 'fade') m = { ...m, intensity: Math.min(m.intensity, 0.15) };
  }
  if (look.exit === 'none') m = { ...m, outSec: 0.05 };
  return m;
}

const sceneCache = new WeakMap<StyleDNA, Map<string, StyleDNA>>();
const captionCache = new WeakMap<StyleDNA, Map<string, StyleDNA>>();

function memo(cache: WeakMap<StyleDNA, Map<string, StyleDNA>>, style: StyleDNA, look: TextLook, make: () => StyleDNA): StyleDNA {
  if (lookIsEmptyText(look)) return style;
  let m = cache.get(style);
  if (!m) cache.set(style, (m = new Map()));
  const k = JSON.stringify(look);
  let s = m.get(k);
  if (!s) {
    s = make();
    if (m.size > 200) m.clear();
    m.set(k, s);
  }
  return s;
}

/** Estilo para desenhar uma cena (título, número, lista, citação, nome, chamada) com a aparência pedida. */
export function sceneStyle(style: StyleDNA, look: TextLook): StyleDNA {
  return memo(sceneCache, style, look, () => {
    const P = { ...style.palette };
    if (look.text) {
      P.text = look.text;
      P.onPanel = look.text;
    }
    if (look.highlight) {
      P.accent = look.highlight;
      P.accent2 = look.highlight;
    }
    let shape = style.shape;
    if (look.box === 'none') shape = { ...shape, panel: 'none' };
    else if (look.box) {
      P.panel = look.box;
      shape = { ...shape, panel: 'box' };
    }
    if (look.shadow === false) P.shadow = TRANSPARENT;
    else if (look.shadow === true && shape.shadow === 'none') shape = { ...shape, shadow: 'soft' };
    const layout = look.align ? { ...style.layout, align: look.align === 'left' ? ('left' as const) : ('center' as const) } : style.layout;
    return {
      ...style,
      palette: P,
      shape,
      layout,
      motion: motion(style, look),
      type: { ...style.type, display: font(style.type.display, look), text: font(style.type.text, look), label: font(style.type.label, look) },
    };
  });
}

/** Estilo para desenhar a legenda com a aparência pedida (cores, fonte, caixa, contorno, destaque, entrada). */
export function captionStyle(style: StyleDNA, look: TextLook): StyleDNA {
  return memo(captionCache, style, look, () => {
    const C = style.captions;
    const colors = { ...C.colors };
    if (look.text) colors.text = look.text;
    if (look.highlight) colors.highlight = look.highlight;
    if (look.stroke) colors.stroke = look.stroke;
    let box = look.boxMode ?? C.box;
    if (look.box === 'none') box = 'none';
    else if (look.box) {
      colors.box = look.box;
      if (box === 'none') box = 'line';
    }
    const captions = {
      ...C,
      colors,
      box,
      stroke: look.strokeWidth ?? C.stroke,
      wordsPerLine: look.wordsPerLine ?? C.wordsPerLine,
      highlight: look.highlightMode ?? C.highlight,
      enter: look.enter ?? C.enter,
    };
    const m = look.intensity !== undefined ? { ...style.motion, intensity: look.intensity } : style.motion;
    return { ...style, captions, motion: m, type: { ...style.type, text: font(style.type.text, look), emphasis: look.font ? font(style.type.emphasis, look) : style.type.emphasis } };
  });
}
