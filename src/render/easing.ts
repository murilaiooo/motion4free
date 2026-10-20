export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeInCubic = (x: number) => Math.pow(clamp01(x), 3);
export const easeOutBack = (x: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const t = clamp01(x);
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Progresso 0..1 de `t` dentro de [start, start+dur]. */
export const progress = (t: number, start: number, dur: number) => (dur <= 0 ? 1 : clamp01((t - start) / dur));
/** Queda com quiques no fim (0..1). */
export const easeOutBounce = (x: number) => {
  const t = clamp01(x);
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) * (t - 1.5 / d) + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) * (t - 2.25 / d) + 0.9375;
  return n * (t - 2.625 / d) * (t - 2.625 / d) + 0.984375;
};
