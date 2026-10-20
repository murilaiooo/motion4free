import { describe, expect, it } from 'vitest';
import { FORMAT_IDS, OUTPUT_FORMATS, formatOf, orientationOf, profileFor } from '../src/core/formats';
import { DEFAULT_STYLE, PRESETS } from '../src/core/presets';
import type { Framing } from '../src/core/types';
import { galleryPlan } from '../src/editorial/sample';
import { captionMaxWidth } from '../src/render/captions';
import { drawFrame, type SourceFrame } from '../src/render/frame';
import { FACE_ROW, NO_FACE, framingFor, placeSource, smoothTrack, trackAt, type FaceSample } from '../src/render/framing';
import { makeFrame } from '../src/render/kit';
import { reelsSafeArea, safeAreaFor, unitFor } from '../src/render/layout';
import { RecordingContext } from './helpers/recording-ctx';

const fill: Framing = { mode: 'fill', fill: 'blur', zoom: 1, x: 0, y: 0 };
const fit: Framing = { ...fill, mode: 'fit' };
const smart: Framing = { ...fill, mode: 'smart' };

const inside = (r: { x: number; y: number; w: number; h: number }, w: number, h: number) => r.x >= -1e-6 && r.y >= -1e-6 && r.x + r.w <= w + 1e-6 && r.y + r.h <= h + 1e-6;

describe('formatos de saída', () => {
  it('quatro formatos com lado curto de 1080', () => {
    expect(FORMAT_IDS).toEqual(['vertical', 'retrato', 'quadrado', 'horizontal']);
    for (const id of FORMAT_IDS) expect(Math.min(OUTPUT_FORMATS[id].width, OUTPUT_FORMATS[id].height)).toBe(1080);
    expect(profileFor('horizontal')).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(formatOf({ width: 1080, height: 1350 })).toBe('retrato');
    expect(formatOf({ width: 540, height: 960 })).toBe('vertical');
    expect(orientationOf(1920, 1080)).toBe('horizontal');
    expect(orientationOf(720, 1280)).toBe('vertical');
    expect(orientationOf(1000, 1000)).toBe('quadrado');
  });
});

describe('enquadramento: toda origem em todo formato', () => {
  const sources = [
    [1920, 1080],
    [1080, 1920],
    [1080, 1080],
    [1440, 1080],
  ] as const;
  for (const [sw, sh] of sources) {
    for (const id of FORMAT_IDS) {
      const { width: ow, height: oh } = OUTPUT_FORMATS[id];
      it(`${sw}×${sh} → ${id}: preencher cobre a tela sem distorcer e sem sair do quadro`, () => {
        for (const framing of [fill, smart, { ...fill, zoom: 1.6, x: 1, y: -1 }, { ...smart, x: -0.4 }]) {
          const p = placeSource(sw, sh, ow, oh, framing, { x: 0.9, y: 0.1 });
          expect(p.needsBackdrop).toBe(false);
          expect(p.dst).toEqual({ x: 0, y: 0, w: ow, h: oh });
          expect(inside(p.src, sw, sh)).toBe(true);
          expect(p.src.w / p.src.h).toBeCloseTo(ow / oh, 6);
        }
      });
      it(`${sw}×${sh} → ${id}: ajustar mostra o quadro inteiro, centrado, com fundo quando sobra espaço`, () => {
        const p = placeSource(sw, sh, ow, oh, fit);
        expect(p.src).toEqual({ x: 0, y: 0, w: sw, h: sh });
        expect(p.dst.w / p.dst.h).toBeCloseTo(sw / sh, 6);
        expect(inside(p.dst, ow, oh)).toBe(true);
        expect(p.dst.x + p.dst.w / 2).toBeCloseTo(ow / 2, 6);
        expect(p.needsBackdrop).toBe(Math.abs(sw / sh - ow / oh) > 0.01);
      });
    }
  }

  it('deitado → vertical, seguir o rosto: o recorte vai para onde o rosto está, com espaço sobre a cabeça', () => {
    const right = placeSource(1920, 1080, 1080, 1920, smart, { x: 0.75, y: 0.45 });
    expect(right.src.x + right.src.w / 2).toBeCloseTo(0.75 * 1920, 6);
    const left = placeSource(1920, 1080, 1080, 1920, smart, { x: 0.1, y: 0.45 });
    expect(left.src.x).toBe(0); // encosta na borda, nunca mostra fora do quadro
    // rosto um pouco acima do meio do recorte (só dá para ver quando há folga vertical: quadrado)
    const sq = placeSource(1080, 1920, 1080, 1080, smart, { x: 0.5, y: 0.4 });
    expect((0.4 * 1920 - sq.src.y) / sq.src.h).toBeCloseTo(FACE_ROW, 6);
  });

  it('sem rosto, seguir o rosto = preencher pelo centro', () => {
    expect(placeSource(1920, 1080, 1080, 1920, smart, null)).toEqual(placeSource(1920, 1080, 1080, 1920, fill, null));
  });

  it('zoom aproxima (recorte menor) e x/y andam dentro da folga', () => {
    const a = placeSource(1920, 1080, 1080, 1080, fill);
    const z = placeSource(1920, 1080, 1080, 1080, { ...fill, zoom: 2 });
    expect(z.src.w).toBeCloseTo(a.src.w / 2, 6);
    const r = placeSource(1920, 1080, 1080, 1080, { ...fill, x: 1 });
    expect(r.src.x + r.src.w).toBeCloseTo(1920, 6);
    const l = placeSource(1920, 1080, 1080, 1080, { ...fill, x: -1 });
    expect(l.src.x).toBeCloseTo(0, 6);
  });

  it('enquadramento do clipe vence o do vídeo', () => {
    const plan = { framing: fill, clips: [{ id: 'c1', name: '', duration: 1, framing: fit }, { id: 'c2', name: '', duration: 1, framing: null }] };
    expect(framingFor(plan, 'c1')).toBe(fit);
    expect(framingFor(plan, 'c2')).toBe(fill);
    expect(framingFor(plan, null)).toBe(fill);
  });
});

