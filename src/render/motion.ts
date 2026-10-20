/**
 * Sistema de movimento (v0.7, ADR-0012). Curvas e molas como funções puras do tempo: o mesmo `t`
 * dá sempre o mesmo valor, sem estado entre quadros (prévia = MP4, seek em qualquer ordem).
 *
 * - `spring`: mola amortecida resolvida analiticamente (não integra quadro a quadro).
 * - `cubicBezier`: a curva do CSS (`cubic-bezier(x1, y1, x2, y2)`), resolvida por Newton + bisseção.
 * - curvas prontas: expo, quint, back com sobra configurável.
 * - `wiggle`: tremor suave e determinístico (soma de senos com fases fixas), para "shake".
 */

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export interface SpringSpec {
  /** oscilações por segundo da mola sem amortecimento */
  freq: number;
  /** 0 < zeta < 1 = passa do ponto e volta (overshoot); 1 = crítica (sem sobra) */
  zeta: number;
}

/**
 * Posição 0→1 de uma mola solta em t=0 (segundos). Valores negativos de t dão 0.
 * Subamortecida passa de 1 e volta; crítica chega em 1 sem passar.
 */
export function spring(t: number, { freq, zeta }: SpringSpec): number {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + ((zeta * w) / wd) * Math.sin(wd * t));
}

/** Mola normalizada numa janela 0..1: começa em 0, termina exatamente em 1 (sem salto no fim). */
export function springIn(x: number, spec: SpringSpec): number {
  const p = clamp01(x);
  const end = spring(1, spec);
  return spring(p, spec) + (1 - end) * p;
}

/** Maior valor que a mola alcança (para testes e para reservar espaço da sobra). */
export function springPeak(spec: SpringSpec): number {
  if (spec.zeta >= 1) return 1;
  return 1 + Math.exp((-Math.PI * spec.zeta) / Math.sqrt(1 - spec.zeta * spec.zeta));
}

/** Curva `cubic-bezier(x1, y1, x2, y2)` do CSS. x1 e x2 em 0..1. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s;
  const sy = (s: number) => ((ay * s + by) * s + cy) * s;
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx;
  return (x: number) => {
    const t = clamp01(x);
    if (t === 0 || t === 1) return t;
    let s = t;
    for (let i = 0; i < 6; i++) {
      const err = sx(s) - t;
      const d = dx(s);
      if (Math.abs(err) < 1e-6) return sy(s);
      if (Math.abs(d) < 1e-6) break;
      s -= err / d;
    }
    let lo = 0;
    let hi = 1;
    s = t;
    for (let i = 0; i < 30; i++) {
      const v = sx(s);
      if (Math.abs(v - t) < 1e-6) break;
      if (v < t) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return sy(s);
  };
}

/** Saída exponencial: arranca rápido e pousa longo (títulos, máscaras). */
export const easeOutExpo = (x: number) => {
  const t = clamp01(x);
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
};
export const easeInExpo = (x: number) => {
  const t = clamp01(x);
  return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
};
export const easeOutQuint = (x: number) => 1 - Math.pow(1 - clamp01(x), 5);
export const easeInOutQuint = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2;
};
export const easeInQuad = (x: number) => clamp01(x) ** 2;
/** "Ease" padrão de motion design (cubic-bezier .2,.8,.2,1): rápido no começo, sem sobra. */
export const easeStandard = cubicBezier(0.2, 0.8, 0.2, 1);
/** Volta com sobra `overshoot` (0.1 = passa 10% e volta). */
export function easeOutBackBy(x: number, overshoot: number): number {
  // c1 que dá aproximadamente a sobra pedida (ajuste numérico: 1.70158 → ~10%)
  const c1 = 1.70158 * (overshoot / 0.1);
  const c3 = c1 + 1;
  const t = clamp01(x);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Atraso de cada item numa entrada em sequência, com teto no total (listas longas não demoram demais). */
export function stagger(i: number, step: number, maxTotal = 0.5, count = 1): number {
  const s = count > 1 ? Math.min(step, maxTotal / (count - 1)) : step;
  return i * s;
}

/** Tremor suave determinístico em -1..1 (soma de senos com fases fixas). `seed` muda o desenho. */
export function wiggle(t: number, freq: number, seed = 0): number {
  const a = Math.sin(2 * Math.PI * freq * t + seed * 1.7);
  const b = Math.sin(2 * Math.PI * freq * 1.93 * t + seed * 4.1 + 1.3);
  const c = Math.sin(2 * Math.PI * freq * 3.07 * t + seed * 2.3 + 0.7);
  return (a * 0.55 + b * 0.3 + c * 0.15);
}

/** Interpolação linear. */
export const mix = (a: number, b: number, k: number) => a + (b - a) * k;
