import type { CreativeBrief } from './brief';
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

export interface EditPlan {
  version: 3;
  output: OutputProfile;
  style: StyleDNA;
  /** o pedido por texto já entendido (vazio = nenhum pedido) */
  brief: CreativeBrief;
  segments: Segment[];
  captions: Caption[];
  scenes: SceneInstance[];
}

export const REELS_PROFILE: OutputProfile = { width: 1080, height: 1920, fps: 30 };
