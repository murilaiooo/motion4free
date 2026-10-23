import { fingerprint } from '../ai/routing';
import type { ClipOrigins } from '../editorial/clip-source-map';
import { cleanTranscript, toWords } from '../analysis/asr-merge';
import { planAsr } from '../analysis/asr-windows';
import { ENERGY_STEP_SEC, energyEnvelope } from '../analysis/energy';
import { findSilences } from '../analysis/silence';
import type { Transcriber } from '../asr/transcriber';
import type { AsrMode } from '../core/asr-models';
import { compactEnergy, loadClipJob, sameSource, saveClipJob, type ClipJob } from '../core/clip-job';
import { AppError, describeError, toAppError } from '../core/errors';
import type { Fs } from '../core/storage-fs';
import type { StyleDNA } from '../core/style';
import type { EditPlan, OutputProfile, TimeRange, Word } from '../core/types';
import { clipFileName, clipPlan, sliceForClip } from '../editorial/clip-plan';
import type { Moment } from '../editorial/highlights';
import type { DecodedAudio } from '../media/audio';
import { cutRange } from '../media/cut';
import { exportInBackground, type BackgroundExport } from '../media/export-client';
import { openMedia, type OpenedMedia } from '../media/input';
import { decodeMono16k } from '../media/long-audio';
import { APP_VERSION } from '../version';
import { formatClock } from '../core/bytes';
import { exportProgress, type OnProgress } from '../core/progress';
import { openWithAudio } from './pipeline';

/** Criador de clipes (v0.22, ADR-0023): análise do vídeo longo e produção de cada clipe. */

export const LONG_MAX_SEC = 2 * 3600;
export const LONG_MIN_SEC = 120;

export interface LongAnalysis {
  file: File;
  durationSec: number;
  width: number;
  height: number;
  words: Word[];
  silences: TimeRange[];
  energy: ArrayLike<number>;
  energyStep: number;
  warnings: AppError[];
  asrModel: string | null;
  /** veio da análise guardada (o arquivo já tinha sido analisado) */
  reused: boolean;
}

type Step = OnProgress;

/** Abre o vídeo longo, lê o áudio em mono 16 kHz, acha silêncios e energia e transcreve. Guarda o resultado. */
export async function analyzeLong(file: File, transcriber: Transcriber, onStep: Step, opts: { asrMode: AsrMode; fs: Fs | null }): Promise<LongAnalysis> {
  onStep({ label: 'Abrindo o vídeo', phase: 'abrir', fraction: null });
  const media = await openMedia(file, { maxSec: LONG_MAX_SEC });
  try {
    if (media.durationSec < LONG_MIN_SEC) throw new AppError('LONGO_CURTO', `duração ${media.durationSec.toFixed(1)} s`);
    const base = { file, durationSec: media.durationSec, width: media.width, height: media.height };

    const saved = opts.fs ? await loadClipJob(opts.fs).catch(() => null) : null;
    if (saved && sameSource(saved, file) && Math.abs(saved.source.durationSec - media.durationSec) < 0.5 && saved.words.length > 0) {
      return { ...base, words: saved.words, silences: saved.silences, energy: saved.energy, energyStep: saved.energyStep, warnings: saved.warnings.map((w) => new AppError(w.key, w.detail)), asrModel: saved.asrModel, reused: true };
    }

    if (!media.audio) throw new AppError('LONGO_SEM_FALA', 'o vídeo não tem faixa de áudio');
    const reading = (fraction: number) =>
      onStep({ label: 'Lendo o áudio do vídeo inteiro', phase: 'audio', fraction, detail: `${formatClock(fraction * media.durationSec)} de ${formatClock(media.durationSec)} lidos` });
    reading(0);
    const mono = await decodeMono16k(media.audio, media.durationSec, reading);
    onStep({ label: 'Procurando silêncios e os trechos com mais energia na voz', phase: 'silencios', fraction: null });
    const silences = findSilences(mono, 16000);
    const energy = energyEnvelope(mono, 16000, ENERGY_STEP_SEC);
    // o áudio vai inteiro para a transcrição (transferido, sem cópia): silêncios e energia já foram medidos
    const r = await transcriber.transcribe(mono, media.durationSec, planAsr(silences, media.durationSec), onStep, opts.asrMode);
    const words = toWords(cleanTranscript(r.words, silences));
    if (words.length === 0) throw new AppError('LONGO_SEM_FALA', `${silences.length} silêncios em ${media.durationSec.toFixed(0)} s`);
    const warnings = [...r.notices];

    if (opts.fs) {
      const job: ClipJob = {
        version: 1,
        savedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        source: { name: file.name, size: file.size, durationSec: media.durationSec },
        words,
        silences,
        energy: compactEnergy(energy),
        energyStep: ENERGY_STEP_SEC,
        asrModel: r.model,
        warnings: warnings.map((w) => ({ key: w.key, detail: w.detail })),
      };
      // sem espaço para guardar a análise, os clipes continuam; só não dá para pular a análise depois
      onStep({ label: 'Guardando a análise para não repetir da próxima vez', phase: 'montar', fraction: null });
      await saveClipJob(opts.fs, job).catch((err) => console.warn('Análise do vídeo longo não foi guardada', err));
    }
    return { ...base, words, silences, energy, energyStep: ENERGY_STEP_SEC, warnings, asrModel: r.model, reused: false };
  } catch (err) {
    if (err instanceof RangeError) throw new AppError('MEMORIA_LONGO', describeError(err));
    throw toAppError(err, 'ABRIR_FALHOU');
  } finally {
    media.input.dispose();
  }
}

