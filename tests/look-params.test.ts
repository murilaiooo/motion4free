import { describe, expect, it } from 'vitest';
import { colorFromWords, parseColorValue, parseHex, shade } from '../src/core/color-names';
import { EMOJI_FONT_FAMILY, EMOJI_SET, isEmoji, normalizeEmoji, planUsesEmoji } from '../src/core/emoji';
import { lookIsEmpty, mergeLook, rangeLook, sanitizeLook, type Look } from '../src/core/look';
import { EDITORIAL, POP, PRESETS } from '../src/core/presets';
import { parseEditPlan } from '../src/core/schema';
import type { StyleDNA } from '../src/core/style';
import type { Caption, SceneInstance } from '../src/core/types';
import { autoEdit } from '../src/editorial/auto-edit';
import { applyLook } from '../src/editorial/brief-apply';
import { emojiForWord, emojiForWords } from '../src/editorial/emoji-pick';
import { interpretPrompt } from '../src/editorial/interpret';
import { applyBrief, applyRange, type EditContext } from '../src/editorial/ops';
import { interpretRangePrompt } from '../src/editorial/range-interpret';
import { styleAt } from '../src/editorial/ranges';
import { proposeEmojis } from '../src/editorial/selector';
import { captionCenterFrac, captionColors, captionEnter, captionTop, drawCaption, layoutLines } from '../src/render/captions';
import { drawEmoji, emojiPose } from '../src/render/emoji';
import { makeFrame } from '../src/render/kit';
import { RecordingContext } from './helpers/recording-ctx';
import { SAMPLE_TEXT, wordsFrom } from './helpers/words';

const VERDE = '#22C55E';
const AMARELO = '#FFD400';
const look = (l: Look, base: StyleDNA = POP, forbid: string[] = []) => applyLook(base, l, forbid as never);

