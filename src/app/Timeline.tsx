import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import type { EditPlan, TimeRange } from '../core/types';
import { outputToSource, outputToSourceEnd, sourceToOutput, sourceToOutputClamped } from '../engine/timeline';

interface Props {
  durationSec: number;
  plan: EditPlan;
  cuts: TimeRange[];
  peaks: Float32Array | null;
  /** tempo de saída do player */
  time: number;
  selectedCut: number | null;
  onSeek: (outTime: number) => void;
  onSelectCut: (index: number) => void;
  /** pedaço selecionado para ajuste (tempo do vídeo editado) */
  selection: TimeRange | null;
  selectedRange: string | null;
  onSelection: (out: TimeRange) => void;
  onPickRange: (id: string) => void;
}

/**
 * Linha do tempo no tempo do vídeo original: trechos mantidos, cortes (clicáveis),
 * waveform do áudio e legendas. Clicar num trecho mantido leva o player até ali.
 */
export function Timeline({ durationSec, plan, cuts, peaks, time, selectedCut, onSeek, onSelectCut, selection, selectedRange, onSelection, onPickRange }: Props) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; x0: number } | null>(null);
  const pct = (src: number) => `${(100 * src) / durationSec}%`;
  const width = (r: TimeRange) => `${(100 * (r.end - r.start)) / durationSec}%`;

  useEffect(() => {
    const canvas = waveRef.current;
    if (!canvas || !peaks) return;
    canvas.width = peaks.length;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getComputedStyle(canvas).color;
    peaks.forEach((p, x) => {
      const h = Math.max(1, p * canvas.height);
      ctx.fillRect(x, (canvas.height - h) / 2, 1, h);
    });
  }, [peaks]);

  function onTrackClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const src = ((e.clientX - rect.left) / rect.width) * durationSec;
    const cutIndex = cuts.findIndex((c) => src >= c.start && src < c.end);
    if (cutIndex >= 0) return onSelectCut(cutIndex);
    const out = sourceToOutput(plan.segments, src);
    if (out !== null) onSeek(out);
  }

  const playheadSrc = outputToSource(plan.segments, time) ?? plan.segments.at(-1)?.srcEnd ?? 0;

  // faixa "Trechos": arrastar seleciona um pedaço (convertido para o tempo do vídeo editado)
  const srcAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(durationSec, Math.max(0, ((e.clientX - rect.left) / rect.width) * durationSec));
  };
  function onLaneDown(e: PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const src = srcAt(e);
    setDrag({ from: src, to: src, x0: e.clientX });
  }
  function onLaneMove(e: PointerEvent<HTMLDivElement>) {
    if (drag) setDrag({ ...drag, to: srcAt(e) });
  }
  function onLaneUp(e: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const d = { ...drag, to: srcAt(e) };
    setDrag(null);
    if (Math.abs(e.clientX - d.x0) < 4) return;
    const a = sourceToOutputClamped(plan.segments, Math.min(d.from, d.to));
    const b = sourceToOutputClamped(plan.segments, Math.max(d.from, d.to));
    onSelection({ start: Math.round(a * 100) / 100, end: Math.round(b * 100) / 100 });
  }
  const selSrc = drag
    ? { start: Math.min(drag.from, drag.to), end: Math.max(drag.from, drag.to) }
    : selection && !selectedRange
      ? { start: outputToSource(plan.segments, selection.start) ?? 0, end: outputToSourceEnd(plan.segments, selection.end) ?? durationSec }
      : null;

  return (
    <div className="timeline" data-testid="timeline">
      <div className="track" onClick={onTrackClick} title="Clique num trecho para ir até ele; clique num trecho cortado para restaurar ou ajustar">
        {plan.segments.map((s, i) => (
          <div key={`k${i}`} className="kept" style={{ left: pct(s.srcStart), width: width({ start: s.srcStart, end: s.srcEnd }) }} data-testid="kept-segment" />
        ))}
        {peaks && <canvas ref={waveRef} className="wave" data-testid="waveform" />}
        {cuts.map((c, i) => (
          <button
            key={`c${i}-${c.start}`}
            className={`cut ${selectedCut === i ? 'selected' : ''}`}
            style={{ left: pct(c.start), width: width(c) }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectCut(i);
            }}
            title={`Trecho cortado (${(c.end - c.start).toFixed(2)} s): clique para restaurar ou ajustar`}
            aria-label={`Trecho cortado ${i + 1}`}
            data-testid={`cut-${i}`}
          />
        ))}
        <div className="playhead" style={{ left: pct(playheadSrc) }} />
      </div>
      <div className="caption-track">
        {plan.captions.map((c) => {
          const start = outputToSource(plan.segments, c.start);
          const end = outputToSource(plan.segments, Math.max(c.start, c.end - 1e-3));
          if (start === null || end === null) return null;
          return (
            <button key={c.id} className="chip" style={{ left: pct(start), width: width({ start, end: Math.max(end, start + 0.05) }) }} onClick={() => onSeek(c.start + 0.01)} title={c.text} data-testid={`caption-chip-${c.id}`}>
              {c.text}
            </button>
          );
        })}
      </div>
      <div className="range-lane" onPointerDown={onLaneDown} onPointerMove={onLaneMove} onPointerUp={onLaneUp} title="Arraste aqui para selecionar um trecho e pedir uma mudança só nele" data-testid="range-lane">
        <span className="range-lane-label">Trechos: arraste para selecionar</span>
        {plan.ranges.map((r) => (
          <button
            key={r.id}
            className={`range-chip ${r.locked ? 'locked' : ''} ${selectedRange === r.id ? 'selected' : ''}`}
            style={{ left: pct(r.srcStart), width: width({ start: r.srcStart, end: r.srcEnd }) }}
            onClick={() => onPickRange(r.id)}
            title={`${r.locked ? 'Travado' : 'Ajustado'}: ${r.prompt || 'sem pedido'}`}
            aria-label={`Trecho ${r.locked ? 'travado' : 'ajustado'} de ${r.out.start.toFixed(1)} a ${r.out.end.toFixed(1)} segundos`}
            data-testid={`range-${r.id}`}
          >
            {r.locked ? 'travado' : 'ajustado'}
          </button>
        ))}
        {selSrc && <div className="range-sel" style={{ left: pct(selSrc.start), width: width(selSrc) }} data-testid="range-selection" />}
      </div>
      <div className="legend">
        <span className="sw sw-kept" /> mantido <span className="sw sw-cut" /> cortado <span className="sw sw-range" /> trecho ajustado <span className="sw sw-locked" /> trecho travado
      </div>
    </div>
  );
}