export interface ClipSettings {
  style: StyleDNA;
  output: OutputProfile;
}

/** Clipe recortado, aberto e com o plano montado: pronto para o editor ou para exportar. */
export interface PreparedClip {
  sourceMaps?: ClipOrigins;
  file: File;
  media: OpenedMedia;
  audio: DecodedAudio | null;
  plan: EditPlan;
  words: Word[];
  silences: TimeRange[];
}

/** `index`: número do clipe na lista (1, 2…), usado no nome do arquivo. */
export async function prepareClip(long: LongAnalysis, m: Moment, index: number, settings: ClipSettings, onStep: Step): Promise<PreparedClip> {
  const cutting = (fraction: number) => onStep({ label: 'Recortando o trecho do vídeo longo', phase: 'recortar', fraction, detail: `${formatClock(m.end - m.start)} de vídeo` });
  cutting(0);
  const blob = await cutRange(long.file, m.start, m.end, cutting);
  const file = new File([blob], clipFileName(long.file.name, index, m.title), { type: 'video/mp4' });
  onStep({ label: 'Montando a edição do clipe', phase: 'montar', fraction: null });
  const { media, audio } = await openWithAudio(file, () => undefined);
  const slice = sliceForClip({ start: m.start, end: m.end }, media.durationSec, long.words, long.silences);
  const sourceId = await fingerprint({ name: long.file.name, size: long.file.size, modified: long.file.lastModified, duration: long.durationSec });
  return { file, media, audio, plan: clipPlan(slice, settings.style, settings.output), words: slice.words, silences: slice.silences, sourceMaps: { c1: { version: 1, sourceId, sourceOffset: m.start, sourceEnd: m.end, sourceDuration: long.durationSec, derivedDuration: media.durationSec } } };
}

/** Recorta, monta e exporta: devolve o MP4 final e o nome do arquivo. */
export async function renderClip(long: LongAnalysis, m: Moment, index: number, settings: ClipSettings, onStep: Step): Promise<{ blob: Blob; name: string; result: BackgroundExport }> {
  const p = await prepareClip(long, m, index, settings, onStep);
  try {
    const result = await exportInBackground(p.file, p.media, p.audio, p.plan, (f) => onStep(exportProgress(f)));
    return { blob: result.blob, name: clipFileName(long.file.name, index, m.title), result };
  } finally {
    p.media.input.dispose();
  }
}

/** Baixa um arquivo gerado no navegador (nada sai do aparelho). */
export function downloadBlob(url: string, name: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
