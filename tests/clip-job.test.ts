import { describe, expect, it } from 'vitest';
import { CLIP_JOB_PATH, compactEnergy, deleteClipJob, loadClipJob, parseClipJob, sameSource, saveClipJob, type ClipJob } from '../src/core/clip-job';
import type { Fs } from '../src/core/storage-fs';

function memFs(): Fs & { files: Map<string, Blob> } {
  const files = new Map<string, Blob>();
  const key = (p: string[]) => p.join('/');
  return {
    files,
    async list() {
      return null;
    },
    async readFile(p) {
      return files.get(key(p)) ?? null;
    },
    async writeFile(p, data) {
      files.set(key(p), typeof data === 'string' ? new Blob([data]) : data);
    },
    async remove(p) {
      for (const k of [...files.keys()]) if (k === key(p) || k.startsWith(`${key(p)}/`)) files.delete(k);
    },
  };
}

const job: ClipJob = {
  version: 1,
  savedAt: '2026-10-21T00:00:00Z',
  appVersion: '0.22.0',
  source: { name: 'live.mp4', size: 123, durationSec: 3600 },
  words: [{ id: 'w1', text: 'Oi', start: 1, end: 1.2 }],
  silences: [{ start: 0, end: 1 }],
  energy: compactEnergy([-20.04, -60]),
  energyStep: 0.5,
  asrModel: 'Whisper small',
  warnings: [{ key: 'MODELO_RESERVA', detail: 'x' }],
};

describe('análise guardada do vídeo longo', () => {
  it('salva, lê e apaga', async () => {
    const fs = memFs();
    await saveClipJob(fs, job);
    expect(fs.files.has(CLIP_JOB_PATH.join('/'))).toBe(true);
    expect(await loadClipJob(fs)).toEqual(job);
    await deleteClipJob(fs);
    expect(await loadClipJob(fs)).toBeNull();
  });

  it('JSON estranho vira null (a análise é refeita)', () => {
    expect(parseClipJob('{')).toBeNull();
    expect(parseClipJob(JSON.stringify({ ...job, version: 2 }))).toBeNull();
    expect(parseClipJob(JSON.stringify({ ...job, words: [{ id: 1 }] }))).toBeNull();
    expect(parseClipJob(JSON.stringify({ ...job, warnings: [{ key: 'NAO_EXISTE', detail: '' }] }))!.warnings).toEqual([]);
  });

  it('mesmo arquivo = mesmo nome e tamanho', () => {
    expect(sameSource(job, { name: 'live.mp4', size: 123 })).toBe(true);
    expect(sameSource(job, { name: 'live.mp4', size: 124 })).toBe(false);
    expect(compactEnergy([-20.04])).toEqual([-20]);
  });
});
