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
  /** `loaded`/`total` em bytes somando todos os arquivos do modelo; `cached`: já estava guardado neste aparelho */
  | { type: 'progress'; stage: 'download'; fraction: number; model: AsrCandidateId; loaded: number; total: number; cached: boolean }
  /** arquivos baixados; o modelo está sendo montado (na placa de vídeo pode levar um tempo, sem notícia) */
  | { type: 'progress'; stage: 'prepare'; model: AsrCandidateId }
  /** `doneSec`/`totalSec`: segundos de áudio já ouvidos e o total a ouvir (as janelas só de silêncio não contam) */
  | { type: 'progress'; stage: 'transcribe'; fraction: number; model: AsrCandidateId; window: number; windows: number; doneSec: number; totalSec: number }
  | { type: 'fallback'; from: AsrCandidateId; to: AsrCandidateId; key: ErrorKey; detail: string }
  | { type: 'done'; results: WindowResult[]; model: AsrCandidateId; device: string; retried: number }
  | { type: 'error'; key: ErrorKey; detail: string };
