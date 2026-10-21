import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { EditPlan } from '../core/types';
import type { Offset, Placement } from '../core/edits';
import { toAppError, type AppError } from '../core/errors';
import { setElementPlacement } from '../editorial/manual';
import { resolvePlan, sameRef, type ElementRef } from '../editorial/elements';
import { boxGeometry, elementBoxes, hitTest, snapLines, snapRect } from '../render/hit';
import type { ElementBox, Measurer } from '../render/bounds';

interface Props {
  plan: EditPlan;
  time: number;
  selected: ElementRef | null;
  onSelect: (ref: ElementRef | null) => void;
  /** aplica a mudança (uma entrada no desfazer), ao soltar */
  onChange: (next: EditPlan) => void;
  /** mostra a prévia durante o arraste sem mexer no desfazer (v0.18) */
  onPreview?: (next: EditPlan | null) => void;
  onError?: (err: AppError) => void;
  /** clique fora de qualquer elemento: tocar/pausar */
  onEmptyClick?: () => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onEditText?: (ref: ElementRef) => void;
  disabled?: boolean;
}

/** folga para pegar as alças, em px da tela */
const HANDLE_HIT_PX = 14;
const PAD_PX = 10;
const SNAP_PX = 6;
const DRAG_PX = 3;

type Drag = {
  ref: ElementRef;
  mode: 'move' | 'scale';
  /** plano no começo do arraste: cada movimento parte dele (não acumula erro) */
  plan: EditPlan;
  start: { x: number; y: number };
  /** posição de legenda/elemento adicionado, ou deslocamento de cena gerada */
  place: Placement | null;
  offset: Offset | null;
  box: ElementBox;
  moved: boolean;
};

/** Posição atual de uma legenda (a dela, a de todas, ou o centro da caixa desenhada pelo modelo) ou de um elemento. */
function startPlace(plan: EditPlan, ref: ElementRef, box: ElementBox, W: number, H: number): Placement | null {
  const R = resolvePlan(plan);
  if (ref.type === 'caption') {
    const c = R.captions.find((x) => x.key === ref.key);
    if (c?.placement) return c.placement;
    const g = boxGeometry(box);
    return { x: g.cx / W, y: g.cy / H, scale: 1, rotate: 0 };
  }
  if (ref.type === 'added') return R.added.find((x) => x.el.id === ref.id)?.el.placement ?? null;
  return null;
}

function startOffset(plan: EditPlan, ref: ElementRef): Offset | null {
  if (ref.type !== 'scene') return null;
  const s = resolvePlan(plan).scenes.find((x) => x.key === ref.key);
  return s?.edit?.offset ?? { dx: 0, dy: 0, scale: 1, rotate: 0 };
}

function cornerPoints(g: { cx: number; cy: number; w: number; h: number; angle: number }) {
  const rad = (g.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const px = (sx! * g.w) / 2;
    const py = (sy! * g.h) / 2;
    return { x: g.cx + px * cos - py * sin, y: g.cy + px * sin + py * cos };
  });
}

/**
 * Camada de edição direta na prévia (v0.18): clique escolhe, arrastar move, os cantos mudam o tamanho.
 * Durante o arraste só a prévia muda (leve, um desenho por quadro); ao soltar vira uma entrada do
 * desfazer. Legenda move todas as legendas juntas (para tirar do rosto de uma vez).
 */
