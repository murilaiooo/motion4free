import { parseGraph } from './graph.mjs';
/** Original layouts; same user-annotated phrases and boundaries for all three. */
export function compositionFor(kind, phrases, first = 4, second = 8) {
  if (!['minimal', 'tech', 'documentary'].includes(kind) || !Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= first || second >= 12) return parseGraph(null);
  const ranges = [[0, first], [first, second], [second, 12]];
  const base = { enter: 'fade', enterSec: .8, end: 12 };
  const rect = (id, x, y, width, height, color, start = 0, end = 12) => ({...base, id, kind: 'rect', x, y, width, height, color, start, end});
  const text = (id, value, x, y, width, height, start, end, fontSize = 30) => ({...base, id, kind: 'text', x, y, width, height, color: '#f0f4ff', text: value, start, end, fontSize});
  const nodes = [];
  if (kind === 'minimal') {
    nodes.push(rect('reading-band', 270, 795, 540, 230, '#10161f'));
    phrases.forEach((phrase, i) => nodes.push(text(`phrase-${i}`, phrase, 270, 795, 470, 180, ...ranges[i], 39)));
    nodes.push(rect('accent', 270, 690, 56, 3, '#f5ce79'));
  } else if (kind === 'tech') {
    nodes.push(rect('diagram-board', 270, 700, 540, 520, '#102139'));
    phrases.forEach((phrase, i) => {
      const start = ranges[i][0];
      nodes.push({...base, id: `volume-${i}`, kind: 'box3d', x: 96, y: 510 + 165 * i, width: 68, height: 68, depth: 68, color: '#56cedb', start, enter: 'grow', enterSec: .4, spin: .35});
      nodes.push(text(`phrase-${i}`, phrase, 330, 510 + 165 * i, 330, 130, start, 12, 29));
      if (i < 2) nodes.push(rect(`link-${i}`, 96, 593 + 165 * i, 3, 80, '#56cedb', ranges[i + 1][0]));
    });
  } else {
    nodes.push(rect('chapter-rail', 38, 478, 3, 550, '#e3d5bc'));
    phrases.forEach((phrase, i) => {
      const [start, end] = ranges[i];
      nodes.push(rect(`chapter-${i}`, 102, 240 + 220 * i, 90, 3, '#e3d5bc', start, end));
      nodes.push(text(`marker-${i}`, `PARTE ${i + 1}`, 168, 215 + 220 * i, 220, 45, start, end, 19));
      nodes.push(rect(`backing-${i}`, 300, 300 + 220 * i, 450, 130, '#18232a', start, end));
      nodes.push({...text(`phrase-${i}`, phrase, 300, 300 + 220 * i, 420, 120, start, end, 31), enter: 'rise', enterSec: 1});
    });
  }
  return parseGraph({ version: 1, width: 540, height: 960, duration: 12, background: '#10161f', transparent: true, nodes });
}
