import type { AsrWindow } from '../analysis/asr-windows';
import type { WindowResult } from '../analysis/asr-merge';
import type { AsrCandidateId } from '../core/asr-models';
import type { ErrorKey } from '../core/errors';

/**
 * `windows`: janelas de até 28 s (mais 1 s de folga de cada lado), em segundos do original.
 * `ladder`: modelos em ordem de tentativa; se um falhar, o Worker passa para o próximo (ADR-0013).
 */
export type ToWorker = { type: 'transcribe'; audio: Float32Array; language: string; windows: AsrWindow[]; ladder: AsrCandidateId[] };
export type FromWorker =
  | { type: 'progress'; stage: 'download'; fraction: number; model: AsrCandidateId }
  | { type: 'progress'; stage: 'transcribe'; fraction: number; model: AsrCandidateId; window: number; windows: number }
  | { type: 'fallback'; from: AsrCandidateId; to: AsrCandidateId; key: ErrorKey; detail: string }
  | { type: 'done'; results: WindowResult[]; model: AsrCandidateId; device: string; retried: number }
  | { type: 'error'; key: ErrorKey; detail: string };
