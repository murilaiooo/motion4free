import { describe, expect, it } from 'vitest';
import { DOCUMENTAL, EDITORIAL, POP, PRESETS } from '../src/core/presets';
import type { StyleDNA } from '../src/core/style';
import type { Caption, EditPlan, SceneInstance } from '../src/core/types';
import { activeWord, drawCaption, layoutLines, wordTimings } from '../src/render/captions';
import { makeFrame } from '../src/render/kit';
import { countUp, drawOverlay } from '../src/render/scenes';
import { drawFrame } from '../src/render/frame';
import { RecordingContext } from './helpers/recording-ctx';

const W = 1080;
const H = 1920;

const SCENES: SceneInstance[] = [
  { id: 'a', kind: 'kinetic-title', text: 'Três dicas rápidas', start: 0, end: 2.4 },
  { id: 'b', kind: 'big-number', value: '90%', label: 'desistem antes', start: 3, end: 5.4 },
  { id: 'c', kind: 'list', items: [{ text: 'Comece pequeno', at: 6 }, { text: 'Durma bem', at: 7 }], start: 5.9, end: 9 },
  { id: 'd', kind: 'quote', text: 'Você sabe por que desistimos?', start: 10, end: 13 },
  { id: 'e', kind: 'lower-third', title: 'Ana Souza', subtitle: 'Personal trainer', start: 14, end: 17 },
  { id: 'f', kind: 'end-cta', text: 'Siga para mais', start: 18, end: 20 },
];

function draw(style: StyleDNA, scene: SceneInstance, t: number): RecordingContext {
  const rc = new RecordingContext();
  drawOverlay(rc.asCtx(), makeFrame(W, H, style), scene, t);
  return rc;
}
const mid = (s: SceneInstance) => (s.start + s.end) / 2 + (s.kind === 'list' ? 0.6 : 0);
const visibleTexts = (rc: RecordingContext) => rc.calls.filter((c) => c.op === 'fillText' && c.globalAlpha > 0.01).map((c) => String(c.args[0]));

describe('cenas: funções puras do tempo, em todos os estilos', () => {
  for (const style of PRESETS) {
    for (const scene of SCENES) {
      it(`${style.id} · ${scene.kind}: no meio da cena o texto aparece inteiro, dentro do quadro`, () => {
        const rc = draw(style, scene, mid(scene));
        const texts = visibleTexts(rc).join(' ').toLowerCase();
        const expected = { 'kinetic-title': 'três', 'big-number': '90%', list: 'durma bem', quote: 'desistimos', 'lower-third': 'ana souza', 'end-cta': 'siga' }[scene.kind as string]!;
        expect(texts).toContain(expected);
        for (const c of rc.calls.filter((c) => c.op === 'fillText')) {
          // posição final (com a matriz) dentro do quadro
          const [x, y] = [c.args[1] as number, c.args[2] as number];
          const px = c.m[0]! * x + c.m[2]! * y + c.m[4]!;
          const py = c.m[1]! * x + c.m[3]! * y + c.m[5]!;
          expect(px).toBeGreaterThanOrEqual(0);
          expect(px).toBeLessThanOrEqual(W);
          expect(py).toBeGreaterThan(H * 0.08);
          expect(py).toBeLessThan(H * 0.8);
        }
        const main = rc.calls.filter((c) => c.op === 'fillText' && String(c.args[0]).toLowerCase().includes(expected.split(' ')[0]!));
        expect(Math.max(...main.map((c) => c.globalAlpha))).toBeCloseTo(1, 2);
      });

      it(`${style.id} · ${scene.kind}: no primeiro instante está invisível (entra animando)`, () => {
        const rc = draw(style, scene, scene.start);
        expect(visibleTexts(rc)).toEqual([]);
      });

      it(`${style.id} · ${scene.kind}: mesmo instante = mesmo desenho`, () => {
        expect(draw(style, scene, mid(scene) - 0.3).snapshot()).toBe(draw(style, scene, mid(scene) - 0.3).snapshot());
      });
    }
  }

  it('cada estilo desenha a mesma cena de um jeito diferente (fonte e layout, não só cor)', () => {
    for (const scene of SCENES) {
      const fonts = PRESETS.map((s) => new Set(draw(s, scene, mid(scene)).calls.filter((c) => c.op === 'fillText').map((c) => c.font.replace(/^.*?px /, ''))));
      const keys = fonts.map((f) => [...f].sort().join('|'));
      expect(new Set(keys).size, scene.kind).toBe(3);
      const xs = PRESETS.map((s) => {
        const c = draw(s, scene, mid(scene)).calls.find((c) => c.op === 'fillText')!;
        return `${c.textAlign}@${Math.round((c.m[0]! * (c.args[1] as number) + c.m[4]!) / 10)}`;
      });
      expect(new Set(xs).size, scene.kind).toBeGreaterThan(1);
    }
  });

  it('Pop usa caixas (adesivo), Documental usa painel com barra, Editorial só tipografia', () => {
    const title = SCENES[0]!;
    const boxes = (s: StyleDNA) => draw(s, title, 1.2).calls.filter((c) => c.op === 'roundRect').length;
    expect(boxes(POP)).toBeGreaterThan(0);
    expect(boxes(DOCUMENTAL)).toBeGreaterThan(0);
    expect(boxes(EDITORIAL)).toBe(0);
    expect(draw(POP, title, 1.2).texts().join(' ')).toBe('TRÊS DICAS RÁPIDAS');
    expect(draw(EDITORIAL, title, 1.2).texts().join(' ')).toBe('Três dicas rápidas');
  });

  it('número grande conta até o valor nos estilos com movimento; Documental mostra direto', () => {
    expect(countUp('90%', 0.5)).toBe('45%');
    expect(countUp('R$ 2.000', 0.25)).toBe('R$ 500');
    expect(countUp('1 milhão', 0.5)).toBe('1 milhão');
    expect(countUp('2,5', 1)).toBe('2,5');
    const n = SCENES[1]!;
    const early = (s: StyleDNA) => draw(s, n, n.start + 0.12).calls.find((c) => c.op === 'fillText')!.args[0];
    expect(early(POP)).not.toBe('90%');
    expect(early(DOCUMENTAL)).toBe('90%');
  });

  it('lista: item aparece quando é dito e o anterior fica apagado', () => {
    const list = SCENES[2]!;
    for (const style of [EDITORIAL, DOCUMENTAL]) {
      const before = visibleTexts(draw(style, list, 6.8));
      expect(before.join(' ')).toContain('Comece pequeno');
      expect(before.join(' ')).not.toContain('Durma bem');
      const after = draw(style, list, 8);
      const first = after.calls.filter((c) => c.op === 'fillText' && String(c.args[0]).includes('Comece'));
      expect(first[0]!.globalAlpha).toBeCloseTo(0.5, 1);
    }
  });
});

