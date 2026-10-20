import type { ElementRef } from '../editorial/elements';
import type { Ctx2D } from './ctx';
import type { Rect } from './layout';

/**
 * Onde cada elemento foi desenhado (v0.13): um contexto 2D "de mentira" que não pinta nada, só
 * acompanha transformações e mede o que seria desenhado entre `begin(ref)` e `end()`. Rodar a mesma
 * `drawFrame` nele dá as caixas exatas da prévia e do MP4, sem regra paralela de layout.
 */

/** Marcação de elementos durante o desenho (a `drawFrame` chama, o contexto de medida escuta). */
export interface ElementMarks {
  begin(ref: ElementRef): void;
  end(): void;
}

/** Matriz afim [a, b, c, d, e, f] (como no canvas). */
export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function mul(p: Matrix, q: Matrix): Matrix {
  return [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
}
export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-12;
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}
export const apply = (m: Matrix, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Caixa de um elemento: retângulo no sistema do próprio elemento + matriz para a tela (gira junto). */
export interface ElementBox {
  ref: ElementRef;
  /** retângulo no sistema do elemento */
  local: Rect;
  /** do sistema do elemento para o quadro (px de saída) */
  m: Matrix;
  /** caixa alinhada aos eixos, no quadro */
  aabb: Rect;
}

/** O que basta para medir texto: um contexto de verdade (canvas) ou o falso dos testes. */
export interface Measurer {
  font: string;
  letterSpacing: string;
  measureText(text: string): { width: number };
}

interface Open {
  ref: ElementRef;
  m: Matrix;
  inv: Matrix;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const STATE = ['font', 'textAlign', 'textBaseline', 'lineWidth', 'letterSpacing', 'globalAlpha'] as const;

export class BoundsContext implements ElementMarks {
  font = '10px sans-serif';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  lineWidth = 1;
  letterSpacing = '0px';
  globalAlpha = 1;
  fillStyle: unknown = '#000';
  strokeStyle: unknown = '#000';
  lineJoin: CanvasLineJoin = 'miter';
  lineCap: CanvasLineCap = 'butt';
  shadowColor = 'rgba(0, 0, 0, 0)';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  readonly boxes: ElementBox[] = [];
  private m: Matrix = [...IDENTITY];
  private stack: { m: Matrix; s: Record<string, unknown> }[] = [];
  private open: Open[] = [];
  /** pontos do caminho atual, já no quadro */
  private path: [number, number][] = [];

  constructor(private readonly measure: Measurer) {}

  asCtx(): Ctx2D {
    return this as unknown as Ctx2D;
  }

  begin(ref: ElementRef): void {
    const m: Matrix = [...this.m];
    this.open.push({ ref, m, inv: invert(m), x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  }

  end(): void {
    const o = this.open.pop();
    if (!o || !Number.isFinite(o.x0)) return;
    const local = { x: o.x0, y: o.y0, w: o.x1 - o.x0, h: o.y1 - o.y0 };
    const pts = [apply(o.m, o.x0, o.y0), apply(o.m, o.x1, o.y0), apply(o.m, o.x1, o.y1), apply(o.m, o.x0, o.y1)];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const aabb = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    this.boxes.push({ ref: o.ref, local, m: o.m, aabb });
  }

  /** ponto já no quadro → acumula na caixa de cada elemento aberto (no sistema dele) */
  private add(x: number, y: number): void {
    if (this.open.length === 0 || this.globalAlpha <= 0.001) return;
    for (const o of this.open) {
      const [lx, ly] = apply(o.inv, x, y);
      if (lx < o.x0) o.x0 = lx;
      if (ly < o.y0) o.y0 = ly;
      if (lx > o.x1) o.x1 = lx;
      if (ly > o.y1) o.y1 = ly;
    }
  }
  private addRect(x: number, y: number, w: number, h: number): void {
    if (this.open.length === 0) return;
    for (const [px, py] of [
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h],
    ] as const) {
      const [qx, qy] = apply(this.m, px, py);
      this.add(qx, qy);
    }
  }

  save(): void {
    const s: Record<string, unknown> = {};
    for (const k of STATE) s[k] = this[k];
    this.stack.push({ m: [...this.m], s });
  }
  restore(): void {
    const top = this.stack.pop();
    if (!top) return;
    this.m = top.m;
    Object.assign(this, top.s);
  }
  translate(x: number, y: number): void {
    this.m = mul(this.m, [1, 0, 0, 1, x, y]);
  }
  scale(x: number, y: number): void {
    this.m = mul(this.m, [x, 0, 0, y, 0, 0]);
  }
  rotate(a: number): void {
    this.m = mul(this.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.m = [a, b, c, d, e, f];
  }

  measureText(text: string): TextMetrics {
    this.measure.font = this.font;
    this.measure.letterSpacing = this.letterSpacing;
    return { width: this.measure.measureText(text).width } as TextMetrics;
  }
  private fontSize(): number {
    return Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 10);
  }
  private textBox(text: string, x: number, y: number, pad = 0): void {
    if (this.open.length === 0) return;
    const w = this.measureText(text).width;
    const size = this.fontSize();
    const a = this.textAlign;
    const left = a === 'center' ? x - w / 2 : a === 'right' || a === 'end' ? x - w : x;
    const b = this.textBaseline;
    const top = b === 'middle' ? y - size * 0.58 : b === 'top' || b === 'hanging' ? y - size * 0.05 : b === 'bottom' || b === 'ideographic' ? y - size * 1.1 : y - size * 0.85;
    this.addRect(left - pad, top - pad, w + 2 * pad, size * 1.16 + 2 * pad);
  }
  fillText(text: string, x: number, y: number): void {
    this.textBox(text, x, y);
  }
  strokeText(text: string, x: number, y: number): void {
    this.textBox(text, x, y, this.lineWidth / 2);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    this.addRect(x, y, w, h);
  }
  drawImage(): void {}
  beginPath(): void {
    this.path = [];
  }
  private pt(x: number, y: number): void {
    this.path.push(apply(this.m, x, y));
  }
  moveTo(x: number, y: number): void {
    this.pt(x, y);
  }
  lineTo(x: number, y: number): void {
    this.pt(x, y);
  }
  closePath(): void {}
  arc(x: number, y: number, r: number): void {
    this.pt(x - r, y - r);
    this.pt(x + r, y - r);
    this.pt(x + r, y + r);
    this.pt(x - r, y + r);
  }
  rect(x: number, y: number, w: number, h: number): void {
    this.pt(x, y);
    this.pt(x + w, y);
    this.pt(x + w, y + h);
    this.pt(x, y + h);
  }
  roundRect(x: number, y: number, w: number, h: number): void {
    this.rect(x, y, w, h);
  }
  fill(): void {
    for (const [x, y] of this.path) this.add(x, y);
  }
  stroke(): void {
    const sx = Math.hypot(this.m[0], this.m[1]);
    const pad = (this.lineWidth / 2) * sx;
    for (const [x, y] of this.path) {
      this.add(x - pad, y - pad);
      this.add(x + pad, y + pad);
    }
  }
  clip(): void {}
  createLinearGradient(): CanvasGradient {
    return { addColorStop() {} } as CanvasGradient;
  }
  createRadialGradient(): CanvasGradient {
    return { addColorStop() {} } as CanvasGradient;
  }
}
