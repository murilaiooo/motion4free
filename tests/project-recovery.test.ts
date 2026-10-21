import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory } from '../src/engine/history';
import { DEFAULT_STYLE } from '../src/core/presets';
import { makeProject } from '../src/core/project';
import {
  listProjects,
  loadProject,
  loadProjectVideos,
  readMeta,
  renameProject,
  saveClipVideo,
  saveProjectData,
  saveVideo,
} from '../src/core/project-library';
import type { Fs } from '../src/core/storage-fs';
import type { ClipRef } from '../src/core/types';
import { MemoryFs } from './helpers/memory-fs';

/**
 * Recuperação de projetos (v0.16): cada jeito de uma gravação parar no meio vira uma situação
 * diferente na lista. Um projeto que tem as edições guardadas nunca aparece como "não abre".
 */
const ID = 'p-recover1';
const DIR = ['motion4free', 'projects', ID];
const savedAt = '2026-10-21T01:00:00Z';
const saved = makeProject({
  appVersion: '0.16.0',
  savedAt,
  video: { name: 'entrevista.mp4', size: 120, durationSec: 3 },
  words: [{ id: 'w1', text: 'Olá.', start: 0.1, end: 0.5 }],
  silences: [],
  warnings: [],
  history: createHistory(autoEdit(3, [], [])),
});

describe('recuperação de projetos interrompidos', () => {
  it('app fechado antes do primeiro salvamento (só a cópia do vídeo): "Importação interrompida", não "não abre"', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([...DIR, 'video.bin'], new Blob([]));
    const [p] = await listProjects(fs);
    expect(p).toMatchObject({ id: ID, status: 'interrupted', broken: true, name: 'Importação interrompida', hasVideo: false });
    expect(p!.name).not.toBe('Projeto que não abre');
    expect((await loadProject(fs, ID)).kind).toBe('none');
  });

  it('vídeo não coube (QuotaExceeded) mas as edições foram salvas: projeto abre e pede o vídeo original', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, ID, saved, 'entrevista', savedAt);
    fs.space = 10; // a cópia do vídeo não cabe
    await expect(saveVideo(fs, ID, new Blob([new Uint8Array(120)]))).rejects.toThrow();
    const [p] = await listProjects(fs);
    expect(p).toMatchObject({ status: 'ok', broken: false, hasVideo: false, name: 'entrevista' });
    const loaded = await loadProject(fs, ID);
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') expect(loaded.video).toBeNull(); // o app mostra M4F-604
  });

  it('cópia do vídeo cortada no meio (tamanho diferente): abre e pede o vídeo de novo', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, ID, saved, 'entrevista', savedAt);
    await saveVideo(fs, ID, new Blob([new Uint8Array(40)]));
    expect((await listProjects(fs))[0]).toMatchObject({ status: 'ok', hasVideo: false });
    const loaded = await loadProject(fs, ID);
    if (loaded.kind !== 'ok') throw new Error(loaded.kind);
    expect(loaded.video).toBeNull();
  });

  it('meta.json ausente (fechou entre project.json e meta.json): resumo refeito, abre e renomeia', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([...DIR, 'project.json'], JSON.stringify(saved));
    const [p] = await listProjects(fs);
    expect(p).toMatchObject({ status: 'ok', broken: false, name: 'entrevista', updatedAt: savedAt });
    expect((await readMeta(fs, ID))?.name).toBe('entrevista');
    expect((await loadProject(fs, ID)).kind).toBe('ok');
    expect((await renameProject(fs, ID, 'Novo nome'))?.name).toBe('Novo nome');
    expect((await listProjects(fs))[0]!.name).toBe('Novo nome');
  });

  it('meta.json estragado com project.json íntegro: não vira falsa perda', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([...DIR, 'project.json'], JSON.stringify(saved));
    await fs.writeFile([...DIR, 'meta.json'], '{"format":1,"id":"p-rec');
    expect((await listProjects(fs))[0]).toMatchObject({ status: 'ok', broken: false, name: 'entrevista' });
  });

  it('project.json estragado: "danificado", com o nome guardado e o motivo para copiar', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, ID, saved, 'Minha entrevista', savedAt);
    await fs.writeFile([...DIR, 'project.json'], '{"format":2,"sav');
    const [p] = await listProjects(fs);
    expect(p).toMatchObject({ status: 'damaged', broken: true, name: 'Minha entrevista' });
    expect(p!.problem).toMatch(/JSON inválido/);
    expect((await loadProject(fs, ID)).kind).toBe('corrupt');
  });

  it('project.json com formato desconhecido: "danificado" com os erros do esquema', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([...DIR, 'project.json'], JSON.stringify({ format: 99 }));
    const [p] = await listProjects(fs);
    expect(p).toMatchObject({ status: 'damaged', broken: true, name: 'Projeto que não abre' });
    expect(p!.problem).not.toBe('');
  });

  it('clipe com arquivo vazio (gravação que falhou no começo) não conta como cópia', async () => {
    const fs = new MemoryFs();
    const clips: ClipRef[] = [
      { id: 'c1', name: 'a.mp4', duration: 2, framing: null },
      { id: 'c2', name: 'b.mp4', duration: 1, framing: null },
    ];
    const multi = makeProject({
      appVersion: '0.16.0', savedAt, video: { name: 'a.mp4', size: 5, durationSec: 2 }, words: [], silences: [], warnings: [],
      history: createHistory(autoEdit(3, [], [], DEFAULT_STYLE, { clips })),
    });
    await saveProjectData(fs, ID, multi, 'multi', savedAt);
    await saveVideo(fs, ID, new Blob(['first']));
    await saveClipVideo(fs, ID, 'c2', new Blob([]));
    expect((await listProjects(fs))[0]).toMatchObject({ status: 'ok', hasVideo: false });
    expect(await loadProjectVideos(fs, ID, multi)).toBeNull(); // o app pede os vídeos (M4F-615)
    await saveClipVideo(fs, ID, 'c2', new Blob(['second']));
    expect((await listProjects(fs))[0]!.hasVideo).toBe(true);
  });

  it('uma pasta ilegível não esconde os outros projetos', async () => {
    const mem = new MemoryFs();
    await saveProjectData(mem, ID, saved, 'bom', savedAt);
    await saveProjectData(mem, 'p-ruim1', saved, 'ruim', savedAt);
    const fs: Fs = {
      list: (d) => mem.list(d),
      writeFile: (p, d) => mem.writeFile(p, d),
      remove: (p) => mem.remove(p),
      readFile: async (p) => {
        if (p.includes('p-ruim1') && p[p.length - 1] === 'project.json') throw new DOMException('disco', 'NotReadableError');
        return mem.readFile(p);
      },
    };
    const list = await listProjects(fs);
    expect(list.find((p) => p.id === ID)).toMatchObject({ status: 'ok', name: 'bom' });
    expect(list.find((p) => p.id === 'p-ruim1')).toMatchObject({ status: 'damaged', broken: true });
    expect(list.find((p) => p.id === 'p-ruim1')!.problem).toMatch(/NotReadableError|leitura/);
  });
});
