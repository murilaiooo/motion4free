import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory } from '../src/engine/history';
import { makeProject } from '../src/core/project';
import {
  LEGACY_DIR,
  cleanName,
  deleteProject,
  duplicateProject,
  getCurrent,
  isProjectId,
  listProjects,
  loadProject,
  migrateLegacy,
  nameFromFile,
  newProjectId,
  renameProject,
  saveProjectData,
  saveThumb,
  saveVideo,
  setCurrent,
} from '../src/core/project-library';
import { formatBytes, formatClock, formatWhen } from '../src/core/bytes';
import { MemoryFs } from './helpers/memory-fs';

const words = [{ id: 'w1', text: 'Olá.', start: 0.1, end: 0.5 }];
const plan = autoEdit(3, [], words);

function project(name: string, size: number, savedAt: string) {
  return makeProject({ video: { name, size, durationSec: 3 }, words, silences: [], warnings: [], history: createHistory(plan), appVersion: '0.11.0', savedAt });
}

const video = (size: number) => new Blob([new Uint8Array(size)]);

describe('biblioteca de projetos', () => {
  it('ids novos são válidos e diferentes', () => {
    const a = newProjectId(1_700_000_000_000, () => 0.1);
    const b = newProjectId(1_700_000_000_000, () => 0.2);
    expect(isProjectId(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(isProjectId('../x')).toBe(false);
  });

  it('nome vem do arquivo sem extensão; nome vazio é recusado', () => {
    expect(nameFromFile('minha fala.final.mp4')).toBe('minha fala.final');
    expect(nameFromFile('.mp4')).toBe('Projeto sem nome');
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('  a   b  ')).toBe('a b');
    expect(cleanName('x'.repeat(200))!.length).toBe(80);
  });

  it('dois projetos ficam na lista, o mais recente primeiro, com tamanho, miniatura e duração editada', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, 'p-aaaa', project('a.webm', 100, '2026-10-20T10:00:00Z'), 'a', '2026-10-20T10:00:00Z');
    await saveVideo(fs, 'p-aaaa', video(100));
    await saveProjectData(fs, 'p-bbbb', project('b.webm', 50, '2026-10-20T11:00:00Z'), 'b', '2026-10-20T11:00:00Z');
    await saveThumb(fs, 'p-bbbb', video(7));
    const list = await listProjects(fs);
    expect(list.map((p) => p.id)).toEqual(['p-bbbb', 'p-aaaa']);
    expect(list[1]!.hasVideo).toBe(true);
    expect(list[0]!.hasVideo).toBe(false);
    expect(list[0]!.thumb?.size).toBe(7);
    expect(list[1]!.sizeBytes).toBeGreaterThan(100);
    expect(list[1]!.editedSec).toBeGreaterThan(0);
    expect(list[1]!.templateId).toBe(plan.style.id);
  });

  it('salvar de novo mantém nome e data de criação', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, 'p-aaaa', project('a.webm', 1, '2026-10-20T10:00:00Z'), 'a', '2026-10-20T10:00:00Z');
    await renameProject(fs, 'p-aaaa', 'Dicas de casa');
    const meta = await saveProjectData(fs, 'p-aaaa', project('a.webm', 1, '2026-10-20T12:00:00Z'), 'outro', '2026-10-20T12:00:00Z');
    expect(meta.name).toBe('Dicas de casa');
    expect(meta.createdAt).toBe('2026-10-20T10:00:00Z');
    expect(meta.updatedAt).toBe('2026-10-20T12:00:00Z');
    expect(await renameProject(fs, 'p-aaaa', '  ')).toBeNull();
  });

  it('abre o projeto; cópia do vídeo de outro tamanho conta como ausente; JSON quebrado é "corrupt"', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, 'p-aaaa', project('a.webm', 10, 't'), 'a', 't');
    await saveVideo(fs, 'p-aaaa', video(9));
    const r = await loadProject(fs, 'p-aaaa');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.video).toBeNull();
    await saveVideo(fs, 'p-aaaa', video(10));
    const r2 = await loadProject(fs, 'p-aaaa');
    if (r2.kind === 'ok') expect(r2.video?.size).toBe(10);
    await fs.writeFile(['motion4free', 'projects', 'p-aaaa', 'project.json'], '{quebrado');
    expect((await loadProject(fs, 'p-aaaa')).kind).toBe('corrupt');
    expect((await loadProject(fs, 'p-zzzz')).kind).toBe('none');
  });

  it('duplica com vídeo e nome "(cópia)"; disco cheio não deixa meia cópia', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, 'p-aaaa', project('a.webm', 1000, 't'), 'Fala', 't');
    await saveVideo(fs, 'p-aaaa', video(1000));
    const copy = await duplicateProject(fs, 'p-aaaa', 'p-cccc', '2026-10-21T00:00:00Z');
    expect(copy!.name).toBe('Fala (cópia)');
    const list = await listProjects(fs);
    expect(list.find((p) => p.id === 'p-cccc')!.hasVideo).toBe(true);

    fs.space = 500;
    await expect(duplicateProject(fs, 'p-aaaa', 'p-dddd', 't')).rejects.toThrow();
    expect(await fs.list(['motion4free', 'projects', 'p-dddd'])).toBeNull();
  });

  it('apagar devolve o espaço liberado e tira o projeto de "aberto por último"', async () => {
    const fs = new MemoryFs();
    await saveProjectData(fs, 'p-aaaa', project('a.webm', 2048, 't'), 'a', 't');
    await saveVideo(fs, 'p-aaaa', video(2048));
    await setCurrent(fs, 'p-aaaa');
    expect(await getCurrent(fs)).toBe('p-aaaa');
    const freed = await deleteProject(fs, 'p-aaaa');
    expect(freed).toBeGreaterThan(2048);
    expect(await getCurrent(fs)).toBeNull();
    expect(await listProjects(fs)).toEqual([]);
  });

  it('pasta só com a cópia do vídeo aparece como "Importação interrompida" para poder apagar', async () => {
    const fs = new MemoryFs();
    await fs.writeFile(['motion4free', 'projects', 'p-eeee', 'video.bin'], video(5));
    const [p] = await listProjects(fs);
    expect(p!.broken).toBe(true);
    expect(p!.status).toBe('interrupted');
    expect(p!.sizeBytes).toBe(5);
  });
});

