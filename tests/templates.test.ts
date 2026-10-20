import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EMPTY_BRIEF } from '../src/core/brief';
import { CINEMA, DATILOGRAFIA, IMPACTO, JORNAL, LUXO, MARCA_TEXTO, PODCAST, POP, PRESETS, presetById, RETRO, TURBO, TUTORIAL } from '../src/core/presets';
import { parseEditPlan } from '../src/core/schema';
import { DECOR_OFF, FONT_FILES, fontsOf, styleSchema, type StyleDNA } from '../src/core/style';
import { TAG_LABELS, TEMPLATE_IDS, TEMPLATE_TAGS, TEMPLATES, templateById, templatesByTag } from '../src/core/templates';
import type { Caption, EditPlan, SceneInstance } from '../src/core/types';
import { applyLook } from '../src/editorial/brief-apply';
import { galleryPlan } from '../src/editorial/sample';
import { captionJitter, drawCaption } from '../src/render/captions';
import { letterboxH, TICKER_LABEL, tickerText, timecode } from '../src/render/decor';
import { drawFrame } from '../src/render/frame';
import { applyMotion, composition, makeFrame, phase, TICKER_H } from '../src/render/kit';
import { drawOverlay } from '../src/render/scenes';
import { RecordingContext } from './helpers/recording-ctx';

const W = 1080;
const H = 1920;

const cap = (text: string, start: number, end: number, wordStarts: number[]): Caption => ({ id: 'c', text, start, end, wordIds: [], wordStarts });
const CAPTION = cap('isso muda tudo', 1, 2.2, [1, 1.4, 1.8]);

function drawCap(style: StyleDNA, t: number, kw: string[] = []) {
  const rc = new RecordingContext();
  drawCaption(rc.asCtx(), makeFrame(W, H, style), CAPTION, t, new Set(kw));
  return rc;
}
function drawScene(style: StyleDNA, scene: SceneInstance, t: number) {
  const rc = new RecordingContext();
  drawOverlay(rc.asCtx(), makeFrame(W, H, style), scene, t);
  return rc;
}
function frame(p: EditPlan, t: number) {
  const rc = new RecordingContext();
  drawFrame(rc.asCtx(), p, t, {} as CanvasImageSource);
  return rc;
}
const word = (rc: RecordingContext, w: string) => rc.calls.filter((c) => c.op === 'fillText' && String(c.args[0]).toLowerCase() === w);
const screenY = (c: { args: unknown[]; m: number[] }) => c.m[1]! * (c.args[1] as number) + c.m[3]! * (c.args[2] as number) + c.m[5]!;

