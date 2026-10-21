import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Captions, ClipboardPaste, Copy, CopyPlus, Film, Layers, Magnet, Scissors, SquareDashedMousePointer, SquareSplitHorizontal, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import type { EditPlan, TimeRange } from '../core/types';
import { clipAt } from '../engine/clips';
import { outputDuration, outputToSource } from '../engine/timeline';
import { listElements, resolvePlan, sameRef, type ElementRef } from '../editorial/elements';
import { segmentZoom } from '../editorial/manual';
import { segmentOffsets } from '../editorial/sequence';

/** Ações da barra da linha do tempo (o Editor aplica e guarda no desfazer). */
export interface TimelineActions {
  split: () => void;
  copy: () => void;
  cut: () => void;
  paste: () => void;
  duplicate: () => void;
  remove: () => void;
  canPaste: boolean;
}

interface Props {
  plan: EditPlan;
  /** duração do original (os picos do áudio cobrem o original inteiro) */
  durationSec: number;
  peaks: Float32Array | null;
  time: number;
  playing: boolean;
  cuts: TimeRange[];
  selectedSeg: number | null;
  selectedEl: ElementRef | null;
  onSeek: (outTime: number) => void;
  onSelectSeg: (index: number | null) => void;
  onSelectEl: (ref: ElementRef | null) => void;
  onSelectCut: (index: number) => void;
  onTrim: (index: number, edge: 'start' | 'end', src: number) => void;
  onMoveSeg: (from: number, to: number) => void;
  onRetime: (ref: ElementRef, out: TimeRange) => void;
  selection: TimeRange | null;
  selectedRange: string | null;
  onSelection: (out: TimeRange) => void;
  onPickRange: (id: string) => void;
  actions: TimelineActions;
  /** botões Edição | Original */
  viewSwitch: ReactNode;
  disabled: boolean;
}

const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
const SNAP_PX = 8;
const DRAG_PX = 4;
const MAX_ROWS = 3;

function clock(s: number, step: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const ss = step < 1 ? sec.toFixed(1).padStart(4, '0') : String(Math.round(sec)).padStart(2, '0');
  return `${m}:${ss}`;
}
const secs = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;

type Drag =
  | { kind: 'scrub' }
  | { kind: 'seg-move'; index: number; x0: number; moved: boolean; t: number; dx: number }
  | { kind: 'seg-trim'; index: number; edge: 'start' | 'end'; x0: number; delta: number }
  | { kind: 'el'; mode: 'move' | 'start' | 'end'; ref: ElementRef; start: number; end: number; x0: number; delta: number; moved: boolean }
  | { kind: 'range'; from: number; to: number; x0: number };

/**
 * Linha do tempo de edição (v0.17, ADR-0020), no tempo do vídeo final, como num editor profissional:
 * pedaços do vídeo em blocos (clique seleciona, arraste muda a ordem, as pontas aparam), elementos
 * e legendas em faixas próprias (arraste move, as pontas mudam quando aparecem), ímã nas emendas e
 * na agulha, e a faixa Trechos para pedir mudança só num pedaço. Nada é aplicado durante o arraste:
 * só ao soltar, numa entrada do desfazer.
 */
