import type { EditPlan, SceneInstance } from '../core/types';
import type { Framing as ManualFraming } from '../core/edits';
import { resolvePlan, type Resolved, type ResolvedScene } from '../editorial/elements';
import type { ElementMarks } from './bounds';
import { drawAdded } from './added';
import { captionStyle, sceneStyle } from './look';
import { normalizeToken } from '../editorial/detect';
import { activeSemanticCues } from '../editorial/semantic-word-edits';
import { styleAt } from '../editorial/ranges';
import type { StyleDNA } from '../core/style';
import { outputDuration, outputToSource } from '../engine/timeline';
import { drawCaption } from './captions';
import { drawEmoji, emojiPose } from './emoji';
import { maskPath } from './mask';
import type { Ctx2D } from './ctx';
import { clamp01, progress } from './easing';
import type { Rect } from './layout';
import { easeInOutQuint, easeOutExpo, springIn, wiggle } from './motion';
import { alphaOf, composition, makeFrame, withAlpha, type Frame } from './kit';
import { drawOverlay, drawProgress } from './scenes';
import { drawHandle, drawLetterbox, drawScanlines, drawTag, drawTicker, drawTint, drawVignette, tickerText } from './decor';
import { framingFor, placeSource, type Focus } from './framing';

export function activeAt<T extends { start: number; end: number }>(items: T[], t: number): T[] {
  return items.filter((i) => t >= i.start && t < i.end);
}

/** Câmera virtual sobre o vídeo de fundo em `t`: escala total e deslocamento (tremor). */
export interface Camera {
  zoom: number;
  dx: number;
  dy: number;
}

/** Início (tempo de saída) do trecho mantido que contém `t`, e quanto dele já passou. */
export function segmentClock(plan: EditPlan, t: number): { start: number; elapsed: number; len: number } {
  let acc = 0;
  for (const s of plan.segments) {
    const len = s.srcEnd - s.srcStart;
    if (t < acc + len || s === plan.segments[plan.segments.length - 1]) return { start: acc, elapsed: Math.max(0, t - acc), len };
    acc += len;
  }
  return { start: 0, elapsed: Math.max(0, t), len: 0 };
}

/** Ken Burns só em trechos longos (a imagem parada é o que cansa), depois do primeiro segundo e pouco. */
export const KB_MIN_SEGMENT = 3;
export const KB_DELAY = 1.2;

/**
 * "Ken Burns": aproximação lenta e contínua nos trechos mantidos longos (≥ 3 s), começando depois de
 * 1,2 s sem corte (a imagem não fica parada), reiniciando em cada corte. Desligada sem zoom no estilo ("sem zoom"/"sem efeitos") e nos trechos
 * pedidos "sem animação aqui". Velocidade e teto crescem com o zoom e a intensidade do estilo.
 */
export function kenBurns(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): number {
  const amount = S.zoomScale - 1;
  if (amount <= 0.001 || S.motion.intensity <= 0.02) return 1;
  for (const r of plan.ranges) if (r.quiet && t >= r.out.start && t < r.out.end) return 1;
  const clock = segmentClock(plan, t);
  if (clock.len < KB_MIN_SEGMENT || clock.elapsed <= KB_DELAY) return 1;
  const elapsed = clock.elapsed - KB_DELAY;
  const k = 0.35 + 0.65 * S.motion.intensity;
  const rate = amount * 0.11 * k; // por segundo
  const cap = amount * 0.55 * k;
  // começa suave (sem tranco logo depois do corte) e cresce em linha reta até o teto
  const ramp = Math.min(elapsed, 0.6);
  const lin = elapsed <= 0.6 ? (ramp * ramp) / 1.2 : elapsed - 0.3;
  return 1 + Math.min(cap, rate * lin);
}

