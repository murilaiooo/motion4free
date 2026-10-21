import { useState } from 'react';
import { Diamond, Plus, Trash2, X } from 'lucide-react';
import { MAX_KEYS } from '../core/edits';
import type { EditPlan } from '../core/types';
import { findElement } from '../editorial/elements';
import { addKeyframe, clearKeyframes, patchKeyframe, removeKeyframe } from '../editorial/manual';
import { keyAt } from '../render/keyframes';

const secs = (s: number) => `${s.toFixed(2).replace('.', ',')} s`;

/**
 * Animação por pontos (keyframes, v0.26): o usuário marca pontos no tempo; em cada ponto o elemento tem
 * posição, tamanho, giro e opacidade, e entre dois pontos ele anda sozinho de um para o outro.
 * Com pontos, arrastar o elemento na prévia ajusta (ou cria) o ponto na agulha.
 */
export function KeyframePanel({ plan, id, time, onApply, onSeek, disabled }: { plan: EditPlan; id: string; time: number; onApply: (op: (p: EditPlan) => EditPlan) => void; onSeek: (t: number) => void; disabled: boolean }) {
  const el = plan.edits.added.find((a) => a.id === id);
  const at = findElement(plan, { type: 'added', id });
  const [opacity, setOpacity] = useState<{ i: number; v: number } | null>(null);
  if (!el || !at) return null;
  const keys = el.keys ?? [];
  const inside = time >= at.start - 1e-3 && time <= at.end + 1e-3;
  const here = keyAt(keys, time - at.start);
  const commitOpacity = () => {
    if (!opacity) return;
    const o = opacity;
    setOpacity(null);
    if (Math.abs((keys[o.i]?.opacity ?? -1) - o.v) > 1e-3) onApply((p) => patchKeyframe(p, id, o.i, { opacity: o.v }));
  };

  return (
    <details className="fold keyframes" open data-testid="keyframes">
      <summary>Animação por pontos</summary>
      <p className="hint">
        {keys.length === 0
          ? 'Faça o elemento andar, crescer, girar ou sumir: leve a agulha até um instante e marque um ponto; depois vá para outro instante e arraste o elemento no vídeo. Ele anda sozinho de um ponto ao outro.'
          : 'Arraste o elemento no vídeo para mudar o ponto da agulha (ou criar um novo ali). Entre dois pontos ele anda sozinho.'}
      </p>
      <div className="row wrap">
        <button type="button" className="sm" disabled={disabled || !inside || here >= 0 || keys.length >= MAX_KEYS} onClick={() => onApply((p) => addKeyframe(p, id, time))} data-testid="key-add">
          <Plus size={13} aria-hidden /> Marcar ponto aqui ({secs(Math.max(0, time - at.start))})
        </button>
        {keys.length > 0 && (
          <button type="button" className="sm ghost" disabled={disabled} onClick={() => onApply((p) => clearKeyframes(p, id, inside ? time : at.start))} data-testid="key-clear">
            <X size={13} aria-hidden /> Tirar animação
          </button>
        )}
      </div>
      {!inside && <p className="hint">A agulha está fora do tempo deste elemento: use “Ir até ele” para marcar pontos.</p>}
      {keys.length > 0 && (
        <ol className="key-list" aria-label="Pontos de animação">
          {keys.map((k, i) => (
            <li key={`${i}-${k.at}`} className={i === here ? 'current' : ''} data-testid={`key-${i}`}>
              <button type="button" className="sm ghost key-time" onClick={() => onSeek(at.start + k.at + 0.001)} aria-label={`Ir até o ponto ${i + 1}`}>
                <Diamond size={12} aria-hidden /> {secs(k.at)}
              </button>
              <label className="key-opacity">
                <span className="sr-only">Opacidade do ponto {i + 1}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={opacity?.i === i ? opacity.v : k.opacity}
                  disabled={disabled}
                  onChange={(e) => setOpacity({ i, v: e.target.valueAsNumber })}
                  onPointerUp={commitOpacity}
                  onKeyUp={commitOpacity}
                  onBlur={commitOpacity}
                  data-testid={`key-${i}-opacity`}
                />
                <b className="tnum">{Math.round((opacity?.i === i ? opacity.v : k.opacity) * 100)}%</b>
              </label>
              {i > 0 && (
                <select value={k.ease} disabled={disabled} onChange={(e) => onApply((p) => patchKeyframe(p, id, i, { ease: e.target.value === 'linear' ? 'linear' : 'smooth' }))} aria-label={`Como chega no ponto ${i + 1}`} data-testid={`key-${i}-ease`}>
                  <option value="smooth">Suave</option>
                  <option value="linear">Reto</option>
                </select>
              )}
              <button type="button" className="icon sm ghost" disabled={disabled} onClick={() => onApply((p) => removeKeyframe(p, id, i))} aria-label={`Apagar o ponto ${i + 1}`} data-testid={`key-${i}-delete`}>
                <Trash2 size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      )}
      {keys.length > 0 && <p className="hint">Opacidade: 0% some, 100% aparece inteiro. {keys.length} de {MAX_KEYS} pontos.</p>}
    </details>
  );
}