export function EditTimeline(props: Props) {
  // os callbacks mais recentes (o arraste começa num render e termina em outro)
  const live = useRef(props);
  live.current = props;
  const { plan, durationSec, peaks, time, playing, cuts, selectedSeg, selectedEl, onSeek, onSelectSeg, onSelectEl, onSelectCut, actions, disabled } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [viewW, setViewW] = useState(800);
  const [snapOn, setSnapOn] = useState(true);
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = (d: Drag | null) => {
    dragRef.current = d;
    setDragState(d);
  };
  const zoom = ZOOMS[zoomIdx]!;
  const total = Math.max(0.001, outputDuration(plan.segments));
  const offsets = useMemo(() => segmentOffsets(plan.segments), [plan.segments]);
  const pxPerSec = (viewW * zoom) / total;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // com zoom, acompanha a agulha enquanto toca
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1 || !playing) return;
    const x = (time / total) * el.scrollWidth;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = x - el.clientWidth * 0.2;
  }, [time, playing, zoom, total]);

  // forma de onda no tempo do vídeo final (cada coluna lê o áudio do instante do original que aparece ali)
  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas || !peaks || peaks.length === 0) return;
    const cols = Math.max(200, Math.min(4000, Math.round(viewW * zoom)));
    canvas.width = cols;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, cols, 64);
    g.fillStyle = getComputedStyle(canvas).color;
    for (let x = 0; x < cols; x++) {
      const src = outputToSource(plan.segments, ((x + 0.5) / cols) * total);
      if (src === null) continue;
      const p = peaks[Math.min(peaks.length - 1, Math.max(0, Math.floor((src / Math.max(0.001, durationSec)) * peaks.length)))] ?? 0;
      const h = Math.max(1, p * 64);
      g.fillRect(x, (64 - h) / 2, 1, h);
    }
  }, [peaks, plan.segments, total, durationSec, viewW, zoom]);

  function setZoom(next: number) {
    const el = scrollRef.current;
    const idx = Math.max(0, Math.min(ZOOMS.length - 1, next));
    if (!el) return setZoomIdx(idx);
    const ratio = time / total;
    const before = ratio * el.scrollWidth - el.scrollLeft;
    setZoomIdx(idx);
    requestAnimationFrame(() => {
      el.scrollLeft = ratio * el.scrollWidth - before;
    });
  }

  const tAt = (clientX: number) => {
    const r = lanesRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return 0;
    return Math.min(total, Math.max(0, ((clientX - r.left) / r.width) * total));
  };
  const pxToSec = (px: number) => px / Math.max(1e-6, (lanesRef.current?.getBoundingClientRect().width ?? viewW * zoom) / total);
  /** Ímã: encosta na emenda, no começo/fim do vídeo ou na agulha quando chega perto. */
  const snap = (t: number): number => {
    if (!snapOn) return t;
    const tol = pxToSec(SNAP_PX);
    let best = t;
    let dist = tol;
    for (const p of [...offsets, total, time]) {
      if (Math.abs(p - t) < dist) {
        dist = Math.abs(p - t);
        best = p;
      }
    }
    return best;
  };

  // arraste: segue o ponteiro na janela inteira e só aplica ao soltar
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === 'scrub') return onSeek(tAt(e.clientX));
      if (d.kind === 'range') return setDrag({ ...d, to: tAt(e.clientX) });
      if (d.kind === 'seg-move') {
        const moved = d.moved || Math.abs(e.clientX - d.x0) > DRAG_PX;
        return setDrag({ ...d, moved, t: tAt(e.clientX), dx: e.clientX - d.x0 });
      }
      if (d.kind === 'seg-trim') {
        const s = plan.segments[d.index]!;
        const raw = pxToSec(e.clientX - d.x0);
        // a ponta encosta no ímã (tempo do vídeo final)
        const edgeOut = d.edge === 'end' ? offsets[d.index]! + (s.srcEnd - s.srcStart) + raw : offsets[d.index]! + raw;
        const delta = d.edge === 'end' ? snap(edgeOut) - (offsets[d.index]! + (s.srcEnd - s.srcStart)) : snap(edgeOut) - offsets[d.index]!;
        return setDrag({ ...d, delta });
      }
      const raw = pxToSec(e.clientX - d.x0);
      const moved = d.moved || Math.abs(e.clientX - d.x0) > DRAG_PX;
      let delta = raw;
      if (d.mode === 'move') {
        delta = Math.min(total - d.end, Math.max(-d.start, raw));
        const a = snap(d.start + delta) - d.start;
        const b = snap(d.end + delta) - d.end;
        delta = Math.abs(a - delta) <= Math.abs(b - delta) ? a : b;
      } else if (d.mode === 'start') delta = snap(d.start + raw) - d.start;
      else delta = snap(d.end + raw) - d.end;
      setDrag({ ...d, delta, moved });
    };
    const up = (e: PointerEvent) => {
      const d = dragRef.current;
      setDrag(null);
      if (!d || disabled) return;
      if (d.kind === 'range') {
        if (Math.abs(e.clientX - d.x0) < DRAG_PX) return;
        const a = Math.min(d.from, d.to);
        const b = Math.max(d.from, d.to);
        return live.current.onSelection({ start: Math.round(a * 100) / 100, end: Math.round(b * 100) / 100 });
      }
      if (d.kind === 'seg-move') {
        if (!d.moved) {
          live.current.onSelectSeg(d.index);
          live.current.onSelectEl(null);
          onSeek(tAt(e.clientX));
          return;
        }
        const to = dropIndex(d.index, d.t);
        if (to !== d.index) live.current.onMoveSeg(d.index, to);
        return;
      }
      if (d.kind === 'seg-trim') {
        if (Math.abs(d.delta) < 1e-3) return;
        const s = plan.segments[d.index]!;
        live.current.onTrim(d.index, d.edge, d.edge === 'start' ? s.srcStart + d.delta : s.srcEnd + d.delta);
        return;
      }
      if (d.kind === 'el') {
        if (!d.moved || Math.abs(d.delta) < 1e-3) {
          live.current.onSelectEl(d.ref);
          live.current.onSelectSeg(null);
          if (time < d.start || time >= d.end) onSeek(Math.min(d.end - 0.01, d.start + 0.01));
          return;
        }
        const start = d.mode === 'end' ? d.start : d.start + d.delta;
        const end = d.mode === 'start' ? d.end : d.end + d.delta;
        live.current.onRetime(d.ref, { start, end });
        live.current.onSelectEl(d.ref);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!drag, plan, offsets, total, time, snapOn, disabled]);

  /** Para onde vai o pedaço `from` se for solto no instante `t` (antes do primeiro pedaço cujo meio fica depois de t). */
  function dropIndex(from: number, t: number): number {
    let slot = 0;
    plan.segments.forEach((s, i) => {
      if (offsets[i]! + (s.srcEnd - s.srcStart) / 2 < t) slot = i + 1;
    });
    return slot > from ? slot - 1 : slot;
  }

  // prévia do arraste de ponta: o pedaço muda de tamanho e o resto anda junto
  const lens = plan.segments.map((s, i) => {
    const len = s.srcEnd - s.srcStart;
    if (drag?.kind === 'seg-trim' && drag.index === i) return Math.max(0.1, drag.edge === 'end' ? len + drag.delta : len - drag.delta);
    return len;
  });
  const shownTotal = Math.max(0.001, lens.reduce((a, b) => a + b, 0));
  const scale = drag?.kind === 'seg-trim' ? total / shownTotal : 1;
  const left = (t: number) => `${(100 * t) / total}%`;
  const width = (d: number) => `${(100 * Math.max(0, d)) / total}%`;

  const blocks = (() => {
    let acc = 0;
    return plan.segments.map((s, i) => {
      const start = acc * scale;
      acc += lens[i]!;
      const clip = plan.clips.length > 1 ? clipAt(plan.clips, s.srcStart) : null;
      return { s, i, start, len: lens[i]! * scale, clip };
    });
  })();

  // emendas com corte entre dois pedaços: clicar abre o corte para restaurar ou ajustar
  const joins = plan.segments.slice(1).flatMap((s, k) => {
    const prev = plan.segments[k]!;
    if (Math.abs(prev.srcEnd - s.srcStart) < 1e-3) return [];
    const cut = cuts.findIndex((c) => Math.abs(c.start - prev.srcEnd) < 1e-3);
    return cut >= 0 ? [{ at: offsets[k + 1]!, cut, k: k + 1, len: cuts[cut]!.end - cuts[cut]!.start }] : [];
  });

  const elements = listElements(plan);
  const rows: number[] = [];
  const rowEnds: number[] = [];
  for (const e of elements) {
    let r = rowEnds.findIndex((end) => end <= e.start + 1e-3);
    if (r < 0) r = rowEnds.length < MAX_ROWS ? rowEnds.length : rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[r] = e.end;
    rows.push(r);
  }
  const rowCount = Math.max(1, rowEnds.length);
  const captions = resolvePlan(plan).captions;

  const elRange = (ref: ElementRef, start: number, end: number) => {
    if (drag?.kind !== 'el' || !sameRef(drag.ref, ref)) return { start, end };
    return { start: drag.mode === 'end' ? start : start + drag.delta, end: drag.mode === 'start' ? end : end + drag.delta };
  };

  const startEl = (e: ReactPointerEvent, ref: ElementRef, start: number, end: number, mode: 'move' | 'start' | 'end') => {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setDrag({ kind: 'el', mode, ref, start, end, x0: e.clientX, delta: 0, moved: false });
  };
  const keySelect = (e: ReactKeyboardEvent, f: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      f();
    }
  };

  const step = STEPS.find((s) => s * pxPerSec >= 80) ?? 300;
  const ticks: number[] = [];
  for (let s = 0; s <= total + 1e-6 && ticks.length < 2000; s += step) ticks.push(s);
  const selSpan = drag?.kind === 'range' ? { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) } : props.selection && !props.selectedRange ? props.selection : null;
  // onde o pedaço arrastado vai entrar (linha amarela)
  let slotAt: number | null = null;
  if (drag?.kind === 'seg-move' && drag.moved) {
    const to = dropIndex(drag.index, drag.t);
    const s = plan.segments[to]!;
    slotAt = to <= drag.index ? offsets[to]! : offsets[to]! + (s.srcEnd - s.srcStart);
  }
  const hasSel = selectedSeg !== null || selectedEl !== null;
  const moveDx = drag?.kind === 'seg-move' && drag.moved ? drag.dx : 0;

  return (
    <section className="timeline edit-tl" data-testid="timeline" data-view="edicao" aria-label="Linha do tempo">
      <div className="tl-head">
        <h2 className="tl-title">Linha do tempo</h2>
        {props.viewSwitch}
        <div className="tl-tools" role="toolbar" aria-label="Edição na linha do tempo">
          <button className="sm ghost" onClick={actions.split} disabled={disabled} data-tip="Dividir na agulha (S)" aria-keyshortcuts="S" data-testid="tl-split">
            <SquareSplitHorizontal size={15} aria-hidden /> <span className="tl-tool-label">Dividir</span>
          </button>
          <span className="tl-tools-sep" aria-hidden />
          <button className="sm icon ghost" onClick={actions.copy} disabled={disabled || !hasSel} aria-label="Copiar" data-tip="Copiar (Ctrl+C)" aria-keyshortcuts="Control+C" data-testid="tl-copy">
            <Copy size={15} />
          </button>
          <button className="sm icon ghost" onClick={actions.cut} disabled={disabled || !hasSel} aria-label="Recortar" data-tip="Recortar (Ctrl+X)" aria-keyshortcuts="Control+X" data-testid="tl-cut">
            <Scissors size={15} />
          </button>
          <button className="sm icon ghost" onClick={actions.paste} disabled={disabled || !actions.canPaste} aria-label="Colar na agulha" data-tip="Colar na agulha (Ctrl+V)" aria-keyshortcuts="Control+V" data-testid="tl-paste">
            <ClipboardPaste size={15} />
          </button>
          <button className="sm icon ghost" onClick={actions.duplicate} disabled={disabled || !hasSel} aria-label="Duplicar" data-tip="Duplicar (Ctrl+D)" aria-keyshortcuts="Control+D" data-testid="tl-duplicate">
            <CopyPlus size={15} />
          </button>
          <button className="sm icon ghost" onClick={actions.remove} disabled={disabled || !hasSel} aria-label="Apagar" data-tip="Apagar (Delete)" aria-keyshortcuts="Delete" data-testid="tl-delete">
            <Trash2 size={15} />
          </button>
          <span className="tl-tools-sep" aria-hidden />
          <button className="sm icon ghost" aria-pressed={snapOn} onClick={() => setSnapOn(!snapOn)} aria-label="Ímã: encostar nas emendas e na agulha" data-tip="Ímã (encosta nas emendas)" data-testid="tl-snap">
            <Magnet size={15} />
          </button>
        </div>
        <div className="tl-zoom">
          <button className="sm icon ghost" onClick={() => setZoom(zoomIdx - 1)} disabled={zoomIdx === 0} aria-label="Diminuir zoom da linha do tempo" data-tip="Diminuir zoom">
            <ZoomOut size={16} />
          </button>
          <input type="range" min={0} max={ZOOMS.length - 1} step={1} value={zoomIdx} onChange={(e) => setZoom(e.target.valueAsNumber)} aria-label="Zoom da linha do tempo" />
          <button className="sm icon ghost" onClick={() => setZoom(zoomIdx + 1)} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Aumentar zoom da linha do tempo" data-tip="Aumentar zoom">
            <ZoomIn size={16} />
          </button>
          <span className="hint tnum tl-zoom-label">{zoom}×</span>
        </div>
      </div>
      <div className="tl-body">
        <div className="tl-labels etl-labels" aria-hidden style={{ gridTemplateRows: `22px 60px ${rowCount * 22 + (rowCount - 1) * 2}px 26px 26px` }}>
          <span className="tl-label" />
          <span className="tl-label">
            <Film size={14} /> Vídeo
          </span>
          <span className="tl-label">
            <Layers size={14} /> Elementos
          </span>
          <span className="tl-label">
            <Captions size={14} /> Legendas
          </span>
          <span className="tl-label">
            <SquareDashedMousePointer size={14} /> Trechos
          </span>
        </div>
        <div
          className="tl-scroll"
          ref={scrollRef}
          onWheel={(e) => {
            if (!(e.ctrlKey || e.metaKey)) return;
            e.preventDefault();
            setZoom(zoomIdx + (e.deltaY < 0 ? 1 : -1));
          }}
        >
          <div className="tl-inner" style={{ width: `${zoom * 100}%` }}>
            <div className="tl-lanes etl-lanes" ref={lanesRef} style={{ gridTemplateRows: `22px 60px ${rowCount * 22 + (rowCount - 1) * 2}px 26px 26px` }}>
              <div
                className="tl-ruler"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  setDrag({ kind: 'scrub' });
                  onSeek(tAt(e.clientX));
                }}
                title="Clique ou arraste para ir até um ponto"
                data-testid="ruler"
              >
                {ticks.map((s) => (
                  <span key={s} className="tick" style={{ left: left(s) }}>
                    {clock(s, step)}
                  </span>
                ))}
              </div>

              <div
                className="etl-video"
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  onSelectSeg(null);
                  onSeek(tAt(e.clientX));
                }}
              >
                {peaks && <canvas ref={waveRef} className="wave etl-wave" data-testid="tl-waveform" />}
                {blocks.map(({ s, i, start, len, clip }) => {
                  const z = segmentZoom(plan, i);
                  const moving = drag?.kind === 'seg-move' && drag.moved && drag.index === i;
                  return (
                    <div
                      key={`${i}-${s.srcStart}-${s.srcEnd}`}
                      role="button"
                      tabIndex={0}
                      className={`etl-seg ${selectedSeg === i ? 'selected' : ''} ${moving ? 'moving' : ''} ${clip ? `clip-tint-${clip.index % 6}` : ''}`}
                      style={{ left: left(start), width: width(len), transform: moving ? `translateX(${moveDx}px)` : undefined }}
                      aria-pressed={selectedSeg === i}
                      aria-label={`Pedaço ${i + 1} do vídeo, ${secs(s.srcEnd - s.srcStart)}${clip ? `, clipe ${clip.index + 1}` : ''}`}
                      title={`Pedaço ${i + 1}: ${secs(s.srcEnd - s.srcStart)}. Clique para selecionar, arraste para mudar de lugar, puxe as pontas para aparar.`}
                      data-testid={`tl-seg-${i}`}
                      onPointerDown={(e) => {
                        if (disabled || e.button !== 0) return;
                        e.preventDefault();
                        setDrag({ kind: 'seg-move', index: i, x0: e.clientX, moved: false, t: tAt(e.clientX), dx: 0 });
                      }}
                      onKeyDown={(e) =>
                        keySelect(e, () => {
                          onSelectSeg(i);
                          onSelectEl(null);
                          onSeek(offsets[i]!);
                        })
                      }
                    >
                      <span className="etl-seg-label">
                        <b>{i + 1}</b> {secs(len)}
                        {z !== null && <span className="etl-badge">zoom {z.toFixed(1).replace('.', ',')}×</span>}
                      </span>
                      {(['start', 'end'] as const).map((edge) => (
                        <span
                          key={edge}
                          className={`etl-handle ${edge}`}
                          aria-hidden
                          data-testid={`tl-seg-${i}-${edge}`}
                          onPointerDown={(e) => {
                            if (disabled || e.button !== 0) return;
                            e.stopPropagation();
                            e.preventDefault();
                            onSelectSeg(i);
                            setDrag({ kind: 'seg-trim', index: i, edge, x0: e.clientX, delta: 0 });
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
                {joins.map((j) => (
                  <button
                    key={`j${j.k}`}
                    className="etl-join"
                    style={{ left: left(j.at) }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectCut(j.cut);
                    }}
                    disabled={disabled}
                    title={`Corte de ${secs(j.len)} aqui: clique para restaurar ou ajustar`}
                    aria-label={`Corte de ${secs(j.len)} entre os pedaços ${j.k} e ${j.k + 1}`}
                    data-testid={`tl-join-${j.k}`}
                  >
                    <Scissors size={10} aria-hidden />
                  </button>
                ))}
                {slotAt !== null && <span className="etl-drop" style={{ left: left(slotAt) }} aria-hidden />}
              </div>

              <div
                className="etl-lane"
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  onSelectEl(null);
                  onSeek(tAt(e.clientX));
                }}
              >
                {elements.length === 0 && <span className="range-lane-label">Sem títulos ou elementos. Adicione texto, emoji ou forma na prévia.</span>}
                {elements.map((el, k) => {
                  const r = elRange(el.ref, el.start, el.end);
                  const sel = sameRef(selectedEl, el.ref);
                  const id = el.ref.type === 'added' ? el.ref.id : el.ref.type === 'scene' ? el.ref.key : '';
                  return (
                    <div
                      key={id}
                      role="button"
                      tabIndex={0}
                      className={`etl-chip etl-el kind-${el.kind} ${sel ? 'selected' : ''}`}
                      style={{ left: left(r.start), width: width(r.end - r.start), top: rows[k]! * 24 }}
                      aria-pressed={sel}
                      aria-label={`${el.label || 'Elemento'}, de ${secs(r.start)} a ${secs(r.end)}`}
                      title={`${el.label}: arraste para mudar quando aparece; puxe as pontas para mudar a duração.`}
                      data-testid={`tl-el-${id}`}
                      onPointerDown={(e) => startEl(e, el.ref, el.start, el.end, 'move')}
                      onKeyDown={(e) => keySelect(e, () => onSelectEl(el.ref))}
                    >
                      <span className="etl-chip-text">{el.label}</span>
                      <span className="etl-handle start" aria-hidden onPointerDown={(e) => startEl(e, el.ref, el.start, el.end, 'start')} />
                      <span className="etl-handle end" aria-hidden onPointerDown={(e) => startEl(e, el.ref, el.start, el.end, 'end')} />
                    </div>
                  );
                })}
              </div>

              <div
                className="etl-lane etl-caps"
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  onSelectEl(null);
                  onSeek(tAt(e.clientX));
                }}
              >
                {captions.map((c) => {
                  const ref: ElementRef = { type: 'caption', key: c.key };
                  const r = elRange(ref, c.caption.start, c.caption.end);
                  const sel = sameRef(selectedEl, ref);
                  return (
                    <div
                      key={c.key}
                      role="button"
                      tabIndex={0}
                      className={`etl-chip etl-cap ${sel ? 'selected' : ''} ${c.locked ? 'locked' : ''}`}
                      style={{ left: left(r.start), width: width(Math.max(0.05, r.end - r.start)) }}
                      aria-pressed={sel}
                      aria-label={`Legenda: ${c.caption.text}`}
                      title={`${c.caption.text}: clique para escolher, arraste as pontas para mudar quando aparece.`}
                      data-testid={`tl-cap-${c.caption.id}`}
                      onPointerDown={(e) => startEl(e, ref, c.caption.start, c.caption.end, 'move')}
                      onKeyDown={(e) => keySelect(e, () => onSelectEl(ref))}
                    >
                      <span className="etl-chip-text">{c.caption.text}</span>
                      <span className="etl-handle start" aria-hidden onPointerDown={(e) => startEl(e, ref, c.caption.start, c.caption.end, 'start')} />
                      <span className="etl-handle end" aria-hidden onPointerDown={(e) => startEl(e, ref, c.caption.start, c.caption.end, 'end')} />
                    </div>
                  );
                })}
              </div>

              <div
                className="range-lane"
                onPointerDown={(e) => {
                  if ((e.target as HTMLElement).closest('button') || e.button !== 0 || disabled) return;
                  const t = tAt(e.clientX);
                  setDrag({ kind: 'range', from: t, to: t, x0: e.clientX });
                }}
                title="Arraste aqui para selecionar um trecho e pedir uma mudança só nele"
                data-testid="range-lane"
              >
                {plan.ranges.length === 0 && !selSpan && <span className="range-lane-label">Arraste aqui para selecionar um trecho</span>}
                {plan.ranges.map((r) => (
                  <button
                    key={r.id}
                    className={`range-chip ${r.locked ? 'locked' : ''} ${props.selectedRange === r.id ? 'selected' : ''}`}
                    style={{ left: left(r.out.start), width: width(r.out.end - r.out.start) }}
                    onClick={() => props.onPickRange(r.id)}
                    title={`${r.locked ? 'Travado' : 'Ajustado'}: ${r.prompt || 'sem pedido'}`}
                    aria-label={`Trecho ${r.locked ? 'travado' : 'ajustado'} de ${r.out.start.toFixed(1)} a ${r.out.end.toFixed(1)} segundos`}
                    data-testid={`range-${r.id}`}
                  >
                    {r.locked ? 'travado' : 'ajustado'}
                  </button>
                ))}
                {selSpan && <div className="range-sel" style={{ left: left(selSpan.start), width: width(selSpan.end - selSpan.start) }} data-testid="range-selection" />}
              </div>

              <div className="tl-playhead" style={{ left: left(Math.min(time, total)) }} aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
