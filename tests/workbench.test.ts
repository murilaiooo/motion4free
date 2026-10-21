import { describe, expect, it } from 'vitest';
import { clampWorkbenchLayout, DEFAULT_LAYOUT, parseWorkbenchLayout, resizeWorkbench } from '../src/app/workbench/layout';

describe('workspace geometry and persisted UI state', () => {
  it('recovers corrupted, unsupported and non-finite preferences', () => {
    for (const raw of [null, '{broken', 'null', '[]', '{"version":9}', '{"version":1,"libraryPx":null}']) {
      expect(parseWorkbenchLayout(raw)).toEqual(DEFAULT_LAYOUT);
    }
  });

  it('keeps the preview usable at desktop and compact widths', () => {
    for (const width of [1024, 1366, 1920]) {
      const layout = clampWorkbenchLayout({ ...DEFAULT_LAYOUT, libraryPx: 9999, inspectorPx: 9999, timelineRatio: 2 }, width, 768);
      const inspector = width < 1280 ? 0 : layout.inspectorPx;
      expect(width - 64 - 16 - layout.libraryPx - inspector).toBeGreaterThanOrEqual(320);
      expect(layout.timelineRatio).toBeLessThanOrEqual(0.65);
      expect(layout.timelineRatio).toBeGreaterThanOrEqual(0.22);
    }
  });

  it('clamps pointer drag and keyboard input instead of hiding panes', () => {
    const left = resizeWorkbench(DEFAULT_LAYOUT, 'library', -5000, 1366, 768);
    expect(left.libraryPx).toBe(220);
    const bottom = resizeWorkbench(DEFAULT_LAYOUT, 'timeline', 9999, 1366, 768);
    expect(bottom.timelineRatio).toBe(0.65);
    expect(DEFAULT_LAYOUT.libraryPx).toBe(320);
  });

  it('roundtrips collapse settings independently from the audiovisual plan', () => {
    const layout = { ...DEFAULT_LAYOUT, libraryCollapsed: true, inspectorCollapsed: true, timelineRatio: 0.5 };
    expect(parseWorkbenchLayout(JSON.stringify(layout))).toEqual(layout);
  });
});
