import { CAPTION_COLORS_DEFAULT, EMOJI_OFF, type StyleDNA } from './style';

/**
 * Estilos iniciais com personalidades opostas. Diferem em tipografia, movimento,
 * ritmo e layout, não só em cor:
 * - Editorial: revista. Serifa elegante, legenda limpa que "acende" palavra a palavra, movimento lento, poucas cenas.
 * - Pop: energia de Reels. Letra condensada gigante, legenda em maiúsculas no meio da tela com a palavra falada em caixa amarela, cortes com flash, muitas cenas.
 * - Documental: sóbrio. Sans técnica, painéis escuros alinhados à esquerda, revelação em cortina, quase nenhum movimento.
 */
export const EDITORIAL: StyleDNA = {
  version: 2,
  id: 'editorial',
  name: 'Editorial',
  palette: {
    text: '#FAF7F0',
    muted: '#FAF7F08C',
    accent: '#F5C451',
    accent2: '#F5C451',
    panel: '#0E0E0EE0',
    onPanel: '#FAF7F0',
    scrim: '#000000A6',
    shadow: '#000000BF',
  },
  type: {
    display: { family: 'Instrument Serif', weight: 400, style: 'normal', case: 'none', tracking: -0.01 },
    text: { family: 'Inter', weight: 700, style: 'normal', case: 'none', tracking: -0.015 },
    emphasis: { family: 'Instrument Serif', weight: 400, style: 'italic', case: 'none', tracking: 0 },
    label: { family: 'Inter', weight: 600, style: 'normal', case: 'upper', tracking: 0.2 },
    scale: 1.3,
  },
  motion: { enter: 'rise', ease: 'gentle', inSec: 0.6, outSec: 0.4, intensity: 0.25, staggerSec: 0.07 },
  rhythm: { overlaysPer10s: 0.7, minGapSec: 2.5, keywordEverySec: 6, zoomEverySec: 14, titleSec: 2.6, sceneSec: 2.6 },
  shape: { radius: 0, stroke: 3, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.3 },
  captions: { position: 'bottom', size: 0.07, maxChars: 26, maxWords: 5, maxLines: 2, highlight: 'reveal', box: 'none', stroke: 0, upcomingAlpha: 0.5, activeScale: 1, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  transition: 'zoom',
  progress: 'line',
  zoomScale: 1.06,
  cta: 'Siga para mais',
};

export const POP: StyleDNA = {
  version: 2,
  id: 'pop',
  name: 'Pop',
  palette: {
    text: '#FFFFFF',
    muted: '#FFFFFFD9',
    accent: '#FFE135',
    accent2: '#4DFF91',
    panel: '#FFE135',
    onPanel: '#0B0B0B',
    scrim: '#00000000',
    shadow: '#000000',
  },
  type: {
    display: { family: 'Anton', weight: 400, style: 'normal', case: 'upper', tracking: 0.01 },
    text: { family: 'Montserrat', weight: 900, style: 'normal', case: 'upper', tracking: -0.01 },
    emphasis: { family: 'Montserrat', weight: 900, style: 'normal', case: 'upper', tracking: -0.01 },
    label: { family: 'Montserrat', weight: 800, style: 'normal', case: 'upper', tracking: 0.04 },
    scale: 1.25,
  },
  motion: { enter: 'pop', ease: 'snappy', inSec: 0.28, outSec: 0.18, intensity: 0.9, staggerSec: 0.05 },
  rhythm: { overlaysPer10s: 1.8, minGapSec: 0.8, keywordEverySec: 2.5, zoomEverySec: 5, titleSec: 1.8, sceneSec: 1.9 },
  shape: { radius: 0.22, stroke: 10, shadow: 'hard', panel: 'box' },
  layout: { align: 'center', overlayY: 0.26 },
  captions: { position: 'middle', size: 0.088, maxChars: 20, maxWords: 3, maxLines: 2, highlight: 'box', box: 'none', stroke: 12, upcomingAlpha: 1, activeScale: 1.1, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  transition: 'flash',
  progress: 'bar',
  zoomScale: 1.14,
  cta: 'Segue pra mais',
};

export const DOCUMENTAL: StyleDNA = {
  version: 2,
  id: 'documental',
  name: 'Documental',
  palette: {
    text: '#F2F0EA',
    muted: '#F2F0EAA6',
    accent: '#E3A44B',
    accent2: '#E3A44B',
    panel: '#121417E0',
    onPanel: '#F2F0EA',
    scrim: '#0000008C',
    shadow: '#00000000',
  },
  type: {
    display: { family: 'IBM Plex Sans Condensed', weight: 700, style: 'normal', case: 'none', tracking: 0 },
    text: { family: 'IBM Plex Sans', weight: 600, style: 'normal', case: 'none', tracking: 0 },
    emphasis: { family: 'IBM Plex Sans', weight: 700, style: 'normal', case: 'none', tracking: 0 },
    label: { family: 'IBM Plex Mono', weight: 500, style: 'normal', case: 'upper', tracking: 0.08 },
    scale: 0.95,
  },
  motion: { enter: 'wipe', ease: 'smooth', inSec: 0.5, outSec: 0.35, intensity: 0.1, staggerSec: 0.12 },
  rhythm: { overlaysPer10s: 0.5, minGapSec: 3.5, keywordEverySec: 10, zoomEverySec: 16, titleSec: 3.2, sceneSec: 3.2 },
  shape: { radius: 0.06, stroke: 0, shadow: 'none', panel: 'box' },
  layout: { align: 'left', overlayY: 0.56 },
  captions: { position: 'bottom', size: 0.064, maxChars: 30, maxWords: 7, maxLines: 2, highlight: 'color', box: 'line', stroke: 0, upcomingAlpha: 1, activeScale: 1, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  transition: 'dip',
  progress: 'none',
  zoomScale: 1.04,
  cta: 'Continue acompanhando',
};

/**
 * Neon (v0.7): a legenda "karaokê" limpa dos Reels de hoje. Sem caixas: letras brancas grossas em
 * maiúsculas e minúsculas, poucas palavras por vez, a palavra falada acende em verde neon e cresce com
 * mola; títulos só tipografia com faixa de leitura; zoom de corte. Contrasta com o Pop (caixas amarelas).
 */
export const NEON: StyleDNA = {
  version: 2,
  id: 'neon',
  name: 'Neon',
  palette: {
    text: '#FFFFFF',
    muted: '#FFFFFFB3',
    accent: '#39FF14',
    accent2: '#39FF14',
    panel: '#111111E6',
    onPanel: '#FFFFFF',
    scrim: '#0000008C',
    shadow: '#000000CC',
  },
  type: {
    display: { family: 'Montserrat', weight: 900, style: 'normal', case: 'upper', tracking: -0.03 },
    text: { family: 'Inter', weight: 800, style: 'normal', case: 'none', tracking: -0.02 },
    emphasis: { family: 'Inter', weight: 800, style: 'normal', case: 'none', tracking: -0.02 },
    label: { family: 'IBM Plex Mono', weight: 600, style: 'normal', case: 'upper', tracking: 0.12 },
    scale: 1.15,
  },
  motion: { enter: 'pop', ease: 'snappy', inSec: 0.3, outSec: 0.2, intensity: 0.75, staggerSec: 0.04 },
  rhythm: { overlaysPer10s: 1.2, minGapSec: 1.5, keywordEverySec: 3, zoomEverySec: 6, titleSec: 2.2, sceneSec: 2.2 },
  shape: { radius: 0.5, stroke: 0, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.22 },
  captions: { position: 'middle', size: 0.084, maxChars: 16, maxWords: 2, maxLines: 2, highlight: 'color', box: 'none', stroke: 9, upcomingAlpha: 1, activeScale: 1.14, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  transition: 'zoom',
  progress: 'line',
  zoomScale: 1.1,
  cta: 'Segue pra mais',
};

export const PRESETS: readonly StyleDNA[] = [POP, NEON, EDITORIAL, DOCUMENTAL];
/** Estilo dos projetos novos e dos projetos antigos (v1) ao abrir. */
export const DEFAULT_STYLE = POP;

export function presetById(id: string): StyleDNA | undefined {
  return PRESETS.find((p) => p.id === id);
}
