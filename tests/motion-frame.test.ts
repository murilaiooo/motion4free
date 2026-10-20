import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from '../src/core/brief';
import { DOCUMENTAL, EDITORIAL, NEON, POP, PRESETS } from '../src/core/presets';
import type { StyleDNA } from '../src/core/style';
import type { Caption, EditPlan, RangeEdit, SceneInstance } from '../src/core/types';
import { captionMaxWidth, drawCaption, REELS_BUTTONS_X } from '../src/render/captions';
import { emojiPose } from '../src/render/emoji';
import { cameraAt, drawFrame, kenBurns, sameWords, segmentClock } from '../src/render/frame';
import { makeFrame, overlayYFor } from '../src/render/kit';
import { RecordingContext } from './helpers/recording-ctx';

const W = 1080;
const H = 1920;

function plan(style: StyleDNA, over: Partial<EditPlan> = {}): EditPlan {
  return {
    version: 5,
    ranges: [],
    reference: null,
    brief: EMPTY_BRIEF,
    output: { width: W, height: H, fps: 30 },
    style,
    segments: [
      { srcStart: 0, srcEnd: 6 },
      { srcStart: 8, srcEnd: 20 },
    ],
    captions: [],
    scenes: [],
    ...over,
  };
}
const cap = (id: string, text: string, start: number, end: number, wordStarts: number[] = []): Caption => ({ id, text, start, end, wordIds: [], wordStarts });
const frame = (p: EditPlan, t: number) => {
  const rc = new RecordingContext();
  drawFrame(rc.asCtx(), p, t, {} as CanvasImageSource);
  return rc;
};
const screenY = (c: { args: unknown[]; m: number[] }) => c.m[1]! * (c.args[1] as number) + c.m[3]! * (c.args[2] as number) + c.m[5]!;
const screenX = (c: { args: unknown[]; m: number[] }) => c.m[0]! * (c.args[1] as number) + c.m[2]! * (c.args[2] as number) + c.m[4]!;

describe('câmera: Ken Burns, soco de zoom e tremor (v0.7)', () => {
  it('aproxima devagar dentro de cada trecho e recomeça no corte', () => {
    const p = plan(POP);
    expect(segmentClock(p, 7)).toEqual({ start: 6, elapsed: 1, len: 12 });
    expect(kenBurns(p, 0)).toBe(1);
    // começa depois de 1,2 s parado no mesmo trecho
    expect(kenBurns(p, 1)).toBe(1);
    expect(kenBurns(p, 3)).toBeGreaterThan(1);
    expect(kenBurns(p, 5.9)).toBeGreaterThan(1.03);
    // logo depois do corte (6 s) volta a 1
    expect(kenBurns(p, 6.05)).toBe(1);
    // trecho curto (< 3 s) não aproxima
    const short = plan(POP, { segments: [{ srcStart: 0, srcEnd: 2.5 }, { srcStart: 3, srcEnd: 9 }] });
    expect(kenBurns(short, 2.2)).toBe(1);
    // teto: nunca passa de metade do zoom do estilo
    expect(kenBurns(p, 17.9)).toBeLessThanOrEqual(1 + (POP.zoomScale - 1) * 0.55 + 1e-9);
  });

  it('desligada sem zoom no estilo e nos trechos "sem animação aqui"', () => {
    expect(kenBurns(plan({ ...EDITORIAL, zoomScale: 1 }), 4)).toBe(1);
    const quiet = { id: 'r1', srcStart: 2, srcEnd: 5, out: { start: 2, end: 5 }, prompt: 'sem animação aqui', tone: null, intensity: null, pace: null, forbid: [], emphasize: [], quiet: true, accent: false, variant: 0, look: null, style: null, locked: null } as RangeEdit;
    const p = plan(POP, { ranges: [quiet] });
    expect(kenBurns(p, 4)).toBe(1);
    expect(kenBurns(p, 5.5)).toBeGreaterThan(1);
  });

  it('Pop: soco de zoom chega rápido com mola e treme só no impacto; Editorial chega suave sem tremor', () => {
    const zoom: SceneInstance = { id: 'z', kind: 'emphasis-zoom', scale: 1.14, start: 10, end: 12 };
    const pop = plan(POP, { scenes: [zoom] });
    const kb = (t: number) => kenBurns(pop, t);
    expect(cameraAt(pop, 10.18).zoom / kb(10.18)).toBeGreaterThan(1.12);
    expect(Math.abs(cameraAt(pop, 10.1).dx)).toBeGreaterThan(0);
    expect(cameraAt(pop, 10.5).dx).toBe(0);
    const ed = plan(EDITORIAL, { scenes: [{ ...zoom, scale: 1.06 }] });
    expect(cameraAt(ed, 10.1).dx).toBe(0);
    expect(cameraAt(ed, 10.05).zoom / kenBurns(ed, 10.05)).toBeLessThan(1.04);
  });

  it('o tremor nunca mostra a borda do vídeo (a escala cobre o deslocamento)', () => {
    const p = plan(POP, { scenes: [{ id: 'z', kind: 'emphasis-zoom', scale: 1.14, start: 10, end: 12 }] });
    for (let t = 10; t < 10.35; t += 0.02) {
      const img = frame(p, t).calls.find((c) => c.op === 'drawImage')!;
      const [a, , , d, e, f] = img.m;
      expect(e!).toBeLessThanOrEqual(0.01);
      expect(f!).toBeLessThanOrEqual(0.01);
      expect(e! + a! * W).toBeGreaterThanOrEqual(W - 0.01);
      expect(f! + d! * H).toBeGreaterThanOrEqual(H - 0.01);
    }
  });
});

