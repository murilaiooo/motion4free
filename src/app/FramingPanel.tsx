import { useEffect, useState } from 'react';
import { Crosshair } from 'lucide-react';
import { VIDEO_SCALE } from '../core/edits';
import type { EditPlan } from '../core/types';
import { setFraming as setClipFraming } from '../editorial/assembly';
import { FRAMING_ZOOM_MAX, applyFramingView, framingView, type FramingView } from '../editorial/framing-view';

interface Props {
  plan: EditPlan;
  /** vídeo montado de vários clipes (enquadramento por clipe, ADR-0019); senão, um vídeo só (moldura manual, ADR-0018) */
  multi: boolean;
  onChange: (next: EditPlan) => void;
  disabled?: boolean;
  hasFaceTracks?: boolean;
  onTrackFaces?: (clipId: string | null) => void;
  faceProgress?: number | null;
  onCancelFaces?: () => void;
}

/**
 * Enquadramento do vídeo no formato de saída: preencher a tela (corta as sobras) ou mostrar o quadro inteiro
 * (com o próprio vídeo desfocado atrás), aproximar e mover. Essencial para vídeo deitado virar Reels e vice-versa.
 * Os controles deslizantes só gravam ao soltar, para o desfazer não ganhar um passo por pixel.
 */
export function FramingPanel({ plan, multi, onChange, disabled, hasFaceTracks = false, onTrackFaces, faceProgress = null, onCancelFaces }: Props) {
  const [clipId, setClipId] = useState<string | null>(null);
  const target = multi && clipId && plan.clips.some((c) => c.id === clipId) ? clipId : null;
  const saved = framingView(plan, multi, target);
  const [draft, setDraft] = useState<FramingView>(saved);
  const key = JSON.stringify(saved);
  useEffect(() => setDraft(saved), [key]);

  const smart = hasFaceTracks && (target ? plan.clips.find((clip) => clip.id === target)?.framing?.mode === 'smart' : plan.clips.some((clip) => (clip.framing ?? plan.framing).mode === 'smart'));
  const commit = (v: FramingView) => {
    if (JSON.stringify(v) === key && !smart) return;
    const manual = { ...plan, framing: target ? plan.framing : { ...plan.framing, mode: 'fill' as const }, clips: plan.clips.map((clip) => (!target || clip.id === target) && clip.framing?.mode === 'smart' ? { ...clip, framing: { ...clip.framing, mode: 'fill' as const } } : clip) };
    onChange(applyFramingView(manual, multi, target, v));
  };
  const centered = draft.zoom === 1 && draft.x === 0 && draft.y === 0;
  const zoomMin = multi ? 1 : VIDEO_SCALE.min;
  const slider = (label: string, field: 'zoom' | 'x' | 'y', min: number, max: number, testid: string) => (
    <label className="framing-row">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={draft[field]}
        disabled={disabled}
        data-testid={testid}
        onChange={(e) => setDraft({ ...draft, [field]: e.target.valueAsNumber })}
        onPointerUp={() => commit(draft)}
        onKeyUp={() => commit(draft)}
        onBlur={() => commit(draft)}
      />
    </label>
  );

  return (
    <div className="framing" data-testid="framing-panel">
      <div className="framing-head">
        <span className="hint">Enquadramento</span>
        {multi && plan.clips.length > 1 && (
          <select value={target ?? ''} onChange={(e) => setClipId(e.target.value || null)} disabled={disabled} aria-label="Aplicar enquadramento em" data-testid="framing-target">
            <option value="">Todos os clipes</option>
            {plan.clips.map((c, i) => (
              <option key={c.id} value={c.id}>
                Só o clipe {i + 1}{c.framing ? ' (próprio)' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      {onTrackFaces && <div className="stack">
        <p className="set-sub-title">Seguir o rosto</p>
        <p className="hint">Útil quando o vídeo é deitado e sai em pé (ou o contrário): o quadro acompanha o rosto em vez de cortar no meio. Tudo é feito neste computador; na primeira vez baixa um detector pequeno (cerca de 1 MB). Segue o rosto mais próximo da câmera; não sabe quem está falando. Se não gostar, os controles abaixo mandam mais que o rosto.</p>
        <div className="notice-row">
          <button type="button" className="sm" disabled={disabled} onClick={() => onTrackFaces(target)} data-testid="framing-track-faces">Seguir o rosto {target ? 'neste clipe' : 'em todos os clipes'}</button>
          {faceProgress !== null && <><span role="status">Analisando: {Math.round(faceProgress * 100)}%</span><button type="button" className="sm ghost" onClick={onCancelFaces}>Cancelar análise</button></>}
          {smart && <span className="hint">Seguindo o rosto. Mexer no zoom ou na posição abaixo troca para o enquadramento manual.</span>}
        </div>
      </div>}
      <div className="segmented" role="group" aria-label="Como o vídeo ocupa a tela">
        <button type="button" aria-pressed={!draft.whole} disabled={disabled} onClick={() => commit({ ...draft, whole: false, zoom: Math.max(1, draft.zoom) })} data-testid="framing-fill">
          Preencher a tela
        </button>
        <button type="button" aria-pressed={draft.whole} disabled={disabled} onClick={() => commit({ ...draft, whole: true })} data-testid="framing-fit">
          Mostrar inteiro
        </button>
      </div>
      <p className="hint">
        {draft.whole ? 'O vídeo aparece todo, com ele mesmo desfocado atrás.' : 'O vídeo cobre a tela e as sobras são cortadas. Mova para escolher o que aparece.'}
      </p>
      {slider('Aproximar', 'zoom', zoomMin, FRAMING_ZOOM_MAX, 'framing-zoom')}
      {slider('Esquerda ↔ direita', 'x', -1, 1, 'framing-x')}
      {slider('Cima ↕ baixo', 'y', -1, 1, 'framing-y')}
      <div className="notice-row">
        <button
          type="button"
          className="sm ghost"
          disabled={disabled || centered}
          onClick={() => commit({ ...draft, zoom: 1, x: 0, y: 0 })}
          data-testid="framing-center"
        >
          <Crosshair size={14} aria-hidden /> Centralizar
        </button>
        {multi && target && plan.clips.find((c) => c.id === target)?.framing && (
          <button type="button" className="sm ghost" disabled={disabled} onClick={() => onChange(setClipFraming(plan, target, null))} data-testid="framing-inherit">
            Igual aos outros clipes
          </button>
        )}
      </div>
    </div>
  );
}
