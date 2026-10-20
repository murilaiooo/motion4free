import type { AsrChunk } from './words';

export type ToWorker = { type: 'transcribe'; audio: Float32Array; language: string };
export type FromWorker =
  | { type: 'progress'; stage: 'download' | 'transcribe'; fraction: number }
  | { type: 'done'; chunks: AsrChunk[]; device: string }
  | { type: 'error'; message: string };