describe('legenda profissional (v0.7)', () => {
  const c = cap('c1', 'Isso muda tudo hoje', 1, 3, [1, 1.4, 1.8, 2.3]);
  const draw = (style: StyleDNA, t: number, exit = false, caption = c) => {
    const rc = new RecordingContext();
    const rect = drawCaption(rc.asCtx(), makeFrame(W, H, style), caption, t, new Set(), { exit });
    return { rc, rect };
  };
  const word = (rc: RecordingContext, w: string) => rc.calls.find((x) => x.op === 'fillText' && String(x.args[0]).toLowerCase() === w);

  it('Pop: palavras entram uma depois da outra (a última ainda não apareceu no começo)', () => {
    const { rc } = draw(POP, 1.05);
    expect(word(rc, 'isso')!.globalAlpha).toBeGreaterThan(0.5);
    expect(word(rc, 'hoje')).toBeUndefined();
    const later = draw(POP, 1.5).rc;
    expect(word(later, 'hoje')!.globalAlpha).toBeCloseTo(1, 5);
  });

  it('Pop: a palavra falada cresce com sobra (mola) e assenta no tamanho do estilo', () => {
    const scaleOf = (t: number) => word(draw(POP, t).rc, 'muda')!.m[0]!;
    const samples = Array.from({ length: 30 }, (_, i) => scaleOf(1.4 + i * 0.01));
    expect(Math.max(...samples)).toBeGreaterThan(POP.captions.activeScale + 0.01);
    expect(scaleOf(1.75)).toBeCloseTo(POP.captions.activeScale, 2);
  });

  it('Pop: a caixa da palavra falada desliza da palavra anterior', () => {
    const boxCenter = (t: number) => {
      const calls = draw(POP, t).rc.calls;
      const i = calls.findIndex((x) => x.op === 'fill' && x.fillStyle === POP.palette.accent);
      const r = calls.slice(0, i).reverse().find((x) => x.op === 'roundRect')!;
      const [x, , w] = r.args as number[];
      return r.m[0]! * (x! + w! / 2) + r.m[4]!;
    };
    const center = (t: number, w: string) => screenX(word(draw(POP, t).rc, w)!);
    const issoX = center(1.3, 'isso');
    const mudaX = center(1.7, 'muda');
    expect(boxCenter(1.3)).toBeCloseTo(issoX, 0);
    expect(boxCenter(1.7)).toBeCloseTo(mudaX, 0);
    const mid = boxCenter(1.43);
    expect(mid).toBeGreaterThan(issoX + 5);
    expect(mid).toBeLessThan(mudaX - 5);
  });

  it('Pop: no instante da troca, o texto escuro fica na palavra que a caixa cobre (nunca texto escuro fora da caixa)', () => {
    const at = (t: number) => {
      const rc = draw(POP, t).rc;
      return { isso: word(rc, 'isso')!.fillStyle, muda: word(rc, 'muda')!.fillStyle };
    };
    // exatamente no começo de "muda", a caixa ainda está em "isso"
    expect(at(1.4)).toEqual({ isso: POP.palette.onPanel, muda: POP.palette.text });
    expect(at(1.6)).toEqual({ isso: POP.palette.text, muda: POP.palette.onPanel });
  });

  it('sai animando quando há pausa depois; sem pausa, fica inteira até o fim', () => {
    const exitDrawn = draw(POP, 2.97, true).rc;
    const stay = draw(POP, 2.97, false).rc;
    expect(word(exitDrawn, 'hoje')!.globalAlpha).toBeLessThan(0.6);
    expect(word(stay, 'hoje')!.globalAlpha).toBeCloseTo(1, 5);
  });

  it('na metade de baixo, a legenda não passa por baixo dos botões do Reels', () => {
    const long = cap('c2', 'consistência extraordinária transformação', 0, 2, [0, 0.6, 1.2]);
    for (const style of PRESETS) {
      const bottom = { ...style, captions: { ...style.captions, position: 'bottom' as const } };
      const f = makeFrame(W, H, bottom);
      expect(captionMaxWidth(f)).toBeLessThanOrEqual(2 * (W * REELS_BUTTONS_X - W / 2));
      const { rect } = draw(bottom, 1.9, false, long);
      expect(rect!.x + rect!.w).toBeLessThanOrEqual(W * REELS_BUTTONS_X + 1);
    }
  });

  it('contorno com sombra suave (sem deslocamento duro) no Pop', () => {
    const stroke = draw(POP, 2).rc.calls.find((x) => x.op === 'strokeText')!;
    expect(stroke).toBeDefined();
  });
});

