import { useEffect, useMemo, useState } from 'react';
import { PROMPT_MAX, summarizeBrief, type CreativeBrief, type Hook } from '../core/brief';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, Word } from '../core/types';
import { LOCAL_AI_ENABLED, loadLocalAi, webGpuAvailable } from '../ai/local-ai';
import { geminiCompleter, loadKey, saveKey } from '../ai/own-key';
import { interpretLayered } from '../editorial/ai-brief';
import { findHooks } from '../editorial/hooks';
import { LLM_VRAM_MB } from '../core/mirror';
import { ErrorBox } from './ErrorBox';

const EXAMPLES = ['Gancho forte, estilo calmo, sem emojis, destaque os números', 'Bem animado, mas sem efeitos', 'Minimalista e elegante, sem zoom', 'Sério, tipo documentário, para iniciantes'];

type Mode = 'regras' | 'local' | 'chave';

const hookKey = (h: Pick<Hook, 'wordIds'> | null) => (h ? h.wordIds.join('|') : '');

/**
 * "O que você quer?": pedido por texto, resumo do que foi entendido e escolha do gancho.
 * Tudo vira operação no plano (entra no desfazer). Sem IA por padrão; IA é opcional e avançada.
 */
export function BriefPanel({ plan, words, onBrief, onHook, disabled }: { plan: EditPlan; words: Word[]; onBrief: (b: CreativeBrief) => void; onHook: (h: Hook | null) => void; disabled: boolean }) {
  const [text, setText] = useState(plan.brief.prompt);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [warning, setWarning] = useState<AppError | null>(null);
  const [mode, setMode] = useState<Mode>('regras');
  const [key, setKey] = useState(loadKey);
  const gpu = useMemo(webGpuAvailable, []);
  const hooks = useMemo(() => findHooks(words), [words]);
  const summary = summarizeBrief(plan.brief);
  const hasBrief = plan.brief.prompt !== '';
  // desfazer/refazer traz de volta o texto do pedido daquele momento
  useEffect(() => setText(plan.brief.prompt), [plan.brief.prompt]);

  async function apply() {
    setError(null);
    setWarning(null);
    setBusy('Entendendo o pedido…');
    try {
      let ai: Parameters<typeof interpretLayered>[2] = null;
      let aiWarning: AppError | null = null;
      if (mode === 'local') {
        try {
          const local = await loadLocalAi((f, t) => setBusy(`Preparando a IA no navegador (só na primeira vez): ${Math.round(f * 100)}% ${t.slice(0, 60)}`));
          ai = { complete: local.complete, source: 'ia-local' };
          setBusy('A IA no navegador está lendo o pedido…');
        } catch (err) {
          aiWarning = toAppError(err, 'IA_LOCAL_FALHOU');
        }
      } else if (mode === 'chave' && key.trim()) {
        ai = { complete: geminiCompleter(key.trim()), source: 'ia-chave' };
        setBusy('Consultando o serviço da sua chave (só texto)…');
      }
      const r = await interpretLayered(text, words, ai);
      setWarning(r.warning ?? aiWarning);
      if (!r.understood) {
        setWarning(new AppError('PEDIDO_NAO_ENTENDIDO', r.brief.notes.ignored.join(', ')));
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
    <section className="brief" aria-label="Pedido por texto" data-testid="brief-panel">
      <h2>O que você quer?</h2>
      <p className="hint">Escreva com suas palavras. Exemplos (toque para usar):</p>
      <div className="examples">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" className="example" onClick={() => setText(e)} disabled={disabled || busy !== null}>
            {e}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={PROMPT_MAX}
        rows={3}
        placeholder="Ex.: calmo e elegante, sem emojis, destaque os números"
        aria-label="O que você quer?"
        data-testid="brief-input"
        disabled={disabled || busy !== null}
      />
      <div className="actions">
        <button className="primary" onClick={apply} disabled={disabled || busy !== null} data-testid="brief-apply">
          Aplicar
        </button>
        <span className="hint">{text.length}/{PROMPT_MAX}</span>
      </div>
      {busy && (
        <p className="status" role="status">
          {busy}
        </p>
      )}
      {error && <ErrorBox error={error} kind="error" />}
      {warning && <ErrorBox error={warning} kind="warning" />}

      {hasBrief && (
        <div className="brief-summary" data-testid="brief-summary">
          <p>
            <b>Entendi</b>
            {plan.brief.source !== 'regras' ? (plan.brief.source === 'ia-local' ? ' (com a IA no navegador)' : ' (com a IA da sua chave)') : ''}:
          </p>
          <ul>
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
          {summary.ignored.length > 0 && (
            <p className="hint" data-testid="brief-ignored">
              Palavras que não usei: {summary.ignored.join(', ')}
            </p>
          )}
        </div>
      )}

      <div className="hooks" data-testid="hooks">
        <h3>Gancho (a frase que abre o vídeo)</h3>
        <p className="hint" data-testid="opening-title">
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

      <details className="ai-options">
        <summary>IA opcional (avançado)</summary>
        <p className="hint">Sem IA o pedido é entendido por regras, que funcionam sempre e sem internet. A IA ajuda com frases que as regras não conhecem; ela nunca tira uma proibição sua.</p>
        <label className="hook">
          <input type="radio" name="ai" checked={mode === 'regras'} onChange={() => setMode('regras')} data-testid="ai-rules" />
          <span>Só regras (recomendado)</span>
        </label>
        {LOCAL_AI_ENABLED && (
          <label className="hook">
            <input type="radio" name="ai" checked={mode === 'local'} onChange={() => setMode('local')} disabled={!gpu} data-testid="ai-local" />
            <span>
              IA no navegador (experimental). Baixa cerca de 300 MB na primeira vez e precisa de uma placa de vídeo com ~{LLM_VRAM_MB} MB livres. Nada sai do aparelho.
              {!gpu && <small className="hint"> Indisponível: este navegador não tem WebGPU.</small>}
            </span>
          </label>
        )}
        <label className="hook">
          <input type="radio" name="ai" checked={mode === 'chave'} onChange={() => setMode('chave')} data-testid="ai-key" />
          <span>Minha chave do Google Gemini (gratuita)</span>
        </label>
        {mode === 'chave' && (
          <div className="key-box">
            <p className="hint" data-testid="key-notice">
              Só texto é enviado ao Google: o seu pedido e um trecho da transcrição da fala. <b>O vídeo nunca sai do seu aparelho.</b> A chave fica guardada só neste navegador.
            </p>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Cole sua chave aqui" aria-label="Chave do Google Gemini" autoComplete="off" data-testid="key-input" />
            <div className="actions">
              <button type="button" onClick={() => saveKey(key)}>
                Guardar neste navegador
              </button>
              <button
                type="button"
                onClick={() => {
                  setKey('');
                  saveKey('');
                }}
              >
                Apagar chave
              </button>
            </div>
          </div>
        )}
      </details>
    </section>
  );
}
