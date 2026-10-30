import { useMemo, useState } from 'react';
import type { EditPlan, SemanticWordCue, Word } from '../core/types';
import { outputToSource, sourceToOutput } from '../engine/timeline';
import { scheduledPlanCues } from '../editorial/semantic-word-edits';

interface Props {
  plan: EditPlan;
  words: readonly Word[];
  time: number;
  disabled: boolean;
  onAdd: (word: Word) => void;
  /** devolve quantos destaques foram criados */
  onSuggest?: () => number;
  onRemove: (id: string) => void;
  onReanchor: (id: string, word: Word) => void;
  onOffset: (id: string, frames: number) => void;
  onEffect: (id: string, effect: NonNullable<SemanticWordCue['effect']>) => void;
  onSeek: (t: number) => void;
}

const format = (sec: number) => `${sec.toFixed(2).replace('.', ',')} s`;

/** Small optional control in Legendas. Nothing is inferred or sent automatically. */
export function SemanticCuePanel({ plan, words, time, disabled, onAdd, onRemove, onReanchor, onOffset, onEffect, onSeek, onSuggest }: Props) {
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<number | null>(null);
  const src = outputToSource(plan.segments, Math.min(time, Math.max(0, plan.segments.reduce((s, p) => s + p.srcEnd - p.srcStart, 0) - .001)));
  const available = useMemo(() => {
    const spoken = new Set(plan.captions.flatMap(c => c.wordIds));
    return words.filter(w => spoken.has(w.id) && w.text.trim().length > 0 && w.text.trim().length <= 30 &&
      w.end > w.start && plan.segments.some(s => w.start >= s.srcStart - 1e-6 && w.end <= s.srcEnd + 1e-6))
      .sort((a,b) => a.start - b.start);
  }, [words, plan.captions, plan.segments]);
  // A seek moves the window; while playing, choose only twice per second.
  // Binary search avoids sorting all (potentially thousands of) words every frame.
  const nearestHalfSecond = Math.floor((src ?? 0) * 2) / 2;
  const closest = useMemo(() => {
    let lo = 0, hi = available.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (available[mid]!.start < nearestHalfSecond) lo = mid + 1;
      else hi = mid;
    }
    return available.slice(Math.max(0, lo-12), Math.min(available.length, lo+12))
      .sort((a,b) => Math.abs(a.start-nearestHalfSecond)-Math.abs(b.start-nearestHalfSecond))
      .slice(0,12).sort((a,b)=>a.start-b.start);
  }, [available, nearestHalfSecond]);
  const picked = closest.find(w => w.id === pickedId) ?? closest[0] ?? null;
  const cues = plan.semanticCues ?? [];
  const scheduled = scheduledPlanCues(plan);
  const selected = (cueId: string) => scheduled.find(c => c.cueId === cueId);

  return (
    <section className="set-sub stack" data-testid="semantic-cue-panel" aria-label="Destaques sincronizados com a fala">
      <div className="stack" style={{ gap: 4 }}>
        <b>Destaques nas palavras</b>
        <small className="hint">Escolha uma palavra e o movimento visual. Os efeitos acompanham a fala, inclusive após os cortes, na prévia e no vídeo final.</small>
      </div>
      {available.length === 0 ? (
        <p className="hint" role="status" data-testid="semantic-no-words">Não há palavras com tempos confirmados neste trecho. Faça ou corrija a transcrição antes de destacar.</p>
      ) : (
        <div className="set-row">
          <label className="stack" style={{ flex: '1 1 160px', minWidth: 0 }}>
            <small>Palavra próxima da agulha</small>
            <select data-testid="semantic-word-select" aria-label="Palavra da fala para destacar" value={picked?.id ?? ''} onChange={e=> setPickedId(e.target.value)}>
              {closest.map(w => <option key={w.id} value={w.id}>{w.text} · {format(sourceToOutput(plan.segments, w.start) ?? w.start)}</option>)}
            </select>
          </label>
          <button type="button" className="sm primary" data-testid="semantic-add-current" disabled={disabled || !picked || cues.length >= 60} onClick={()=> picked && onAdd(picked)}>Destacar palavra</button>
        </div>
      )}
      {available.length > 0 && onSuggest && (
        <div className="set-row">
          <button type="button" className="sm" data-testid="semantic-suggest" disabled={disabled || cues.length >= 60} onClick={() => { const n = onSuggest(); setSuggested(n); }}>Sugerir destaques automáticos</button>
          <small className="hint">Escolhe até 8 palavras fortes da sua fala, espaçadas. Remova as que não quiser.</small>
          {suggested !== null && <small role="status" data-testid="semantic-suggest-result">{suggested > 0 ? `Adicionei ${suggested} destaque${suggested === 1 ? '' : 's'}. Ctrl+Z desfaz.` : 'Não achei palavras fortes novas nesta fala. Escolha uma palavra acima e clique em Destacar palavra.'}</small>}
        </div>
      )}
      {cues.length > 0 && (
        <div className="stack" data-testid="semantic-cue-list">
          <small className="hint">{cues.length} efeito(s) por palavra. Você pode trocar o estilo, a palavra e o início, ou remover.</small>
          {cues.map(cue => {
            const instance = selected(cue.id);
            return (
              <div className="set-sub" key={cue.id} data-testid={`semantic-cue-${cue.id}`}>
                <div className="set-row">
                  <button className="sm ghost" type="button" disabled={!instance} onClick={()=> instance && onSeek(instance.startFrame / plan.output.fps)}>{cue.source.text} · {instance ? format(instance.startFrame / plan.output.fps) : 'cortada'}</button>
                  <button type="button" className="sm ghost" disabled={disabled || !picked || (picked.id===cue.wordId)} onClick={()=>picked && onReanchor(cue.id,picked)} data-testid={`semantic-reanchor-${cue.id}`}>Mover para palavra escolhida</button>
                  <button type="button" className="sm ghost danger" disabled={disabled} onClick={()=>onRemove(cue.id)} data-testid={`semantic-remove-${cue.id}`}>Remover</button>
                </div>
                <label className="stack" style={{ minWidth: 0 }}>
                  <small>Movimento de {cue.source.text}</small>
                  <select aria-label={`Movimento visual da palavra ${cue.source.text}`} data-testid={`semantic-effect-${cue.id}`}
                    value={cue.effect ?? 'emphasis'} disabled={disabled}
                    onChange={e => onEffect(cue.id, e.target.value as NonNullable<SemanticWordCue['effect']>)}>
                    <option value="emphasis">Destaque (cor e peso)</option>
                    <option value="underline">Sublinhado animado</option>
                    <option value="pulse">Pulso suave</option>
                  </select>
                </label>
                <label className="set-check">
                  <small>Deslocamento inicial (quadros)</small>
                  <input type="number" min="-30" max="30" step="1" value={cue.offsetFrames} disabled={disabled} aria-label={`Deslocamento de ${cue.source.text} em quadros`} data-testid={`semantic-offset-${cue.id}`}
                    onChange={e => { const n = Number(e.target.value); if (e.target.value && Number.isSafeInteger(n) && n >= -30 && n <= 30) onOffset(cue.id,n); }} />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