describe('caminho do recorte (rosto ao longo do tempo)', () => {
  it('sem detecções: centro (um pouco acima do meio)', () => {
    const tr = smoothTrack([], 3);
    expect(trackAt(tr, 1.3)).toEqual(NO_FACE);
    expect(trackAt(null, 1)).toEqual(NO_FACE);
  });

  it('tremor das detecções não mexe o recorte (zona morta + média)', () => {
    const samples: FaceSample[] = Array.from({ length: 50 }, (_, i) => ({ t: i * 0.2, x: 0.6 + (i % 2 ? 0.015 : -0.015), y: 0.4 + (i % 3 ? 0.01 : -0.01) }));
    const tr = smoothTrack(samples, 10);
    const xs = tr.xs;
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.01);
  });

  it('rosto que troca de lugar: o recorte chega lá, sem salto e no limite de velocidade', () => {
    const samples: FaceSample[] = Array.from({ length: 60 }, (_, i) => ({ t: i * 0.2, x: i < 30 ? 0.3 : 0.7, y: 0.4 }));
    const tr = smoothTrack(samples, 12);
    expect(trackAt(tr, 0.5).x).toBeCloseTo(0.3, 2);
    expect(trackAt(tr, 11.5).x).toBeCloseTo(0.7, 2);
    for (let i = 1; i < tr.xs.length; i++) expect(Math.abs(tr.xs[i]! - tr.xs[i - 1]!)).toBeLessThanOrEqual(0.18 * 0.2 + 1e-3);
    // sem atraso: começa a andar antes da troca e termina depois (simétrico)
    const mid = trackAt(tr, 6).x;
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.6);
  });

  it('buraco nas detecções: segura a última posição; determinístico', () => {
    const samples: FaceSample[] = [
      { t: 0, x: 0.2, y: 0.5 },
      { t: 0.2, x: 0.2, y: 0.5 },
      { t: 5, x: 0.2, y: 0.5 },
    ];
    const tr = smoothTrack(samples, 5);
    expect(trackAt(tr, 2.5).x).toBeCloseTo(0.2, 6);
    expect(smoothTrack(samples, 5)).toEqual(tr);
  });
});