describe('registro de modelos', () => {
  it('ids na ordem do registro, únicos, iguais aos do StyleDNA; pelo menos 15 modelos', () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual([...TEMPLATE_IDS]);
    expect(new Set(TEMPLATE_IDS).size).toBe(TEMPLATE_IDS.length);
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(15);
    for (const t of TEMPLATES) {
      expect(t.style.id).toBe(t.id);
      expect(t.style.name).toBe(t.name);
    }
  });

  it('cada modelo tem StyleDNA válido, frase curta, etiquetas conhecidas e miniatura com as cores do estilo', () => {
    for (const t of TEMPLATES) {
      expect(styleSchema.safeParse(t.style).success, t.id).toBe(true);
      expect(t.description.length, t.id).toBeGreaterThan(20);
      expect(t.description.length, t.id).toBeLessThanOrEqual(140);
      expect(t.tags.length, t.id).toBeGreaterThan(0);
      for (const tag of t.tags) expect(TEMPLATE_TAGS).toContain(tag);
      expect(t.preview.titleFont.family).toBe(t.style.type.display.family);
      expect(t.preview.captionFont.family).toBe(t.style.type.text.family);
      expect(t.preview.background).toMatch(/^#[0-9A-F]{6}$/i);
    }
    for (const tag of TEMPLATE_TAGS) expect(TAG_LABELS[tag]).toBeTruthy();
  });

  it('nomes sem marca registrada nem nome de criador/empresa', () => {
    const banned = /capcut|submagic|captions|veed|opus|hormozi|mrbeast|tiktok|instagram|youtube|netflix|vhs|nintendo|playstation|xbox|globo|cnn|vogue/i;
    for (const t of TEMPLATES) expect(t.name, t.id).not.toMatch(banned);
  });

  it('PRESETS, presetById, templateById e templatesByTag leem do registro', () => {
    expect(PRESETS).toEqual(TEMPLATES.map((t) => t.style));
    for (const t of TEMPLATES) {
      expect(presetById(t.id)).toBe(t.style);
      expect(templateById(t.id)).toBe(t);
    }
    expect(templateById('nada')).toBeUndefined();
    expect(templatesByTag('podcast').map((t) => t.id)).toContain('podcast');
    expect(templatesByTag('noticias').map((t) => t.id)).toContain('jornal');
  });

  it('modelos de verdade diferentes: par de fontes único e assinatura visual única', () => {
    const fonts = TEMPLATES.map((t) => `${t.style.type.display.family}/${t.style.type.display.style}|${t.style.type.text.family}`);
    expect(new Set(fonts).size).toBe(TEMPLATES.length);
    const sig = (s: StyleDNA) =>
      [s.captions.highlight, s.captions.box, s.motion.enter, composition(s), s.decor.title, s.decor.letterbox > 0, s.decor.tag, s.decor.ticker, s.decor.cursor, s.decor.gradient, s.decor.scanlines > 0, s.captions.position, s.type.text.case].join('|');
    expect(new Set(TEMPLATES.map((t) => sig(t.style))).size).toBe(TEMPLATES.length);
  });

  it('toda fonte dos modelos é OFL incluída: peso no esquema, arquivo no pacote e no carregador', () => {
    const loader = readFileSync('src/media/fonts.ts', 'utf8');
    const licenses = readFileSync('docs/licencas.md', 'utf8');
    for (const t of TEMPLATES) {
      for (const f of fontsOf(t.style)) {
        expect(FONT_FILES[f.family].some((x) => x.weight === f.weight && x.style === f.style), `${t.id}: ${f.family} ${f.weight}`).toBe(true);
        expect(loader).toContain(`'${f.family}|${f.weight}|${f.style}'`);
        expect(licenses, f.family).toContain(f.family);
      }
    }
    for (const [family, files] of Object.entries(FONT_FILES)) {
      const slug = family.toLowerCase().replace(/ /g, '-');
      const pkg = JSON.parse(readFileSync(`node_modules/@fontsource/${slug}/package.json`, 'utf8')) as { license: string };
      expect(pkg.license, family).toBe('OFL-1.1');
      for (const f of files) expect(existsSync(`node_modules/@fontsource/${slug}/files/${slug}-latin-${f.weight}-${f.style}.woff2`), `${family} ${f.weight} ${f.style}`).toBe(true);
    }
  });

  it('projetos antigos (estilo sem acabamento) abrem com tudo desligado', () => {
    const { decor: _d, ...old } = POP;
    const parsed = styleSchema.parse(old);
    expect(parsed.decor).toEqual(DECOR_OFF);
    const plan = { ...galleryPlan(POP), style: old };
    const r = parseEditPlan(plan);
    expect(r.ok && r.plan.style.decor).toEqual(DECOR_OFF);
  });

  it('o plano da galeria passa no esquema em todos os modelos', () => {
    for (const t of TEMPLATES) expect(parseEditPlan(galleryPlan(t.style)).ok, t.id).toBe(true);
  });
});