describe('migração do projeto único da v0.10', () => {
  it('move project.json e video.bin para a lista, abre igual e apaga a pasta antiga', async () => {
    const fs = new MemoryFs();
    const old = project('minha fala.webm', 300, '2026-10-19T09:00:00Z');
    await fs.writeFile([LEGACY_DIR, 'project.json'], JSON.stringify(old));
    await fs.writeFile([LEGACY_DIR, 'video.bin'], video(300));

    const r = await migrateLegacy(fs, 'p-mmmm', '2026-10-20T00:00:00Z');
    expect(r).toEqual({ kind: 'migrated', id: 'p-mmmm' });
    expect(await fs.list([LEGACY_DIR])).toBeNull();
    expect(await getCurrent(fs)).toBe('p-mmmm');
    const [p] = await listProjects(fs);
    expect(p!.name).toBe('minha fala');
    expect(p!.hasVideo).toBe(true);
    expect(p!.updatedAt).toBe('2026-10-19T09:00:00Z');
    const loaded = await loadProject(fs, 'p-mmmm');
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') {
      expect(loaded.project.history.present).toEqual(old.history.present);
      expect(loaded.video?.size).toBe(300);
    }
    // rodar de novo não faz nada
    expect((await migrateLegacy(fs, 'p-nnnn', 't')).kind).toBe('none');
  });

  it('sem vídeo salvo também migra (o app pede o vídeo de novo)', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([LEGACY_DIR, 'project.json'], JSON.stringify(project('a.webm', 300, 't')));
    expect((await migrateLegacy(fs, 'p-mmmm', 't')).kind).toBe('migrated');
    const [p] = await listProjects(fs);
    expect(p!.hasVideo).toBe(false);
  });

  it('se faltar espaço no meio, a pasta antiga fica intacta e não sobra cópia parcial', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([LEGACY_DIR, 'project.json'], JSON.stringify(project('a.webm', 3000, 't')));
    await fs.writeFile([LEGACY_DIR, 'video.bin'], video(3000));
    fs.space = 2000;
    const r = await migrateLegacy(fs, 'p-mmmm', 't');
    expect(r.kind).toBe('failed');
    expect((await fs.readFile([LEGACY_DIR, 'video.bin']))!.size).toBe(3000);
    expect(await fs.list(['motion4free', 'projects', 'p-mmmm'])).toBeNull();
  });

  it('projeto antigo que não abre é movido como "não abre" (nada é descartado sem a pessoa pedir)', async () => {
    const fs = new MemoryFs();
    await fs.writeFile([LEGACY_DIR, 'project.json'], '{quebrado');
    expect((await migrateLegacy(fs, 'p-mmmm', 't')).kind).toBe('migrated');
    const [p] = await listProjects(fs);
    expect(p!.broken).toBe(true);
  });
});

describe('formatBytes', () => {
  it('escreve tamanhos em português', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(12 * 1024)).toBe('12 KB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1,5 MB');
    expect(formatBytes(350 * 1024 * 1024)).toBe('350 MB');
    expect(formatBytes(1.4 * 1024 ** 3)).toBe('1,4 GB');
    expect(formatBytes(2 * 1024 ** 3)).toBe('2 GB');
  });

  it('duração e "quando" em português', () => {
    expect(formatClock(42.4)).toBe('0:42');
    expect(formatClock(125)).toBe('2:05');
    const now = Date.parse('2026-10-20T12:00:00');
    expect(formatWhen('2026-10-20T11:59:40', now)).toBe('agora há pouco');
    expect(formatWhen('2026-10-20T11:55:00', now)).toBe('há 5 min');
    expect(formatWhen('2026-10-20T09:00:00', now)).toBe('há 3 h');
    expect(formatWhen('2026-10-19T09:00:00', now)).toBe('ontem');
    expect(formatWhen('2026-10-16T12:00:00', now)).toBe('há 4 dias');
    expect(formatWhen('2026-09-01T12:00:00', now)).toBe('01/09/2026');
    expect(formatWhen('lixo', now)).toBe('');
  });
});
