import type { ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, CircleAlert, Clock3, Download, FileVideo2, Play, SquarePen, WandSparkles } from 'lucide-react';
import { clock } from '../editorial/highlights';
import type { ClipItem } from './ClipMaker';
import type { TranscriptIndex } from '../editorial/clip-context';
import { contextAround } from '../editorial/clip-context';
import { ErrorBox } from './ErrorBox';
import { ProgressPanel } from './ProgressPanel';
import type { Progress } from '../core/progress';
import type { AppError } from '../core/errors';

type ReviewProps = {
  item: ClipItem;
  index: number;
  expanded: boolean;
  active: boolean;
  playing: boolean;
  busy: boolean;
  still?: string;
  sourceContext: TranscriptIndex;
  openingProgress?: Progress | null;
  openingError?: AppError | null;
  onToggle: (checked: boolean) => void;
  onTitle: (title: string) => void;
  onExpand: () => void;
  onPreview: (context: boolean) => void;
  onNudge: (edge: 'start' | 'end', direction: -1 | 1) => void;
  onRender: () => void;
  onEditor: () => void;
  onJobDismiss: () => void;
  onOpeningDismiss: () => void;
};

/**
 * One result = one compact card. Optional inspector is inside the same article
 * so keyboard users never lose source context or edit state when switching.
 */