describe('acabamento do quadro (decor)', () => {
  it('Cinema: duas faixas pretas da altura pedida; Pop não tem', () => {
    const bars = (s: StyleDNA) => frame(galleryPlan(s), 1.3).calls.filter((c) => c.op === 'fillRect' && c.fillStyle === '#000000' && c.args[3] === letterboxH({ h: H, style: s }));
    expect(bars(CINEMA)).toHaveLength(2);
    expect(letterboxH({ h: H, style: CINEMA })).toBe(Math.round(H * 0.085));
    expect(bars(POP)).toHaveLength(0);
  });

  it('Jornal: faixa de manchetes com as frases do vídeo, correndo com o tempo, sem cobrir a legenda', () => {
    const p = galleryPlan(JORNAL);
    expect(tickerText(p)).toContain('Três dicas que mudam tudo');
    expect(tickerText(p)).toContain('Comece pequeno');
    expect(tickerText({ scenes: [], captions: p.captions })).toContain('Noventa por cento');
    const at = (t: number) => frame(p, t).calls.filter((c) => c.op === 'fillText' && String(c.args[0]).includes('TRÊS DICAS QUE MUDAM TUDO   •'));
    expect(frame(p, 3).texts()).toContain(TICKER_LABEL.toUpperCase());
    expect(at(3)[0]!.args[1]).not.toBe(at(4)[0]!.args[1]);
    const f = makeFrame(W, H, JORNAL);
    const tickerTop = f.safe.y + f.safe.h + 18;
    expect(makeFrame(W, H, POP).safe.h - f.safe.h).toBeCloseTo(TICKER_H + 18, 5);
    const rc = frame(p, 4.2);
    const capWords = rc.calls.filter((c) => c.op === 'fillText' && /^(NOVENTA|CENTO|DESISTEM)$/.test(String(c.args[0])));
    expect(capWords.length).toBeGreaterThan(0);
    for (const c of capWords) expect(screenY(c)).toBeLessThan(tickerTop);
  });

  it('selo do canto: rótulo (Podcast), "REC" com o tempo (Retrô); some com a legenda em cima', () => {
    expect(frame(galleryPlan(PODCAST), 2).texts()).toContain('PODCAST');
    expect(timecode(3725.4)).toBe('01:02:05');
    const retro = frame(galleryPlan(RETRO), 12.3).texts();
    expect(retro).toContain('PLAY');
    expect(retro).toContain('00:00:12');
    const top = { ...PODCAST, captions: { ...PODCAST.captions, position: 'top' as const } };
    expect(frame(galleryPlan(top), 2).texts()).not.toContain('PODCAST');
  });

  it('Retrô: linhas de TV num único preenchimento, cores separadas na legenda e tremor determinístico', () => {
    const rc = frame(galleryPlan(RETRO), 4.2);
    expect(rc.calls.filter((c) => c.op === 'rect').length).toBeGreaterThan(400);
    expect(frame(galleryPlan(POP), 4.2).calls.filter((c) => c.op === 'rect').length).toBeLessThan(10);
    const fills = drawCap(RETRO, 1.5).calls.filter((c) => c.op === 'fillText' && String(c.args[0]) === 'ISSO').map((c) => c.fillStyle);
    expect(fills).toEqual(expect.arrayContaining(['#FF1E56', '#00E5FF', RETRO.palette.text]));
    expect(captionJitter(RETRO, 2.31)).toBe(captionJitter(RETRO, 2.31));
    expect(captionJitter(POP, 2.31)).toBe(0);
    expect(captionJitter({ ...RETRO, motion: { ...RETRO.motion, intensity: 0 } }, 2.31)).not.toBe(captionJitter(RETRO, 2.31));
  });

  it('Datilografia: palavras aparecem quando são ditas, a tira de papel cresce e o cursor fica depois da última', () => {
    const at = (t: number) => drawCap(DATILOGRAFIA, t);
    expect(at(1.1).texts()).toEqual(['isso']);
    expect(at(1.5).texts()).toEqual(['isso', 'muda']);
    const strip = (t: number) => at(t).calls.find((c) => c.op === 'roundRect')!.args[2] as number;
    expect(strip(1.5)).toBeGreaterThan(strip(1.1));
    const cursor = (t: number) => at(t).calls.filter((c) => c.op === 'fillRect' && c.fillStyle === DATILOGRAFIA.palette.accent);
    expect(cursor(1.5)).toHaveLength(1);
    const muda = word(at(1.5), 'muda')[0]!;
    expect(cursor(1.5)[0]!.args[0] as number).toBeGreaterThan(muda.args[1] as number);
    // texto escuro sobre a tira clara; a palavra falada em vermelho (ainda legível sobre o papel)
    expect(word(at(1.5), 'isso')[0]!.fillStyle).toBe('#0B0B0B');
    expect(word(at(1.5), 'muda')[0]!.fillStyle).toBe(DATILOGRAFIA.palette.accent);
  });

  it('Impacto: um bloco por palavra (texto escuro), a falada num bloco vermelho com texto branco', () => {
    const rc = drawCap(IMPACTO, 1.6);
    expect(rc.calls.filter((c) => c.op === 'roundRect').length).toBeGreaterThanOrEqual(4);
    expect(word(rc, 'isso')[0]!.fillStyle).toBe('#0B0B0B');
    expect(word(rc, 'muda')[0]!.fillStyle).toBe(IMPACTO.palette.onPanel);
    expect(rc.calls.filter((c) => c.op === 'strokeText')).toHaveLength(0);
    // pedir outra cor de caixa mantém os blocos por palavra
    expect(applyLook(IMPACTO, { captions: { box: '#000000' } }, []).captions.box).toBe('word');
  });

  it('Marca-texto: traço amarelo atrás da palavra falada, que fica escura', () => {
    const rc = drawCap(MARCA_TEXTO, 1.7);
    expect(rc.calls.some((c) => c.op === 'fill' && c.fillStyle === MARCA_TEXTO.palette.accent)).toBe(true);
    expect(word(rc, 'muda')[0]!.fillStyle).toBe(MARCA_TEXTO.palette.onPanel);
    expect(word(rc, 'isso')[0]!.fillStyle).toBe(MARCA_TEXTO.palette.text);
  });

  it('Turbo: palavra falada em degradê; cor pedida pela pessoa vale mais que o degradê', () => {
    expect(word(drawCap(TURBO, 1.6), 'muda').at(-1)!.fillStyle).toBe('gradient');
    expect(word(drawCap(TURBO, 1.6), 'isso').at(-1)!.fillStyle).toBe(TURBO.palette.text);
    const own = applyLook(TURBO, { captions: { highlight: '#FF0000' } }, []);
    expect(word(drawCap(own, 1.6), 'muda').at(-1)!.fillStyle).toBe('#FF0000');
  });

  it('molduras do título: Luxo (moldura), Jornal (tarja de ponta a ponta), Marca-texto (traço), Pop sem moldura', () => {
    const title: SceneInstance = { id: 't', kind: 'kinetic-title', text: 'Três dicas rápidas', start: 0, end: 3 };
    const accentRects = (s: StyleDNA, t: number) => drawScene(s, title, t).calls.filter((c) => c.op === 'fillRect' && c.fillStyle === s.palette.accent);
    expect(accentRects(LUXO, 1.5).length).toBeGreaterThanOrEqual(6);
    expect(accentRects(LUXO, 0.2).reduce((a, c) => a + (c.args[2] as number) * (c.args[3] as number), 0)).toBeLessThan(accentRects(LUXO, 1.5).reduce((a, c) => a + (c.args[2] as number) * (c.args[3] as number), 0));
    const band = accentRects(JORNAL, 1.5);
    expect(band[0]!.args[0]).toBe(0);
    expect(drawScene(MARCA_TEXTO, title, 1.5).calls.some((c) => c.op === 'fill' && c.fillStyle === MARCA_TEXTO.palette.accent)).toBe(true);
    expect(accentRects(POP, 1.5)).toHaveLength(0);
  });

  it('Jornal: nome na tela vira tarja encostada na borda; Tutorial: passos em círculos numerados', () => {
    const lt: SceneInstance = { id: 'l', kind: 'lower-third', title: 'Ana Souza', subtitle: 'Personal trainer', start: 0, end: 3 };
    const rc = drawScene(JORNAL, lt, 1.5);
    expect(rc.calls.some((c) => c.op === 'fillRect' && c.args[0] === 0 && c.fillStyle.startsWith('rgba(11, 31, 58'))).toBe(true);
    expect(rc.texts()).toEqual(expect.arrayContaining(['ANA SOUZA', 'PERSONAL TRAINER']));
    const list: SceneInstance = { id: 'x', kind: 'list', items: [{ text: 'Comece pequeno', at: 0.2 }, { text: 'Durma bem', at: 1 }], start: 0, end: 3 };
    const texts = drawScene(TUTORIAL, list, 2).texts();
    expect(texts).toEqual(expect.arrayContaining(['1', '2', 'Comece pequeno', 'Durma bem']));
    expect(texts).not.toContain('01');
  });
});

