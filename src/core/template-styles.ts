import { CAPTION_COLORS_DEFAULT, DECOR_OFF, EMOJI_OFF, type StyleDNA } from './style';

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
  decor: { ...DECOR_OFF },
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
  decor: { ...DECOR_OFF },
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
  decor: { ...DECOR_OFF },
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
  decor: { ...DECOR_OFF },
  transition: 'zoom',
  progress: 'line',
  zoomScale: 1.1,
  cta: 'Segue pra mais',
};


/* ---------- Modelos da v0.9 (ADR-0014) ---------- */

/** Fonte de um papel tipográfico (atalho para os modelos abaixo). */
type F = StyleDNA['type']['display'];
const font = (family: F['family'], weight: number, c: F['case'] = 'none', tracking = 0, style: F['style'] = 'normal'): F => ({ family, weight, style, case: c, tracking });

/**
 * Impacto: vendas e negócios. Cada palavra num bloco branco, a falada num bloco vermelho; títulos em
 * adesivos vermelhos; tudo entra deslizando rápido. Letra pesada (Archivo Black) em maiúsculas.
 */
export const IMPACTO: StyleDNA = {
  version: 2,
  id: 'impacto',
  name: 'Impacto',
  palette: { text: '#FFFFFF', muted: '#FFFFFFCC', accent: '#FF2E4D', accent2: '#FFD400', panel: '#FF2E4D', onPanel: '#FFFFFF', scrim: '#00000000', shadow: '#000000B3' },
  type: { display: font('Archivo Black', 400, 'upper', -0.01), text: font('Archivo Black', 400, 'upper', 0), emphasis: font('Archivo Black', 400, 'upper', 0), label: font('Inter', 800, 'upper', 0.06), scale: 1.15 },
  motion: { enter: 'slide', ease: 'snappy', inSec: 0.26, outSec: 0.18, intensity: 0.8, staggerSec: 0.04 },
  rhythm: { overlaysPer10s: 1.6, minGapSec: 1, keywordEverySec: 2.8, zoomEverySec: 5.5, titleSec: 1.9, sceneSec: 2 },
  shape: { radius: 0.08, stroke: 8, shadow: 'hard', panel: 'box' },
  layout: { align: 'center', overlayY: 0.27 },
  captions: { position: 'middle', size: 0.072, maxChars: 22, maxWords: 3, maxLines: 2, highlight: 'box', box: 'word', stroke: 0, upcomingAlpha: 1, activeScale: 1.06, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT, box: '#FFFFFF' } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF },
  transition: 'flash',
  progress: 'bar',
  zoomScale: 1.12,
  cta: 'Clique no link',
};

/** Minimal: tudo em minúsculas, uma só família (DM Sans), legenda que acende devagar, sem transições. */
export const MINIMAL: StyleDNA = {
  version: 2,
  id: 'minimal',
  name: 'Minimal',
  palette: { text: '#FFFFFF', muted: '#FFFFFF80', accent: '#B8F2E6', accent2: '#B8F2E6', panel: '#111111D9', onPanel: '#FFFFFF', scrim: '#00000066', shadow: '#00000099' },
  type: { display: font('DM Sans', 700, 'lower', -0.045), text: font('DM Sans', 500, 'lower', -0.015), emphasis: font('DM Sans', 700, 'lower', -0.015), label: font('DM Sans', 500, 'lower', 0.01), scale: 0.95 },
  motion: { enter: 'rise', ease: 'gentle', inSec: 0.7, outSec: 0.5, intensity: 0.12, staggerSec: 0.08 },
  rhythm: { overlaysPer10s: 0.4, minGapSec: 4, keywordEverySec: 12, zoomEverySec: 20, titleSec: 2.8, sceneSec: 2.8 },
  shape: { radius: 0, stroke: 2, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.32 },
  captions: { position: 'bottom', size: 0.064, maxChars: 28, maxWords: 5, maxLines: 2, highlight: 'reveal', box: 'none', stroke: 0, upcomingAlpha: 0.38, activeScale: 1, enter: 'fade', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, vignette: 0.2 },
  transition: 'none',
  progress: 'none',
  zoomScale: 1.03,
  cta: 'siga para mais',
};

