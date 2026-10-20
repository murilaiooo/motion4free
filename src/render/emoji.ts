import { EMOJI_FONT_FAMILY } from '../core/emoji';
import type { SceneInstance } from '../core/types';
import { captionCenterFrac } from './captions';
import type { Ctx2D } from './ctx';
import { clamp01, easeInCubic, easeOutBack, easeOutBounce, easeOutCubic, progress } from './easing';
import { clearShadow, setShadow, type Frame } from './kit';

/**
 * Emoji perto da fala (v0.6). Desenhado com a fonte de emojis que acompanha o app (subconjunto da
 * Noto Color Emoji, OFL), carregada antes do primeiro quadro na prévia e na exportação: mesmo arquivo,
 * mesmo desenho. Função pura de (cena, t, estilo).
 */

type EmojiScene = Extract<SceneInstance, { kind: 'emoji' }>;

export interface EmojiPose {
  x: number;
  y: number;
  size: number;
  scale: number;
  rotate: number;
  alpha: number;
}

/** Onde e como o emoji está no instante `t`. */
export function emojiPose(f: Frame, s: EmojiScene, t: number): EmojiPose {
  const E = f.style.emoji;
  const { safe, u } = f;
  const size = E.size * f.w;
  const k = 0.4 + 0.6 * f.style.motion.intensity;
  // posição: longe da legenda, variando entre centro, esquerda e direita (pelo instante, sempre igual)
  const lane = Math.round(s.start * 7) % 3;
  const dx = [0, -0.2, 0.2][lane]! * safe.w;
  const cap = captionCenterFrac(f.style);
  let x = f.w / 2 + dx;
  let yFrac: number;
  switch (E.position) {
    case 'top':
      yFrac = 0.1;
      break;
    case 'middle':
      yFrac = 0.45;
      break;
    case 'bottom':
      yFrac = 0.9;
      break;
    case 'left':
    case 'right':
      yFrac = cap >= 0.55 ? 0.45 : 0.6;
      x = E.position === 'left' ? safe.x + size * 0.6 : safe.x + safe.w - size * 0.6;
      break;
    default:
      yFrac = cap >= 0.55 ? Math.max(0.12, cap - 0.3) : Math.min(0.88, cap + 0.3);
  }
  let y = safe.y + safe.h * yFrac;
  const p = progress(t, s.start, 0.35);
  const out = easeInCubic(progress(t, s.end - 0.2, 0.2));
  let scale = 1;
  let rotate = 0;
  let alpha = 1 - out;
  switch (E.animation) {
    case 'pop':
      scale = Math.max(0, easeOutBack(p)) * (1 - 0.3 * out);
      alpha *= clamp01(p * 3);
      break;
    case 'bounce':
      y -= (1 - easeOutBounce(progress(t, s.start, 0.6))) * 160 * u * k;
      alpha *= clamp01(p * 4);
      break;
    case 'float':
      y += Math.sin((t - s.start) * Math.PI * 1.6) * 14 * u * k - (1 - easeOutCubic(p)) * 30 * u;
      alpha *= p;
      break;
    case 'spin':
      rotate = -(1 - easeOutCubic(p)) * Math.PI * k;
      scale = 0.6 + 0.4 * easeOutCubic(p);
      alpha *= clamp01(p * 2);
      break;
    case 'fade':
      alpha *= p;
      break;
    case 'none':
      break;
  }
  return { x, y, size, scale, rotate, alpha: clamp01(alpha) };
}

export function drawEmoji(ctx: Ctx2D, f: Frame, s: EmojiScene, t: number): void {
  const pose = emojiPose(f, s, t);
  if (pose.alpha <= 0.001 || pose.scale <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= pose.alpha;
  ctx.translate(pose.x, pose.y);
  if (pose.rotate) ctx.rotate(pose.rotate);
  if (pose.scale !== 1) ctx.scale(pose.scale, pose.scale);
  ctx.font = `${Math.round(pose.size * 100) / 100}px "${EMOJI_FONT_FAMILY}"`;
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000000';
  setShadow(ctx, f, 'soft', 0.5);
  ctx.fillText(s.emoji, 0, 0);
  clearShadow(ctx);
  ctx.restore();
}