describe('composição sem colisões (v0.7)', () => {
  it('título com a mesma frase da legenda: a legenda não repete', () => {
    expect(sameWords('Três dicas que mudam tudo', 'Três dicas que mudam tudo')).toBe(true);
    expect(sameWords('Primeira dica.', 'Três dicas rápidas.')).toBe(false);
    const p = plan(POP, {
      captions: [cap('c1', 'Três dicas que mudam tudo', 0.2, 2.6)],
      scenes: [{ id: 't', kind: 'kinetic-title', text: 'Três dicas que mudam tudo', start: 0, end: 2.6 }],
    });
    const texts = frame(p, 1.3).texts();
    expect(texts.filter((x) => x.toUpperCase().includes('DICAS')).length).toBe(1);
    const other = plan(POP, { captions: [cap('c1', 'Outra frase aqui', 0.2, 2.6)], scenes: p.scenes });
    expect(frame(other, 1.3).texts().join(' ')).toContain('OUTRA');
  });

  it('legenda pedida em cima: as cenas descem para não ficar por baixo dela', () => {
    const top = { ...EDITORIAL, captions: { ...EDITORIAL.captions, position: 'top' as const } };
    expect(overlayYFor(top)).toBeGreaterThan(0.55);
    expect(overlayYFor(EDITORIAL)).toBe(EDITORIAL.layout.overlayY);
    const center = { ...POP, captions: { ...POP.captions, position: 'center' as const } };
    expect(Math.abs(overlayYFor(center) - 0.5)).toBeGreaterThanOrEqual(0.25);
    const p = plan(top, {
      captions: [cap('c1', 'uma frase qualquer', 0.2, 2.6)],
      scenes: [{ id: 't', kind: 'kinetic-title', text: 'Título bem diferente', start: 0, end: 2.6 }],
    });
    const calls = frame(p, 1.5).calls.filter((x) => x.op === 'fillText');
    const capY = Math.max(...calls.filter((x) => /frase|qualquer|uma/i.test(String(x.args[0]))).map(screenY));
    const titleY = Math.min(...calls.filter((x) => /título|diferente|bem/i.test(String(x.args[0]))).map(screenY));
    expect(titleY - capY).toBeGreaterThan(H * 0.2);
  });

  it('emoji "auto" fica logo acima da legenda, sem cobrir ela', () => {
    const style = { ...POP, emoji: { ...POP.emoji, mode: 'interval' as const, animation: 'none' as const } };
    const f = makeFrame(W, H, style);
    const rect = { x: 200, y: 1100, w: 680, h: 200 };
    const pose = emojiPose(f, { id: 'e', kind: 'emoji', emoji: '🔥', start: 1, end: 3 }, 2, { caption: rect });
    expect(pose.y + pose.size / 2).toBeLessThanOrEqual(rect.y);
    expect(pose.y).toBeGreaterThan(rect.y - pose.size * 1.5);
  });

  it('emoji sem legenda com cena central: longe dos dois', () => {
    const style = { ...DOCUMENTAL, emoji: { ...DOCUMENTAL.emoji, mode: 'interval' as const, animation: 'none' as const } };
    const f = makeFrame(W, H, style);
    const pose = emojiPose(f, { id: 'e', kind: 'emoji', emoji: '🔥', start: 1, end: 3 }, 2, { busy: true });
    const frac = (pose.y - f.safe.y) / f.safe.h;
    expect(Math.abs(frac - f.overlayY)).toBeGreaterThan(0.2);
  });
});