/**
 * Podcast: selo "ao vivo" no canto, legenda em pílulas escuras com a palavra falada em laranja, cartões
 * arredondados à esquerda (nome de quem fala em destaque) e zoom de corte no rosto.
 */
export const PODCAST: StyleDNA = {
  version: 2,
  id: 'podcast',
  name: 'Podcast',
  palette: { text: '#FFFFFF', muted: '#FFFFFFB3', accent: '#FF6B2C', accent2: '#FFB547', panel: '#161616E6', onPanel: '#FFFFFF', scrim: '#00000080', shadow: '#000000CC' },
  type: { display: font('Space Grotesk', 700, 'none', -0.025), text: font('Space Grotesk', 700, 'none', -0.01), emphasis: font('Space Grotesk', 700, 'none', -0.01), label: font('Space Grotesk', 500, 'upper', 0.14), scale: 1 },
  motion: { enter: 'slide', ease: 'smooth', inSec: 0.45, outSec: 0.3, intensity: 0.35, staggerSec: 0.06 },
  rhythm: { overlaysPer10s: 0.8, minGapSec: 2.5, keywordEverySec: 5, zoomEverySec: 9, titleSec: 2.4, sceneSec: 2.6 },
  shape: { radius: 0.5, stroke: 0, shadow: 'soft', panel: 'box' },
  layout: { align: 'left', overlayY: 0.36 },
  captions: { position: 'bottom', size: 0.066, maxChars: 24, maxWords: 4, maxLines: 2, highlight: 'color', box: 'line', stroke: 0, upcomingAlpha: 1, activeScale: 1.04, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, tag: 'live', tagText: 'Podcast' },
  transition: 'zoom',
  progress: 'none',
  zoomScale: 1.12,
  cta: 'Ouça o episódio completo',
};

/** Tutorial: amigável (Nunito arredondada), pílulas brancas, passos numerados em círculos azuis, sublinhado na palavra falada. */
export const TUTORIAL: StyleDNA = {
  version: 2,
  id: 'tutorial',
  name: 'Tutorial',
  palette: { text: '#FFFFFF', muted: '#FFFFFFCC', accent: '#2F80FF', accent2: '#FFC83D', panel: '#FFFFFF', onPanel: '#14213D', scrim: '#00000066', shadow: '#0B1A33E6' },
  type: { display: font('Nunito', 900, 'none', -0.01), text: font('Nunito', 900, 'none', 0), emphasis: font('Nunito', 900, 'none', 0), label: font('Nunito', 800, 'upper', 0.08), scale: 1.05 },
  motion: { enter: 'pop', ease: 'snappy', inSec: 0.35, outSec: 0.22, intensity: 0.5, staggerSec: 0.06 },
  rhythm: { overlaysPer10s: 1, minGapSec: 2, keywordEverySec: 4, zoomEverySec: 8, titleSec: 2.4, sceneSec: 2.8 },
  shape: { radius: 0.5, stroke: 6, shadow: 'soft', panel: 'box' },
  layout: { align: 'center', overlayY: 0.3 },
  captions: { position: 'middle', size: 0.076, maxChars: 22, maxWords: 4, maxLines: 2, highlight: 'underline', box: 'none', stroke: 10, upcomingAlpha: 1, activeScale: 1.05, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, tag: 'label', tagText: 'Tutorial', listMarker: 'circle' },
  transition: 'zoom',
  progress: 'bar',
  zoomScale: 1.08,
  cta: 'Salve para não esquecer',
};

