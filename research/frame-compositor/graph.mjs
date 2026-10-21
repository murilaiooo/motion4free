import { z } from 'zod';
import { AppError } from '../../src/core/errors.ts';
const number = z.number().finite();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const node = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/), kind: z.enum(['rect', 'circle', 'text', 'box3d']),
  x: number.min(-540).max(1080), y: number.min(-960).max(1920),
  width: number.min(1).max(1080), height: number.min(1).max(1920), color,
  start: number.min(0).max(120), end: number.min(0).max(120),
  enter: z.enum(['fade', 'rise', 'grow']), enterSec: number.min(.05).max(2),
  text: z.string().max(160).optional(), fontSize: number.min(10).max(100).optional(),
  depth: number.min(1).max(300).optional(), spin: number.min(-1).max(1).optional(),
}).strict().refine(n => n.end > n.start && (n.kind !== 'text' || !!n.text?.trim()));
const schema = z.object({ version: z.literal(1), width: z.literal(540), height: z.literal(960),
  duration: number.min(1).max(120), background: color, nodes: z.array(node).max(80),
}).strict().superRefine((g, ctx) => {
  if (new Set(g.nodes.map(n => n.id)).size !== g.nodes.length || g.nodes.some(n => n.end > g.duration)) ctx.addIssue({code: 'custom', message: 'IDs ou limites inválidos'});
});
export function parseGraph(input) {
  const checked = schema.safeParse(input);
  if (!checked.success) throw new AppError('CRIATIVO_GRAFO');
  return checked.data;
}
export function stateAt(node, time) {
  const u = Math.max(0, Math.min(1, (time - node.start) / node.enterSec));
  const ease = 1 - (1 - u) ** 3;
  const exit = Math.max(0, Math.min(1, (node.end - time) / .25));
  return { visible: time >= node.start && time < node.end, opacity: ease * exit,
    x: node.x, y: node.y + (node.enter === 'rise' ? (1 - ease) * 48 : 0),
    scale: node.enter === 'grow' ? .85 + .15 * ease : 1, angle: (node.spin ?? 0) * Math.max(0, time - node.start) };
}
export function textCanvas(node) {
  const canvas = document.createElement('canvas'); canvas.width = node.width; canvas.height = node.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = node.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let size = node.fontSize ?? 36;
  const lines = (node.text ?? '').split('\n').slice(0, 3);
  do { ctx.font = `600 ${size}px sans-serif`; if (lines.every(line => ctx.measureText(line).width <= node.width - 8)) break; size--; } while (size > 10);
  lines.forEach((line, i) => ctx.fillText(line, node.width / 2, node.height / 2 + (i - (lines.length - 1) / 2) * size * 1.2));
  return canvas;
}
export function commonGraph() {
  const base = { start: 0, end: 12, enter: 'rise', enterSec: .6 };
  return parseGraph({ version: 1, width: 540, height: 960, duration: 12, background: '#10161f', nodes: [
    { ...base, id: 'heading', kind: 'text', x: 270, y: 170, width: 460, height: 130, color: '#f1f5ff', text: 'Uma ideia em três partes', fontSize: 44 },
    ...['Contexto', 'Desenvolvimento', 'Conclusão'].flatMap((text, i) => [
      { ...base, id: `panel-${i}`, kind: 'rect', x: 270, y: 350 + i * 155, width: 430, height: 116, color: '#243449', start: 1 + i * 2 },
      { ...base, id: `label-${i}`, kind: 'text', x: 270, y: 350 + i * 155, width: 410, height: 100, color: '#e8f3ff', text, fontSize: 31, start: 1.1 + i * 2 },
    ]),
  ] });
}
