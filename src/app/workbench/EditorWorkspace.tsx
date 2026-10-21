import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Columns3, PanelLeftClose, PanelRightClose, RotateCcw } from 'lucide-react';
import { clampWorkbenchLayout, DEFAULT_LAYOUT, LAYOUT_KEY, parseWorkbenchLayout, resizeWorkbench, type ResizePane, type WorkbenchLayout } from './layout';
import './workbench.css';

interface WorkspaceContext {
  layout: WorkbenchLayout;
  setLayout: (layout: WorkbenchLayout) => void;
  message: string;
}
const Workspace = createContext<WorkspaceContext | null>(null);

function initialLayout(): WorkbenchLayout {
  try { return parseWorkbenchLayout(localStorage.getItem(LAYOUT_KEY)); } catch { return { ...DEFAULT_LAYOUT }; }
}

export function WorkspaceControls() {
  const workspace = useContext(Workspace);
  if (!workspace) return null;
  const { layout, setLayout, message } = workspace;
  return <details className="wb-menu"><summary className="btn ghost icon" aria-label="Layout da mesa" data-testid="workspace-menu"><Columns3 size={17} aria-hidden /></summary><div className="wb-menu-body">
    <p className="eyebrow">ÁREA DE TRABALHO</p>
    <button className="ghost sm" aria-pressed={!layout.libraryCollapsed} onClick={() => setLayout({ ...layout, libraryCollapsed: !layout.libraryCollapsed })}><PanelLeftClose size={15} aria-hidden /> {layout.libraryCollapsed ? 'Mostrar biblioteca' : 'Recolher biblioteca'}</button>
    <button className="ghost sm" aria-pressed={!layout.inspectorCollapsed} onClick={() => setLayout({ ...layout, inspectorCollapsed: !layout.inspectorCollapsed })}><PanelRightClose size={15} aria-hidden /> {layout.inspectorCollapsed ? 'Mostrar propriedades' : 'Recolher propriedades'}</button>
    <button className="ghost sm" onClick={() => setLayout({ ...DEFAULT_LAYOUT })}><RotateCcw size={15} aria-hidden /> Restaurar layout</button>
    <p className="hint">Arraste as divisórias ou use as setas do teclado. Duplo clique restaura o painel.</p>{message && <p className="hint" role="status">{message}</p>}
  </div></details>;
}

export function EditorWorkspace({ children, inspectionKey }: { children: ReactNode; inspectionKey: string }) {
  const [stored, setStored] = useState(initialLayout);
  const [size, setSize] = useState({ width: typeof innerWidth === 'number' ? innerWidth : 1366, height: typeof innerHeight === 'number' ? innerHeight : 768 });
  const [message, setMessage] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const layout = clampWorkbenchLayout(stored, size.width, size.height);
  const latest = useRef(layout);
  latest.current = layout;
  const drag = useRef<{ pane: ResizePane; origin: number; before: WorkbenchLayout; pointerId: number; target: HTMLDivElement } | null>(null);
  const commit = (next: WorkbenchLayout) => {
    const safe = clampWorkbenchLayout(next, size.width, size.height);
    setStored(safe);
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(safe)); setMessage(''); } catch { setMessage('M4F-619 · O layout vale nesta visita; não foi possível guardá-lo.'); }
  };
  useEffect(() => {
    if (!root.current) return;
    const observer = new ResizeObserver(entries => { const rect = entries[0]?.contentRect; if (rect) setSize({ width: rect.width, height: rect.height }); });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (inspectionKey) setStored(current => ({ ...current, inspectorCollapsed: false }));
  }, [inspectionKey]);
  const cancel = () => {
    const gesture = drag.current;
    if (!gesture) return;
    drag.current = null;
    setStored(gesture.before);
    if (gesture.target.hasPointerCapture(gesture.pointerId)) gesture.target.releasePointerCapture(gesture.pointerId);
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopImmediatePropagation(); cancel(); }
    };
    window.addEventListener('keydown', escape, true);
    window.addEventListener('blur', cancel);
    return () => { window.removeEventListener('keydown', escape, true); window.removeEventListener('blur', cancel); };
  }, []);
  const start = (pane: ResizePane, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    drag.current = { pane, origin: pane === 'timeline' ? event.clientY : event.clientX, before: layout, pointerId: event.pointerId, target: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = drag.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const coordinate = gesture.pane === 'timeline' ? event.clientY : event.clientX;
    const sign = gesture.pane === 'library' ? 1 : -1;
    setStored(resizeWorkbench(gesture.before, gesture.pane, sign * (coordinate - gesture.origin), size.width, size.height));
  };
  const finish = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    commit(latest.current);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const separator = (pane: ResizePane, label: string) => {
    const vertical = pane !== 'timeline';
    const value = pane === 'library' ? layout.libraryPx : pane === 'inspector' ? layout.inspectorPx : Math.round(layout.timelineRatio * 100);
    const min = pane === 'library' ? 220 : pane === 'inspector' ? 240 : 22;
    const max = pane === 'library' ? 480 : pane === 'inspector' ? 420 : 65;
    return <div key={pane} className={`wb-divider wb-${pane}`} role="separator" aria-label={label} aria-orientation={vertical ? 'vertical' : 'horizontal'} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} aria-valuetext={vertical ? `${value} pixels` : `${value}% da altura`} tabIndex={0}
      onPointerDown={event => start(pane, event)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onDoubleClick={() => commit({ ...layout, [pane === 'timeline' ? 'timelineRatio' : pane === 'library' ? 'libraryPx' : 'inspectorPx']: DEFAULT_LAYOUT[pane === 'timeline' ? 'timelineRatio' : pane === 'library' ? 'libraryPx' : 'inspectorPx'] })}
      onKeyDown={event => {
        const backward = pane === 'library' ? 'ArrowLeft' : pane === 'inspector' ? 'ArrowRight' : 'ArrowDown';
        const forward = pane === 'library' ? 'ArrowRight' : pane === 'inspector' ? 'ArrowLeft' : 'ArrowUp';
        if (![backward, forward, 'Home', 'End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const amount = event.key === 'Home' ? -100000 : event.key === 'End' ? 100000 : (event.key === forward ? 1 : -1) * (event.shiftKey ? 32 : 16);
        commit(resizeWorkbench(layout, pane, amount, size.width, size.height));
      }} />;
  };
  const style = { '--panel-w': `${layout.libraryCollapsed ? 0 : layout.libraryPx}px`, '--insp-w': `${layout.inspectorCollapsed ? 0 : layout.inspectorPx}px`, '--timeline-h': `${Math.round(Math.max(240, size.height - 94) * layout.timelineRatio)}px` } as CSSProperties;
  return <Workspace.Provider value={{ layout, setLayout: commit, message }}><div ref={root} className={`ws workbench ${layout.libraryCollapsed ? 'wb-library-hidden' : ''} ${layout.inspectorCollapsed ? 'wb-inspector-hidden' : ''}`} style={style}
    onKeyDownCapture={event => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); } }}
    onClickCapture={event => {
      const target = event.target as HTMLElement;
      if (layout.libraryCollapsed && target.closest('.rail-tab')) commit({ ...layout, libraryCollapsed: false });
    }}>
    {children}
    {separator('library', 'Largura da biblioteca')}{separator('inspector', 'Largura das propriedades')}{separator('timeline', 'Altura da linha do tempo')}
    <button className="wb-drawer-close icon ghost" aria-label="Fechar propriedades" onClick={() => commit({ ...layout, inspectorCollapsed: true })}>×</button>
  </div></Workspace.Provider>;
}