/** Cinema: faixas pretas, véu quente e vinheta; serifa clássica espaçada; tudo assenta devagar de um pouco maior. */
export const CINEMA: StyleDNA = {
  version: 2,
  id: 'cinema',
  name: 'Cinema',
  palette: { text: '#F5EFE6', muted: '#F5EFE699', accent: '#E8C58A', accent2: '#E8C58A', panel: '#000000CC', onPanel: '#F5EFE6', scrim: '#00000073', shadow: '#000000B3' },
  type: { display: font('Cormorant Garamond', 600, 'upper', 0.14), text: font('Cormorant Garamond', 600, 'none', 0.005), emphasis: font('Cormorant Garamond', 500, 'none', 0, 'italic'), label: font('Inter', 500, 'upper', 0.32), scale: 0.9 },
  motion: { enter: 'zoom', ease: 'gentle', inSec: 1, outSec: 0.7, intensity: 0.2, staggerSec: 0.1 },
  rhythm: { overlaysPer10s: 0.5, minGapSec: 3.5, keywordEverySec: 9, zoomEverySec: 16, titleSec: 3.2, sceneSec: 3 },
  shape: { radius: 0, stroke: 1, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.4 },
  captions: { position: 'bottom', size: 0.074, maxChars: 30, maxWords: 6, maxLines: 2, highlight: 'reveal', box: 'none', stroke: 0, upcomingAlpha: 0.45, activeScale: 1, enter: 'fade', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, letterbox: 0.085, vignette: 0.55, tint: '#FF9A3C14' },
  transition: 'dip',
  progress: 'none',
  zoomScale: 1.05,
  cta: 'Assista até o fim',
};

/** Jornal: selo "ao vivo", faixa de manchetes correndo embaixo, tarja de título, legenda em barra branca com a palavra em vermelho. */
export const JORNAL: StyleDNA = {
  version: 2,
  id: 'jornal',
  name: 'Jornal',
  palette: { text: '#FFFFFF', muted: '#FFFFFFCC', accent: '#E10600', accent2: '#E10600', panel: '#0B1F3AF2', onPanel: '#FFFFFF', scrim: '#00000059', shadow: '#00000099' },
  type: { display: font('Oswald', 700, 'upper', 0.01), text: font('Oswald', 500, 'upper', 0.02), emphasis: font('Oswald', 700, 'upper', 0.02), label: font('Oswald', 500, 'upper', 0.12), scale: 1 },
  motion: { enter: 'wipe', ease: 'smooth', inSec: 0.45, outSec: 0.3, intensity: 0.2, staggerSec: 0.08 },
  rhythm: { overlaysPer10s: 0.9, minGapSec: 2.2, keywordEverySec: 6, zoomEverySec: 12, titleSec: 2.6, sceneSec: 2.8 },
  shape: { radius: 0, stroke: 0, shadow: 'none', panel: 'box' },
  layout: { align: 'left', overlayY: 0.42 },
  captions: { position: 'bottom', size: 0.066, maxChars: 30, maxWords: 6, maxLines: 2, highlight: 'color', box: 'line', stroke: 0, upcomingAlpha: 1, activeScale: 1, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT, box: '#FFFFFF' } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, title: 'band', tag: 'live', tagText: 'Ao vivo', ticker: true },
  transition: 'zoom',
  progress: 'none',
  zoomScale: 1.05,
  cta: 'Acompanhe as notícias',
};

