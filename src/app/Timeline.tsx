import { useEffect, useRef, type MouseEvent } from 'react';
import type { EditPlan, TimeRange } from '../core/types';
import { outputToSource, sourceToOutput } from '../engine/timeline';

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
}

/**
 * Linha do tempo no tempo do vídeo original: trechos mantidos, cortes (clicáveis),
 * waveform do áudio e legendas. Clicar num trecho mantido leva o player até ali.
 */
export function Timeline({ durationSec, plan, cuts, peaks, time, selectedCut, onSeek, onSelectCut }: Props) {
  const waveRef = useRef<HTMLCanvasElement>(null);
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
      <div className="legend">
        <span className="sw sw-kept" /> mantido <span className="sw sw-cut" /> cortado
      </div>
    </div>
  );
}
