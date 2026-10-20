import type { Ctx2D } from '../../src/render/ctx';

/** Uma chamada de desenho com o estado do contexto no momento (para conferir texto, posição, cor e opacidade). */
export interface DrawCall {
  op: string;
  args: unknown[];
  font: string;
  fillStyle: string;
  strokeStyle: string;
  globalAlpha: number;
  lineWidth: number;
  textAlign: string;
  /** matriz [a, b, c, d, e, f] acumulada por translate/scale/rotate */
  m: number[];
  clipped: boolean;
}

type M = number[];
const mul = (p: M, q: M): M => [p[0]! * q[0]! + p[2]! * q[1]!, p[1]! * q[0]! + p[3]! * q[1]!, p[0]! * q[2]! + p[2]! * q[3]!, p[1]! * q[2]! + p[3]! * q[3]!, p[0]! * q[4]! + p[2]! * q[5]! + p[4]!, p[1]! * q[4]! + p[3]! * q[5]! + p[5]!];

/**
 * Contexto 2D falso que grava cada operação. measureText é aproximado
 * (0,55 × tamanho da fonte por caractere + espaçamento), suficiente para testar layout.
 */
export class RecordingContext {
  calls: DrawCall[] = [];
  font = '10px sans-serif';
  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  lineWidth = 1;
  lineJoin: CanvasLineJoin = 'miter';
  lineCap: CanvasLineCap = 'butt';
  globalAlpha = 1;
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  shadowColor = 'rgba(0, 0, 0, 0)';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  letterSpacing = '0px';
  private m: M = [1, 0, 0, 1, 0, 0];
  private clipDepth = 0;
  private stack: { state: Record<string, unknown>; m: M; clip: number }[] = [];

  private static readonly STATE = ['font', 'fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'lineCap', 'globalAlpha', 'textAlign', 'textBaseline', 'shadowColor', 'shadowBlur', 'shadowOffsetX', 'shadowOffsetY', 'letterSpacing'] as const;

  private rec(op: string, args: unknown[]) {
    this.calls.push({
      op,
      args,
      font: this.font,
      fillStyle: String(typeof this.fillStyle === 'string' ? this.fillStyle : 'gradient'),
      strokeStyle: String(this.strokeStyle),
      globalAlpha: this.globalAlpha,
      lineWidth: this.lineWidth,
      textAlign: this.textAlign,
      m: [...this.m],
      clipped: this.clipDepth > 0,
    });
  }

  save() {
    const state: Record<string, unknown> = {};
    for (const k of RecordingContext.STATE) state[k] = this[k];
    this.stack.push({ state, m: [...this.m], clip: this.clipDepth });
  }
  restore() {
    const s = this.stack.pop();
    if (!s) return;
    Object.assign(this, s.state);
    this.m = s.m;
    this.clipDepth = s.clip;
  }
  translate(x: number, y: number) {
    this.m = mul(this.m, [1, 0, 0, 1, x, y]);
  }
  scale(x: number, y: number) {
    this.m = mul(this.m, [x, 0, 0, y, 0, 0]);
  }
  rotate(a: number) {
    this.m = mul(this.m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]);
  }
  fontSize(): number {
    return Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 10);
  }
  measureText(text: string): TextMetrics {
    const spacing = Number.parseFloat(this.letterSpacing) || 0;
    return { width: text.length * (this.fontSize() * 0.55 + spacing) } as TextMetrics;
  }
  fillText(...a: unknown[]) {
    this.rec('fillText', a);
  }
  strokeText(...a: unknown[]) {
    this.rec('strokeText', a);
  }
  fillRect(...a: unknown[]) {
    this.rec('fillRect', a);
  }
  drawImage(...a: unknown[]) {
    this.rec('drawImage', a.slice(1));
  }
  beginPath() {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  arc() {}
  rect(...a: unknown[]) {
    this.rec('rect', a);
  }
  roundRect(...a: unknown[]) {
    this.rec('roundRect', a);
  }
  fill() {
    this.rec('fill', []);
  }
  stroke() {
    this.rec('stroke', []);
  }
  clip() {
    this.clipDepth++;
  }
  createLinearGradient(): CanvasGradient {
    return { addColorStop() {} } as CanvasGradient;
  }

  asCtx(): Ctx2D {
    return this as unknown as Ctx2D;
  }
  texts(): string[] {
    return this.calls.filter((c) => c.op === 'fillText').map((c) => String(c.args[0]));
  }
  /** Lista serializável para comparar dois quadros. */
  snapshot(): string {
    return JSON.stringify(this.calls, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v));
  }
}
