import type { ErrorKey } from '../core/errors';
import type { EditPlan } from '../core/types';
import type { DecodedAudio } from './audio';

export type ToExportWorker = { type: 'export'; file: Blob; plan: EditPlan; audio: DecodedAudio | null; music: DecodedAudio | null; faceTracks?: import('./face-analysis').FaceTracks };
export type FromExportWorker =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; buffer: ArrayBuffer; degraded: boolean; codec: string; fontWarning: string; emojiWarning: string }
  | { type: 'error'; key: ErrorKey; detail: string };