/** Retrô 90: fita antiga. Letra de terminal (VT323), linhas de TV, cores separadas, tremor e "REC" com o tempo. Só efeitos de canvas. */
export const RETRO: StyleDNA = {
  version: 2,
  id: 'retro',
  name: 'Retrô 90',
  palette: { text: '#FFFFFF', muted: '#FFFFFFB3', accent: '#00F0FF', accent2: '#FF3EA5', panel: '#1A0B2EE6', onPanel: '#FFFFFF', scrim: '#00000066', shadow: '#000000' },
  type: { display: font('VT323', 400, 'upper', 0.02), text: font('VT323', 400, 'upper', 0.02), emphasis: font('VT323', 400, 'upper', 0.02), label: font('VT323', 400, 'upper', 0.08), scale: 1.45 },
  motion: { enter: 'wipe', ease: 'snappy', inSec: 0.3, outSec: 0.2, intensity: 0.6, staggerSec: 0.05 },
  rhythm: { overlaysPer10s: 1.1, minGapSec: 1.8, keywordEverySec: 4, zoomEverySec: 7, titleSec: 2.2, sceneSec: 2.2 },
  shape: { radius: 0, stroke: 0, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.3 },
  captions: { position: 'middle', size: 0.1, maxChars: 18, maxWords: 3, maxLines: 2, highlight: 'color', box: 'none', stroke: 8, upcomingAlpha: 1, activeScale: 1.05, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, scanlines: 0.7, chroma: 0.7, jitter: 0.6, vignette: 0.4, tint: '#3A1D5C1F', tag: 'rec', tagText: 'Play' },
  transition: 'flash',
  progress: 'none',
  zoomScale: 1.08,
  cta: 'Siga para mais',
};

/** Turbo: games e muita energia. Títulos Bungee em adesivos roxos que caem quicando, legenda itálica com a palavra em degradê. */
export const TURBO: StyleDNA = {
  version: 2,
  id: 'turbo',
  name: 'Turbo',
  palette: { text: '#FFFFFF', muted: '#FFFFFFCC', accent: '#C04BFF', accent2: '#22E4FF', panel: '#7B2FF7', onPanel: '#FFFFFF', scrim: '#00000000', shadow: '#000000' },
  type: { display: font('Bungee', 400, 'upper', 0), text: font('Rubik', 900, 'upper', -0.01, 'italic'), emphasis: font('Rubik', 900, 'upper', -0.01, 'italic'), label: font('Rubik', 800, 'upper', 0.04, 'italic'), scale: 1.05 },
  motion: { enter: 'drop', ease: 'snappy', inSec: 0.5, outSec: 0.2, intensity: 1, staggerSec: 0.04 },
  rhythm: { overlaysPer10s: 2, minGapSec: 0.8, keywordEverySec: 2.2, zoomEverySec: 4.5, titleSec: 1.8, sceneSec: 1.8 },
  shape: { radius: 0.18, stroke: 12, shadow: 'hard', panel: 'box' },
  layout: { align: 'center', overlayY: 0.26 },
  captions: { position: 'middle', size: 0.086, maxChars: 18, maxWords: 3, maxLines: 2, highlight: 'color', box: 'none', stroke: 14, upcomingAlpha: 1, activeScale: 1.18, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, gradient: true, chroma: 0.25, vignette: 0.3 },
  transition: 'flash',
  progress: 'bar',
  zoomScale: 1.16,
  cta: 'Segue pro próximo nível',
};

/** Datilografia: máquina de escrever. Courier Prime, legenda que vai sendo "digitada" numa tira de papel com cursor, cartões de papel. */
export const DATILOGRAFIA: StyleDNA = {
  version: 2,
  id: 'datilografia',
  name: 'Datilografia',
  palette: { text: '#F4EEE1', muted: '#F4EEE199', accent: '#C0392B', accent2: '#C0392B', panel: '#F4EEE1', onPanel: '#1C1A17', scrim: '#00000040', shadow: '#00000066' },
  type: { display: font('Courier Prime', 700, 'none', -0.01), text: font('Courier Prime', 700, 'none', -0.01), emphasis: font('Courier Prime', 700, 'none', -0.01), label: font('Courier Prime', 400, 'upper', 0.1), scale: 0.95 },
  motion: { enter: 'type', ease: 'smooth', inSec: 0.7, outSec: 0.3, intensity: 0.15, staggerSec: 0.06 },
  rhythm: { overlaysPer10s: 0.6, minGapSec: 3, keywordEverySec: 8, zoomEverySec: 14, titleSec: 3, sceneSec: 3 },
  shape: { radius: 0.04, stroke: 0, shadow: 'soft', panel: 'box' },
  layout: { align: 'left', overlayY: 0.34 },
  captions: { position: 'bottom', size: 0.066, maxChars: 26, maxWords: 5, maxLines: 2, highlight: 'color', box: 'line', stroke: 0, upcomingAlpha: 1, activeScale: 1, enter: 'auto', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, cursor: true, vignette: 0.25 },
  transition: 'dip',
  progress: 'none',
  zoomScale: 1.03,
  cta: 'Siga para a próxima página',
};

