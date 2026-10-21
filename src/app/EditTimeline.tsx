import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { AudioLines, Captions, ClipboardPaste, Copy, CopyPlus, Film, Layers, ListChecks, Magnet, Maximize2, Scissors, Sparkles, SquareDashedMousePointer, SquareSplitHorizontal, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { peakBetween, type PeakIndex } from '../analysis/waveform';
import { MAX_TRACK } from '../core/edits';
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
  /** áudio do vídeo para a onda real (v0.18), no tempo do original */
  peakIndex: PeakIndex | null;
  time: number;
  playing: boolean;
  cuts: TimeRange[];
  selectedSeg: number | null;
  selectedEl: ElementRef | null;
  onSeek: (outTime: number) => void;
  onSelectSeg: (index: number | null) => void;
  onSelectEl: (ref: ElementRef | null) => void;
  /** seleção múltipla (v0.26) */
  multi: { segs: number[]; els: ElementRef[] };
  /** Ctrl/Shift + clique ou modo Vários: põe ou tira o item da seleção */
  onToggle: (item: { seg: number } | { el: ElementRef }) => void;
  /** Apagar vale também para a seleção múltipla e para o trecho marcado na faixa Trechos */
  canRemove: boolean;
  onSelectCut: (index: number) => void;
  onTrim: (index: number, edge: 'start' | 'end', src: number) => void;
  onMoveSeg: (from: number, to: number) => void;
  /** novo tempo e/ou nova camada (null = não muda); uma entrada só no desfazer */
  onRetime: (ref: ElementRef, out: TimeRange | null, track: number | null) => void;
  selection: TimeRange | null;
  selectedRange: string | null;
  onSelection: (out: TimeRange) => void;
  onPickRange: (id: string) => void;
  actions: TimelineActions;
  /** botões Edição | Original */
  viewSwitch: ReactNode;
  disabled: boolean;
}

const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64];
const STEPS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];
const SNAP_PX = 10;
const DRAG_PX = 4;
const MAX_ROWS = 3;

/** Altura das faixas de vídeo e áudio (v0.25): pequena cabe mais camadas, grande mostra melhor a onda. */
type TrackSize = 'p' | 'm' | 'g';
const TRACK_SIZES: Record<TrackSize, { video: number; audio: number; label: string; name: string }> = {
  p: { video: 32, audio: 36, label: 'P', name: 'pequenas' },
  m: { video: 44, audio: 52, label: 'M', name: 'médias' },
  g: { video: 72, audio: 96, label: 'G', name: 'grandes' },
};
const TRACK_SIZE_KEY = 'm4f.track-size';
function loadTrackSize(): TrackSize {
  try {
    const v = localStorage.getItem(TRACK_SIZE_KEY);
    return v === 'p' || v === 'g' ? v : 'm';
  } catch {
    return 'm';
  }
}
const typingIn = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) || t.isContentEditable || !!t.closest?.('[role="separator"]'));
};

function clock(s: number, step: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const ss = step < 0.25 ? sec.toFixed(2).padStart(5, '0') : step < 1 ? sec.toFixed(1).padStart(4, '0') : String(Math.round(sec)).padStart(2, '0');
  return `${m}:${ss}`;
}
const secs = (s: number) => `${s.toFixed(1).replace('.', ',')} s`;

