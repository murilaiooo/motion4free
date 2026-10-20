import type { CreativeBrief, Emphasis, Level, Pace, Prohibition, Tone } from './brief';
import type { StyleDNA } from './style';

/** Tempo sempre em segundos (number). "src" = tempo no vídeo original; "out" = tempo no vídeo editado. */

export interface Word {
  id: string;
  text: string;
  start: number; // src
  end: number; // src
}

export interface TimeRange {
  start: number;
  end: number;
}

/** Trecho do original que entra no vídeo final, na ordem. */
export interface Segment {
  srcStart: number;
  srcEnd: number;
}

export interface Caption {
  id: string;
  text: string;
  start: number; // out
  end: number; // out
  wordIds: string[];
  /**
   * Início (out) de cada palavra da legenda, para destacar a palavra falada.
   * Vazio ou com tamanho diferente do número de palavras do texto (ex.: texto corrigido) =
   * distribuição proporcional ao tamanho das palavras.
   */
  wordStarts: number[];
}

interface SceneBase {
  id: string;
  start: number; // out
  end: number; // out
}

/** Tipos de cena: enum fechado, cada um com seus parâmetros. Nada de código livre. */
export type SceneInstance =
  | (SceneBase & { kind: 'kinetic-title'; text: string })
  | (SceneBase & { kind: 'highlight-word'; text: string })
  | (SceneBase & { kind: 'big-number'; value: string; label: string })
  | (SceneBase & { kind: 'list'; items: ListItem[] })
  | (SceneBase & { kind: 'quote'; text: string })
  | (SceneBase & { kind: 'lower-third'; title: string; subtitle: string })
  | (SceneBase & { kind: 'emphasis-zoom'; scale: number })
  | (SceneBase & { kind: 'cut-transition'; at: number })
  | (SceneBase & { kind: 'progress-bar' })
  | (SceneBase & { kind: 'end-cta'; text: string });

export type SceneKind = SceneInstance['kind'];

export interface ListItem {
  text: string;
  /** instante (out) em que o item aparece */
  at: number;
}

export interface OutputProfile {
  width: number;
  height: number;
  fps: number;
}

/** Cópia do que um trecho travado mostra (cenas e legendas que tocam o trecho), no tempo do vídeo editado. */
export interface RangeLock {
  /** início do trecho (out) quando foi travado: se um corte antes dele mudar, tudo é deslocado pela diferença */
  outStart: number;
  scenes: SceneInstance[];
  captions: Caption[];
}

/**
 * Trecho ajustado (Fase 5). Ancorado no vídeo original (srcStart/srcEnd) para continuar sendo
 * "as mesmas falas" se um corte antes dele mudar. `out` é derivado (tempo no vídeo editado).
 * Os campos do pedido valem só dentro do trecho, por cima do pedido geral.
 */
export interface RangeEdit {
  id: string;
  srcStart: number;
  srcEnd: number;
  /** posição atual no vídeo editado (recalculada a cada mudança) */
  out: TimeRange;
  /** pedidos feitos para o trecho, só para mostrar */
  prompt: string;
  tone: Tone | null;
  intensity: Level | null;
  pace: Pace | null;
  forbid: Prohibition[];
  emphasize: Emphasis[];
  /** "sem animação aqui" */
  quiet: boolean;
  /** "destaque isso" */
  accent: boolean;
  /** "troca essa animação": quantas trocas */
  variant: number;
  /** estilo usado dentro do trecho; null = o do vídeo */
  style: StyleDNA | null;
  locked: RangeLock | null;
}

/** Cores tiradas de uma imagem da pessoa (a imagem em si não é guardada). */
export interface ReferencePalette {
  colors: string[];
}

export interface EditPlan {
  version: 4;
  output: OutputProfile;
  style: StyleDNA;
  /** o pedido por texto já entendido (vazio = nenhum pedido) */
  brief: CreativeBrief;
  segments: Segment[];
  captions: Caption[];
  scenes: SceneInstance[];
  /** trechos ajustados, em ordem e sem sobreposição */
  ranges: RangeEdit[];
  reference: ReferencePalette | null;
}

export const REELS_PROFILE: OutputProfile = { width: 1080, height: 1920, fps: 30 };
