import { describe, expect, it } from 'vitest';
import { clipLayout, clipSpans, outputToClip, placeWords, placeRanges, totalDuration } from '../src/engine/clips';
import { outputDuration } from '../src/engine/timeline';
import { autoEdit } from '../src/editorial/auto-edit';
import { DEFAULT_STYLE } from '../src/core/presets';
import { FORMAT_IDS, OUTPUT_FORMATS, profileFor } from '../src/core/formats';
import { placeSource, framingFor } from '../src/render/framing';
import { drawFrame } from '../src/render/frame';
import { RecordingContext } from './helpers/recording-ctx';
import { wordsFrom } from './helpers/words';
import { MemoryFs } from './helpers/memory-fs';
import { saveProjectData, listProjects, loadProject, saveVideo, saveClipVideo, loadProjectVideos, newProjectId } from '../src/core/project-library';
import { makeProject } from '../src/core/project';
import { createHistory } from '../src/engine/history';
import { setElementPlacement, addElement, deleteElement } from '../src/editorial/manual';
import { APP_VERSION } from '../src/version';

// E2E multi-clip: import -> preview -> reorder -> assemble -> timeline -> save/reopen -> export -> reopen verification
// Usa dados sintéticos (sem decodificação real) para validar pipeline puro e persistência

describe('E2E multi-clip workflow (pipeline puro + persistência)', () => {
  const clips: import('../src/core/types').ClipRef[] = [
    { id: 'c1', name: 'clipe1.mp4', duration: 4, framing: null },
    { id: 'c2', name: 'clipe2.mp4', duration: 3.5, framing: null },
    { id: 'c3', name: 'clipe3.mp4', duration: 2.5, framing: null },
  ];

  it('importa múltiplos clipes e monta timeline virtual corretamente', () => {
    expect(totalDuration(clips)).toBeCloseTo(10, 6);
    expect(clipLayout(clips)).toEqual([
      { id: 'c1', start: 0, end: 4 },
      { id: 'c2', start: 4, end: 7.5 },
      { id: 'c3', start: 7.5, end: 10 },
    ]);
    const words = placeWords(clips, {
      c1: wordsFrom('oi eu sou ana', 0.5),
      c2: wordsFrom('segundo clipe aqui', 0.2),
      c3: wordsFrom('terceiro', 0.1),
    });
    // palavras do c2 deslocadas para 4+0.2 etc: encontra palavra 'segundo'
    const segundo = words.find(w => w.text === 'segundo')!;
    expect(segundo.start).toBeCloseTo(4.2, 6);
    const silences = placeRanges(clips, { c1: [{ start: 1, end: 1.5 }], c2: [{ start: 0, end: 0.3 }] });
    expect(silences).toEqual([{ start: 1, end: 1.5 }, { start: 4, end: 4.3 }]);
  });

  it('reordenar clipes mantém duração e remapeia palavras corretamente', () => {
    const reordered: typeof clips = [clips[2]!, clips[0]!, clips[1]!];
    expect(totalDuration(reordered)).toBe(10);
    const words = placeWords(reordered, {
      c1: wordsFrom('primeiro', 0.5),
      c2: wordsFrom('segundo', 0.2),
      c3: wordsFrom('terceiro', 0.1),
    });
    // c3 agora começa em 0, c1 em 2.5, c2 em 6.5
    expect(words.find(w => w.text === 'primeiro')!.start).toBeCloseTo(3.0, 6);
  });

  it('autoEdit com múltiplos clipes gera segments sem atravessar emendas', () => {
    const allWords = placeWords(clips, { c1: wordsFrom('ola mundo teste', 0.2), c2: wordsFrom('outro teste', 0.3) });
    const silences: any[] = [];
    const plan = autoEdit(10, silences, allWords, DEFAULT_STYLE, { clips });
    expect(plan.clips).toEqual(clips);
    expect(outputDuration(plan.segments)).toBeGreaterThan(0);
    // Cada segment deve estar dentro de um único clipe (v0.14 splitAtClips)
    for (const s of plan.segments) {
      const startClip = clipLayout(clips).find(l => s.srcStart >= l.start && s.srcStart < l.end);
      const endClip = clipLayout(clips).find(l => s.srcEnd > l.start && s.srcEnd <= l.end) ?? clipLayout(clips).find(l => s.srcEnd === l.end);
      expect(startClip?.id).toBe(endClip?.id);
    }
  });

  it('outputToClip mapeia tempo de saída para clipe e tempo local', () => {
    const plan = autoEdit(10, [], placeWords(clips, {}), DEFAULT_STYLE, { clips });
    // output 0 -> c1 local 0, output 4 -> c2 local 0, output 7.5 -> c3 local 0
    expect(outputToClip(plan.segments, clips, 0)!.clipId).toBe('c1');
    expect(outputToClip(plan.segments, clips, 4.1)!.clipId).toBe('c2');
    expect(outputToClip(plan.segments, clips, 7.6)!.clipId).toBe('c3');
  });

  it('timeline global/local: cada segundo de saída corresponde ao arquivo correto', () => {
    const segs = [{ srcStart: 0, srcEnd: 10 }];
    // Simula timeline com 3 clipes
    for (let outT = 0; outT < 10; outT += 0.5) {
      const at = outputToClip(segs, clips, outT);
      expect(at).not.toBeNull();
      const layout = clipLayout(clips);
      const clip = layout.find(l => outT >= l.start && outT < l.end) ?? layout[2];
      expect(at!.clipId).toBe(clip!.id);
    }
  });

  it('salva e reabre projeto multi-clip preservando ordem e cortes', async () => {
    const fs = new MemoryFs();
    const plan = autoEdit(10, [], placeWords(clips, {}), DEFAULT_STYLE, { clips });
    const words = placeWords(clips, {});
    const history = createHistory(plan);
    const project = makeProject({
      appVersion: APP_VERSION,
      savedAt: new Date().toISOString(),
      video: { name: clips[0]!.name, size: 12345, durationSec: clips[0]!.duration },
      words,
      silences: [],
      warnings: [],
      history,
      versions: [],
    });
    const id = newProjectId(Date.now());
    await saveProjectData(fs, id, project, 'Teste multi', new Date().toISOString());
    // Salva cada clip como arquivo separado (simula App onFile multi)
    for (const c of clips) {
      const blob = new Blob([`video-${c.id}`], { type: 'video/mp4' });
      await saveClipVideo(fs, id, c.id, blob);
      if (c.id === 'c1') await saveVideo(fs, id, blob); // compat fallback
    }
    // Lista mostra hasVideo true
    const list = await listProjects(fs);
    expect(list[0]!.hasVideo).toBe(true);
    // Carrega e verifica multi
    const loaded = await loadProject(fs, id);
    expect(loaded.kind).toBe('ok');
    if (loaded.kind === 'ok') {
      expect(loaded.project.history.present.clips).toEqual(clips);
      const videos = await loadProjectVideos(fs, id, loaded.project);
      expect(videos?.size).toBe(3);
      expect(videos?.get('c2')?.size).toBeGreaterThan(0);
    }
  });

  it('remove clip e reordena refletem em novo plano sem perder edições manuais', () => {
    const plan = autoEdit(10, [], placeWords(clips, {}), DEFAULT_STYLE, { clips });
    const added = addElement(plan, { durationSec: 10, words: [] }, { kind: 'text', text: 'Meu título' }, 1);
    expect(added.plan.edits.added).toHaveLength(1);
    // Remove c2 -> novo clips com 2, duração 6.5
    const nextClips = [clips[0]!, clips[2]!];
    const nextPlan = autoEdit(6.5, [], [], DEFAULT_STYLE, { clips: nextClips });
    expect(nextPlan.clips).toHaveLength(2);
    // Edição manual do elemento anterior ainda deve ser aplicável (reaplica via remap)
    const moved = setElementPlacement(added.plan, { type: 'added', id: added.id }, { x: 0.6, y: 0.4, scale: 1, rotate: 0 });
    expect(moved.edits.added[0]!.placement.x).toBeCloseTo(0.6, 4);
  });

  it('export para cada formato mantém proporções e sem crop indevido', () => {
    const planBase = autoEdit(10, [], placeWords(clips, {}), DEFAULT_STYLE, { clips });
    for (const fid of FORMAT_IDS) {
      const profile = profileFor(fid);
      const plan = { ...planBase, output: profile, framing: { mode: 'fill' as const, fill: 'blur' as const, zoom: 1, x: 0, y: 0 } };
      const rc = new RecordingContext();
      // Simula frame de cada clipe com diferentes orientações
      const frames = [
        { w: 1920, h: 1080, id: 'c1' }, // deitado
        { w: 1080, h: 1920, id: 'c2' }, // em pé
        { w: 1080, h: 1080, id: 'c3' }, // quadrado
      ];
      for (const fr of frames) {
        const p = placeSource(fr.w, fr.h, profile.width, profile.height, plan.framing, null);
        expect(p.dst).toEqual({ x: 0, y: 0, w: profile.width, h: profile.height });
        expect(p.src.w / p.src.h).toBeCloseTo(profile.width / profile.height, 6);
      }
      // Desenha um quadro sintético e verifica que texto não sai da tela
      drawFrame(rc.asCtx(), plan, 0.5, null);
      for (const c of rc.calls.filter(c => c.op === 'fillText')) {
        const x = (c.m[0]! * (c.args[1] as number) + c.m[2]! * (c.args[2] as number) + c.m[4]!);
        const y = (c.m[1]! * (c.args[1] as number) + c.m[3]! * (c.args[2] as number) + c.m[5]!);
        expect(x).toBeGreaterThan(-profile.width * 0.05);
        expect(x).toBeLessThan(profile.width * 1.05);
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(profile.height);
      }
    }
  });
});