/** Escala do vídeo de fundo em `t`: zoom de ênfase + "soco" de zoom logo depois de um corte + Ken Burns. */
export function cameraAt(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): Camera {
  let z = kenBurns(plan, t, S);
  let dx = 0;
  let dy = 0;
  for (const s of activeAt(plan.scenes, t)) {
    if (s.kind === 'emphasis-zoom') {
      const len = s.end - s.start;
      const outDur = Math.min(0.35, len * 0.3);
      const leave = easeInOutQuint(progress(t, s.end - outDur, outDur));
      let k: number;
      if (S.motion.ease === 'snappy') {
        // soco: chega no zoom em ~0,15 s com mola e assenta
        k = springIn(progress(t, s.start, Math.min(0.45, len * 0.4)), { freq: 1.5, zeta: 0.5 });
        // tremor curto no impacto, só em estilos bem intensos
        const d = 1 - progress(t, s.start, 0.32);
        if (S.motion.intensity >= 0.6 && d > 0) {
          const amp = 9 * (Math.min(plan.output.width, plan.output.height) / 1080) * S.motion.intensity * d * d;
          dx = wiggle(t - s.start, 13, 1) * amp;
          dy = wiggle(t - s.start, 11, 2) * amp * 0.7;
        }
      } else {
        const inDur = Math.min(S.motion.inSec * 1.6, len * 0.45);
        k = easeOutExpo(progress(t, s.start, inDur));
      }
      z *= 1 + (s.scale - 1) * k * (1 - leave);
    }
    if (s.kind === 'cut-transition' && t >= s.at && (S.transition === 'zoom' || S.transition === 'flash')) {
      const amount = S.transition === 'zoom' ? 0.07 : 0.09;
      z *= 1 + amount * (1 - easeOutExpo(progress(t, s.at, Math.max(0.12, (s.end - s.at) * 1.6))));
    }
  }
  return { zoom: z, dx, dy };
}

/** Só a escala da câmera (compatível com a v0.6). */
export function sourceZoom(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): number {
  return cameraAt(plan, t, S).zoom;
}

/** Opacidade do flash (branco) ou do mergulho (preto) da transição de corte em `t`. */
export function transitionVeil(plan: EditPlan, t: number, S: StyleDNA = styleAt(plan, t)): { color: string; alpha: number } | null {
  const kind = S.transition;
  if (kind !== 'flash' && kind !== 'dip') return null;
  let alpha = 0;
  for (const s of activeAt(plan.scenes, t)) {
    if (s.kind !== 'cut-transition') continue;
    const before = Math.max(0.01, s.at - s.start);
    const after = Math.max(0.01, s.end - s.at);
    const d = t < s.at ? 1 - (s.at - t) / before : 1 - (t - s.at) / after;
    alpha = Math.max(alpha, (kind === 'flash' ? 0.85 : 0.75) * Math.pow(clamp01(d), kind === 'flash' ? 2 : 1));
  }
  return alpha > 0 ? { color: kind === 'flash' ? '#FFFFFF' : '#000000', alpha } : null;
}

const CENTRAL: ReadonlySet<SceneInstance['kind']> = new Set(['kinetic-title', 'big-number', 'list', 'quote', 'end-cta']);

/** A frase do título é (quase) a mesma da legenda: mostrar as duas seria repetir. */
export function sameWords(a: string, b: string): boolean {
  const wa = a.split(/\s+/).map(normalizeToken).filter(Boolean);
  const wb = new Set(b.split(/\s+/).map(normalizeToken).filter(Boolean));
  if (wa.length === 0 || wb.size === 0) return false;
  const common = wa.filter((w) => wb.has(w)).length;
  return common / Math.min(wa.length, wb.size) >= 0.6;
}

/**
 * Quadro de um clipe no tamanho de origem (v0.14), com o que o enquadramento precisa: proporção real,
 * de qual clipe ele é (enquadramento próprio), o foco do rosto naquele instante e uma cópia minúscula
 * para o fundo desfocado do modo "ajustar". Quem decodifica (player/exportação) monta isto; o desenho é puro.
 */
export interface SourceFrame {
  kind: 'clip';
  image: CanvasImageSource;
  width: number;
  height: number;
  clipId: string;
  focus: Focus | null;
  /** cópia bem pequena do mesmo quadro: esticada, vira o fundo desfocado */
  backdrop: CanvasImageSource | null;
}

