import type { ErrorKey } from '../core/errors';
import type { AsrChunk } from './words';

export type ToWorker = { type: 'transcribe'; audio: Float32Array; language: string };
export type FromWorker =
  | { type: 'progress'; stage: 'download' | 'transcribe'; fraction: number }
  | { type: 'done'; chunks: AsrChunk[]; device: string }
  | { type: 'error'; key: ErrorKey; detail: string };