describe('legendas estilo Reels', () => {
  const caption: Caption = { id: 'c1', text: 'Isso muda tudo', start: 1, end: 2.2, wordIds: ['1', '2', '3'], wordStarts: [1, 1.4, 1.8] };
  const drawCap = (style: StyleDNA, t: number, kw: string[] = []) => {
    const rc = new RecordingContext();
    drawCaption(rc.asCtx(), makeFrame(W, H, style), caption, t, new Set(kw));
    return rc;
  };
  const wordCall = (rc: RecordingContext, word: string) => rc.calls.find((c) => c.op === 'fillText' && String(c.args[0]).toLowerCase() === word)!;

  it('tempos por palavra: reais quando batem, proporcionais quando o texto foi corrigido', () => {
    expect(wordTimings(caption, ['a', 'b', 'c'])).toEqual([1, 1.4, 1.8]);
    const t = wordTimings({ start: 0, end: 1, wordStarts: [0, 0.5] }, ['aa', 'b', 'cc']);
    expect(t[0]).toBe(0);
    expect(t[1]).toBeCloseTo(0.375, 5);
    expect(activeWord([1, 1.4, 1.8], 1.5)).toBe(1);
    expect(activeWord([1, 1.4, 1.8], 0.5)).toBe(-1);
  });

  it('quebra em linhas pela largura', () => {
    expect(layoutLines([100, 100, 100], 10, 220)).toEqual([[0, 1], [2]]);
  });

  it('tamanho da fonte segue o estilo e é maior que na v0.2', () => {
    for (const style of PRESETS) {
      const size = Number(/([\d.]+)px/.exec(wordCall(drawCap(style, 1.5), 'muda').font)![1]);
      expect(size).toBeGreaterThanOrEqual(style.captions.size * W * 0.99);
      expect(size).toBeGreaterThan(67);
    }
  });

  it('Pop: palavra falada numa caixa amarela, em maiúsculas, com contorno nas outras', () => {
    const rc = drawCap(POP, 1.5);
    expect(rc.texts()).toEqual(['ISSO', 'MUDA', 'TUDO']);
    const box = rc.calls.findIndex((c) => c.op === 'fill' && c.fillStyle === POP.palette.accent);
    const muda = rc.calls.findIndex((c) => c.op === 'fillText' && c.args[0] === 'MUDA');
    expect(box).toBeGreaterThan(-1);
    expect(box).toBeLessThan(muda);
    expect(rc.calls[muda]!.fillStyle).toBe(POP.palette.onPanel);
    expect(rc.calls.some((c) => c.op === 'strokeText' && c.args[0] === 'ISSO')).toBe(true);
  });

  it('Editorial: palavras ainda não faladas ficam apagadas', () => {
    const rc = drawCap(EDITORIAL, 1.5);
    expect(wordCall(rc, 'isso').globalAlpha).toBeCloseTo(1, 2);
    expect(wordCall(rc, 'muda').globalAlpha).toBeCloseTo(1, 2);
    expect(wordCall(rc, 'tudo').globalAlpha).toBeCloseTo(EDITORIAL.captions.upcomingAlpha, 2);
  });

  it('Documental: caixa atrás da linha e palavra falada na cor de destaque', () => {
    const rc = drawCap(DOCUMENTAL, 1.5);
    expect(rc.calls.some((c) => c.op === 'fill' && c.fillStyle === DOCUMENTAL.palette.panel)).toBe(true);
    expect(wordCall(rc, 'muda').fillStyle).toBe(DOCUMENTAL.palette.accent);
    expect(wordCall(rc, 'isso').fillStyle).toBe(DOCUMENTAL.palette.text);
  });

  it('palavra-chave usa a fonte e a cor de ênfase do estilo', () => {
    const rc = drawCap(EDITORIAL, 1.9, ['muda']);
    const c = wordCall(rc, 'muda');
    expect(c.font).toContain('italic');
    expect(c.font).toContain('Instrument Serif');
    expect(c.fillStyle).toBe(EDITORIAL.palette.accent2);
  });

  it('legenda fica na parte de baixo (Editorial/Documental) ou no meio (Pop)', () => {
    const y = (s: StyleDNA) => wordCall(drawCap(s, 1.5), 'muda').args[2] as number;
    expect(y(EDITORIAL)).toBeGreaterThan(H * 0.66);
    expect(y(POP)).toBeLessThan(y(EDITORIAL));
    expect(y(POP)).toBeGreaterThan(H * 0.5);
  });
});

