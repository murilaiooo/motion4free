import { useEffect, useMemo, useState } from 'react';
import { PROMPT_MAX, summarizeBrief, type CreativeBrief, type Hook } from '../core/brief';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, Word } from '../core/types';
import { interpretLayered } from '../editorial/ai-brief';
import { findHooks } from '../editorial/hooks';
import { Check, Sparkles } from 'lucide-react';
import { AiStatusLine, prepareAi, useAiSettings } from './AiOptions';
import { ErrorBox } from './ErrorBox';
import { ProgressPanel } from './ProgressPanel';
import type { Progress } from '../core/progress';

const EXAMPLES = [
  'gancho diferenciado e criativo, legenda verde e amarela, emojis a cada 3 segundos',
  'Gancho forte, estilo calmo, sem emojis, destaque os números',
  'legenda grande em cima, amarela com contorno preto',
  'cortes rápidos, transição flash, emojis nas palavras importantes',
  'Minimalista e elegante, sem zoom, legenda em minúsculas',
];

const hookKey = (h: Pick<Hook, 'wordIds'> | null) => (h ? h.wordIds.join('|') : '');

/**
 * "O que você quer?": pedido por texto, o que foi aplicado, o que o app ainda não sabe fazer e a
 * escolha do gancho. Tudo vira operação no plano (entra no desfazer). Sem IA por padrão; a IA é opcional.
 */
export function BriefPanel({ plan, words, onBrief, disabled }: { plan: EditPlan; words: Word[]; onBrief: (b: CreativeBrief) => void; disabled: boolean }) {
  const ai = useAiSettings();
  const [text, setText] = useState(plan.brief.prompt);
  const [busy, setBusy] = useState<Progress | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [warning, setWarning] = useState<AppError | null>(null);
  const [notDone, setNotDone] = useState<string[]>([]);
  const summary = summarizeBrief(plan.brief);
  const hasBrief = plan.brief.prompt !== '';
  // desfazer/refazer traz de volta o texto do pedido daquele momento
  useEffect(() => setText(plan.brief.prompt), [plan.brief.prompt]);

  async function apply() {
    setError(null);
    setWarning(null);
    setNotDone([]);
    setBusy({ label: 'Entendendo o pedido', phase: 'pedido', fraction: null });
    try {
      const { ai: choice, warning: aiWarning } = await prepareAi(ai, setBusy);
      const r = await interpretLayered(text, words, choice);
      setWarning(r.warning ?? aiWarning);
      if (!r.understood) {
        setWarning(new AppError('PEDIDO_NAO_ENTENDIDO', [...r.brief.unsupported, ...r.brief.notes.ignored].slice(0, 8).join(', ')));
        setNotDone(r.brief.unsupported);
        return;
      }
      onBrief(r.brief);
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="brief stack" aria-label="Pedido por texto" data-testid="brief-panel">
      <div className="field">
        <label className="field-label" htmlFor="brief-input">
          O que você quer?
        </label>
        <p className="hint">Escreva com suas palavras. O app aplica e mostra o que entendeu.</p>
      </div>
      <textarea
        id="brief-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={PROMPT_MAX}
        rows={4}
        placeholder="Ex.: legenda verde e amarela, emojis a cada 3 segundos, gancho criativo"
        aria-label="O que você quer?"
        data-testid="brief-input"
        disabled={disabled || busy !== null}
      />
      <div className="row-between">
        <span className="hint tnum">
          {text.length}/{PROMPT_MAX}
        </span>
        <button className="primary" onClick={apply} disabled={disabled || busy !== null} data-testid="brief-apply">
          <Sparkles size={15} aria-hidden /> Aplicar
        </button>
      </div>
      <div className="examples" aria-label="Exemplos de pedido">
        <span className="eyebrow">Exemplos — toque para usar</span>
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="example" onClick={() => setText(e)} disabled={disabled || busy !== null}>
            {e}
          </button>
        ))}
      </div>
      <ProgressPanel progress={busy} compact testId="ai-progress" />
      {error && <ErrorBox error={error} kind="error" />}
      {warning && <ErrorBox error={warning} kind="warning" />}

      {!hasBrief && notDone.length > 0 && (
        <p className="hint" data-testid="brief-unsupported">
          <b>Ainda não sei fazer:</b> {notDone.join('; ')}
        </p>
      )}

      {hasBrief && (
        <div className="brief-summary card" data-testid="brief-summary">
          <p className="card-title">
            <Check size={15} aria-hidden /> <b>Apliquei</b>
            {plan.brief.source !== 'regras' ? (plan.brief.source === 'ia-local' ? ' (com a IA no navegador)' : ' (com a IA da sua chave)') : ''}:
          </p>
          {plan.brief.summary && (
            <p className="hint" data-testid="brief-ai-summary">
              {plan.brief.summary}
            </p>
          )}
          <ul data-testid="brief-applied">
            {summary.understood.map((u) => (
              <li key={u}>{u}</li>
            ))}
            {summary.forbidden.length > 0 && <li data-testid="brief-forbidden">Sem: {summary.forbidden.join(', ')}</li>}
          </ul>
          {summary.conflicts.length > 0 && (
            <ul className="brief-notes" data-testid="brief-conflicts">
              {summary.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
          <div className="not-yet" data-testid="brief-unsupported">
            <b>Ainda não sei fazer:</b>{' '}
            {summary.unsupported.length > 0 ? (
              <ul>
                {summary.unsupported.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            ) : (
              <span className="hint">nada deste pedido — entendi tudo.</span>
            )}
          </div>
        </div>
      )}

      <AiStatusLine />
    </section>
  );
}

/** Gancho: frases da própria fala para abrir o vídeo (nunca inventadas). Entra no desfazer. */
export function HookPanel({ plan, words, onHook, disabled }: { plan: EditPlan; words: Word[]; onHook: (h: Hook | null) => void; disabled: boolean }) {
  const hooks = useMemo(() => findHooks(words), [words]);
  return (
    <section className="stack" aria-label="Gancho">
      <div className="hooks" data-testid="hooks">
        <p className="opening card" data-testid="opening-title">
          {(() => {
            const t = plan.scenes.find((s) => s.kind === 'kinetic-title' && s.start === 0);
            return t && t.kind === 'kinetic-title' ? `Abre com: “${t.text}”` : 'Sem título de abertura.';
          })()}
        </p>
        {words.length > 0 && hooks.length === 0 && <ErrorBox error={new AppError('GANCHO_SEM_FRASES')} kind="warning" />}
        {hooks.length > 0 && (
          <>
            <p className="hint">Frases da sua própria fala, nunca inventadas. A escolhida aparece como título no começo.</p>
            <label className="hook">
              <input type="radio" name="hook" checked={!plan.brief.hook} onChange={() => onHook(null)} disabled={disabled} data-testid="hook-none" />
              <span>Sem gancho (título automático)</span>
            </label>
            {hooks.map((h, i) => (
              <label className="hook" key={hookKey(h)}>
                <input type="radio" name="hook" checked={hookKey(plan.brief.hook) === hookKey(h)} onChange={() => onHook({ text: h.text, wordIds: h.wordIds })} disabled={disabled} data-testid={`hook-${i}`} />
                <span>
                  “{h.text}” <small className="hint">{h.reasons.join(', ')}</small>
                </span>
              </label>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