describe('acabamento (v0.7)', () => {
  it('Editorial: faixa escura suave atrás do título aparece e some com ele; Pop (caixas) não precisa', () => {
    const title: SceneInstance = { id: 't', kind: 'kinetic-title', text: 'Título', start: 1, end: 3 };
    const band = (style: StyleDNA, t: number) => frame(plan(style, { scenes: [title] }), t).calls.filter((c) => c.op === 'fillRect' && c.fillStyle === 'gradient' && (c.args[1] as number) !== H * 0.5).length;
    expect(band(EDITORIAL, 2)).toBe(1);
    expect(band(EDITORIAL, 0.5)).toBe(0);
    expect(band(POP, 2)).toBe(0);
  });

  it('Pop: gancho em duas cores alternadas por linha', () => {
    const p = plan(POP, { scenes: [{ id: 't', kind: 'kinetic-title', text: 'Três dicas que mudam tudo para sempre', start: 0, end: 3 }] });
    const fills = frame(p, 1.5).calls.filter((c) => c.op === 'fill').map((c) => c.fillStyle);
    expect(fills).toContain(POP.palette.panel);
    expect(fills).toContain(POP.palette.text);
  });

  it('a palavra falada que cresce empurra as vizinhas (letras nunca encavalam)', () => {
    const c = cap('c1', 'mais dicas', 0, 2, [0, 0.5]);
    const gap = (style: StyleDNA) => {
      const rc = new RecordingContext();
      drawCaption(rc.asCtx(), makeFrame(W, H, style), c, 1.2, new Set());
      const xs = rc.calls.filter((x) => x.op === 'fillText').map(screenX);
      return xs[1]! - xs[0]!;
    };
    const flat = { ...NEON, captions: { ...NEON.captions, activeScale: 1 } };
    expect(gap(NEON)).toBeGreaterThan(gap(flat) + 10);
  });

  it('palavra-chave falada cresce mais que uma palavra comum', () => {
    const c = cap('c1', 'o segredo é isso', 0, 2, [0, 0.4, 0.9, 1.2]);
    const scale = (kw: string[]) => {
      const rc = new RecordingContext();
      drawCaption(rc.asCtx(), makeFrame(W, H, POP), c, 0.7, new Set(kw));
      return rc.calls.find((x) => x.op === 'fillText' && String(x.args[0]) === 'SEGREDO')!.m[0]!;
    };
    expect(scale(['segredo'])).toBeGreaterThan(scale([]) + 0.05);
  });
});