export function isSourceFrame(x: unknown): x is SourceFrame {
  return !!x && typeof x === 'object' && (x as { kind?: unknown }).kind === 'clip';
}

/** Desenha o vídeo de fundo: legado (já no tamanho da saída) ou clipe com enquadramento. */
function drawSource(ctx: Ctx2D, plan: EditPlan, source: CanvasImageSource | SourceFrame, w: number, h: number, style: StyleDNA): void {
  if (!isSourceFrame(source)) {
    // sem clipe (galeria/testes): usa a moldura manual antiga se existir
    // se houver enquadramento de clipe único, ele já está em plan.framing; mas sem SourceFrame tratamos como legado
    // tenta usar edits.video se existir, senão desenha direto
    const manual = (plan as any).edits?.video as ManualFraming | undefined;
    if (manual) {
      drawVideo(ctx, source, w, h, manual);
      return;
    }
    ctx.drawImage(source, 0, 0, w, h);
    return;
  }
  const framing = framingFor(plan, source.clipId);
  const p = placeSource(source.width, source.height, w, h, framing, source.focus);
  if (p.needsBackdrop) {
    if (framing.fill === 'blur' && source.backdrop) {
      // fundo: o mesmo quadro esticado (cobrindo a tela) a partir de uma cópia minúscula = desfoque barato
      const cover = placeSource(source.width, source.height, w, h, { mode: 'fill', fill: 'blur', zoom: 1.08, x: 0, y: 0 }, null);
      const k = 1 / source.width;
      const bw = (source.backdrop as { width?: number }).width ?? 1;
      const bh = (source.backdrop as { height?: number }).height ?? 1;
      ctx.drawImage(source.backdrop, cover.src.x * k * bw, (cover.src.y / source.height) * bh, cover.src.w * k * bw, (cover.src.h / source.height) * bh, 0, 0, w, h);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.fillStyle = style.palette.panel.slice(0, 7);
      ctx.fillRect(0, 0, w, h);
    }
  }
  ctx.drawImage(source.image, p.src.x, p.src.y, p.src.w, p.src.h, p.dst.x, p.dst.y, p.dst.w, p.dst.h);
}

const OVERLAY_ORDER: SceneInstance['kind'][] = ['lower-third', 'kinetic-title', 'big-number', 'list', 'quote', 'end-cta'];

/**
 * Desenha um quadro do vídeo final no instante `t` (tempo de saída).
 * `source` é o quadro do vídeo original (qualquer tamanho; enquadrado aqui conforme as edições).
 * `source` pode ser um SourceFrame (v0.14) para múltiplos clipes com enquadramento.
 * A mesma função serve para a prévia e para a exportação: é isso que garante prévia = MP4.
 * Depende só de (plano, t, quadro de origem): desenhar em qualquer ordem dá o mesmo resultado.
 * `marks` (opcional) recebe o começo e o fim de cada elemento selecionável (caixas da edição manual).
 */
