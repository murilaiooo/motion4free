import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EditPlan } from '../core/types';
import type { ManualEdits, Placement } from '../core/edits';
import { clampPlacement, setElementPlacement } from '../editorial/manual';
import type { ElementRef } from '../editorial/elements';
import { sameRef } from '../editorial/elements';
import { boxContains, boxGeometry, elementBoxes, hitTest, snapLines, snapRect } from '../render/hit';
import type { ElementBox } from '../render/bounds';
import { reelsSafeArea } from '../render/layout';

interface Props {
  plan: EditPlan;
  time: number;
  selected: ElementRef | null;
  onSelect: (ref: ElementRef | null) => void;
  onChange: (next: EditPlan) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onEditText?: (ref: ElementRef) => void;
  disabled?: boolean;
}

const HANDLE_SIZE = 10;
const PAD = 12;
const SNAP_THRESH = 8;

function placementFromDrag(
  start: Placement,
  dxPx: number,
  dyPx: number,
  outW: number,
  outH: number,
): Placement {
  const dx = dxPx / outW;
  const dy = dyPx / outH;
  return clampPlacement({ ...start, x: start.x + dx, y: start.y + dy });
}

function getMeasure(canvas: HTMLCanvasElement | null): CanvasRenderingContext2D | null {
  if (!canvas) return null;
  // Offscreen 1x1 canvas to measure text (fonts already loaded)
  const off = document.createElement('canvas');
  return off.getContext('2d');
}

