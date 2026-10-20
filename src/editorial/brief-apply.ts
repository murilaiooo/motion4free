import type { CreativeBrief, Prohibition } from '../core/brief';
import type { StyleDNA } from '../core/style';
import type { SceneKind } from '../core/types';
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
  emojis: [],
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

export function forbiddenKinds(brief: CreativeBrief): Set<SceneKind> {
  return new Set(brief.forbid.flatMap((p) => FORBIDDEN_KINDS[p]));
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
  const forbid = new Set(brief.forbid);
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
  };
}
