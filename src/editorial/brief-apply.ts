import type { CreativeBrief, Prohibition } from '../core/brief';
import { EMOJI_OFF, nearestWeight, type StyleDNA } from '../core/style';
import type { Look } from '../core/look';
import type { SceneKind } from '../core/types';
import { onBox } from '../core/color';
import type { SceneOptions } from './selector';

/**
 * Como o brief vira parâmetros: ajustes numéricos no StyleDNA do preset (sempre dentro dos limites
 * do esquema) e opções do seletor de cenas (tipos proibidos, destaques, título do gancho).
 * Nada aqui cria cena nova nem texto: só liga, desliga e dosa o que o seletor já faz.
 */

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Tipos de cena que cada proibição remove. */
export const FORBIDDEN_KINDS: Record<Prohibition, SceneKind[]> = {
  efeitos: ['emphasis-zoom', 'cut-transition'],
  emojis: ['emoji'],
  numeros: ['big-number'],
  zoom: ['emphasis-zoom'],
  transicoes: ['cut-transition'],
  titulo: ['kinetic-title'],
  listas: ['list'],
  perguntas: ['quote'],
  nome: ['lower-third'],
  destaques: ['highlight-word'],
  barra: ['progress-bar'],
  chamada: ['end-cta'],
  textos: ['kinetic-title', 'big-number', 'list', 'quote', 'lower-third', 'highlight-word', 'end-cta'],
};

/** Proibições do pedido + cenas desligadas pelo look ("sem barra" = proibição de barra). */
export function effectiveForbid(brief: Pick<CreativeBrief, 'forbid' | 'look'>): Prohibition[] {
  const off = Object.entries(brief.look.scenes ?? {})
    .filter(([, on]) => on === false)
    .map(([k]) => k as Prohibition);
  return [...new Set([...brief.forbid, ...off])];
}

export function forbiddenKinds(brief: Pick<CreativeBrief, 'forbid' | 'look'>): Set<SceneKind> {
  return new Set(effectiveForbid(brief).flatMap((p) => FORBIDDEN_KINDS[p]));
}

/** Texto da chamada final por objetivo (frases fixas do app, não da IA). */
const CTA_BY_GOAL: Partial<Record<NonNullable<CreativeBrief['goal']>, string>> = {
  vender: 'Saiba mais no link',
  ensinar: 'Salve para não esquecer',
  inspirar: 'Compartilhe com alguém',
};

/** StyleDNA do preset ajustado pelo pedido. Mantém id e nome do preset (o seletor de estilo continua marcado). */
export function styleForBrief(preset: StyleDNA, brief: CreativeBrief): StyleDNA {
  const s: StyleDNA = structuredClone(preset);
  const M = s.motion;
  const R = s.rhythm;

  if (brief.intensity === 'baixa') {
    M.intensity = r3(M.intensity * 0.4);
    M.inSec = r3(clamp(M.inSec * 1.3, 0.05, 1.2));
    M.outSec = r3(clamp(M.outSec * 1.2, 0.05, 1));
    M.staggerSec = r3(clamp(M.staggerSec * 1.3, 0, 0.3));
    s.zoomScale = r3(1 + (s.zoomScale - 1) * 0.5);
    s.captions.activeScale = r3(1 + (s.captions.activeScale - 1) * 0.5);
    if (s.transition === 'flash') s.transition = 'dip';
  } else if (brief.intensity === 'alta') {
    M.intensity = r3(clamp(M.intensity * 1.5 + 0.2, 0, 1));
    M.inSec = r3(clamp(M.inSec * 0.8, 0.05, 1.2));
    M.outSec = r3(clamp(M.outSec * 0.8, 0.05, 1));
    s.zoomScale = r3(clamp(1 + (s.zoomScale - 1) * 1.5, 1, 1.3));
  }

  if (brief.pace === 'lento') {
    R.overlaysPer10s = r3(clamp(R.overlaysPer10s * 0.6, 0, 4));
    R.minGapSec = r3(clamp(R.minGapSec * 1.5, 0, 10));
    R.keywordEverySec = r3(clamp(R.keywordEverySec * 1.6, 0.5, 60));
    R.zoomEverySec = r3(clamp(R.zoomEverySec * 1.6, 1, 120));
    R.sceneSec = r3(clamp(R.sceneSec * 1.15, 0.8, 5));
    R.titleSec = r3(clamp(R.titleSec * 1.15, 0.8, 5));
  } else if (brief.pace === 'rapido') {
    R.overlaysPer10s = r3(clamp(R.overlaysPer10s * 1.5, 0, 4));
    R.minGapSec = r3(clamp(R.minGapSec * 0.6, 0, 10));
    R.keywordEverySec = r3(clamp(R.keywordEverySec * 0.65, 0.5, 60));
    R.zoomEverySec = r3(clamp(R.zoomEverySec * 0.7, 1, 120));
    R.sceneSec = r3(clamp(R.sceneSec * 0.85, 0.8, 5));
  }

  if (brief.emphasize.includes('palavras')) R.keywordEverySec = r3(clamp(R.keywordEverySec * 0.5, 0.5, 60));

  // proibições por último: sempre vencem os ajustes acima
  const forbid = new Set(effectiveForbid(brief));
  if (forbid.has('efeitos')) {
    M.intensity = r3(Math.min(M.intensity, 0.15));
    if (M.enter === 'pop') M.enter = 'rise';
    s.captions.activeScale = 1;
  }
  if (forbid.has('efeitos') || forbid.has('zoom')) {
    s.zoomScale = 1;
    if (s.transition === 'zoom') s.transition = forbid.has('efeitos') || forbid.has('transicoes') ? 'none' : 'dip';
  }
  if (forbid.has('efeitos') || forbid.has('transicoes')) s.transition = 'none';
  if (forbid.has('barra') || forbid.has('textos')) s.progress = 'none';

  if (brief.goal && CTA_BY_GOAL[brief.goal]) s.cta = CTA_BY_GOAL[brief.goal]!;
  return s;
}