export function PreviewOverlay({ plan, time, selected, onSelect, onChange, canvasRef, onEditText, disabled }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<ElementBox[]>([]);
  const [drag, setDrag] = useState<{
    ref: ElementRef;
    startPlacement: Placement;
    startOffset: { dx: number; dy: number; scale: number; rotate: number } | null;
    pointerStart: { x: number; y: number };
    box: ElementBox;
  } | null>(null);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const outputW = plan.output.width;
  const outputH = plan.output.height;

  // recompute boxes when plan or time changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Use OffscreenCanvas for measuring without affecting preview
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (!measureCtx) return;
    const measurer = {
      _ctx: measureCtx,
      get font() { return (this as any)._ctx.font; },
      set font(v: string) { (this as any)._ctx.font = v; },
      get letterSpacing() { return ((this as any)._ctx as any).letterSpacing ?? '0px'; },
      set letterSpacing(v: string) { ((this as any)._ctx as any).letterSpacing = v; },
      measureText: (text: string) => measureCtx.measureText(text),
    } as unknown as import('../render/bounds').Measurer;
    const next = elementBoxes(plan, time, measurer);
    setBoxes(next);
  }, [plan, time, canvasRef]);

  const selectedBox = useMemo(() => {
    if (!selected) return null;
    return boxes.find((b) => sameRef(b.ref, selected)) ?? null;
  }, [boxes, selected]);

  const toOutput = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * outputW;
      const y = ((clientY - rect.top) / rect.height) * outputH;
      return { x, y };
    },
    [canvasRef, outputW, outputH],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      const { x, y } = toOutput(e.clientX, e.clientY);
      // Check handles first if selected
      if (selectedBox) {
        const g = boxGeometry(selectedBox);
        const handles = handlePositions(g, outputW, outputH);
        for (const h of handles) {
          if (Math.hypot(h.x - x, h.y - y) < HANDLE_SIZE * 2) {
            const placement = placementForRef(plan, selectedBox.ref);
            if (!placement) return;
            setDrag({
              ref: selectedBox.ref,
              startPlacement: placement,
              startOffset: null,
              pointerStart: { x, y },
              box: selectedBox,
            });
            (e.target as Element).setPointerCapture(e.pointerId);
            e.stopPropagation();
            e.preventDefault();
            return;
          }
        }
      }
      // Hit test
      const hit = hitTest(boxes, x, y, PAD);
      if (hit) {
        if (!sameRef(hit, selected)) onSelect(hit);
        const placement = placementForRef(plan, hit);
        const offset = offsetForRef(plan, hit);
        if (hit.type === 'scene' && offset) {
          setDrag({
            ref: hit,
            startPlacement: { x: 0.5, y: 0.5, scale: 1, rotate: 0 },
            startOffset: offset,
            pointerStart: { x, y },
            box: boxes.find((b) => sameRef(b.ref, hit))!,
          });
        } else if (placement) {
          setDrag({
            ref: hit,
            startPlacement: placement,
            startOffset: offset ?? null,
            pointerStart: { x, y },
            box: boxes.find((b) => sameRef(b.ref, hit))!,
          });
        } else {
          const fallback = { x: 0.5, y: 0.5, scale: 1, rotate: 0 } as Placement;
          setDrag({
            ref: hit,
            startPlacement: fallback,
            startOffset: null,
            pointerStart: { x, y },
            box: boxes.find((b) => sameRef(b.ref, hit))!,
          });
        }
        (e.target as Element).setPointerCapture(e.pointerId);
        e.stopPropagation();
        e.preventDefault();
      } else {
        // No element hit: deselect and forward to canvas for play/pause (overlay covers canvas)
        if (selected) onSelect(null);
        const canvas = canvasRef.current;
        if (canvas) canvas.click();
        return;
      }
    },
    [boxes, selectedBox, selected, onSelect, plan, toOutput, disabled, outputW, outputH],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const { x, y } = toOutput(e.clientX, e.clientY);
      const dxPx = x - drag.pointerStart.x;
      const dyPx = y - drag.pointerStart.y;
      if (e.shiftKey) {
        // Lock axis
        if (Math.abs(dxPx) > Math.abs(dyPx)) {
          // keep only X
        } else {
          // keep only Y - we'll handle via lockAxis logic in snap
        }
      }
      // Compute new placement via drag delta
      const basePlacement = drag.startPlacement;
      let nextPlacement = placementFromDrag(basePlacement, dxPx, dyPx, outputW, outputH);

      // Snap logic
      const rect = {
        x: selectedBox ? boxGeometry(selectedBox).cx - selectedBox.local.w * Math.hypot(selectedBox.m[0], selectedBox.m[1]) / 2 + dxPx : 0,
        y: selectedBox ? boxGeometry(selectedBox).cy - selectedBox.local.h * Math.hypot(selectedBox.m[2], selectedBox.m[3]) / 2 + dyPx : 0,
        w: selectedBox ? selectedBox.local.w * Math.hypot(selectedBox.m[0], selectedBox.m[1]) : 100,
        h: selectedBox ? selectedBox.local.h * Math.hypot(selectedBox.m[2], selectedBox.m[3]) : 50,
      };
      const others = boxes.filter((b) => !sameRef(b.ref, drag.ref)).map((b) => b.aabb);
      const lines = snapLines(outputW, outputH, others);
      const snap = snapRect(rect, lines, SNAP_THRESH);
      if (Math.abs(snap.dx) > 0.5 || Math.abs(snap.dy) > 0.5) {
        nextPlacement = placementFromDrag(basePlacement, dxPx + snap.dx, dyPx + snap.dy, outputW, outputH);
        setGuides({ x: snap.guides.find((g) => g.axis === 'x')?.at ?? null, y: snap.guides.find((g) => g.axis === 'y')?.at ?? null });
      } else {
        setGuides({ x: null, y: null });
      }

      // Apply via onChange
      try {
        const next = setElementPlacement(plan, drag.ref, nextPlacement, 'one');
        onChange(next);
      } catch {
        // ignore locked errors etc - will be handled via error display elsewhere
      }
    },
    [drag, selectedBox, boxes, outputW, outputH, plan, onChange, toOutput],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      setDrag(null);
      setGuides({ x: null, y: null });
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    },
    [],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!selected) return;
      onEditText?.(selected);
    },
    [selected, onEditText],
  );

  if (disabled) return null;

  return (
    <div
      ref={overlayRef}
      className="preview-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        touchAction: 'none',
        cursor: drag ? 'grabbing' : 'pointer',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onDoubleClick={handleDoubleClick}
      data-testid="preview-overlay"
    >
      {/* Selection box */}
      {selectedBox && !drag && (
        <SelectionBox box={selectedBox} outputW={outputW} outputH={outputH} canvasRef={canvasRef} />
      )}
      {drag && selectedBox && (
        <SelectionBox box={selectedBox} outputW={outputW} outputH={outputH} canvasRef={canvasRef} dragging />
      )}
      {/* Snap guides */}
      {guides.x !== null && <div className="snap-guide vertical" style={{ left: `${(guides.x! / outputW) * 100}%` }} />}
      {guides.y !== null && <div className="snap-guide horizontal" style={{ top: `${(guides.y! / outputH) * 100}%` }} />}
      <style>{`
        .preview-overlay .selection-box {
          position: absolute;
          border: 1px solid #38bdf8;
          box-shadow: 0 0 0 1px rgba(56,189,248,0.3);
          pointer-events: none;
        }
        .preview-overlay .handle {
          position: absolute;
          width: ${HANDLE_SIZE}px;
          height: ${HANDLE_SIZE}px;
          background: #38bdf8;
          border: 1px solid white;
          border-radius: 2px;
          pointer-events: none;
          transform: translate(-50%, -50%);
        }
        .snap-guide {
          position: absolute;
          background: #38bdf8;
          pointer-events: none;
        }
        .snap-guide.vertical { width: 1px; top: 0; bottom: 0; }
        .snap-guide.horizontal { height: 1px; left: 0; right: 0; }
      `}</style>
    </div>
  );
}