describe('entradas novas (slide, drop, zoom, type): começam fora do lugar e terminam paradas', () => {
  const box = { x: 100, y: 800, w: 600, h: 120 };
  const pose = (s: StyleDNA, t: number) => {
    const rc = new RecordingContext();
    const ctx = rc.asCtx();
    ctx.save();
    applyMotion(ctx, makeFrame(W, H, s), phase(s, t, 0, 3), box);
    ctx.fillText('x', 0, 0);
    return rc.calls.at(-1)!;
  };
  it('slide vem da esquerda (Impacto)', () => {
    expect(pose(IMPACTO, 0.05).m[4]!).toBeLessThan(-10);
    expect(pose(IMPACTO, 1.5).m[4]!).toBeCloseTo(0, 3);
  });
  it('drop cai de cima (Turbo)', () => {
    expect(pose(TURBO, 0.05).m[5]!).toBeLessThan(-50);
    expect(pose(TURBO, 1.5).m[5]!).toBeCloseTo(0, 3);
  });
  it('zoom assenta de um pouco maior (Cinema)', () => {
    expect(pose(CINEMA, 0.2).m[0]!).toBeGreaterThan(1.02);
    expect(pose(CINEMA, 1.5).m[0]!).toBeCloseTo(1, 3);
  });
  it('type revela em degraus (Datilografia)', () => {
    const rcAt = (t: number) => {
      const rc = new RecordingContext();
      applyMotion(rc.asCtx(), makeFrame(W, H, DATILOGRAFIA), phase(DATILOGRAFIA, t, 0, 3), box);
      return rc.calls.find((c) => c.op === 'rect')!.args[2] as number;
    };
    expect(rcAt(0.2)).toBeLessThan(rcAt(0.5));
    expect(rcAt(1.5)).toBeGreaterThanOrEqual(box.w);
  });
});

describe('todos os modelos respeitam o look e são determinísticos', () => {
  for (const t of TEMPLATES) {
    it(`${t.id}: cor, posição e tamanho pedidos aparecem na legenda`, () => {
      const s = applyLook(t.style, { captions: { text: '#FF0000', position: 'top', scale: 1.3 } }, []);
      const rc = drawCap(s, 2.1);
      const isso = word(rc, 'isso').at(-1)!;
      expect(isso.fillStyle).toBe('#FF0000');
      expect(screenY(isso)).toBeLessThan(H * 0.35);
      const size = Number(/([\d.]+)px/.exec(isso.font)![1]);
      expect(size).toBeGreaterThan(t.style.captions.size * W * 1.1);
    });

    it(`${t.id}: o mesmo instante dá o mesmo quadro, em qualquer ordem`, () => {
      const p = galleryPlan(t.style);
      const first = frame(p, 8.3).snapshot();
      for (const x of [26.9, 0.4, 12, 4.4, 22]) frame(p, x);
      expect(frame(p, 8.3).snapshot()).toBe(first);
    });
  }
});

void EMPTY_BRIEF;
