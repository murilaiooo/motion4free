import type { ErrorKey } from '../core/errors';
import type { EditPlan } from '../core/types';
import type { FaceTrack } from '../render/framing';
import type { OutputAudio } from './export';

/** Vários clipes (v0.14): o Worker recebe os arquivos (sem cópia) e só o áudio já emendado do vídeo final. */
export type ToExportWorker = { type: 'export'; clips: { id: string; file: Blob }[]; tracks: Record<string, FaceTrack | null>; plan: EditPlan; audio: OutputAudio | null };
export type FromExportWorker =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; buffer: ArrayBuffer; degraded: boolean; codec: string; fontWarning: string; emojiWarning: string }
  | { type: 'error'; key: ErrorKey; detail: string };
