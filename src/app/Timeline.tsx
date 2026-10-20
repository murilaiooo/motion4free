import { useEffect, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Captions, Film, SquareDashedMousePointer, ZoomIn, ZoomOut } from 'lucide-react';
import type { EditPlan, TimeRange } from '../core/types';
import { outputToSource, outputToSourceEnd, sourceToOutput, sourceToOutputClamped } from '../engine/timeline';

interface Props {
  durationSec: number;
  plan: EditPlan;
  cuts: TimeRange[];
  peaks: Float32Array | null;
  /** tempo de saída do player */
  time: number;
  playing: boolean;
  selectedCut: number | null;
  onSeek: (outTime: number) => void;
  onSelectCut: (index: number) => void;
  /** pedaço selecionado para ajuste (tempo do vídeo editado) */
  selection: TimeRange | null;
  selectedRange: string | null;
  onSelection: (out: TimeRange) => void;
  onPickRange: (id: string) => void;
}

const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8, 12, 16];
const STEPS = [0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120];

function clock(s: number, step: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  const ss = step < 1 ? sec.toFixed(1).padStart(4, '0') : String(Math.round(sec)).padStart(2, '0');
  return `${m}:${ss}`;
}

/**
 * Linha do tempo no tempo do vídeo original, em faixas: régua (clique/arraste para ir), vídeo (trechos
 * mantidos, cortes clicáveis e waveform), legendas e trechos (arraste para selecionar). Com zoom.
 */
export function Timeline({ durationSec, plan, cuts, peaks, time, playing, selectedCut, onSeek, onSelectCut, selection, selectedRange, onSelection, onPickRange }: Props) {
  const waveRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; x0: number } | null>(null);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [viewW, setViewW] = useState(800);
  const [scrub, setScrub] = useState(false);
  const zoom = ZOOMS[zoomIdx]!;
  const pct = (src: number) => `${(100 * src) / durationSec}%`;
  const width = (r: TimeRange) => `${(100 * (r.end - r.start)) / durationSec}%`;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    setViewW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

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

  const playheadSrc = outputToSource(plan.segments, time) ?? plan.segments.at(-1)?.srcEnd ?? 0;

  // com zoom, a linha do tempo acompanha o player enquanto toca
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || zoom === 1 || !playing) return;
    const x = (playheadSrc / durationSec) * el.scrollWidth;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - 24) el.scrollLeft = x - el.clientWidth * 0.2;
  }, [playheadSrc, playing, zoom, durationSec]);

  function setZoom(next: number) {
    const el = scrollRef.current;
    const idx = Math.max(0, Math.min(ZOOMS.length - 1, next));
    if (!el) return setZoomIdx(idx);
    // mantém a agulha no mesmo lugar da tela
    const ratio = playheadSrc / durationSec;
    const before = ratio * el.scrollWidth - el.scrollLeft;
    setZoomIdx(idx);
    requestAnimationFrame(() => {
      el.scrollLeft = ratio * el.scrollWidth - before;
    });
  }

  function onTrackClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const src = ((e.clientX - rect.left) / rect.width) * durationSec;
    const cutIndex = cuts.findIndex((c) => src >= c.start && src < c.end);
    if (cutIndex >= 0) return onSelectCut(cutIndex);
    const out = sourceToOutput(plan.segments, src);
    if (out !== null) onSeek(out);
  }

  const srcAt = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return Math.min(durationSec, Math.max(0, ((e.clientX - rect.left) / rect.width) * durationSec));
  };

  // régua: clicar ou arrastar leva a prévia até ali
  const rulerSeek = (e: PointerEvent<HTMLDivElement>) => onSeek(sourceToOutputClamped(plan.segments, srcAt(e)));

  // faixa "Trechos": arrastar seleciona um pedaço (convertido para o tempo do vídeo editado)
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

  // marcas da régua: passo que deixa ~80 px entre os números
  const pxPerSec = (viewW * zoom) / Math.max(0.001, durationSec);
  const step = STEPS.find((s) => s * pxPerSec >= 80) ?? 300;
  const ticks: number[] = [];
  for (let s = 0; s <= durationSec + 1e-6 && ticks.length < 2000; s += step) ticks.push(s);

  return (
    <section className="timeline" data-testid="timeline" aria-label="Linha do tempo">
      <div className="tl-head">
        <h2 className="tl-title">Linha do tempo</h2>
        <div className="tl-legend" aria-hidden>
          <span className="sw sw-kept" /> mantido <span className="sw sw-cut" /> cortado <span className="sw sw-range" /> ajustado <span className="sw sw-locked" /> travado
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
        <div className="tl-labels" aria-hidden>
          <span className="tl-label tl-label-ruler" />
          <span className="tl-label tl-label-video">
            <Film size={14} /> Vídeo
          </span>
          <span className="tl-label tl-label-cap">
            <Captions size={14} /> Legendas
          </span>
          <span className="tl-label tl-label-range">
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
            <div className="tl-lanes">
            <div
              className="tl-ruler"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                setScrub(true);
                rulerSeek(e);
              }}
              onPointerMove={(e) => scrub && rulerSeek(e)}
              onPointerUp={() => setScrub(false)}
              title="Clique ou arraste para ir até um ponto"
              data-testid="ruler"
            >
              {ticks.map((s) => (
                <span key={s} className="tick" style={{ left: pct(s) }}>
                  {clock(s, step)}
                </span>
              ))}
            </div>
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
            </div>
            <div className="caption-track">
              {plan.captions.map((c) => {
                const start = outputToSource(plan.segments, c.start);
                const end = outputToSource(plan.segments, Math.max(c.start, c.end - 1e-3));
                if (start === null || end === null) return null;
                return (
                  <button key={c.id} className="cap-chip" style={{ left: pct(start), width: width({ start, end: Math.max(end, start + 0.05) }) }} onClick={() => onSeek(c.start + 0.01)} title={c.text} data-testid={`caption-chip-${c.id}`}>
                    {c.text}
                  </button>
                );
              })}
            </div>
            <div className="range-lane" onPointerDown={onLaneDown} onPointerMove={onLaneMove} onPointerUp={onLaneUp} title="Arraste aqui para selecionar um trecho e pedir uma mudança só nele" data-testid="range-lane">
              {plan.ranges.length === 0 && !selSrc && <span className="range-lane-label">Arraste aqui para selecionar um trecho</span>}
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
            <div className="tl-playhead" style={{ left: pct(playheadSrc) }} aria-hidden />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
