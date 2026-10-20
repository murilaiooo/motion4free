import { useEffect, useState } from 'react';
import { LABELS, describeLook } from '../core/brief';
import { AppError, toAppError } from '../core/errors';
import type { RangeEdit, TimeRange, Word } from '../core/types';
import { RANGE_PROMPT_MAX, type RangeRequest } from '../editorial/range-interpret';
import { interpretRangeLayered } from '../editorial/range-ai';
import { prepareAi, type AiSettings } from './AiOptions';
import { ErrorBox } from './ErrorBox';

const EXAMPLES = ['mais calmo aqui', 'sem animação aqui', 'troca essa animação', 'destaque isso', 'trava esse pedaço', 'legenda vermelha aqui'];

const fmt = (s: number) => `${s.toFixed(2).replace('.', ',')} s`;

/** O que o trecho tem de pedido, em frases curtas. */
function summarize(r: RangeEdit): string[] {
  const out: string[] = [];
  if (r.locked) out.push('Travado: não muda com trocas de estilo, pedido geral ou cortes em outros lugares.');
  if (r.quiet) out.push('Sem animação neste trecho');
  if (r.tone) out.push(`Tom ${LABELS.tone[r.tone]}`);
  if (r.intensity) out.push(LABELS.intensity[r.intensity][0]!.toUpperCase() + LABELS.intensity[r.intensity].slice(1));
  if (r.pace) out.push(LABELS.pace[r.pace][0]!.toUpperCase() + LABELS.pace[r.pace].slice(1));
  if (r.forbid.length) out.push(`Sem: ${r.forbid.map((p) => LABELS.prohibition[p]).join(', ')}`);
  if (r.emphasize.length) out.push(`Destacar ${r.emphasize.map((e) => LABELS.emphasis[e]).join(', ')}`);
  if (r.accent) out.push('Destaque (palavra-chave e zoom)');
  if (r.look) out.push(...describeLook(r.look));
  if (r.variant > 0) out.push(`Animação trocada ${r.variant === 1 ? '1 vez' : `${r.variant} vezes`}`);
  return out;
}

interface Props {
  /** pedaço selecionado (tempo do vídeo editado) */
  selection: TimeRange;
  /** trecho já ajustado, se a seleção for um deles */
  range: RangeEdit | null;
  total: number;
  onSelection: (out: TimeRange) => void;
  /** aplica o pedido; devolve o erro (se houver) para mostrar aqui */
  onRequest: (req: RangeRequest) => AppError | null;
  onClose: () => void;
  onSeek: (t: number) => void;
  disabled: boolean;
  /** escolha de IA (a mesma do pedido geral) */
  ai: AiSettings;
  /** palavras faladas no trecho (só vão para a IA, se escolhida) */
  words: Word[];
}

/** Painel do trecho: limites, pedido em português e o que o trecho tem. Tudo entra no desfazer. */
export function RangePanel({ selection, range, total, onSelection, onRequest, onClose, onSeek, disabled, ai, words }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<AppError | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [warning, setWarning] = useState<AppError | null>(null);
  const [notDone, setNotDone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
    setNotes([]);
    setWarning(null);
    setNotDone([]);
  }, [range?.id, selection.start, selection.end]);

  async function send(t: string) {
    setError(null);
    setNotes([]);
    setWarning(null);
    setNotDone([]);
    setBusy('Entendendo o pedido…');
    try {
      const prepared = await prepareAi(ai, setBusy);
      const { req, warning: w } = await interpretRangeLayered(t, words, prepared.ai);
      setWarning(w ?? prepared.warning);
      setNotDone(req.unsupported);
      if (!req.understood) {
        setError(new AppError('TRECHO_NAO_ENTENDIDO', [...req.unsupported, ...req.ignored].slice(0, 8).join(', ')));
        return;
      }
      const err = onRequest(req);
      if (err) setError(err);
      else {
        setNotes(req.notes);
        setText('');
      }
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setBusy(null);
    }
  }
  const off = disabled || busy !== null;

  const setEdge = (which: 'start' | 'end', v: number) => {
    if (!Number.isFinite(v)) return;
    onSelection(which === 'start' ? { start: v, end: selection.end } : { start: selection.start, end: v });
  };

  return (
    <section className="range-panel" aria-label="Ajuste do trecho" data-testid="range-panel">
      <h2>{range ? (range.locked ? 'Trecho travado' : 'Trecho ajustado') : 'Trecho selecionado'}</h2>
      <p>
        De <b data-testid="range-start-label">{fmt(selection.start)}</b> até <b data-testid="range-end-label">{fmt(selection.end)}</b> do vídeo editado ({fmt(selection.end - selection.start)}). O resto do vídeo não muda.{' '}
        <button type="button" onClick={() => onSeek(selection.start + 0.01)} data-testid="range-seek">
          Ir para o começo do trecho
        </button>
      </p>
      {!range && (
        <div className="range-fields">
          <label>
            Início (s)
            <input key={`a${selection.start}`} type="number" step="0.1" min={0} max={total} defaultValue={selection.start} data-testid="range-start" onBlur={(e) => setEdge('start', e.target.valueAsNumber)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          </label>
          <label>
            Fim (s)
            <input key={`b${selection.end}`} type="number" step="0.1" min={0} max={total} defaultValue={selection.end} data-testid="range-end" onBlur={(e) => setEdge('end', e.target.valueAsNumber)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
          </label>
        </div>
      )}
      {range && (
        <ul data-testid="range-summary">
          {summarize(range).map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      <p className="hint">O que mudar neste trecho? Exemplos (toque para usar):</p>
      <div className="examples">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="example" onClick={() => void send(e)} disabled={off} data-testid={`range-example-${e.split(' ')[0]}`}>
            {e}
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={RANGE_PROMPT_MAX} rows={2} placeholder="Ex.: mais calmo aqui, sem zoom" aria-label="O que mudar neste trecho?" data-testid="range-input" disabled={off} />
      <div className="actions">
        <button className="primary" onClick={() => void send(text)} disabled={off} data-testid="range-apply">
          Aplicar no trecho
        </button>
        {range && (
          <button onClick={() => void send(range.locked ? 'destrava' : 'trava')} disabled={off} data-testid="range-lock">
            {range.locked ? 'Destravar' : 'Travar este trecho'}
          </button>
        )}
        {range && (
          <button onClick={() => void send(range.locked ? 'destrava e volta ao normal' : 'volta ao normal')} disabled={off} data-testid="range-reset">
            Voltar ao normal
          </button>
        )}
        <button onClick={onClose} data-testid="range-close">
          Fechar
        </button>
      </div>
      {notes.length > 0 && (
        <ul className="brief-notes" data-testid="range-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      {busy && (
        <p className="status" role="status">
          {busy}
        </p>
      )}
      {notDone.length > 0 && (
        <p className="hint" data-testid="range-unsupported">
          <b>Ainda não sei fazer:</b> {notDone.join('; ')}
        </p>
      )}
      {warning && <ErrorBox error={warning} kind="warning" />}
      {error && <ErrorBox error={error} kind={error.key === 'TRECHO_NAO_ENTENDIDO' || error.key === 'TRECHO_SEM_ALTERNATIVA' ? 'warning' : 'error'} />}
    </section>
  );
}
