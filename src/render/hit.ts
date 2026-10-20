import type { EditPlan } from '../core/types';
import type { ElementRef } from '../editorial/elements';
import { BoundsContext, apply, invert, type ElementBox, type Measurer } from './bounds';
import { drawFrame } from './frame';
import { reelsSafeArea, type Rect } from './layout';

/**
 * Seleção na prévia (v0.13): caixas dos elementos no instante `t`, ponto → elemento e guias de
 * alinhamento ao arrastar. Tudo puro: as caixas saem da própria `drawFrame` (contexto de medida),
 * então o que se seleciona é exatamente o que aparece na prévia e no MP4.
 */

/** Caixas de todos os elementos visíveis em `t`, na ordem em que são desenhados (o último fica por cima). */
export function elementBoxes(plan: EditPlan, t: number, measure: Measurer): ElementBox[] {
  const bc = new BoundsContext(measure);
  drawFrame(bc.asCtx(), plan, t, null, bc);
  return bc.boxes.filter((b) => b.local.w > 0.5 && b.local.h > 0.5);
}

/** Escala do elemento na tela (para folga de clique e tamanho da caixa). */
const scaleOf = (b: ElementBox) => Math.hypot(b.m[0], b.m[1]) || 1;

/** O ponto (px do quadro) cai dentro da caixa (girada) do elemento, com folga `pad` px? */
export function boxContains(b: ElementBox, x: number, y: number, pad = 0): boolean {
  const [lx, ly] = apply(invert(b.m), x, y);
  const p = pad / scaleOf(b);
  return lx >= b.local.x - p && lx <= b.local.x + b.local.w + p && ly >= b.local.y - p && ly <= b.local.y + b.local.h + p;
}

/** Elemento sob o ponto: o de cima primeiro; elementos pequenos ganham folga para o dedo/mouse. */
export function hitTest(boxes: ElementBox[], x: number, y: number, pad = 12): ElementRef | null {
  for (let i = boxes.length - 1; i >= 0; i--) if (boxContains(boxes[i]!, x, y, 0)) return boxes[i]!.ref;
  for (let i = boxes.length - 1; i >= 0; i--) if (boxContains(boxes[i]!, x, y, pad)) return boxes[i]!.ref;
  return null;
}

/** Centro, tamanho (px do quadro) e giro (graus) da caixa: o que a moldura de seleção desenha. */
export function boxGeometry(b: ElementBox): { cx: number; cy: number; w: number; h: number; angle: number } {
  const [cx, cy] = apply(b.m, b.local.x + b.local.w / 2, b.local.y + b.local.h / 2);
  const sx = Math.hypot(b.m[0], b.m[1]);
  const sy = Math.hypot(b.m[2], b.m[3]);
  return { cx, cy, w: b.local.w * sx, h: b.local.h * sy, angle: (Math.atan2(b.m[1], b.m[0]) * 180) / Math.PI };
}

export interface Guide {
  axis: 'x' | 'y';
  /** posição da linha no quadro (px) */
  at: number;
  kind: 'center' | 'safe' | 'element';
}

export interface SnapLines {
  x: { at: number; kind: Guide['kind'] }[];
  y: { at: number; kind: Guide['kind'] }[];
}

/** Linhas que "puxam" o elemento arrastado: meio do quadro, bordas da área segura do Reels e os outros elementos. */
export function snapLines(w: number, h: number, others: Rect[]): SnapLines {
  const safe = reelsSafeArea(w, h);
  const x: SnapLines['x'] = [
    { at: w / 2, kind: 'center' },
    { at: safe.x, kind: 'safe' },
    { at: safe.x + safe.w, kind: 'safe' },
  ];
  const y: SnapLines['y'] = [
    { at: h / 2, kind: 'center' },
    { at: safe.y, kind: 'safe' },
    { at: safe.y + safe.h, kind: 'safe' },
  ];
  for (const r of others) {
    x.push({ at: r.x, kind: 'element' }, { at: r.x + r.w / 2, kind: 'element' }, { at: r.x + r.w, kind: 'element' });
    y.push({ at: r.y, kind: 'element' }, { at: r.y + r.h / 2, kind: 'element' }, { at: r.y + r.h, kind: 'element' });
  }
  return { x, y };
}

/**
 * Ajuste para encostar o retângulo arrastado na linha mais perto (bordas ou centro), se estiver a
 * menos de `threshold` px. Centro do quadro ganha preferência no empate. Devolve as guias para desenhar.
 */
export function snapRect(r: Rect, lines: SnapLines, threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const pick = (vals: number[], ls: SnapLines['x']) => {
    let best: { d: number; at: number; kind: Guide['kind'] } | null = null;
    for (const l of ls)
      for (const v of vals) {
        const d = l.at - v;
        const better = !best || Math.abs(d) < Math.abs(best.d) - 0.01 || (Math.abs(Math.abs(d) - Math.abs(best.d)) <= 0.01 && l.kind === 'center');
        if (Math.abs(d) <= threshold && better) best = { d, at: l.at, kind: l.kind };
      }
    return best;
  };
  const bx = pick([r.x, r.x + r.w / 2, r.x + r.w], lines.x);
  const by = pick([r.y, r.y + r.h / 2, r.y + r.h], lines.y);
  const guides: Guide[] = [];
  if (bx) guides.push({ axis: 'x', at: bx.at, kind: bx.kind });
  if (by) guides.push({ axis: 'y', at: by.at, kind: by.kind });
  return { dx: bx?.d ?? 0, dy: by?.d ?? 0, guides };
}

/** Shift trava o eixo: só o movimento maior vale. */
export function lockAxis(dx: number, dy: number): [number, number] {
  return Math.abs(dx) >= Math.abs(dy) ? [dx, 0] : [0, dy];
}

/** Ângulo (graus) com ímã a cada 15° (Shift) ou perto de 0/90/180 sem Shift. */
export function snapAngle(deg: number, strong: boolean): number {
  const step = strong ? 15 : 90;
  const near = Math.round(deg / step) * step;
  const norm = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
  return strong || Math.abs(deg - near) < 4 ? norm(near) : norm(deg);
}

export type { ElementBox, Measurer };
