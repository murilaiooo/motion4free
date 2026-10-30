import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory } from '../src/engine/history';
import { makeProject } from '../src/core/project';
import { listProjects, loadProject, readMeta, setCurrent, getCurrent } from '../src/core/project-library';
import { MemoryFs } from './helpers/memory-fs';

const ID = 'p-qaorphan';
const savedAt = '2026-10-20T17:58:00-07:00';
const saved = makeProject({
  appVersion: '0.15.1', savedAt,
  video: { name: 'entrevista.mp4', size: 122, durationSec: 3 },
  words: [], silences: [], warnings: [], history: createHistory(autoEdit(3, [], [])),
});

describe('QA não coberto: interrupção de duas gravações de metadados', () => {
  it('meta.json ausente após gravar project.json: restaura cartão utilizável sem apagar a edição', async () => {
    const fs = new MemoryFs();
    await fs.writeFile(['motion4free','projects',ID,'project.json'], JSON.stringify(saved));
    await setCurrent(fs, ID);
    expect(await readMeta(fs, ID)).toBeNull();
    const entries = await listProjects(fs);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: ID, broken: false, name: 'entrevista', hasVideo: false });
    const meta = await readMeta(fs, ID);
    expect(meta?.updatedAt).toBe(savedAt);
    expect((await loadProject(fs, ID)).kind).toBe('ok');
    expect(await getCurrent(fs)).toBe(ID);
  });

  it('meta.json inválido com projeto íntegro não vira falsa perda definitiva', async () => {
    const fs = new MemoryFs();
    await fs.writeFile(['motion4free','projects',ID,'project.json'], JSON.stringify(saved));
    await fs.writeFile(['motion4free','projects',ID,'meta.json'], '{invalid json}');
    expect((await listProjects(fs))[0]?.broken).toBe(false);
    expect((await readMeta(fs, ID))?.name).toBe('entrevista');
  });

  it('project.json inválido mantém cartão marcado como danificado e não inventa plano', async () => {
    const fs = new MemoryFs();
    await fs.writeFile(['motion4free','projects',ID,'project.json'], '{json inválido');
    const entries = await listProjects(fs);
    expect(entries[0]?.broken).toBe(true);
    expect(await readMeta(fs, ID)).toBeNull();
  });
});
