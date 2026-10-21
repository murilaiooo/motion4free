import type { Fs } from './storage-fs';
import type { TimeRange, Word } from './types';
import type { ErrorKey } from './errors';
import { ERRORS } from './errors';

/**
 * Análise guardada do último vídeo longo (v0.22, ADR-0023). Transcrever 1 hora leva tempo; se a pessoa
 * fechar a aba ou voltar depois, escolher o mesmo arquivo pula a análise. Só texto e números são guardados
 * (poucos MB); o vídeo longo em si nunca é copiado. Fica numa pasta própria, que aparece em Armazenamento.
 */

export const CLIP_JOB_DIR = 'motion4free-clipes';
export const CLIP_JOB_FILE = 'ultima-analise.json';
export const CLIP_JOB_PATH = [CLIP_JOB_DIR, CLIP_JOB_FILE];

export interface ClipJobSource {
  name: string;
  size: number;
  durationSec: number;
}

export interface ClipJob {
  version: 1;
  savedAt: string;
  appVersion: string;
  source: ClipJobSource;
  words: Word[];
  silences: TimeRange[];
  /** energia do áudio em dB (uma casa decimal), um valor a cada `energyStep` s */
  energy: number[];
  energyStep: number;
  asrModel: string | null;
  warnings: { key: ErrorKey; detail: string }[];
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isRange = (x: unknown): x is TimeRange => !!x && typeof x === 'object' && isNum((x as TimeRange).start) && isNum((x as TimeRange).end);
const isWord = (x: unknown): x is Word => isRange(x) && typeof (x as Word).id === 'string' && typeof (x as Word).text === 'string';

/** Lê e confere o JSON salvo; qualquer coisa fora do formato = null (a análise é refeita). */
export function parseClipJob(text: string): ClipJob | null {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return null;
  }
  const j = v as Partial<ClipJob>;
  if (!j || typeof j !== 'object' || j.version !== 1) return null;
  const s = j.source;
  if (!s || typeof s.name !== 'string' || !isNum(s.size) || !isNum(s.durationSec)) return null;
  if (!Array.isArray(j.words) || !j.words.every(isWord)) return null;
  if (!Array.isArray(j.silences) || !j.silences.every(isRange)) return null;
  if (!Array.isArray(j.energy) || !j.energy.every(isNum) || !isNum(j.energyStep) || j.energyStep <= 0) return null;
  const warnings = Array.isArray(j.warnings) ? j.warnings.filter((w) => !!w && typeof w.key === 'string' && w.key in ERRORS && typeof w.detail === 'string') : [];
  return {
    version: 1,
    savedAt: typeof j.savedAt === 'string' ? j.savedAt : '',
    appVersion: typeof j.appVersion === 'string' ? j.appVersion : '',
    source: { name: s.name, size: s.size, durationSec: s.durationSec },
    words: j.words,
    silences: j.silences,
    energy: j.energy,
    energyStep: j.energyStep,
    asrModel: typeof j.asrModel === 'string' ? j.asrModel : null,
    warnings,
  };
}

/** Energia com uma casa decimal: o arquivo fica pequeno e a nota dos momentos não muda. */
export function compactEnergy(env: ArrayLike<number>): number[] {
  return Array.from(env, (x) => Math.round(x * 10) / 10);
}

/** O arquivo escolhido é o mesmo da análise guardada? (nome e tamanho; a duração é conferida ao abrir) */
export function sameSource(job: Pick<ClipJob, 'source'>, file: { name: string; size: number }): boolean {
  return job.source.name === file.name && job.source.size === file.size;
}

export async function loadClipJob(fs: Fs): Promise<ClipJob | null> {
  const blob = await fs.readFile(CLIP_JOB_PATH).catch(() => null);
  if (!blob) return null;
  return parseClipJob(await blob.text());
}

export async function saveClipJob(fs: Fs, job: ClipJob): Promise<void> {
  await fs.writeFile(CLIP_JOB_PATH, JSON.stringify(job));
}

export async function deleteClipJob(fs: Fs): Promise<void> {
  await fs.remove([CLIP_JOB_DIR]);
}
