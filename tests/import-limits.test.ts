import { describe, expect, it } from 'vitest';
import { IMPORT_LIMITS, checkImportBatch, formatClock, importLimitsText, importProblemText } from '../src/core/import-limits';
import { MAX_CLIPS } from '../src/core/schema';
import { EDITOR_MAX_SEC } from '../src/media/input';

const many = (n: number, sec: number) => Array.from({ length: n }, (_, i) => ({ name: `v${i + 1}.mp4`, durationSec: sec }));

describe('limites de importação (#154)', () => {
  it('uma fonte só para todas as telas', () => {
    expect(MAX_CLIPS).toBe(IMPORT_LIMITS.maxFiles);
    expect(EDITOR_MAX_SEC).toBe(IMPORT_LIMITS.maxClipSec);
    expect(importLimitsText()).toBe('até 30 vídeos, 3 min cada, 10 min somados');
  });

  it('29, 30 e 31 arquivos', () => {
    expect(checkImportBatch(many(29, 10)).ok).toBe(true);
    expect(checkImportBatch(many(30, 10)).ok).toBe(true);
    const c = checkImportBatch(many(31, 10));
    expect(c.ok).toBe(false);
    expect(c.accepted).toHaveLength(30);
    expect(c.problems).toEqual([{ index: 30, name: 'v31.mp4', kind: 'excess-file', durationSec: 10 }]);
  });

  it('9:59, 10:00 e 10:01 somados', () => {
    expect(checkImportBatch([...many(3, 180), { name: 'a', durationSec: 59 }]).ok).toBe(true); // 9:59
    expect(checkImportBatch([...many(3, 180), { name: 'a', durationSec: 60 }]).ok).toBe(true); // 10:00
    expect(checkImportBatch([...many(3, 180), { name: 'a', durationSec: 60.3 }]).ok).toBe(true); // arredondamento
    const over = checkImportBatch([...many(3, 180), { name: 'a', durationSec: 61 }]); // 10:01
    expect(over.ok).toBe(false);
    expect(over.problems[0]).toMatchObject({ name: 'a', kind: 'over-total' });
    expect(over.accepted).toEqual([0, 1, 2]);
    expect(formatClock(over.totalSec)).toBe('9:00');
    expect(formatClock(over.remainingSec)).toBe('1:00');
  });

  it('cada vídeo até 3:00, com folga de arredondamento', () => {
    expect(checkImportBatch([{ name: 'x', durationSec: 180.2 }]).ok).toBe(true);
    const c = checkImportBatch([{ name: 'x', durationSec: 181 }]);
    expect(c.problems[0]!.kind).toBe('clip-too-long');
    expect(importProblemText(c.problems[0]!)).toContain('M4F-104');
  });

  it('arquivo ilegível tem motivo próprio e não conta no total', () => {
    const c = checkImportBatch([{ name: 'ruim', durationSec: null }, { name: 'bom', durationSec: 30 }]);
    expect(c.problems).toEqual([{ index: 0, name: 'ruim', kind: 'unreadable', durationSec: null }]);
    expect(c.accepted).toEqual([1]);
    expect(c.totalSec).toBe(30);
  });

  it('adicionar clipes conta o que já está no projeto', () => {
    const c = checkImportBatch(many(2, 100), { count: 29, durationSec: 450 });
    expect(c.accepted).toEqual([0]);
    expect(c.problems[0]!.kind).toBe('excess-file');
    const d = checkImportBatch(many(1, 160), { count: 2, durationSec: 450 });
    expect(d.problems[0]!.kind).toBe('over-total');
  });

  it('os motivos são distintos', () => {
    const texts = (['excess-file', 'clip-too-long', 'over-total', 'unreadable'] as const).map((kind) => importProblemText({ index: 0, name: 'n', kind, durationSec: 200 }));
    expect(new Set(texts).size).toBe(4);
    expect(texts.map((t) => t.match(/M4F-\d+/)![0])).toEqual(['M4F-106', 'M4F-104', 'M4F-107', 'M4F-105']);
  });
});