export function ClipReviewCard({
  item: it, index, expanded, active, playing, busy, still, sourceContext,
  openingProgress, openingError, onToggle, onTitle, onExpand, onPreview,
  onNudge, onRender, onEditor, onJobDismiss, onOpeningDismiss,
}: ReviewProps) {
  const moment = it.m;
  const secs = Math.max(0, Math.round(moment.end - moment.start));
  const proven = moment.sourceEvidence?.source === 'ai-context';
  const review = moment.sourceEvidence?.review ?? [];
  const status = it.job.kind === 'done' ? 'Pronto para baixar' : it.job.kind === 'working' ? 'Gerando…' :
    it.job.kind === 'error' ? 'Falhou' : proven ? 'Revisto pela IA' : 'Sugestão local';
  const context = expanded ? contextAround(sourceContext, moment.start, moment.end) : null;

  return (
    <article className={`clip-card${it.checked ? ' on' : ''}${active ? ' active' : ''}${expanded ? ' expanded' : ''}`}
      data-testid="clip-card" aria-label={`Clipe ${index + 1}: ${moment.title}`}>
      <div className="clip-card-main">
        <div className="clip-thumb" aria-hidden="true">
          {still ? <img src={still} alt="" loading="lazy" /> : <FileVideo2 size={28} />}
          <span className="clip-thumb-duration">{secs}s</span>
        </div>
        <div className="clip-card-content">
          <div className="clip-card-topline">
            <label className="clip-select">
              <input type="checkbox" checked={it.checked} disabled={busy}
                onChange={e => onToggle(e.target.checked)} data-testid="clip-check"
                aria-label={`Selecionar clipe ${index + 1}`} />
              <span>Clipe {index + 1}</span>
            </label>
            <span className={`clip-state${proven ? ' clip-state-ai' : ''}${it.job.kind === 'error' ? ' clip-state-error' : ''}`}
              data-testid="clip-provenance" title={proven ? 'Análise contextual da IA, revise antes de exportar' : 'Escolhido por regras locais; não validado por IA'}>
              {status}
            </span>
          </div>
          <label className="clip-title-label" htmlFor={`clip-title-${it.uid}`}>Título do clipe {index + 1}</label>
          <input id={`clip-title-${it.uid}`} className="clip-title" type="text"
            maxLength={100} value={moment.title} disabled={busy}
            onChange={e => onTitle(e.target.value)} data-testid="clip-title"
            aria-label={`Título do clipe ${index + 1}`} />
          <div className="clip-meta-row">
            <span className="clip-time tnum"><Clock3 size={13} aria-hidden /> {clock(moment.start)}–{clock(moment.end)}</span>
            {review.length > 0 && <span className="clip-needs-review" title={review.join(' · ')}>Conferir contexto</span>}
            {moment.userBounds && <span className="clip-edited">Corte ajustado</span>}
          </div>
          <p className="clip-description" data-testid="clip-summary">
            {moment.reasons[0] ? `${moment.reasons[0]}. ` : ''}{moment.text || 'Sem fala reconhecida neste trecho.'}
          </p>
        </div>
      </div>
      <div className="clip-card-actions" role="group" aria-label={`Ações do clipe ${index + 1}`}>
        <button className="sm clip-action-preview" type="button" onClick={() => onPreview(false)}
          data-testid="clip-preview" aria-label={`${active && playing ? 'Pausar' : 'Assistir'} clipe ${index + 1}`}>
          <Play size={15} aria-hidden /> {active && playing ? 'Pausar' : 'Assistir'}
        </button>
        <button className="sm clip-action-details" type="button" aria-expanded={expanded}
          aria-controls={`clip-inspector-${it.uid}`} onClick={onExpand} data-testid="clip-details">
          {expanded ? <ChevronUp size={15} aria-hidden /> : <ChevronDown size={15} aria-hidden />}
          {expanded ? 'Fechar detalhes' : 'Revisar trecho'}
        </button>
        <button className="sm" type="button" disabled={busy} onClick={onEditor} data-testid="clip-edit">
          <SquarePen size={15} aria-hidden /> Editar
        </button>
        {it.job.kind === 'done' ? (
          <a className="btn sm primary clip-action-export" href={it.job.url} download={it.job.name} data-testid="clip-download">
            <Download size={15} aria-hidden /> Baixar MP4
          </a>
        ) : (
          <button className="sm primary clip-action-export" type="button" disabled={busy}
            onClick={onRender} data-testid="clip-render">
            <WandSparkles size={15} aria-hidden /> Gerar MP4
          </button>
        )}
      </div>
      {(openingProgress || openingError || it.job.kind !== 'idle') && (
        <div className="clip-card-feedback" aria-live="polite">
          {openingProgress && <ProgressPanel progress={openingProgress} compact testId="clip-opening-progress" />}
          {openingError && <ErrorBox error={openingError} kind="error" onDismiss={onOpeningDismiss} />}
          {it.job.kind === 'working' && <ProgressPanel progress={it.job.progress} compact testId="clip-progress" />}
          {it.job.kind === 'error' && <ErrorBox error={it.job.error} kind="error" onDismiss={onJobDismiss} />}
          {it.job.kind === 'done' && (
            <p className="clip-done" data-testid="clip-done"><Check size={15} aria-hidden />
              Arquivo pronto: <b>{it.job.name}</b>
              {it.job.degraded && <span className="hint"> (formato alternativo)</span>}
            </p>
          )}
        </div>
      )}
      {expanded && (
        <section className="clip-inspector" id={`clip-inspector-${it.uid}`} data-testid="clip-inspector"
          aria-label={`Revisão do clipe ${index + 1}`}>
          <div className="clip-inspector-heading">
            <div><h3>Revisar este trecho</h3><p>Ajuste o início ou fim por frase. Ouça e confira antes de gerar.</p></div>
            <button className="sm" type="button" onClick={() => onPreview(true)}>
              <Play size={14} aria-hidden /> Ouvir com contexto
            </button>
          </div>
          <label className="clip-inspector-title">Título completo — você pode alterar antes de exportar
            <textarea rows={2} maxLength={100} disabled={busy} value={moment.title}
              onChange={event => onTitle(event.target.value)} data-testid="clip-title-full"
              aria-label={`Editar título completo do clipe ${index + 1}`} />
          </label>
          <div className="clip-inspector-text">
            <div><span className="clip-inspector-label">Antes</span><p>{context?.before || 'Sem fala anterior próxima.'}</p></div>
            <div className="clip-inspector-current"><span className="clip-inspector-label">Neste clipe</span><p>{moment.text || 'Sem fala reconhecida.'}</p></div>
            <div><span className="clip-inspector-label">Depois</span><p>{context?.after || 'Sem fala posterior próxima.'}</p></div>
          </div>
          {review.length > 0 && (
            <div className="clip-review-warning"><CircleAlert size={16} aria-hidden />
              <div><strong>Confira antes de publicar.</strong>{review.map(message => <p key={message}>{message}</p>)}</div>
            </div>
          )}
          <div className="clip-boundary-grid">
            <div>
              <p><strong>Início: {clock(moment.start)}</strong></p>
              <div className="clip-boundary-buttons">
                <button className="sm ghost" disabled={busy} onClick={() => onNudge('start', -1)}>Frase anterior</button>
                <button className="sm ghost" disabled={busy} onClick={() => onNudge('start', 1)}>Próxima frase</button>
              </div>
            </div>
            <div>
              <p><strong>Fim: {clock(moment.end)}</strong></p>
              <div className="clip-boundary-buttons">
                <button className="sm ghost" disabled={busy} onClick={() => onNudge('end', -1)}>Frase anterior</button>
                <button className="sm ghost" disabled={busy} onClick={() => onNudge('end', 1)}>Próxima frase</button>
              </div>
            </div>
          </div>
          <p className="clip-inspector-footnote">A prévia usa a gravação original. O MP4 final aplica o formato e o estilo selecionados. Cortes feitos aqui são guardados enquanto você revisa os clipes.</p>
        </section>
      )}
    </article>
  );
}