describe('desenho em cada formato', () => {
  it('unidade de tamanho pelo lado curto: letras iguais em todo formato', () => {
    for (const id of FORMAT_IDS) expect(unitFor(OUTPUT_FORMATS[id].width, OUTPUT_FORMATS[id].height)).toBe(1);
    expect(unitFor(540, 960)).toBe(0.5);
  });

  it('área segura: Reels em 9:16, margens pequenas nos outros, sempre dentro da tela', () => {
    expect(safeAreaFor(1080, 1920)).toEqual(reelsSafeArea(1080, 1920));
    for (const id of FORMAT_IDS) {
      const { width: w, height: h } = OUTPUT_FORMATS[id];
      const s = safeAreaFor(w, h);
      expect(inside(s, w, h)).toBe(true);
      expect(s.w / w).toBeGreaterThan(0.8);
      expect(s.h / h).toBeGreaterThan(0.6);
    }
  });

  it('legenda: largura máxima compacta fora do 9:16; igual à v0.13 no 9:16', () => {
    const v = makeFrame(1080, 1920, DEFAULT_STYLE);
    const h = makeFrame(1920, 1080, DEFAULT_STYLE);
    expect(captionMaxWidth(h)).toBeLessThanOrEqual(1000);
    expect(captionMaxWidth(v)).toBeLessThan(1000);
  });

  for (const id of FORMAT_IDS) {
    it(`${id}: todo texto da galeria cai dentro da tela, em todos os modelos`, () => {
      const { width: w, height: h } = OUTPUT_FORMATS[id];
      for (const style of PRESETS) {
        const plan = { ...galleryPlan(style), output: { width: w, height: h, fps: 30 } };
        for (const t of [1.3, 4.6, 8.6, 12.2, 15.8, 22.1, 26.6]) {
          const rc = new RecordingContext();
          drawFrame(rc.asCtx(), plan, t, null);
          for (const c of rc.calls.filter((c) => c.op === 'fillText')) {
            const y0 = c.m[1]! * (c.args[1] as number) + c.m[3]! * (c.args[2] as number) + c.m[5]!;
            expect(y0).toBeGreaterThan(0);
            // a faixa de manchetes corre de lado de propósito (recortada); o resto não sai da tela
            if (c.clipped) continue;
            const x = c.m[0]! * (c.args[1] as number) + c.m[2]! * (c.args[2] as number) + c.m[4]!;
            const y = c.m[1]! * (c.args[1] as number) + c.m[3]! * (c.args[2] as number) + c.m[5]!;
            expect(x, `${style.id} t=${t} "${c.args[0]}"`).toBeGreaterThan(-w * 0.05);
            expect(x, `${style.id} t=${t} "${c.args[0]}"`).toBeLessThan(w * 1.05);
            expect(y, `${style.id} t=${t} "${c.args[0]}"`).toBeGreaterThan(0);
            expect(y, `${style.id} t=${t} "${c.args[0]}"`).toBeLessThan(h);
          }
        }
      }
    });
  }

  it('quadro de clipe: drawFrame recorta pelo enquadramento (deitado → vertical)', () => {
    const plan = { ...galleryPlan(DEFAULT_STYLE), framing: fill };
    const image = { width: 1920, height: 1080 } as unknown as CanvasImageSource;
    const src: SourceFrame = { kind: 'clip', image, width: 1920, height: 1080, clipId: 'c1', focus: null, backdrop: null };
    const rc = new RecordingContext();
    drawFrame(rc.asCtx(), plan, 0.1, src);
    const i = rc.images.indexOf(image);
    const draw = rc.calls.filter((c) => c.op === 'drawImage')[i]!;
    expect(draw.args).toEqual([(1920 - 607.5) / 2, 0, 607.5, 1080, 0, 0, 1080, 1920]);
  });

  it('quadro de clipe em "ajustar": fundo desfocado (cópia pequena esticada) e o quadro inteiro por cima', () => {
    const plan = { ...galleryPlan(DEFAULT_STYLE), framing: fit };
    const image = { width: 1920, height: 1080 } as unknown as CanvasImageSource;
    const backdrop = { width: 32, height: 18 } as unknown as CanvasImageSource;
    const rc = new RecordingContext();
    drawFrame(rc.asCtx(), plan, 0.1, { kind: 'clip', image, width: 1920, height: 1080, clipId: 'c1', focus: null, backdrop });
    const draws = rc.calls.filter((c) => c.op === 'drawImage');
    expect(rc.images.slice(0, 2)).toEqual([backdrop, image]);
    expect(draws[0]!.args.slice(4)).toEqual([0, 0, 1080, 1920]);
    expect(draws[1]!.args.slice(4)).toEqual([0, (1920 - 607.5) / 2, 1080, 607.5]);
    // "cor": sem cópia, fundo liso
    const rc2 = new RecordingContext();
    drawFrame(rc2.asCtx(), { ...plan, framing: { ...fit, fill: 'color' } }, 0.1, { kind: 'clip', image, width: 1920, height: 1080, clipId: 'c1', focus: null, backdrop });
    expect(rc2.images).toEqual([image]);
  });
});