describe('drawFrame', () => {
  const plan = (style: StyleDNA, scenes: SceneInstance[] = SCENES): EditPlan => ({
    version: 2,
    output: { width: W, height: H, fps: 30 },
    style,
    segments: [{ srcStart: 0, srcEnd: 20 }],
    captions: [
      { id: 'c1', text: 'Você sabe por que', start: 10, end: 11, wordIds: [], wordStarts: [] },
      { id: 'c2', text: 'Isso muda tudo', start: 3, end: 4, wordIds: [], wordStarts: [] },
    ],
    scenes: [...scenes, { id: 'z', kind: 'emphasis-zoom', scale: 1.1, start: 3, end: 5 }, { id: 't', kind: 'cut-transition', at: 9.5, start: 9.4, end: 9.7 }, { id: 'p', kind: 'progress-bar', start: 0, end: 20 }],
  });
  const frame = (p: EditPlan, t: number, rc = new RecordingContext()) => {
    rc.calls = [];
    drawFrame(rc.asCtx(), p, t, {} as CanvasImageSource);
    return rc;
  };

  it('seek: o quadro em t não depende dos quadros desenhados antes', () => {
    for (const style of PRESETS) {
      const p = plan(style);
      const fresh = frame(p, 6.7).snapshot();
      const rc = new RecordingContext();
      for (const t of [0, 1.1, 19, 3.3, 9.5, 12, 15.2]) frame(p, t, rc);
      expect(frame(p, 6.7, rc).snapshot(), style.id).toBe(fresh);
      // e o estado do contexto volta ao que era
      expect(rc.globalAlpha).toBe(1);
      expect(rc.letterSpacing).toBe('0px');
    }
  });

  it('a legenda some enquanto a citação está na tela', () => {
    const rc = frame(plan(EDITORIAL), 10.5);
    expect(rc.texts().join(' ')).toContain('desistimos');
    expect(rc.texts()).not.toContain('Você');
  });

  it('zoom de ênfase amplia o vídeo de fundo', () => {
    const rc = frame(plan(POP), 4);
    const img = rc.calls.find((c) => c.op === 'drawImage')!;
    expect(img.m[0]).toBeCloseTo(1.1, 2);
    expect(frame(plan(POP), 1).calls.find((c) => c.op === 'drawImage')!.m[0]).toBe(1);
  });

  it('transição de corte: flash branco no Pop, mergulho escuro no Documental, nada no Editorial', () => {
    const veil = (s: StyleDNA) => frame(plan(s), 9.5).calls.filter((c) => c.op === 'fillRect' && (c.args[2] as number) === W && (c.args[3] as number) === H).map((c) => c.fillStyle);
    expect(veil(POP).some((f) => f.startsWith('rgba(255, 255, 255'))).toBe(true);
    expect(veil(DOCUMENTAL).some((f) => f.startsWith('rgba(0, 0, 0, 0.7'))).toBe(true);
    expect(veil(EDITORIAL).filter((f) => f.startsWith('rgba'))).toEqual([]);
  });

  it('barra de progresso acompanha o tempo', () => {
    const width = (t: number) => frame(plan(EDITORIAL), t).calls.filter((c) => c.op === 'fillRect' && c.fillStyle === EDITORIAL.palette.text).map((c) => c.args[2] as number)[0]!;
    expect(width(10) / width(5)).toBeCloseTo(2, 3);
  });
});
