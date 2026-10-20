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
}

export type SceneKind = 'kinetic-title';

export interface SceneInstance {
  id: string;
  kind: SceneKind;
  text: string;
  start: number; // out
  end: number; // out
}

export interface OutputProfile {
  width: number;
  height: number;
  fps: number;
}

export interface EditPlan {
  version: 1;
  output: OutputProfile;
  segments: Segment[];
  captions: Caption[];
  scenes: SceneInstance[];
}

export const REELS_PROFILE: OutputProfile = { width: 1080, height: 1920, fps: 30 };