export function drawFrame(ctx: Ctx2D, plan: EditPlan, t: number, source: CanvasImageSource | SourceFrame | null, marks?: ElementMarks): void {
  const { width: w, height: h } = plan.output;
  const R = resolvePlan(plan);
  const rp = drawnPlan(plan, R);
  // trecho com estilo próprio (pedido do trecho ou trava) desenha com o estilo dele
  const style = styleAt(plan, t);
  const f = makeFrame(w, h, style);
  const activeR = R.scenes.filter((s) => t >= s.scene.start && t < s.scene.end);
  const active = activeR.map((s) => s.scene);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  // máscara (v0.26): fora da forma fica a cor escolhida; o vídeo só aparece dentro
  const mask = plan.edits?.mask ?? null;
  if (source && mask) {
    ctx.fillStyle = mask.fill;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    maskPath(ctx, mask, w, h);
    ctx.clip();
  }
  if (source) {
    const cam = cameraAt(rp, t, style);
    const z = cam.zoom * zoomAt(plan, t);
    ctx.save();
    if (z !== 1 || cam.dx !== 0 || cam.dy !== 0) {
      // centro do zoom um pouco acima do meio, onde costuma estar o rosto; o tremor nunca mostra borda
      const ox = w / 2;
      const oy = h * 0.42;
      const zz = cam.dx !== 0 || cam.dy !== 0 ? Math.max(z, 1 + (2 * Math.max(Math.abs(cam.dx) / w, Math.abs(cam.dy) / h))) : z;
      ctx.translate(ox + cam.dx, oy + cam.dy);
      ctx.scale(zz, zz);
      ctx.translate(-ox, -oy);
    }
    // multi-clipe: SourceFrame com enquadramento; legado: CanvasImageSource com moldura manual
    if (isSourceFrame(source)) drawSource(ctx, plan, source, w, h, style);
    else drawVideo(ctx, source, w, h, (plan as any).edits?.video ?? { fit: 'fill', scale: 1, x: 0, y: 0 });
    ctx.restore();
  }
  if (source && mask) {
    ctx.restore();
    if (mask.border > 0) {
      maskPath(ctx, mask, w, h);
      ctx.lineWidth = mask.border * (w / 1080);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = mask.borderColor;
      ctx.stroke();
    }
  }
  // acabamento do modelo (v0.9): véu de cor e vinheta sobre o vídeo, antes de qualquer texto
  drawTint(ctx, f);
  drawVignette(ctx, f);
  drawScrim(ctx, f);
  const veil = transitionVeil(rp, t, style);
  if (veil) {
    ctx.fillStyle = withAlpha(veil.color, veil.alpha);
    ctx.fillRect(0, 0, w, h);
  }
  drawLetterbox(ctx, f);
  const bar = activeR.find((s) => s.scene.kind === 'progress-bar');
  if (bar) {
    const total = outputDuration(plan.segments);
    withScene(ctx, f, bar, t, marks, null, (ff) => drawProgress(ctx, ff, t, total));
  } else drawProgress(ctx, f, t, 0);
  // só tipografia (sem caixa): uma faixa escura suave atrás da cena central, para ler sobre qualquer fundo
  if (composition(style) === 'type') for (const s of active) if (CENTRAL.has(s.kind)) drawBand(ctx, f, s.start, s.end, t);

  for (const kind of OVERLAY_ORDER) for (const s of activeR) if (s.scene.kind === kind) withScene(ctx, f, s, t, marks, null, (ff) => drawOverlay(ctx, ff, s.scene, t));
  if (style.decor.ticker) drawTicker(ctx, f, t, tickerText(plan));
  drawTag(ctx, f, t);
  drawHandle(ctx, f);

  // a citação já mostra a frase falada, e o título com a mesma frase também: a legenda some
  const ci = R.captions.findIndex((c) => t >= c.caption.start && t < c.caption.end);
  const rc = ci >= 0 ? R.captions[ci]! : null;
  let capRect: Rect | null = null;
  if (rc && !active.some((s) => s.kind === 'quote' || (s.kind === 'kinetic-title' && sameWords(s.text, rc.caption.text)))) {
    const caption = rc.caption;
    const keywords = new Set(active.filter((s) => s.kind === 'highlight-word').map((s) => normalizeToken((s as { text: string }).text)));
    // Identity-sensitive word emphasis: never highlight another occurrence of the
    // same text or a rewritten caption with mismatched word alignment.
    const fps = plan.output.fps;
    const currentFrame = Math.floor(t * fps + 1e-7);
    const semanticEffects = new Map(activeSemanticCues(plan, t).map(cue => [cue.wordId, {
      effect: cue.effect,
      sourceText: cue.text,
      phase: (currentFrame - cue.startFrame) / Math.max(1, cue.endFrameExclusive - cue.startFrame - 1),
    }] as const));
    const next = R.captions.slice(ci + 1).find((c) => c.caption.start >= caption.end - 1e-6);
    const L = rc.look;
    const cs = captionStyle(style, L);
    const ff = cs === style ? f : makeFrame(w, h, cs);
    const exit = L.exit === 'none' ? false : L.exit === 'fade' || L.exit === 'shrink' ? true : !next || next.caption.start - caption.end >= 0.2;
    let begun = false;
    capRect = drawCaption(ctx, ff, caption, t, keywords, {
      semanticEffects,
      exit,
      place: rc.placement,
      align: L.align,
      maxW: L.maxWidth !== undefined ? L.maxWidth * w : undefined,
      shadow: L.shadow,
      onBegin: marks
        ? () => {
            begun = true;
            marks.begin({ type: 'caption', key: rc.key });
          }
        : undefined,
    });
    if (begun) marks!.end();
  }
  // emojis por cima de tudo, perto da legenda sem cobrir nem ela nem as cenas
  const busy = active.some((s) => CENTRAL.has(s.kind));
  for (const s of activeR) if (s.scene.kind === 'emoji') withScene(ctx, f, s, t, marks, capRect, (ff) => drawEmoji(ctx, ff, s.scene as Extract<SceneInstance, { kind: 'emoji' }>, t, { caption: capRect, busy }));
  // elementos adicionados à mão (v0.13), na ordem das camadas
  for (const a of R.added) {
    if (t < a.start || t >= a.end) continue;
    const ref = { type: 'added' as const, id: a.el.id };
    drawAdded(ctx, f, a.el, a.start, a.end, t, marks ? { begin: () => marks.begin(ref), end: () => marks.end() } : undefined);
  }
  // linhas de TV por cima de tudo (fita antiga)
  drawScanlines(ctx, f, t);
  ctx.restore();
}

