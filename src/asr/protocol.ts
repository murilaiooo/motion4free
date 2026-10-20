import type { ErrorKey } from '../core/errors';
import type { TimeRange } from '../core/types';
import type { AsrChunk } from './words';

/** `windows`: trechos de até 30 s, cortados em silêncio, em segundos do original. */
export type ToWorker = { type: 'transcribe'; audio: Float32Array; language: string; windows: TimeRange[] };
export type FromWorker =
  | { type: 'progress'; stage: 'download' | 'transcribe'; fraction: number }
  | { type: 'done'; chunks: AsrChunk[]; device: string }
  | { type: 'error'; key: ErrorKey; detail: string };
