import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { makeProject } from '../src/core/project';
import { createHistory } from '../src/engine/history';
import { exportProjectBackup, restoreProjectBackup } from '../src/core/project-archive';
import { listProjects, loadProject, saveProjectData, saveVideo, setCurrent, getCurrent } from '../src/core/project-library';
import { MemoryFs } from './helpers/memory-fs';

const id = 'p-original';
const build = async (fs: MemoryFs, videoSize = 128) => {
  const media = new Uint8Array(videoSize);
  for (let i = 0; i < media.length; i++) media[i] = (i * 31) % 256;
  const project = makeProject({
    video: { name: 'demo.webm', size: videoSize, durationSec: 3 },
    words: [{ id: 'w1', text: 'Olá', start: 0, end: 0.5 }], silences: [], warnings: [],
    history: createHistory(autoEdit(3, [], [])), appVersion: '0.30.0', savedAt: '2026-10-24T01:00:00Z',
  });
  await saveProjectData(fs, id, project, 'Meu vídeo', '2026-10-24T01:00:00Z');
  await saveVideo(fs, id, new Blob([media]));
  await setCurrent(fs, id);
  return media;
};

describe('backup portátil com integridade antes de restaurar (#4)', () => {
  it('backup de 2+ MB preserva mídia, projeto, nome, histórico e original sem sobrescrever', async () => {
    const fs = new MemoryFs();
    const media = await build(fs, 2 * 1024 * 1024 + 5);
    const archive = await exportProjectBackup(fs, id);
    expect(archive.size).toBeGreaterThan(media.byteLength);
    const restored = await restoreProjectBackup(fs, archive);
    expect(restored).not.toBe(id);
    const opened = await loadProject(fs, restored);
    expect(opened.kind).toBe('ok');
    if (opened.kind === 'ok') {
      expect(opened.video?.size).toBe(media.byteLength);
      const original = await loadProject(fs, id);
      expect(original.kind).toBe('ok');
      if (original.kind === 'ok') expect(opened.project.history.present).toEqual(original.project.history.present);
    }
    const list = await listProjects(fs);
    expect(list).toHaveLength(2);
    expect(list.find(p => p.id === restored)?.name).toBe('Meu vídeo');
    expect(list.every(p => p.hasVideo)).toBe(true);
    expect(await getCurrent(fs)).toBe(id); // no silent project switch
  });

  it('cópia corrompida/truncada é rejeitada antes de alterar qualquer projeto', async () => {
    const fs = new MemoryFs();
    await build(fs);
    const archive = await exportProjectBackup(fs, id);
    const bytes = new Uint8Array(await archive.arrayBuffer());
    bytes[bytes.length - 1]! ^= 1;
    await expect(restoreProjectBackup(fs, new Blob([bytes]))).rejects.toThrow(/corrompido/);
    await expect(restoreProjectBackup(fs, archive.slice(0, -1))).rejects.toThrow();
    expect(await listProjects(fs)).toHaveLength(1);
    expect(await getCurrent(fs)).toBe(id);
  });

  it('não exporta backup sem mídia e recusa arquivo que não é nosso', async () => {
    const fs = new MemoryFs();
    await build(fs);
    await fs.remove(['motion4free', 'projects', id, 'video.bin']);
    await expect(exportProjectBackup(fs, id)).rejects.toThrow(/Falta uma cópia/);
    await expect(restoreProjectBackup(fs, new Blob(['fake zip']))).rejects.toThrow();
    expect(await listProjects(fs)).toHaveLength(1);
  });

  it('restauração com disco cheio é desfeita e não toca no projeto anterior', async () => {
    const fs = new MemoryFs();
    await build(fs, 20);
    const archive = await exportProjectBackup(fs, id);
    fs.space = 15;
    await expect(restoreProjectBackup(fs, archive)).rejects.toThrow();
    expect(await listProjects(fs)).toHaveLength(1);
    expect(await getCurrent(fs)).toBe(id);
  });

  it('manifest com caminho malicioso não escreve fora do OPFS do projeto', async () => {
    const fs = new MemoryFs();
    await build(fs);
    const archive = await exportProjectBackup(fs, id);
    const raw = new Uint8Array(await archive.arrayBuffer());
    const size = new DataView(raw.buffer).getUint32(8, true);
    const manifest = JSON.parse(new TextDecoder().decode(raw.slice(12, 12 + size)));
    manifest.files[manifest.files.length - 1].path = '../secret';
    const encoded = new TextEncoder().encode(JSON.stringify(manifest));
    const head = new Uint8Array(12);
    head.set(raw.slice(0, 8));
    new DataView(head.buffer).setUint32(8, encoded.length, true);
    await expect(restoreProjectBackup(fs, new Blob([head, encoded, raw.slice(12 + size)]))).rejects.toThrow(/Caminhos/);
    expect(await fs.readFile(['motion4free', 'projects', 'secret'])).toBeNull();
    expect(await listProjects(fs)).toHaveLength(1);
  });
});