/** Plano com as cenas como são desenhadas (escondidas fora, texto e tempo editados), para câmera e transições. */
const drawn = new WeakMap<EditPlan, EditPlan>();
function drawnPlan(plan: EditPlan, R: Resolved): EditPlan {
  if (R.hiddenKeys.size === 0 && R.scenes.every((s, i) => s.scene === plan.scenes[i])) return plan;
  let p = drawn.get(plan);
  if (!p) drawn.set(plan, (p = { ...plan, scenes: R.scenes.map((s) => s.scene) }));
  return p;
}

/** Aproximação (zoom) pedida no pedaço que contém `t` (v0.13). */
export function zoomAt(plan: EditPlan, t: number): number {
  if (plan.edits.zooms.length === 0) return 1;
  const src = outputToSource(plan.segments, t);
  if (src === null) return 1;
  for (const z of plan.edits.zooms) if (src >= z.srcStart && src < z.srcEnd) return z.scale;
  return 1;
}

/** Retângulo onde o quadro do vídeo original é desenhado no 9:16 (preencher, caber, tamanho e posição). */
export function videoRect(srcW: number, srcH: number, w: number, h: number, v: ManualFraming): Rect {
  const base = v.fit === 'fill' ? Math.max(w / srcW, h / srcH) : Math.min(w / srcW, h / srcH);
  const k = base * v.scale;
  const dw = srcW * k;
  const dh = srcH * k;
  return { x: (w - dw) / 2 + v.x * w, y: (h - dh) / 2 + v.y * h, w: dw, h: dh };
}

function drawVideo(ctx: Ctx2D, source: CanvasImageSource, w: number, h: number, v: ManualFraming): void {
  const sw = Number((source as { width?: number }).width);
  const sh = Number((source as { height?: number }).height);
  const plain = v.fit === 'fill' && v.scale === 1 && v.x === 0 && v.y === 0;
  if (!(sw > 0 && sh > 0) || (plain && Math.abs(sw / sh - w / h) < 0.01)) {
    ctx.drawImage(source, 0, 0, w, h);
    return;
  }
  if (v.fit === 'fit') {
    // atrás do vídeo inteiro, o próprio vídeo ampliado e escurecido (em vez de faixas pretas)
    const back = videoRect(sw, sh, w, h, { fit: 'fill', scale: 1.08, x: 0, y: 0 });
    ctx.save();
    ctx.globalAlpha *= 0.4;
    ctx.drawImage(source, back.x, back.y, back.w, back.h);
    ctx.restore();
  }
  const r = videoRect(sw, sh, w, h, v);
  ctx.drawImage(source, r.x, r.y, r.w, r.h);
}

