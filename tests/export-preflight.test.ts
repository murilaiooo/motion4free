import { describe, expect, it } from 'vitest';
import { autoEdit } from '../src/editorial/auto-edit';
import { buildExportPreflight } from '../src/editorial/export-preflight';

describe('export preflight', () => {
  const plan = autoEdit(6, [], []);
  it('reports the frame budget and source requirements before rendering', () => {
    const result = buildExportPreflight(plan, new Set(['c1']), true);
    expect(result.frames).toBe(180);
    expect(result.durationSec).toBe(6);
    expect(result.sourceIds).toEqual(['c1']);
  });
  it('refuses a missing source instead of exporting black frames', () => {
    expect(() => buildExportPreflight(plan, new Set(), true)).toThrow('M4F-405');
  });
  it('rejects an invalid persisted plan and reports absent audio explicitly', () => {
    expect(() => buildExportPreflight({ ...plan, segments: [] }, new Set(['c1']), true)).toThrow('M4F-1016');
    expect(buildExportPreflight(plan, new Set(['c1']), false).warnings).toContain('O arquivo será exportado sem áudio.');
  });
  it('does not require an unused source retained in project history', () => {
    const multi = { ...plan, clips: [...plan.clips, { id: 'c2', name: 'unused', duration: 2, framing: null }] };
    expect(buildExportPreflight(multi, new Set(['c1']), true).sourceIds).toEqual(['c1']);
  });
});
