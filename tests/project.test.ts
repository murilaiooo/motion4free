import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { createHistory, pushHistory } from '../src/engine/history';
import { editCaptionText } from '../src/editorial/ops';
import { makeProject, parseProject, restoreHistory, sameVideo } from '../src/core/project';

const words = [{ id: 'w1', text: 'Olá.', start: 0.1, end: 0.5 }];
const plan = autoEdit(3, [], words);
const history = pushHistory(createHistory(plan), editCaptionText(plan, 'c1', 'Oi!'));
const video = { name: 'fala.webm', size: 1234, durationSec: 3 };

function roundTrip(x: unknown): unknown {
  return JSON.parse(JSON.stringify(x));
}

describe('projeto salvo', () => {
  it('ida e volta em JSON preserva plano, histórico e palavras', () => {
    const p = makeProject({ video, words, silences: [{ start: 1, end: 2 }], warnings: [], history, appVersion: '0.2.0', savedAt: '2026-10-20T10:00:00Z' });
    const r = parseProject(roundTrip(p));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.project.words).toEqual(words);
    const h = restoreHistory(r.project);
    expect(h.present.captions[0]!.text).toBe('Oi!');
    expect(h.past).toHaveLength(1);
    expect(h.future).toHaveLength(0);
  });

  it('rejeita projeto com plano inválido', () => {
    const p = roundTrip(makeProject({ video, words, silences: [], warnings: [], history, appVersion: '0.2.0', savedAt: 'x' })) as { history: { present: { segments: unknown[] } } };
    p.history.present.segments = [];
    const r = parseProject(p);
    expect(r.ok).toBe(false);
  });

  it('rejeita lixo e formato desconhecido', () => {
    expect(parseProject('oi').ok).toBe(false);
    expect(parseProject({ format: 99 }).ok).toBe(false);
  });

  it('aviso com código desconhecido é recusado', () => {
    const p = roundTrip(makeProject({ video, words, silences: [], warnings: [], history, appVersion: '0.2.0', savedAt: 'x' })) as Record<string, unknown>;
    p.warnings = [{ key: 'EVAL', detail: '' }];
    expect(parseProject(p).ok).toBe(false);
  });

  it('confere se o vídeo escolhido de novo é o mesmo (tamanho e duração)', () => {
    expect(sameVideo(video, { size: 1234, durationSec: 3.01 })).toBe(true);
    expect(sameVideo(video, { size: 999, durationSec: 3 })).toBe(false);
    expect(sameVideo(video, { size: 1234, durationSec: 5 })).toBe(false);
  });
});

describe('projeto salvo na Fase 2 (plano v1)', () => {
  it('abre com os planos migrados para v4, histórico inteiro', () => {
    const v1 = {
      version: 1,
      output: { width: 1080, height: 1920, fps: 30 },
      segments: [{ srcStart: 0, srcEnd: 3 }],
      captions: [{ id: 'c1', text: 'Oi!', start: 0, end: 0.4, wordIds: ['w1'] }],
      scenes: [{ id: 's1', kind: 'kinetic-title', text: 'Olá', start: 0, end: 2.2 }],
    };
    const saved = {
      format: 1,
      savedAt: '2026-10-20T10:00:00Z',
      appVersion: '0.2.0',
      video,
      words,
      silences: [],
      warnings: [],
      history: { past: [{ ...v1, captions: [{ ...v1.captions[0], text: 'Olá.' }] }], present: v1, future: [] },
    };
    const r = parseProject(roundTrip(saved));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const h = restoreHistory(r.project);
    expect(h.present.version).toBe(4);
    expect(h.present.brief.prompt).toBe('');
    expect(h.present.style.id).toBe('pop');
    expect(h.present.captions[0]!.text).toBe('Oi!');
    expect(h.past[0]!.version).toBe(4);
    expect(h.past[0]!.captions[0]!.text).toBe('Olá.');
  });
});

describe('projeto salvo na Fase 3 (plano v2)', () => {
  it('abre com pedido vazio e o estilo escolhido', () => {
    const current = roundTrip(makeProject({ video, words, silences: [], warnings: [], history, appVersion: '0.3.0', savedAt: 'x' })) as { history: { present: Record<string, unknown>; past: Record<string, unknown>[] } };
    for (const p of [current.history.present, ...current.history.past]) {
      delete p.brief;
      p.version = 2;
    }
    const r = parseProject(current);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const h = restoreHistory(r.project);
    expect(h.present.version).toBe(4);
    expect(h.present.brief.forbid).toEqual([]);
    expect(h.present.captions[0]!.text).toBe('Oi!');
    expect(h.past[0]!.version).toBe(4);
  });
});