/** Opções do seletor de cenas vindas do pedido. */
export function sceneOptionsFor(brief: CreativeBrief): SceneOptions {
  const forbid = forbiddenKinds(brief);
  return {
    forbid,
    emphasize: new Set(brief.emphasize),
    title: brief.hook && !forbid.has('kinetic-title') ? brief.hook.text : null,
    emojiPrefer: brief.look.emoji?.prefer ?? [],
  };
}

/**
 * Aplica o look (cores, legenda, emojis, transição, intensidade, cenas ligadas) por cima do estilo já
 * ajustado pelo pedido e pelas cores da imagem. Proibições continuam vencendo: "sem emojis" desliga os
 * emojis mesmo que o look peça, "sem efeitos" segura a intensidade e tira a transição.
 * Cada valor fica dentro dos limites do esquema do StyleDNA.
 */
export function applyLook(base: StyleDNA, look: Look, forbidList: readonly Prohibition[]): StyleDNA {
  const s: StyleDNA = structuredClone(base);
  const forbid = new Set(forbidList);
  const C = s.captions;
  const c = look.captions ?? {};
  if (c.text) C.colors.text = c.text;
  if (c.highlight) C.colors.highlight = c.highlight;
  if (c.stroke) {
    C.colors.stroke = c.stroke;
    if (C.stroke === 0) C.stroke = 8;
  }
  if (c.strokeWidth !== undefined) C.stroke = clamp(c.strokeWidth, 0, 24);
  if (c.box === 'none') C.box = 'none';
  else if (c.box) {
    C.box = 'line';
    C.colors.box = c.box;
  }
  if (c.scale !== undefined) C.size = r3(clamp(C.size * c.scale, 0.03, 0.16));
  if (c.position) C.position = c.position;
  if (c.y !== undefined) {
    C.position = 'custom';
    C.y = r3(clamp(c.y, 0, 1));
  }
  if (c.case) {
    s.type.text.case = c.case;
    s.type.emphasis.case = c.case;
  }
  if (c.font) {
    const old = s.type.text.family;
    s.type.text = { ...s.type.text, family: c.font, ...nearestWeight(c.font, s.type.text.weight, 'normal') };
    // palavra-chave na mesma família da legenda acompanha a troca
    if (s.type.emphasis.family === old) s.type.emphasis = { ...s.type.emphasis, family: c.font, ...nearestWeight(c.font, s.type.emphasis.weight, s.type.emphasis.style) };
  }
  if (c.animation) C.enter = c.animation;
  if (c.wordsPerLine !== undefined) C.wordsPerLine = c.wordsPerLine;
  if (c.wordsAtOnce !== undefined) {
    C.maxWords = c.wordsAtOnce;
    C.maxChars = Math.round(clamp(Math.max(C.maxChars, c.wordsAtOnce * 8), 8, 60));
  }
  if (c.highlightMode) C.highlight = c.highlightMode;
  if (C.highlight === 'box' && C.colors.highlight) {
    // texto sobre a caixa da palavra falada continua legível com a cor pedida
    s.palette.onPanel = onBox(C.colors.highlight, s.palette.onPanel);
  }

  const e = look.emoji ?? {};
  const E = s.emoji;
  if (e.mode) E.mode = e.mode;
  else if (E.mode === 'off' && (e.everySec !== undefined || e.position || e.scale !== undefined || e.animation || e.prefer?.length)) E.mode = e.everySec !== undefined ? 'interval' : 'keywords';
  if (e.everySec !== undefined) E.everySec = r3(clamp(e.everySec, 1, 30));
  if (e.position) E.position = e.position;
  if (e.scale !== undefined) E.size = r3(clamp(EMOJI_OFF.size * e.scale, 0.06, 0.3));
  if (e.animation) E.animation = e.animation;
  if (forbid.has('emojis')) E.mode = 'off';

  if (look.accent) {
    s.palette.accent = look.accent;
    s.palette.accent2 = look.accent;
    const solid = s.palette.panel.length === 7 || s.palette.panel.toUpperCase().endsWith('FF');
    if (solid) {
      s.palette.panel = look.accent;
      s.palette.onPanel = onBox(look.accent, s.palette.onPanel);
    }
  }

  const noEffects = forbid.has('efeitos');
  if (look.transition && !noEffects && !forbid.has('transicoes')) s.transition = look.transition === 'zoom' && forbid.has('zoom') ? 'dip' : look.transition;
  if (look.motion !== undefined) s.motion.intensity = r3(noEffects ? Math.min(look.motion, 0.15) : clamp(look.motion, 0, 1));

  const on = look.scenes ?? {};
  if (on.barra && !forbid.has('barra') && !forbid.has('textos') && s.progress === 'none') s.progress = 'bar';
  if (on.transicoes && !noEffects && !forbid.has('transicoes') && s.transition === 'none') s.transition = forbid.has('zoom') ? 'dip' : 'zoom';
  if (on.zoom && !noEffects && !forbid.has('zoom')) s.zoomScale = r3(Math.max(s.zoomScale, 1.08));
  if (on.destaques && !forbid.has('destaques') && !forbid.has('textos')) s.rhythm.keywordEverySec = r3(Math.min(s.rhythm.keywordEverySec, 4));
  return s;
}