/** Marca-texto: escrito à mão (Caveat e Kalam), palavra falada riscada de amarelo, título com traços de caneta. */
export const MARCA_TEXTO: StyleDNA = {
  version: 2,
  id: 'marca-texto',
  name: 'Marca-texto',
  palette: { text: '#FFFFFF', muted: '#FFFFFFCC', accent: '#FFE94D', accent2: '#7CF5A5', panel: '#FFE94D', onPanel: '#151515', scrim: '#00000059', shadow: '#000000B3' },
  type: { display: font('Caveat', 700, 'none', 0), text: font('Kalam', 700, 'none', 0), emphasis: font('Caveat', 700, 'none', 0), label: font('Kalam', 700, 'none', 0.02), scale: 1.35 },
  motion: { enter: 'wipe', ease: 'gentle', inSec: 0.55, outSec: 0.3, intensity: 0.4, staggerSec: 0.08 },
  rhythm: { overlaysPer10s: 1, minGapSec: 2, keywordEverySec: 4, zoomEverySec: 9, titleSec: 2.5, sceneSec: 2.5 },
  shape: { radius: 0, stroke: 4, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.3 },
  captions: { position: 'middle', size: 0.08, maxChars: 22, maxWords: 4, maxLines: 2, highlight: 'marker', box: 'none', stroke: 8, upcomingAlpha: 1, activeScale: 1.04, enter: 'fade', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, title: 'marker' },
  transition: 'zoom',
  progress: 'line',
  zoomScale: 1.08,
  cta: 'Salva e compartilha',
};

/** Luxo: preto e dourado. Títulos em itálico (Playfair Display) numa moldura fina que se desenha, legenda em maiúsculas espaçadas. */
export const LUXO: StyleDNA = {
  version: 2,
  id: 'luxo',
  name: 'Luxo',
  palette: { text: '#F7F3EA', muted: '#F7F3EA80', accent: '#C9A96E', accent2: '#E6D3A3', panel: '#0A0A0AE6', onPanel: '#F7F3EA', scrim: '#0000008C', shadow: '#00000099' },
  type: { display: font('Playfair Display', 400, 'none', -0.01, 'italic'), text: font('Inter', 500, 'upper', 0.14), emphasis: font('Playfair Display', 400, 'none', 0, 'italic'), label: font('Inter', 500, 'upper', 0.3), scale: 1.1 },
  motion: { enter: 'zoom', ease: 'gentle', inSec: 1.1, outSec: 0.8, intensity: 0.15, staggerSec: 0.12 },
  rhythm: { overlaysPer10s: 0.45, minGapSec: 4, keywordEverySec: 10, zoomEverySec: 18, titleSec: 3.2, sceneSec: 3.2 },
  shape: { radius: 0, stroke: 1, shadow: 'soft', panel: 'none' },
  layout: { align: 'center', overlayY: 0.36 },
  captions: { position: 'bottom', size: 0.064, maxChars: 24, maxWords: 4, maxLines: 2, highlight: 'color', box: 'none', stroke: 0, upcomingAlpha: 1, activeScale: 1, enter: 'fade', wordsPerLine: 0, y: 0.5, colors: { ...CAPTION_COLORS_DEFAULT } },
  emoji: { ...EMOJI_OFF },
  decor: { ...DECOR_OFF, title: 'frame', vignette: 0.45 },
  transition: 'dip',
  progress: 'none',
  zoomScale: 1.04,
  cta: 'Descubra mais',
};