/** Ponto de giro/escala de uma cena (perto do centro do que o modelo desenha). */
export function scenePivot(f: Frame, s: SceneInstance, t: number, cap: Rect | null): { x: number; y: number } {
  switch (s.kind) {
    case 'progress-bar':
      return { x: f.w / 2, y: f.h * 0.07 };
    case 'lower-third':
      return { x: f.safe.x + f.safe.w * 0.35, y: f.safe.y + f.safe.h * (f.style.captions.position === 'bottom' ? 0.64 : 0.9) };
    case 'emoji': {
      const p = emojiPose(f, s, Math.min(s.end - 0.01, Math.max(t, s.start + 0.6)), { caption: cap });
      return { x: p.x, y: p.y };
    }
    default:
      return { x: f.style.layout.align === 'left' ? f.safe.x + f.safe.w * 0.45 : f.w / 2, y: f.safe.y + f.safe.h * f.overlayY };
  }
}

const easeInQuint = (x: number) => x * x * x * x * x;

/** Desenha uma cena com a edição dela (aparência, deslocamento, tamanho, giro, saída) e marca a caixa. */
function withScene(ctx: Ctx2D, f: Frame, rs: ResolvedScene, t: number, marks: ElementMarks | undefined, cap: Rect | null, draw: (f: Frame) => void): void {
  const e = rs.edit;
  const look = e?.look;
  const style = look ? sceneStyle(f.style, look) : f.style;
  const ff = style === f.style ? f : makeFrame(f.w, f.h, style);
  const off = e?.offset ?? null;
  const exit = look?.exit === 'fade' || look?.exit === 'shrink' ? look.exit : null;
  if (!off && !exit && !marks) return draw(ff);
  ctx.save();
  if (off) ctx.translate(off.dx * f.w, off.dy * f.h);
  if ((off && (off.scale !== 1 || off.rotate !== 0)) || exit === 'shrink') {
    const p = scenePivot(ff, rs.scene, t, cap);
    const k = exit === 'shrink' ? 1 - 0.5 * easeInQuint(progress(t, rs.scene.end - 0.3, 0.3)) : 1;
    ctx.translate(p.x, p.y);
    if (off?.rotate) ctx.rotate((off.rotate * Math.PI) / 180);
    const sc = (off?.scale ?? 1) * k;
    if (sc !== 1) ctx.scale(sc, sc);
    ctx.translate(-p.x, -p.y);
  }
  if (exit) ctx.globalAlpha *= 1 - easeInQuint(progress(t, rs.scene.end - 0.3, 0.3));
  marks?.begin({ type: 'scene', key: rs.key });
  draw(ff);
  marks?.end();
  ctx.restore();
}

/** Faixa escura que aparece e some com a cena central (legibilidade do texto sem caixa). */
export function bandAlpha(start: number, end: number, t: number): number {
  return easeOutExpo(progress(t, start, 0.35)) * (1 - easeInOutQuint(progress(t, end - 0.35, 0.35)));
}
function drawBand(ctx: Ctx2D, f: Frame, start: number, end: number, t: number): void {
  const k = bandAlpha(start, end, t);
  const color = f.style.palette.scrim;
  if (k <= 0 || alphaOf(color) === 0) return;
  const cy = f.safe.y + f.safe.h * f.overlayY;
  const half = f.h * 0.26;
  const g = ctx.createLinearGradient(0, cy - half, 0, cy + half);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.5, withAlpha(color, 0.55 * k));
  g.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, cy - half, f.w, 2 * half);
}

/** Gradiente escuro fixo na parte de baixo (legibilidade das legendas), se o estilo pedir. */
function drawScrim(ctx: Ctx2D, f: Frame): void {
  const color = f.style.palette.scrim;
  if (alphaOf(color) === 0) return;
  const top = f.h * 0.5;
  const g = ctx.createLinearGradient(0, top, 0, f.h);
  g.addColorStop(0, withAlpha(color, 0));
  g.addColorStop(0.55, withAlpha(color, 0.6));
  g.addColorStop(1, withAlpha(color, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, top, f.w, f.h - top);
}