/* ---------- cores por nome ---------- */
describe('cores por nome (PT/EN) e código', () => {
  it('nomes simples, femininos e plurais', () => {
    expect(colorFromWords(['verde'], 0)?.hex).toBe(VERDE);
    expect(colorFromWords(['amarela'], 0)?.hex).toBe(AMARELO);
    expect(colorFromWords(['amarelos'], 0)?.hex).toBe(AMARELO);
    expect(colorFromWords(['yellow'], 0)?.hex).toBe(AMARELO);
  });
  it('nome composto e modificador "mais escuro"', () => {
    expect(colorFromWords(['rosa', 'choque'], 0)).toEqual({ hex: '#FF2E93', used: 2 });
    const dark = colorFromWords(['azul', 'mais', 'escuro'], 0)!;
    expect(dark.used).toBe(3);
    expect(dark.hex).toBe(shade('#3B82F6', 'escuro', 0.5));
  });
  it('códigos #abc e #aabbcc', () => {
    expect(parseHex('#fa0')).toBe('#FFAA00');
    expect(parseHex('#00ff88')).toBe('#00FF88');
    expect(parseHex('#zzz')).toBeNull();
    expect(parseColorValue('verde')).toBe(VERDE);
    expect(parseColorValue('#123456')).toBe('#123456');
    expect(parseColorValue('roxo-galáctico-xyz')).toBeNull();
  });
  it('shade escurece e clareia dentro de #RRGGBB', () => {
    expect(shade('#808080', 'escuro')).toMatch(/^#[0-9A-F]{6}$/);
    expect(parseInt(shade('#808080', 'escuro').slice(1, 3), 16)).toBeLessThan(0x80);
    expect(parseInt(shade('#808080', 'claro').slice(1, 3), 16)).toBeGreaterThan(0x80);
  });
});

/* ---------- validação do look (resposta da IA) ---------- */
describe('sanitizeLook: valida campo a campo e descarta só o inválido', () => {
  it('aceita nomes de cor, sinônimos e números dentro dos limites', () => {
    const { look: l, dropped } = sanitizeLook({ captions: { text: 'verde', highlight: '#ffd400', scale: 1.5, position: 'top', case: 'upper' }, emoji: { mode: 'interval', everySec: 3, prefer: ['🔥', '🚀'] }, cuts: 'agressivo', motion: 0.7 });
    expect(dropped).toEqual([]);
    expect(l).toMatchObject({ captions: { text: VERDE, highlight: AMARELO, scale: 1.5, position: 'top', case: 'upper' }, emoji: { mode: 'interval', everySec: 3, prefer: ['🔥', '🚀'] }, cuts: 'agressivo', motion: 0.7 });
  });
  it('descarta valor fora do limite, enum desconhecido e emoji fora da lista, mas fica com o resto', () => {
    const { look: l, dropped } = sanitizeLook({ captions: { text: 'verde', scale: 99, font: 'Comic Sans' }, emoji: { everySec: 0.1, prefer: ['🦖'] }, transition: 'explosao', accent: 'azul' });
    expect(l.captions?.text).toBe(VERDE);
    expect(l.captions?.scale).toBeUndefined();
    expect(l.captions?.font).toBeUndefined();
    expect(l.emoji?.everySec).toBeUndefined();
    expect(l.transition).toBeUndefined();
    expect(l.accent).toBe('#3B82F6');
    expect(dropped.length).toBeGreaterThanOrEqual(4);
  });
  it('lixo vira look vazio, sem lançar', () => {
    expect(lookIsEmpty(sanitizeLook('nada').look)).toBe(true);
    expect(lookIsEmpty(sanitizeLook(null).look)).toBe(true);
    expect(lookIsEmpty(sanitizeLook([1, 2]).look)).toBe(true);
  });
  it('mergeLook: o segundo vale mais campo a campo', () => {
    expect(mergeLook({ captions: { text: VERDE, scale: 1.2 } }, { captions: { text: AMARELO } })).toEqual({ captions: { text: AMARELO, scale: 1.2 } });
  });
  it('rangeLook tira cortes e palavras por legenda (valem para o vídeo inteiro)', () => {
    const r = rangeLook({ cuts: 'agressivo', captions: { wordsAtOnce: 2, text: VERDE } });
    expect(r.look).toEqual({ captions: { text: VERDE } });
    expect(r.removed).toEqual(['cortes', 'palavras por legenda']);
  });
});

/* ---------- applyLook: cada campo muda o estilo ---------- */
describe('applyLook: cada campo do look chega ao estilo', () => {
  it('cores da legenda (texto, destaque, contorno, caixa)', () => {
    const s = look({ captions: { text: VERDE, highlight: AMARELO, stroke: '#000000', box: '#111111' } });
    expect(s.captions.colors).toEqual({ text: VERDE, highlight: AMARELO, stroke: '#000000', box: '#111111' });
    expect(s.captions.box).toBe('line');
    expect(s.captions.stroke).toBeGreaterThan(0);
  });
  it('sem fundo e espessura do contorno', () => {
    const s = look({ captions: { box: 'none', strokeWidth: 0 } });
    expect(s.captions.box).toBe('none');
    expect(s.captions.stroke).toBe(0);
    expect(look({ captions: { strokeWidth: 99 } }).captions.stroke).toBe(24);
  });
  it('tamanho (escala, com limite do esquema)', () => {
    expect(look({ captions: { scale: 1.5 } }).captions.size).toBeCloseTo(Math.min(0.16, POP.captions.size * 1.5), 3);
    expect(look({ captions: { scale: 2.2 } }).captions.size).toBeLessThanOrEqual(0.16);
  });
  it('posição e altura livre', () => {
    expect(look({ captions: { position: 'top' } }).captions.position).toBe('top');
    const y = look({ captions: { y: 0.3 } }).captions;
    expect(y.position).toBe('custom');
    expect(y.y).toBe(0.3);
  });
  it('caixa das letras vale para legenda e ênfase', () => {
    const s = look({ captions: { case: 'lower' } });
    expect(s.type.text.case).toBe('lower');
    expect(s.type.emphasis.case).toBe('lower');
  });
  it('fonte troca para uma das fontes que acompanham o app, com peso existente', () => {
    const s = look({ captions: { font: 'Anton' } }, EDITORIAL);
    expect(s.type.text.family).toBe('Anton');
    expect(s.type.text.weight).toBe(400);
  });
  it('animação de entrada, palavras por linha, palavras por legenda e destaque', () => {
    const s = look({ captions: { animation: 'typewriter', wordsPerLine: 2, wordsAtOnce: 1, highlightMode: 'underline' } });
    expect(s.captions.enter).toBe('typewriter');
    expect(s.captions.wordsPerLine).toBe(2);
    expect(s.captions.maxWords).toBe(1);
    expect(s.captions.highlight).toBe('underline');
  });
  it('emoji: modo, intervalo, posição, tamanho e animação', () => {
    const s = look({ emoji: { mode: 'interval', everySec: 3, position: 'top', scale: 1.5, animation: 'bounce' } });
    expect(s.emoji).toMatchObject({ mode: 'interval', everySec: 3, position: 'top', animation: 'bounce' });
    expect(s.emoji.size).toBeCloseTo(0.21, 3);
  });
  it('emoji liga sozinho quando um detalhe é pedido; "sem emojis" desliga', () => {
    expect(look({ emoji: { position: 'top' } }).emoji.mode).toBe('keywords');
    expect(look({ emoji: { everySec: 4 } }).emoji.mode).toBe('interval');
    expect(look({ emoji: { mode: 'interval' } }, POP, ['emojis']).emoji.mode).toBe('off');
  });
  it('cor de destaque do vídeo, transição e intensidade', () => {
    const s = look({ accent: '#3B82F6', transition: 'flash', motion: 0.8 });
    expect(s.palette.accent).toBe('#3B82F6');
    expect(s.transition).toBe('flash');
    expect(s.motion.intensity).toBe(0.8);
    const calm = look({ transition: 'flash', motion: 0.9 }, POP, ['efeitos']);
    expect(calm.transition).toBe(POP.transition);
    expect(calm.motion.intensity).toBeLessThanOrEqual(0.15);
  });
  it('cenas ligadas: barra, zoom, destaques e transições (respeitando proibições)', () => {
    const base = { ...EDITORIAL, progress: 'none' as const, transition: 'none' as const };
    const s = look({ scenes: { barra: true, zoom: true, destaques: true, transicoes: true } }, base);
    expect(s.progress).toBe('bar');
    expect(s.zoomScale).toBeGreaterThanOrEqual(1.08);
    expect(s.rhythm.keywordEverySec).toBeLessThanOrEqual(4);
    expect(s.transition).toBe('zoom');
    expect(look({ scenes: { barra: true } }, base, ['barra']).progress).toBe('none');
  });
  it('o estilo resultante continua válido para todos os estilos', () => {
    const big: Look = { captions: { text: VERDE, highlight: AMARELO, stroke: '#000000', box: '#000000', scale: 2.2, y: 0.9, case: 'upper', font: 'Montserrat', animation: 'bounce', wordsPerLine: 3, wordsAtOnce: 8, highlightMode: 'box', strokeWidth: 24 }, emoji: { mode: 'keywords', scale: 2, position: 'left', animation: 'spin' }, accent: '#FF2E93', transition: 'whip', motion: 1, scenes: { barra: true, zoom: true } };
    for (const p of PRESETS) {
      const plan = { ...autoEdit(10, [], wordsFrom('um dois tres quatro')), style: look(big, p) };
      expect(() => parseEditPlan(plan)).not.toThrow();
    }
  });
});

/* ---------- desenho: cada campo aparece no quadro ---------- */
const W = 1080;
const H = 1920;
const caption: Caption = { id: 'c1', text: 'isso muda tudo', start: 0, end: 2, wordIds: ['a', 'b', 'c'], wordStarts: [0, 0.5, 1] };
function drawCap(s: StyleDNA, t = 0.6) {
  const rc = new RecordingContext();
  drawCaption(rc.asCtx(), makeFrame(W, H, s), caption, t, new Set());
  return rc;
}
const textCalls = (rc: RecordingContext) => rc.calls.filter((c) => c.op === 'fillText');

describe('legenda desenhada com o look', () => {
  const plain: StyleDNA = { ...POP, captions: { ...POP.captions, highlight: 'color', box: 'none', stroke: 0 } };
  it('cor do texto e da palavra falada', () => {
    const s = look({ captions: { text: VERDE, highlight: AMARELO } }, plain);
    const calls = textCalls(drawCap(s));
    expect(calls.find((c) => c.args[0] === 'ISSO' || c.args[0] === 'isso')!.fillStyle).toBe(VERDE);
    // a palavra falada em 0,6 s é a segunda
    expect(calls[1]!.fillStyle).toBe(AMARELO);
  });
  it('contorno com a cor pedida', () => {
    const s = look({ captions: { stroke: '#FF0000', strokeWidth: 10 } }, plain);
    const stroke = drawCap(s).calls.find((c) => c.op === 'strokeText')!;
    expect(stroke.strokeStyle).toBe('#FF0000');
    expect(stroke.lineWidth).toBeCloseTo(10, 5);
  });
  it('caixa atrás da linha com a cor pedida', () => {
    const s = look({ captions: { box: '#123456' } }, plain);
    const box = drawCap(s).calls.find((c) => c.op === 'fill' && c.fillStyle === '#123456');
    expect(box).toBeDefined();
  });
  it('posição em cima, no meio e em altura livre', () => {
    const safe = makeFrame(W, H, plain).safe;
    const yOf = (s: StyleDNA) => textCalls(drawCap(s))[0]!.args[2] as number;
    const top = yOf(look({ captions: { position: 'top' } }, plain));
    const center = yOf(look({ captions: { position: 'center' } }, plain));
    const bottom = yOf(look({ captions: { position: 'bottom' } }, plain));
    expect(top).toBeLessThan(center);
    expect(center).toBeLessThan(bottom);
    expect(top).toBeGreaterThanOrEqual(safe.y);
    expect(captionTop(look({ captions: { y: 0.3 } }, plain), safe, 100)).toBeCloseTo(safe.y + safe.h * 0.3 - 50, 3);
    expect(captionCenterFrac(look({ captions: { position: 'top' } }, plain))).toBeLessThan(0.5);
  });
  it('caixa das letras: minúsculas', () => {
    const upper = { ...plain, type: { ...plain.type, text: { ...plain.type.text, case: 'upper' as const } } };
    expect(textCalls(drawCap(upper)).map((c) => c.args[0])).toEqual(['ISSO', 'MUDA', 'TUDO']);
    expect(textCalls(drawCap(look({ captions: { case: 'lower' } }, upper))).map((c) => c.args[0])).toEqual(['isso', 'muda', 'tudo']);
  });
  it('fonte pedida no desenho', () => {
    const s = look({ captions: { font: 'IBM Plex Mono' } }, plain);
    expect(textCalls(drawCap(s))[0]!.font).toContain('IBM Plex Mono');
  });
  it('palavras por linha: uma palavra por linha = três linhas', () => {
    const s = look({ captions: { wordsPerLine: 1 } }, plain);
    const ys = new Set(textCalls(drawCap(s)).map((c) => Math.round(c.args[2] as number)));
    expect(ys.size).toBe(3);
    expect(layoutLines([10, 10, 10, 10], 2, 1000, 2)).toEqual([[0, 1], [2, 3]]);
  });
  it('entrada "como digitando": só as palavras já faladas aparecem', () => {
    const s = look({ captions: { animation: 'typewriter' } }, plain);
    expect(textCalls(drawCap(s, 0.6)).map((c) => String(c.args[0]).toLowerCase())).toEqual(['isso', 'muda']);
  });
  for (const kind of ['fade', 'slide', 'bounce', 'pop', 'rise'] as const) {
    it(`entrada "${kind}": começa diferente e termina no lugar`, () => {
      const s = look({ captions: { animation: kind } }, plain);
      expect(captionEnter(s)).toBe(kind);
      const early = drawCap(s, 0.02);
      const late = drawCap(s, 1.5);
      const settled = drawCap(look({ captions: { animation: 'none' } }, plain), 1.5);
      expect(early.snapshot()).not.toBe(late.snapshot());
      const pos = (rc: RecordingContext) => textCalls(rc).map((c) => [c.args[1], c.args[2], c.globalAlpha]);
      expect(pos(late)).toEqual(pos(settled));
    });
  }
  it('sem pedido, as cores são as do estilo', () => {
    expect(captionColors(POP).text).toBe(POP.palette.text);
    expect(captionEnter({ ...POP, captions: { ...POP.captions, enter: 'auto' } })).toBe(POP.motion.enter === 'pop' ? 'pop' : POP.motion.enter === 'rise' ? 'rise' : 'none');
  });
});

/* ---------- emojis ---------- */
const emo = (start = 1, emoji: SceneInstance & { kind: 'emoji' } extends infer T ? T : never = { id: 'e', kind: 'emoji', emoji: '🔥', start, end: start + 1.5 } as never) => emoji as Extract<SceneInstance, { kind: 'emoji' }>;

describe('emojis: lista, escolha pelo sentido e desenho', () => {
  it('lista fechada e normalização (com ou sem FE0F)', () => {
    expect(EMOJI_SET.length).toBeGreaterThanOrEqual(60);
    expect(new Set(EMOJI_SET).size).toBe(EMOJI_SET.length);
    expect(isEmoji('🔥')).toBe(true);
    expect(isEmoji('🦖')).toBe(false);
    expect(normalizeEmoji('❤')).toBe('❤️');
    expect(planUsesEmoji({ scenes: [{ kind: 'emoji' }] })).toBe(true);
    expect(planUsesEmoji({ scenes: [{ kind: 'list' }] })).toBe(false);
  });
  it('escolhe pelo sentido da palavra', () => {
    expect(emojiForWord('dinheiro')).toBe('💰');
    expect(emojiForWord('academia')).toBe('💪');
    expect(emojiForWords(['vou', 'te', 'mostrar', 'dicas'])?.emoji).toBeDefined();
  });

  const style = (e: Partial<StyleDNA['emoji']>) => ({ ...POP, emoji: { ...POP.emoji, ...e } }) as StyleDNA;
  const ws = wordsFrom(SAMPLE_TEXT).map((w) => ({ raw: w.text, start: w.start, end: w.end }));
  const total = ws.at(-1)!.end;
  it('a cada N segundos: um emoji por intervalo, sem sobrepor', () => {
    const out = proposeEmojis(ws, total, style({ mode: 'interval', everySec: 3 }));
    expect(out.length).toBeGreaterThanOrEqual(Math.floor(total / 3) - 2);
    expect(out.length).toBeLessThanOrEqual(Math.ceil(total / 3) + 1);
    for (let i = 1; i < out.length; i++) expect(out[i]!.start).toBeGreaterThanOrEqual(out[i - 1]!.end);
    for (const e of out) expect(isEmoji(e.emoji)).toBe(true);
    // dois emojis seguidos nunca são iguais
    for (let i = 1; i < out.length; i++) expect(out[i]!.emoji).not.toBe(out[i - 1]!.emoji);
  });
  it('nas palavras importantes: o emoji aparece na palavra que deu sentido', () => {
    const out = proposeEmojis(ws, total, style({ mode: 'keywords' }));
    expect(out.length).toBeGreaterThan(0);
    // cada emoji está numa palavra cujo sentido o escolheu (ex.: academia → 💪)
    expect(out.find((e) => e.emoji === '💪')).toBeDefined();
    for (const e of out) {
      const i = ws.findIndex((w) => Math.abs(w.start - e.start) < 0.01);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(emojiForWords([ws[i]!.raw, ws[i + 1]?.raw ?? ''].filter(Boolean))?.emoji).toBe(e.emoji);
    }
    // nunca dois a menos de 1,5 s
    for (let i = 1; i < out.length; i++) expect(out[i]!.start - out[i - 1]!.start).toBeGreaterThanOrEqual(1.5);
  });
  it('desligado ou proibido: nenhum emoji', () => {
    expect(proposeEmojis(ws, total, style({ mode: 'off' }))).toEqual([]);
    const words = wordsFrom(SAMPLE_TEXT);
    const d = words.at(-1)!.end + 0.5;
    const ctx: EditContext = { durationSec: d, words };
    const p = applyBrief(autoEdit(d, [], words), ctx, interpretPrompt('emojis a cada 3 segundos, mas sem emojis').brief);
    expect(p.scenes.some((s) => s.kind === 'emoji')).toBe(false);
  });
  it('preferidos: "emoji de fogo" usa o fogo quando a fala não sugere outro', () => {
    const out = proposeEmojis([{ raw: 'blá', start: 0.2, end: 0.4 }], 6, style({ mode: 'interval', everySec: 2 }), ['🔥']);
    expect(out.every((e) => e.emoji === '🔥')).toBe(true);
  });

  it('desenho usa a fonte de emojis do app e a posição pedida', () => {
    const rc = new RecordingContext();
    const f = makeFrame(W, H, style({ mode: 'interval', position: 'top' }));
    drawEmoji(rc.asCtx(), f, emo(), 1.5);
    const call = rc.calls.find((c) => c.op === 'fillText')!;
    expect(call.args[0]).toBe('🔥');
    expect(call.font).toContain(`"${EMOJI_FONT_FAMILY}"`);
    expect(call.m[5]).toBeLessThan(f.safe.y + f.safe.h * 0.3);
  });
  it('posições: em cima < meio < embaixo; esquerda < direita; "auto" longe da legenda', () => {
    const y = (position: StyleDNA['emoji']['position']) => emojiPose(makeFrame(W, H, style({ position, animation: 'none' })), emo(1), 1.5).y;
    const x = (position: StyleDNA['emoji']['position']) => emojiPose(makeFrame(W, H, style({ position, animation: 'none' })), emo(1), 1.5).x;
    expect(y('top')).toBeLessThan(y('middle'));
    expect(y('middle')).toBeLessThan(y('bottom'));
    expect(x('left')).toBeLessThan(x('right'));
    const capBottom = { ...POP, captions: { ...POP.captions, position: 'bottom' as const }, emoji: { ...POP.emoji, position: 'auto' as const, animation: 'none' as const } };
    const f = makeFrame(W, H, capBottom);
    expect(emojiPose(f, emo(1), 1.5).y).toBeLessThan(f.safe.y + f.safe.h * 0.75);
  });
  it('tamanho segue o estilo', () => {
    const small = emojiPose(makeFrame(W, H, style({ size: 0.08 })), emo(), 1.5).size;
    const big = emojiPose(makeFrame(W, H, style({ size: 0.25 })), emo(), 1.5).size;
    expect(big).toBeGreaterThan(small * 2);
  });
  for (const animation of ['pop', 'bounce', 'float', 'spin', 'fade'] as const) {
    it(`animação "${animation}": começa diferente de parado e some no fim`, () => {
      const f = makeFrame(W, H, style({ animation }));
      const still = emojiPose(makeFrame(W, H, style({ animation: 'none' })), emo(1), 1.05);
      const p = emojiPose(f, emo(1), 1.05);
      expect([p.y, p.scale, p.rotate, p.alpha]).not.toEqual([still.y, still.scale, still.rotate, still.alpha]);
      expect(emojiPose(f, emo(1), 2.5).alpha).toBe(0);
    });
  }
  it('é determinístico (mesmo quadro, mesmo desenho: prévia = exportação)', () => {
    const f = makeFrame(W, H, style({ animation: 'bounce' }));
    const a = new RecordingContext();
    const b = new RecordingContext();
    drawEmoji(a.asCtx(), f, emo(), 1.2);
    drawEmoji(b.asCtx(), f, emo(), 1.2);
    expect(a.snapshot()).toBe(b.snapshot());
  });
});

/* ---------- pedido do responsável ponta a ponta no plano ---------- */
describe('pedido do responsável aplicado ao plano (sem IA)', () => {
  const words = wordsFrom(SAMPLE_TEXT);
  const d = words.at(-1)!.end + 0.5;
  const ctx: EditContext = { durationSec: d, words };
  const base = autoEdit(d, [], words);
  const p = applyBrief(base, ctx, interpretPrompt('gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos').brief);
  it('legenda verde e amarela no estilo', () => {
    expect(p.style.captions.colors.text).toBe(VERDE);
    expect(p.style.captions.colors.highlight).toBe(AMARELO);
  });
  it('emojis a cada ~3 s no plano', () => {
    const e = p.scenes.filter((s) => s.kind === 'emoji');
    expect(e.length).toBeGreaterThanOrEqual(5);
    expect(p.style.emoji.everySec).toBe(3);
  });
  it('gancho criativo escolhido entre as frases da própria fala', () => {
    expect(p.brief.wantsHook).toBe(true);
    expect(p.brief.hookStyle).toBe('criativo');
    expect(p.brief.hook).not.toBeNull();
    const text = words.map((w) => w.text).join(' ');
    expect(text).toContain(p.brief.hook!.text.replace(/[.!?]$/, ''));
  });
  it('o plano continua válido', () => expect(() => parseEditPlan(p)).not.toThrow());
});

/* ---------- trecho com look ---------- */
describe('pedido de trecho com look', () => {
  const words = wordsFrom(SAMPLE_TEXT);
  const d = words.at(-1)!.end + 0.5;
  const ctx: EditContext = { durationSec: d, words };
  const base = autoEdit(d, [], words);
  it('"legenda vermelha aqui" muda só o trecho', () => {
    const req = interpretRangePrompt('legenda vermelha aqui');
    expect(req.understood).toBe(true);
    expect(req.look.captions?.text).toBe('#EF4444');
    const r = applyRange(base, ctx, { start: 5, end: 8 }, req);
    expect(styleAt(r.plan, 6).captions.colors.text).toBe('#EF4444');
    expect(styleAt(r.plan, 1).captions.colors.text).not.toBe('#EF4444');
    expect(() => parseEditPlan(r.plan)).not.toThrow();
  });
  it('cortes e palavras por legenda ficam de fora no trecho, com nota', () => {
    const req = interpretRangePrompt('cortes rapidos aqui e legenda verde');
    expect(req.look.cuts).toBeUndefined();
    expect(req.look.captions?.text).toBe(VERDE);
    expect(req.notes.join(' ')).toContain('vídeo inteiro');
  });
  it('trecho travado recusa o look (M4F de trecho travado)', () => {
    const locked = applyRange(base, ctx, { start: 5, end: 8 }, interpretRangePrompt('trava esse pedaço'));
    const id = locked.plan.ranges[0]!.id;
    expect(() => applyRange(locked.plan, ctx, { id }, interpretRangePrompt('legenda verde aqui'))).toThrow(/trecho/i);
  });
  it('"sem animação aqui" tira os emojis do trecho', () => {
    const req = interpretRangePrompt('emojis grandes aqui');
    expect(req.look.emoji).toBeDefined();
    const quiet = interpretRangePrompt('sem animação aqui, emojis grandes');
    expect(quiet.look.emoji).toBeUndefined();
  });
  it('o que o app não sabe fazer no trecho vira "ainda não sei fazer"', () => {
    const req = interpretRangePrompt('musica de fundo aqui e legenda verde');
    expect(req.unsupported).toContain('música ou efeitos sonoros');
  });
});