type Drag =
  | { kind: 'scrub' }
  | { kind: 'seg-move'; index: number; x0: number; moved: boolean; t: number; dx: number }
  | { kind: 'seg-trim'; index: number; edge: 'start' | 'end'; x0: number; delta: number }
  | { kind: 'el'; mode: 'move' | 'start' | 'end'; ref: ElementRef; start: number; end: number; x0: number; y0: number; delta: number; dy: number; moved: boolean; track: number | null }
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
  const { plan, peakIndex, time, playing, cuts, selectedSeg, selectedEl, onSeek, onSelectSeg, onSelectEl, onSelectCut, actions, disabled, multi, onToggle } = props;
  // modo Vários (v0.26): cada clique põe ou tira o item da seleção, sem precisar segurar Ctrl ou Shift
  const [multiMode, setMultiMode] = useState(false);
  const additive = (e: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => multiMode || e.shiftKey || e.ctrlKey || e.metaKey;
  const inMulti = (ref: ElementRef) => multi.els.some((r) => sameRef(r, ref));
  const scrollRef = useRef<HTMLDivElement>(null);
  const lanesRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLCanvasElement>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [viewW, setViewW] = useState(800);
  const [snapOn, setSnapOn] = useState(true);
  const [trackSize, setTrackSizeState] = useState<TrackSize>(loadTrackSize);
  const setTrackSize = (v: TrackSize) => {
    setTrackSizeState(v);
    try {
      localStorage.setItem(TRACK_SIZE_KEY, v);
    } catch {
      /* sem armazenamento: vale só nesta aba */
    }
  };
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  // o arraste guarda a posição na hora e redesenha no máximo uma vez por quadro (arraste leve)
  const frameRef = useRef(0);
  const setDrag = (d: Drag | null, now = false) => {
    dragRef.current = d;
    if (now || !d) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      setDragState(d);
      return;
    }
    if (!frameRef.current)
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = 0;
        setDragState(dragRef.current);
      });
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

  // parte visível da linha do tempo (a onda só é desenhada ali, na resolução da tela)
  const [vis, setVis] = useState({ t0: 0, t1: 1 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const lanes = lanesRef.current;
      if (!lanes) return;
      const r = lanes.getBoundingClientRect();
      const v = el.getBoundingClientRect();
      if (r.width <= 0) return;
      const t0 = Math.max(0, ((v.left - r.left) / r.width) * total);
      const t1 = Math.min(total, ((v.right - r.left) / r.width) * total);
      setVis((old) => (Math.abs(old.t0 - t0) < 1e-4 && Math.abs(old.t1 - t1) < 1e-4 ? old : { t0, t1: Math.max(t0 + 0.001, t1) }));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [total, zoom, viewW]);

  // onda real: cada coluna da tela lê o maior pico das amostras daquele instante (nítida em qualquer zoom)
  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas || !peakIndex) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    const cols = Math.round(cssW * dpr);
    const H = Math.round(cssH * dpr);
    canvas.width = cols;
    canvas.height = H;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, cols, H);
    g.fillStyle = getComputedStyle(canvas).color;
    const span = (vis.t1 - vis.t0) / cols;
    const mid = H / 2;
    for (let x = 0; x < cols; x++) {
      const t = vis.t0 + x * span;
      const src = outputToSource(plan.segments, t);
      if (src === null) continue;
      const h = Math.max(dpr, peakBetween(peakIndex, src, src + span) * (H - 2 * dpr));
      g.fillRect(x, mid - h / 2, 1, h);
    }
  }, [peakIndex, plan.segments, vis, trackSize]);

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

  // atalhos de zoom: + aproxima, − afasta, 0 mostra o vídeo inteiro (fora de campos de texto e janelas)
  const zoomRef = useRef({ zoomIdx, setZoom });
  zoomRef.current = { zoomIdx, setZoom };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typingIn(e.target) || e.isComposing || document.querySelector('[aria-modal="true"]')) return;
      const z = zoomRef.current;
      if (e.key === '+' || e.key === '=') z.setZoom(z.zoomIdx + 1);
      else if (e.key === '-' || e.key === '_') z.setZoom(z.zoomIdx - 1);
      else if (e.key === '0') z.setZoom(0);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // o que foi escolhido na prévia (ou no painel) aparece na linha do tempo: com zoom, rola até ele
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1) return;
    const target = el.querySelector<HTMLElement>('.etl-seg.selected, .etl-chip.selected');
    if (!target) return;
    const a = target.getBoundingClientRect();
    const v = el.getBoundingClientRect();
    if (a.right < v.left + 24 || a.left > v.right - 24) el.scrollLeft += a.left - v.left - v.width * 0.25;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeg, selectedEl]);

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
      const moved = d.moved || Math.abs(e.clientX - d.x0) > DRAG_PX || (d.mode === 'move' && Math.abs(e.clientY - d.y0) > DRAG_PX);
      // elemento adicionado arrastado para cima/baixo muda de camada
      let track: number | null = null;
      let dy = 0;
      if (d.mode === 'move' && d.ref.type === 'added') {
        const lane = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest?.('[data-track]');
        track = lane ? Number(lane.getAttribute('data-track')) : null;
        dy = e.clientY - d.y0;
      }
      let delta = raw;
      if (d.mode === 'move') {
        delta = Math.min(total - d.end, Math.max(-d.start, raw));
        const a = snap(d.start + delta) - d.start;
        const b = snap(d.end + delta) - d.end;
        delta = Math.abs(a - delta) <= Math.abs(b - delta) ? a : b;
      } else if (d.mode === 'start') delta = snap(d.start + raw) - d.start;
      else delta = snap(d.end + raw) - d.end;
      setDrag({ ...d, delta, moved, track, dy });
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
        const home = d.ref.type === 'added' ? (plan.edits.added.find((a) => a.id === (d.ref as { id: string }).id)?.track ?? 0) : null;
        const newTrack = d.track !== null && d.track !== home ? d.track : null;
        if (!d.moved || (Math.abs(d.delta) < 1e-3 && newTrack === null)) {
          live.current.onSelectEl(d.ref);
          live.current.onSelectSeg(null);
          if (time < d.start || time >= d.end) onSeek(Math.min(d.end - 0.01, d.start + 0.01));
          return;
        }
        const start = d.mode === 'end' ? d.start : d.start + d.delta;
        const end = d.mode === 'start' ? d.end : d.end + d.delta;
        live.current.onRetime(d.ref, Math.abs(d.delta) < 1e-3 ? null : { start, end }, newTrack);
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

  // animações geradas numa faixa (empilhadas quando se cruzam); elementos adicionados nas camadas
  const layout = useMemo(() => {
    const all = listElements(plan);
    const scenes = all.filter((e) => e.ref.type === 'scene');
    const rows: number[] = [];
    const rowEnds: number[] = [];
    for (const e of scenes) {
      let r = rowEnds.findIndex((end) => end <= e.start + 1e-3);
      if (r < 0) r = rowEnds.length < MAX_ROWS ? rowEnds.length : rowEnds.indexOf(Math.min(...rowEnds));
      rowEnds[r] = e.end;
      rows.push(r);
    }
    const trackOf = new Map(plan.edits.added.map((a) => [a.id, a.track ?? 0]));
    const added = all.filter((e) => e.ref.type === 'added').map((e) => ({ ...e, track: trackOf.get((e.ref as { id: string }).id) ?? 0 }));
    const top = added.reduce((m, e) => Math.max(m, e.track), -1);
    // sempre uma camada vazia por cima, para arrastar um elemento até ela
    const layers = Math.min(MAX_TRACK + 1, top + 2);
    return { scenes, rows, rowCount: Math.max(1, rowEnds.length), added, layers };
  }, [plan]);
  const { rowCount } = layout;
  const captions = useMemo(() => resolvePlan(plan).captions, [plan]);
  const layerIds = Array.from({ length: layout.layers }, (_, k) => layout.layers - 1 - k);
  const sizes = TRACK_SIZES[trackSize];
  const tpl = `22px ${layerIds.map(() => '26px').join(' ')} ${rowCount * 24 - 2}px ${sizes.video}px ${sizes.audio}px 26px 24px`;

  const elRange = (ref: ElementRef, start: number, end: number) => {
    if (drag?.kind !== 'el' || !sameRef(drag.ref, ref)) return { start, end };
    return { start: drag.mode === 'end' ? start : start + drag.delta, end: drag.mode === 'start' ? end : end + drag.delta };
  };

  const startEl = (e: ReactPointerEvent, ref: ElementRef, start: number, end: number, mode: 'move' | 'start' | 'end') => {
    if (disabled || e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    if (additive(e)) return onToggle({ el: ref });
    setDrag({ kind: 'el', mode, ref, start, end, x0: e.clientX, y0: e.clientY, delta: 0, dy: 0, moved: false, track: null }, true);
  };
  const chip = (el: (typeof layout.scenes)[number], top: number) => {
    const r = elRange(el.ref, el.start, el.end);
    const sel = sameRef(selectedEl, el.ref) || inMulti(el.ref);
    const id = el.ref.type === 'added' ? el.ref.id : el.ref.type === 'scene' ? el.ref.key : '';
    const dragging = drag?.kind === 'el' && drag.moved && sameRef(drag.ref, el.ref);
    return (
      <div
        key={id}
        role="button"
        tabIndex={0}
        className={`etl-chip etl-el kind-${el.kind} ${sel ? 'selected' : ''} ${dragging ? 'dragging' : ''}`}
        style={{ left: left(r.start), width: width(r.end - r.start), top, transform: dragging && drag?.kind === 'el' && drag.dy ? `translateY(${drag.dy}px)` : undefined }}
        aria-pressed={sel}
        aria-label={`${el.label || 'Elemento'}, de ${secs(r.start)} a ${secs(r.end)}`}
        title={`${el.label}: arraste para os lados para mudar quando aparece${el.ref.type === 'added' ? ', para cima ou para baixo para mudar de camada' : ''}; puxe as pontas para mudar a duração.`}
        data-testid={`tl-el-${id}`}
        onPointerDown={(e) => startEl(e, el.ref, el.start, el.end, 'move')}
        onKeyDown={(e) => keySelect(e, () => (additive(e) ? onToggle({ el: el.ref }) : onSelectEl(el.ref)))}
      >
        <span className="etl-chip-text">{el.label}</span>
        {el.ref.type === 'added' &&
          (plan.edits.added.find((x) => x.id === (el.ref as { id: string }).id)?.keys ?? []).map((k, i) => (
            <span key={i} className="etl-key" style={{ left: `${(k.at / Math.max(0.01, el.end - el.start)) * 100}%` }} aria-hidden data-testid={`tl-key-${id}-${i}`} />
          ))}
        <span className="etl-handle start" aria-hidden onPointerDown={(e) => startEl(e, el.ref, el.start, el.end, 'start')} />
        <span className="etl-handle end" aria-hidden onPointerDown={(e) => startEl(e, el.ref, el.start, el.end, 'end')} />
      </div>
    );
  };
  const laneDown = (e: ReactPointerEvent) => {
    if (e.target !== e.currentTarget) return;
    onSelectEl(null);
    onSeek(tAt(e.clientX));
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
  const multiCount = multi.segs.length + multi.els.length;
  const hasSel = selectedSeg !== null || selectedEl !== null || multiCount > 0;
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
          <button className="sm icon ghost" onClick={actions.remove} disabled={disabled || !props.canRemove} aria-label={multiCount > 0 ? `Apagar ${multiCount} itens` : 'Apagar'} data-tip={multiCount > 0 ? `Apagar ${multiCount} itens (Delete); o resto do vídeo encosta` : props.selection && !props.selectedRange && !hasSel ? 'Apagar o trecho marcado (Delete); o resto encosta' : 'Apagar (Delete)'} aria-keyshortcuts="Delete" data-testid="tl-delete">
            <Trash2 size={15} />
          </button>
          <button className="sm ghost" aria-pressed={multiMode} onClick={() => setMultiMode(!multiMode)} disabled={disabled} data-tip="Escolher vários: cada clique põe ou tira (o mesmo que Ctrl ou Shift + clique)" data-testid="tl-multi">
            <ListChecks size={15} aria-hidden /> Vários
          </button>
          {multiCount > 0 && (
            <span className="tl-multi-count" role="status" data-testid="tl-multi-count">
              {multiCount} escolhidos
            </span>
          )}
          <span className="tl-tools-sep" aria-hidden />
          <button className="sm icon ghost" aria-pressed={snapOn} onClick={() => setSnapOn(!snapOn)} aria-label="Ímã: encostar nas emendas e na agulha" data-tip="Ímã (encosta nas emendas)" data-testid="tl-snap">
            <Magnet size={15} />
          </button>
        </div>
        <div className="tl-zoom">
          <button className="sm icon ghost" onClick={() => setZoom(zoomIdx - 1)} disabled={zoomIdx === 0} aria-label="Diminuir zoom da linha do tempo" data-tip="Diminuir zoom (−)" aria-keyshortcuts="-">
            <ZoomOut size={16} />
          </button>
          <input type="range" min={0} max={ZOOMS.length - 1} step={1} value={zoomIdx} onChange={(e) => setZoom(e.target.valueAsNumber)} aria-label="Zoom da linha do tempo" />
          <button className="sm icon ghost" onClick={() => setZoom(zoomIdx + 1)} disabled={zoomIdx === ZOOMS.length - 1} aria-label="Aumentar zoom da linha do tempo" data-tip="Aumentar zoom (+)" aria-keyshortcuts="+">
            <ZoomIn size={16} />
          </button>
          <span className="hint tnum tl-zoom-label">{zoom}×</span>
          <button className="sm icon ghost" onClick={() => setZoom(0)} disabled={zoomIdx === 0} aria-label="Ver o vídeo inteiro na linha do tempo" data-tip="Ver tudo (0)" aria-keyshortcuts="0" data-testid="tl-zoom-fit">
            <Maximize2 size={15} />
          </button>
          <span className="tl-tools-sep" aria-hidden />
          <div className="segmented tl-size" role="group" aria-label="Altura das faixas de vídeo e áudio">
            {(Object.keys(TRACK_SIZES) as TrackSize[]).map((k) => (
              <button key={k} aria-pressed={trackSize === k} onClick={() => setTrackSize(k)} aria-label={`Faixas ${TRACK_SIZES[k].name}`} data-tip={`Faixas ${TRACK_SIZES[k].name}`} data-testid={`tl-size-${k}`}>
                {TRACK_SIZES[k].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="tl-body">
        <div className="tl-labels etl-labels" aria-hidden style={{ gridTemplateRows: tpl }}>
          <span className="tl-label" />
          {layerIds.map((t) => (
            <span key={t} className={`tl-label ${t === layout.layers - 1 ? 'etl-label-new' : ''}`}>
              <Layers size={14} /> Camada {t + 1}
            </span>
          ))}
          <span className="tl-label">
            <Sparkles size={14} /> Animações
          </span>
          <span className="tl-label">
            <Film size={14} /> Vídeo
          </span>
          <span className="tl-label">
            <AudioLines size={14} /> Áudio
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
            <div className="tl-lanes etl-lanes" ref={lanesRef} style={{ gridTemplateRows: tpl }}>
              <div
                className="tl-ruler"
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  setDrag({ kind: 'scrub' }, true);
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

              {layerIds.map((t) => {
                const target = drag?.kind === 'el' && drag.moved && drag.track === t;
                const items = layout.added.filter((e) => e.track === t);
                return (
                  <div key={`L${t}`} className={`etl-lane etl-layer ${target ? 'drop-target' : ''}`} data-track={t} data-testid={`tl-layer-${t}`} onPointerDown={laneDown}>
                    {t === layout.layers - 1 && items.length === 0 && <span className="range-lane-label">{t === 0 ? 'Adicione texto, emoji ou forma na prévia; eles aparecem aqui.' : 'Arraste um elemento até aqui para criar uma camada nova por cima.'}</span>}
                    {items.map((el) => chip(el, 2))}
                  </div>
                );
              })}

              <div className="etl-lane" onPointerDown={laneDown} data-testid="tl-anim">
                {layout.scenes.length === 0 && <span className="range-lane-label">Sem animações geradas neste modelo.</span>}
                {layout.scenes.map((el, k2) => chip(el, layout.rows[k2]! * 24))}
              </div>

              <div
                className="etl-video"
                onPointerDown={(e) => {
                  if (e.target !== e.currentTarget) return;
                  onSelectSeg(null);
                  onSeek(tAt(e.clientX));
                }}
              >
                {blocks.map(({ s, i, start, len, clip }) => {
                  const z = segmentZoom(plan, i);
                  const moving = drag?.kind === 'seg-move' && drag.moved && drag.index === i;
                  const segSel = selectedSeg === i || multi.segs.includes(i);
                  return (
                    <div
                      key={`${i}-${s.srcStart}-${s.srcEnd}`}
                      role="button"
                      tabIndex={0}
                      className={`etl-seg ${segSel ? 'selected' : ''} ${moving ? 'moving' : ''} ${clip ? `clip-tint-${clip.index % 6}` : ''}`}
                      style={{ left: left(start), width: width(len), transform: moving ? `translateX(${moveDx}px)` : undefined }}
                      aria-pressed={segSel}
                      aria-label={`Pedaço ${i + 1} do vídeo, ${secs(s.srcEnd - s.srcStart)}${clip ? `, clipe ${clip.index + 1}` : ''}`}
                      title={`Pedaço ${i + 1}: ${secs(s.srcEnd - s.srcStart)}. Clique para selecionar (Ctrl ou Shift + clique escolhe vários), arraste para mudar de lugar, puxe as pontas para aparar.`}
                      data-testid={`tl-seg-${i}`}
                      onPointerDown={(e) => {
                        if (disabled || e.button !== 0) return;
                        e.preventDefault();
                        if (additive(e)) return onToggle({ seg: i });
                        setDrag({ kind: 'seg-move', index: i, x0: e.clientX, moved: false, t: tAt(e.clientX), dx: 0 }, true);
                      }}
                      onKeyDown={(e) =>
                        keySelect(e, () => {
                          if (additive(e)) return onToggle({ seg: i });
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
                            setDrag({ kind: 'seg-trim', index: i, edge, x0: e.clientX, delta: 0 }, true);
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

              <div className="etl-lane etl-audio" onPointerDown={laneDown} data-testid="tl-audio">
                {blocks.map(({ i, start, len }) => (
                  <span key={`a${i}`} className={`etl-audio-seg ${selectedSeg === i || multi.segs.includes(i) ? 'selected' : ''}`} style={{ left: left(start), width: width(len) }} aria-hidden />
                ))}
                {peakIndex && <canvas ref={waveRef} className="etl-wave" style={{ left: left(vis.t0), width: width(vis.t1 - vis.t0) }} data-testid="tl-waveform" aria-hidden />}
              </div>

              <div className="etl-lane etl-caps" onPointerDown={laneDown}>
                {captions.map((c) => {
                  const ref: ElementRef = { type: 'caption', key: c.key };
                  const r = elRange(ref, c.caption.start, c.caption.end);
                  const sel = sameRef(selectedEl, ref) || inMulti(ref);
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
                      onKeyDown={(e) => keySelect(e, () => (additive(e) ? onToggle({ el: ref }) : onSelectEl(ref)))}
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
                  setDrag({ kind: 'range', from: t, to: t, x0: e.clientX }, true);
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
