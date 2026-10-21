import { parseGraph, stateAt, textCanvas } from './graph.mjs';
export function createCanvas(canvas) {
  const ctx = canvas.getContext('2d'); let graph, texts = new Map();
  return {
    setGraph(input) { graph = parseGraph(input); canvas.width = graph.width; canvas.height = graph.height; texts.clear();
      for (const n of graph.nodes) if (n.kind === 'text') texts.set(n.id, textCanvas(n)); },
    renderAt(time) {
      const t = Number.isFinite(time) ? Math.max(0, Math.min(graph.duration, time)) : 0;
      ctx.clearRect(0, 0, canvas.width, canvas.height); if (!graph.transparent) { ctx.fillStyle = graph.background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      for (const n of graph.nodes) { const s = stateAt(n, t); if (!s.visible) continue;
        ctx.save(); ctx.globalAlpha = s.opacity; ctx.translate(s.x, s.y); ctx.scale(s.scale, s.scale); ctx.fillStyle = n.color;
        if (n.kind === 'text') ctx.drawImage(texts.get(n.id), -n.width / 2, -n.height / 2);
        else if (n.kind === 'circle') { ctx.beginPath(); ctx.ellipse(0, 0, n.width / 2, n.height / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.fillRect(-n.width / 2, -n.height / 2, n.width, n.height); }
        ctx.restore();
      }
    },
    dispose() { texts.clear(); canvas.width = canvas.height = 1; },
  };
}
