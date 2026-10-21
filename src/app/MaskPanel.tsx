import { useEffect, useState } from 'react';
import { DEFAULT_MASK, type MaskShape, type VideoMask } from '../core/edits';
import type { EditPlan } from '../core/types';

const SHAPES: { id: MaskShape | null; label: string }[] = [
  { id: null, label: 'Nenhuma' },
  { id: 'circle', label: 'Círculo' },
  { id: 'rect', label: 'Retângulo' },
  { id: 'heart', label: 'Coração' },
  { id: 'star', label: 'Estrela' },
  { id: 'diamond', label: 'Losango' },
];

/** Desenho pequeno de cada forma no botão (o mesmo contorno que recorta o vídeo). */
function ShapeIcon({ shape }: { shape: MaskShape | null }) {
  const common = { fill: 'currentColor', opacity: 0.85 };
  return (
    <svg width="18" height="18" viewBox="-10 -10 20 20" aria-hidden>
      {shape === null && <path d="M-7 -7 L7 7 M7 -7 L-7 7" stroke="currentColor" strokeWidth="2" fill="none" />}
      {shape === 'circle' && <circle r="8" {...common} />}
      {shape === 'rect' && <rect x="-8" y="-6" width="16" height="12" rx="3" {...common} />}
      {shape === 'diamond' && <path d="M0 -9 L9 0 L0 9 L-9 0 Z" {...common} />}
      {shape === 'star' && <path d="M0 -9 L2.4 -3.1 L8.6 -2.8 L3.8 1.2 L5.3 7.3 L0 3.8 L-5.3 7.3 L-3.8 1.2 L-8.6 -2.8 L-2.4 -3.1 Z" {...common} />}
      {shape === 'heart' && <path d="M0 8 L-7.2 0 A4.4 4.4 0 0 1 0 -5.5 A4.4 4.4 0 0 1 7.2 0 Z" {...common} />}
    </svg>
  );
}

/**
 * Máscara do vídeo (v0.26): o vídeo aparece só dentro de uma forma (círculo, coração...) e o resto
 * da tela fica com a cor escolhida. Legendas, títulos e emojis ficam por cima, sem recorte.
 * Os controles deslizantes só gravam ao soltar (um passo no desfazer).
 */
export function MaskPanel({ plan, onApply, disabled }: { plan: EditPlan; onApply: (op: (p: EditPlan) => EditPlan) => void; disabled: boolean }) {
  const saved = plan.edits.mask ?? null;
  const [draft, setDraft] = useState<VideoMask | null>(saved);
  const key = JSON.stringify(saved);
  useEffect(() => setDraft(saved), [key]);

  const commit = (m: VideoMask | null) => {
    if (JSON.stringify(m) === key) return;
    onApply((p) => ({ ...p, edits: { ...p.edits, mask: m } }));
  };
  const pick = (shape: MaskShape | null) => commit(shape ? { ...(draft ?? DEFAULT_MASK), shape } : null);

  const slider = (label: string, field: 'size' | 'x' | 'y' | 'aspect' | 'radius' | 'border', min: number, max: number, step: number, show: (v: number) => string) =>
    draft && (
      <label className="framing-row">
        <span>
          {label} <b className="tnum">{show(draft[field])}</b>
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={draft[field]}
          disabled={disabled}
          data-testid={`mask-${field}`}
          onChange={(e) => setDraft({ ...draft, [field]: e.target.valueAsNumber })}
          onPointerUp={() => commit(draft)}
          onKeyUp={() => commit(draft)}
          onBlur={() => commit(draft)}
        />
      </label>
    );
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  return (
    <div className="framing mask-panel" data-testid="mask-panel">
      <span className="hint">Máscara: o vídeo aparece só dentro da forma. Legendas e textos continuam por cima.</span>
      <div className="mask-shapes" role="group" aria-label="Forma da máscara">
        {SHAPES.map((s) => (
          <button key={s.label} type="button" className="sm" aria-pressed={(draft?.shape ?? null) === s.id} disabled={disabled} onClick={() => pick(s.id)} data-testid={`mask-shape-${s.id ?? 'none'}`}>
            <ShapeIcon shape={s.id} /> {s.label}
          </button>
        ))}
      </div>
      {draft && (
        <>
          {slider('Tamanho', 'size', 0.1, 1.5, 0.01, pct)}
          {slider('Altura', 'aspect', 0.3, 3, 0.01, (v) => `${v.toFixed(2).replace('.', ',')}×`)}
          {slider('Esquerda ↔ direita', 'x', 0, 1, 0.01, pct)}
          {slider('Cima ↕ baixo', 'y', 0, 1, 0.01, pct)}
          {draft.shape === 'rect' && slider('Cantos redondos', 'radius', 0, 0.5, 0.01, pct)}
          {slider('Borda', 'border', 0, 40, 1, (v) => `${v} px`)}
          <div className="row wrap">
            <label className="mask-color">
              <input type="color" value={draft.fill} disabled={disabled} onChange={(e) => commit({ ...draft, fill: e.target.value.toUpperCase() })} data-testid="mask-fill" />
              Cor de fundo
            </label>
            {draft.border > 0 && (
              <label className="mask-color">
                <input type="color" value={draft.borderColor} disabled={disabled} onChange={(e) => commit({ ...draft, borderColor: e.target.value.toUpperCase() })} data-testid="mask-border-color" />
                Cor da borda
              </label>
            )}
          </div>
        </>
      )}
    </div>
  );
}