function placementForRef(plan: EditPlan, ref: ElementRef): Placement | null {
  try {
    const { resolvePlan } = require('../editorial/elements');
    const R = resolvePlan(plan);
    if (ref.type === 'caption') {
      const c = R.captions.find((x: any) => x.key === ref.key);
      return c?.placement ?? plan.edits.captionPlacement ?? null;
    }
    if (ref.type === 'added') {
      const a = R.added.find((x: any) => x.el.id === ref.id);
      return a?.el.placement ?? null;
    }
    if (ref.type === 'scene') {
      const s = R.scenes.find((x: any) => x.key === ref.key);
      return s?.edit?.offset ? { x: 0.5 + s.edit.offset.dx, y: 0.5 + s.edit.offset.dy, scale: s.edit.offset.scale, rotate: s.edit.offset.rotate } : null;
    }
  } catch {}
  return null;
}

function offsetForRef(plan: EditPlan, ref: ElementRef): { dx: number; dy: number; scale: number; rotate: number } | null {
  if (ref.type !== 'scene') return null;
  try {
    const { resolvePlan } = require('../editorial/elements');
    const R = resolvePlan(plan);
    const s = R.scenes.find((x: any) => x.key === ref.key);
    return s?.edit?.offset ?? null;
  } catch {
    return null;
  }
}

function handlePositions(
  g: { cx: number; cy: number; w: number; h: number; angle: number },
  outW: number,
  outH: number,
) {
  const hw = g.w / 2;
  const hh = g.h / 2;
  const rad = (g.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points = [
    { x: -hw, y: -hh },
    { x: 0, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: 0 },
    { x: hw, y: hh },
    { x: 0, y: hh },
    { x: -hw, y: hh },
    { x: -hw, y: 0 },
  ];
  return points.map((p) => ({
    x: g.cx + p.x * cos - p.y * sin,
    y: g.cy + p.x * sin + p.y * cos,
  }));
}

function SelectionBox({
  box,
  outputW,
  outputH,
  canvasRef,
  dragging,
}: {
  box: ElementBox;
  outputW: number;
  outputH: number;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  dragging?: boolean;
}) {
  const geom = boxGeometry(box);
  const canvas = canvasRef.current;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width / outputW;
  const scaleY = rect.height / outputH;
  const left = geom.cx * scaleX - (geom.w * scaleX) / 2;
  const top = geom.cy * scaleY - (geom.h * scaleY) / 2;
  const width = geom.w * scaleX;
  const height = geom.h * scaleY;
  const angle = geom.angle;

  return (
    <div
      className="selection-box"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `rotate(${angle}deg)`,
        opacity: dragging ? 0.7 : 1,
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => {
        const pos = [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 100, y: 100 },
          { x: 50, y: 100 },
          { x: 0, y: 100 },
          { x: 0, y: 50 },
        ][i]!;
        return <div key={i} className="handle" style={{ left: `${pos.x}%`, top: `${pos.y}%` }} />;
      })}
    </div>
  );
}
