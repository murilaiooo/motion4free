import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory, pushHistory, undo, redo } from '../src/engine/history';
import { appendClipsToPlan } from '../src/editorial/clip-append';
import { makeProject, parseProject, referencedClips } from '../src/core/project';
import { listProjects, loadProject, loadProjectVideos, saveClipVideo, saveProjectData, saveVideo } from '../src/core/project-library';
import { MemoryFs } from './helpers/memory-fs';

const c1 = { id: 'c1', name: 'first.webm', duration: 3, framing: null };
const c2 = { id: 'c2', name: 'second.webm', duration: 2, framing: null };
const base = () => autoEdit(3, [], [], undefined, { clips: [c1] });

describe('persistência de mídia referenciada por undo/redo', () => {
  it('reabrir com c2 no futuro preserva o vídeo e a anotação de c2', async () => {
    const fs = new MemoryFs();
    const b = base();
    const next = appendClipsToPlan(b, [c2], {
      c2: [{ id: 'c2:w1', text: 'segundo', start: 0.2, end: 0.6 }],
    }, { c2: [] });
    const undone = undo(pushHistory(createHistory(b), next));
    expect(undone.present.clips).toHaveLength(1);
    expect(redo(undone).present.clips).toHaveLength(2);
    const p = makeProject({
      savedAt: '2026-10-20', appVersion: '0.15.0',
      video: { name: 'first.webm', size: 5, durationSec: 3 },
      words: [], silences: [], warnings: [], history: undone,
      clipAnnotations: {
        c1: { words: [], silences: [] },
        c2: { words: [{ id: 'c2:w1', text: 'segundo', start: 0.2, end: 0.6 }], silences: [] },
      },
    });
    await saveProjectData(fs, 'p-history', p, 'History', p.savedAt);
    await saveVideo(fs, 'p-history', new Blob(['first']));
    await saveClipVideo(fs, 'p-history', 'c2', new Blob(['second']));

    const loaded = await loadProject(fs, 'p-history');
    expect(loaded.kind).toBe('ok');
    if (loaded.kind !== 'ok') return;
    expect(loaded.video).toBeNull(); // o futuro exige um segundo arquivo
    expect(referencedClips(loaded.project).map(c => c.id)).toEqual(['c1', 'c2']);
    expect(loaded.project.clipAnnotations?.c2?.words[0]!.text).toBe('segundo');
    const videos = await loadProjectVideos(fs, 'p-history', loaded.project);
    expect([...videos!.keys()]).toEqual(['c1', 'c2']);
    expect((await listProjects(fs))[0]!.hasVideo).toBe(true);

    await fs.remove(['motion4free', 'projects', 'p-history', 'video', 'c2.bin']);
    expect((await listProjects(fs))[0]!.hasVideo).toBe(false);
  });

  it('anotações opcionais antigas continuam válidas', () => {
    const p = makeProject({
      savedAt: '2026-10-20', appVersion: '0.14.0',
      video: { name: 'first.webm', size: 5, durationSec: 3 },
      words: [], silences: [], warnings: [], history: createHistory(base()),
    });
    expect(parseProject(JSON.parse(JSON.stringify(p))).ok).toBe(true);
  });
});
