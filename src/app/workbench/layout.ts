export interface WorkbenchLayout {
  version: 1;
  libraryPx: number;
  inspectorPx: number;
  timelineRatio: number;
  libraryCollapsed: boolean;
  inspectorCollapsed: boolean;
}

export type ResizePane = 'library' | 'inspector' | 'timeline';
export const LAYOUT_KEY = 'm4f.workbench-layout.v1';
export const DEFAULT_LAYOUT: WorkbenchLayout = { version: 1, libraryPx: 320, inspectorPx: 300, timelineRatio: 0.38, libraryCollapsed: false, inspectorCollapsed: false };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function parseWorkbenchLayout(raw: string | null): WorkbenchLayout {
  try {
    const input: unknown = raw ? JSON.parse(raw) : null;
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { ...DEFAULT_LAYOUT };
    const candidate = input as WorkbenchLayout;
    if (candidate.version !== 1 || ![candidate.libraryPx, candidate.inspectorPx, candidate.timelineRatio].every(value => typeof value === 'number' && Number.isFinite(value)) || typeof candidate.libraryCollapsed !== 'boolean' || typeof candidate.inspectorCollapsed !== 'boolean') return { ...DEFAULT_LAYOUT };
    return { version: 1, libraryPx: clamp(candidate.libraryPx, 220, 480), inspectorPx: clamp(candidate.inspectorPx, 240, 420), timelineRatio: clamp(candidate.timelineRatio, 0.22, 0.65), libraryCollapsed: candidate.libraryCollapsed, inspectorCollapsed: candidate.inspectorCollapsed };
  } catch {
    return { ...DEFAULT_LAYOUT };
  }
}

export function clampWorkbenchLayout(layout: WorkbenchLayout, width: number, height: number): WorkbenchLayout {
  const safe = parseWorkbenchLayout(JSON.stringify(layout));
  const compact = width < 1280;
  const available = Math.max(220, width - 64 - 16 - 320);
  let library = safe.libraryCollapsed ? 0 : clamp(safe.libraryPx, 220, 480);
  let inspector = safe.inspectorCollapsed || compact ? 0 : clamp(safe.inspectorPx, 240, 420);
  if (library + inspector > available) {
    const excess = library + inspector - available;
    library = Math.max(library ? 220 : 0, library - excess / 2);
    inspector = Math.max(inspector ? 240 : 0, inspector - excess / 2);
    if (library + inspector > available) library = Math.max(0, available - inspector);
  }
  const maxRatio = height < 600 ? 0.5 : 0.65;
  return { ...safe, libraryPx: library || safe.libraryPx, inspectorPx: inspector || safe.inspectorPx, timelineRatio: clamp(safe.timelineRatio, 0.22, maxRatio) };
}

export function resizeWorkbench(layout: WorkbenchLayout, pane: ResizePane, delta: number, width: number, height: number): WorkbenchLayout {
  if (!Number.isFinite(delta)) return layout;
  const changed = pane === 'timeline'
    ? { ...layout, timelineRatio: layout.timelineRatio + delta / Math.max(240, height - 94) }
    : { ...layout, [pane === 'library' ? 'libraryPx' : 'inspectorPx']: layout[pane === 'library' ? 'libraryPx' : 'inspectorPx'] + delta };
  return clampWorkbenchLayout(changed, width, height);
}