export function PreviewOverlay({ plan, time, selected, onSelect, onChange, onPreview, onError, onEmptyClick, canvasRef, onEditText, disabled }: Props) {
  const W = plan.output.width;
  const H = plan.output.height;
  const [live, setLive] = useState<EditPlan | null>(null);
  const shown = live ?? plan;
  const [boxes, setBoxes] = useState<ElementBox[]>([]);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const drag = useRef<Drag | null>(null);
  const pending = useRef<{ next: EditPlan | null; err: AppError | null; raf: number }>({ next: null, err: null, raf: 0 });
  const [dragging, setDragging] = useState(false);

  const measurer = useMemo(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return null;
    const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
    return {
      get font() {
        return c.font;
      },
      set font(v: string) {
        c.font = v;
      },
      get letterSpacing() {
        return c.letterSpacing ?? '0px';
      },
      set letterSpacing(v: string) {
        c.letterSpacing = v;
      },
      measureText: (text: string) => c.measureText(text),
    } as unknown as Measurer;
  }, []);

  useEffect(() => {
    if (!measurer) return;
    setBoxes(elementBoxes(shown, time, measurer));
  }, [shown, time, measurer]);

  // plano novo de fora (desfazer, outra edição): a prévia do arraste perde a validade
  useEffect(() => {
    if (!drag.current) setLive(null);
  }, [plan]);

  const selectedBox = useMemo(() => (selected ? (boxes.find((b) => sameRef(b.ref, selected)) ?? null) : null), [boxes, selected]);

  const toOutput = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return { x: 0, y: 0, k: 1 };
    return { x: ((clientX - r.left) / r.width) * W, y: ((clientY - r.top) / r.height) * H, k: W / r.width };
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    const p = toOutput(e.clientX, e.clientY);
    let ref: ElementRef | null = null;
    let mode: Drag['mode'] = 'move';
    if (selectedBox && cornerPoints(boxGeometry(selectedBox)).some((c) => Math.hypot(c.x - p.x, c.y - p.y) < HANDLE_HIT_PX * p.k)) {
      ref = selectedBox.ref;
      mode = 'scale';
    } else {
      // o já escolhido ganha de quem está por cima (dá para arrastar a legenda mesmo com um emoji encostado)
      ref = selectedBox && hitTest([selectedBox], p.x, p.y, PAD_PX * p.k) ? selectedBox.ref : hitTest(boxes, p.x, p.y, PAD_PX * p.k);
    }
    if (!ref) {
      if (selected) onSelect(null);
      onEmptyClick?.();
      return;
    }
    const box = boxes.find((b) => sameRef(b.ref, ref))!;
    if (!sameRef(ref, selected)) onSelect(ref);
    drag.current = { ref, mode, plan, start: { x: p.x, y: p.y }, place: startPlace(plan, ref, box, W, H), offset: startOffset(plan, ref), box, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = toOutput(e.clientX, e.clientY);
    let dx = p.x - d.start.x;
    let dy = p.y - d.start.y;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX * p.k) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    const g = boxGeometry(d.box);
    let value: Placement | Offset | null = null;
    if (d.mode === 'scale') {
      const k = Math.max(0.05, Math.hypot(p.x - g.cx, p.y - g.cy) / Math.max(1, Math.hypot(d.start.x - g.cx, d.start.y - g.cy)));
      if (d.place) value = { ...d.place, scale: d.place.scale * k };
      else if (d.offset) value = { ...d.offset, scale: d.offset.scale * k };
    } else {
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      // ímã: centro do quadro, área segura e outros elementos
      const rect = { x: g.cx - g.w / 2 + dx, y: g.cy - g.h / 2 + dy, w: g.w, h: g.h };
      const others = boxes.filter((b) => !sameRef(b.ref, d.ref)).map((b) => b.aabb);
      const snap = snapRect(rect, snapLines(W, H, others), SNAP_PX * p.k);
      dx += snap.dx;
      dy += snap.dy;
      setGuides({ x: snap.guides.find((x) => x.axis === 'x')?.at ?? null, y: snap.guides.find((x) => x.axis === 'y')?.at ?? null });
      if (d.place) value = { ...d.place, x: d.place.x + dx / W, y: d.place.y + dy / H };
      else if (d.offset) value = { ...d.offset, dx: d.offset.dx + dx / W, dy: d.offset.dy + dy / H };
    }
    if (!value) return;
    try {
      pending.current.next = setElementPlacement(d.plan, d.ref, value, 'all');
      pending.current.err = null;
    } catch (err) {
      pending.current.err = toAppError(err);
      return;
    }
    // um desenho por quadro, por mais rápido que o mouse mexa
    if (!pending.current.raf)
      pending.current.raf = requestAnimationFrame(() => {
        pending.current.raf = 0;
        const next = pending.current.next;
        if (!next || !drag.current) return;
        setLive(next);
        onPreview?.(next);
      });
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    cancelAnimationFrame(pending.current.raf);
    pending.current.raf = 0;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setGuides({ x: null, y: null });
    setDragging(false);
    if (!d || !d.moved) return;
    const { next, err } = pending.current;
    pending.current = { next: null, err: null, raf: 0 };
    onPreview?.(null);
    if (err) {
      setLive(null);
      onError?.(err);
      return;
    }
    // a prévia fica no lugar novo até o plano novo chegar (sem pular de volta)
    if (next) {
      setLive(next);
      onChange(next);
    }
  };

  if (disabled) return null;
  const pct = (v: number, of: number) => `${(100 * v) / of}%`;
  const g = selectedBox ? boxGeometry(selectedBox) : null;

  return (
    <div
      className={`preview-overlay ${dragging ? 'dragging' : ''}`}
      style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={(e) => {
        onMove(e);
        // cursor: mãozinha sobre um elemento
        if (!drag.current) {
          const p = toOutput(e.clientX, e.clientY);
          const over = hitTest(boxes, p.x, p.y, PAD_PX * p.k);
          e.currentTarget.style.cursor = over ? 'move' : 'pointer';
        }
      }}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onDoubleClick={(e) => {
        const p = toOutput(e.clientX, e.clientY);
        const hit = hitTest(boxes, p.x, p.y, PAD_PX * p.k);
        if (hit) onEditText?.(hit);
      }}
      data-testid="preview-overlay"
    >
      {g && selectedBox && (
        <div
          className="selection-box"
          style={{ left: pct(g.cx - g.w / 2, W), top: pct(g.cy - g.h / 2, H), width: pct(g.w, W), height: pct(g.h, H), transform: `rotate(${g.angle}deg)` }}
          data-testid="selection-box"
        >
          {['nw', 'ne', 'se', 'sw'].map((c) => (
            <span key={c} className={`handle ${c}`} />
          ))}
        </div>
      )}
      {guides.x !== null && <div className="snap-guide vertical" style={{ left: pct(guides.x, W) }} />}
      {guides.y !== null && <div className="snap-guide horizontal" style={{ top: pct(guides.y, H) }} />}
    </div>
  );
}
