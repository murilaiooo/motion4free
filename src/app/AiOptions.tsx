import { useEffect, useMemo, useState } from 'react';
import { AppError, toAppError } from '../core/errors';
import { formatBytes } from '../core/bytes';
import { LLM_KEYS, LLM_MODELS, localAiProgress, modelFit, type LlmKey } from '../core/llm-models';
import { cachedRepos } from '../core/storage-report';
import { storage } from './project-store';
import type { OnProgress } from '../core/progress';
import { LOCAL_AI_ENABLED, loadLocalAi, webGpuAvailable } from '../ai/local-ai';
import { geminiCompleter, saveKey } from '../ai/own-key';
import type { AiChoice } from '../editorial/ai-brief';

export type AiMode = 'regras' | 'local' | 'chave';

/** Escolha de IA da pessoa; vale para o pedido geral e para os pedidos de trecho. */
export interface AiSettings {
  mode: AiMode;
  model: LlmKey;
  key: string;
}

/**
 * Prepara a IA escolhida. Falha ao carregar a IA do navegador não impede o pedido: devolve o aviso
 * e o pedido segue pelas regras.
 */
export async function prepareAi(s: AiSettings, setBusy: OnProgress): Promise<{ ai: AiChoice | null; warning: AppError | null }> {
  if (s.mode === 'local') {
    try {
      const local = await loadLocalAi(s.model, (f, t) => setBusy(localAiProgress(s.model, f, t)));
      setBusy({ label: 'A IA no navegador está lendo o pedido', phase: 'ia-ler', fraction: null, detail: `pode levar até ${LLM_MODELS[s.model].timeoutSec} s` });
      return { ai: { complete: local.complete, source: 'ia-local' }, warning: null };
    } catch (err) {
      return { ai: null, warning: toAppError(err, 'IA_LOCAL_FALHOU') };
    }
  }
  if (s.mode === 'chave' && s.key.trim()) {
    setBusy({ label: 'Consultando o serviço da sua chave (só texto)', phase: 'ia-chave', fraction: null });
    return { ai: { complete: geminiCompleter(s.key.trim()), source: 'ia-chave' }, warning: null };
  }
  return { ai: null, warning: null };
}

/** Espaço livre para o app e modelos já no cache (issue #72): mede só quando a IA no navegador é escolhida. */
function useModelSpace(active: boolean): { free: number | null; cached: Set<LlmKey> } | null {
  const [space, setSpace] = useState<{ free: number | null; cached: Set<LlmKey> } | null>(null);
  useEffect(() => {
    if (!active) return;
    let alive = true;
    void (async () => {
      const est = await storage.quota?.estimate().catch(() => null);
      const repos = await cachedRepos(storage.caches).catch(() => new Set<string>());
      const cached = new Set(LLM_KEYS.filter((k) => repos.has(LLM_MODELS[k].repo)));
      if (alive) setSpace({ free: est ? Math.max(0, est.quota - est.usage) : null, cached });
    })();
    return () => {
      alive = false;
    };
  }, [active]);
  return space;
}

const gb = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`);

export function AiOptions({ settings, onChange }: { settings: AiSettings; onChange: (s: AiSettings) => void }) {
  const gpu = useMemo(webGpuAvailable, []);
  const set = (patch: Partial<AiSettings>) => onChange({ ...settings, ...patch });
  const space = useModelSpace(LOCAL_AI_ENABLED && settings.mode === 'local');
  return (
    <details className="ai-options">
      <summary>IA opcional (avançado): entende pedidos mais livres</summary>
      <p className="hint">
        Sem IA o pedido é entendido por regras, que funcionam sempre e sem internet. Com IA, ela lê o pedido inteiro e as regras conferem: uma proibição sua nunca é tirada e o que a IA responder fora do permitido é descartado.
      </p>
      <label className="hook">
        <input type="radio" name="ai" checked={settings.mode === 'regras'} onChange={() => set({ mode: 'regras' })} data-testid="ai-rules" />
        <span>Só regras (funciona em qualquer computador)</span>
      </label>
      {LOCAL_AI_ENABLED && (
        <label className="hook">
          <input type="radio" name="ai" checked={settings.mode === 'local'} onChange={() => set({ mode: 'local' })} disabled={!gpu} data-testid="ai-local" />
          <span>
            IA no navegador (gratuita, nada sai do aparelho). Baixa o modelo na primeira vez e precisa de placa de vídeo.
            {!gpu && <small className="hint"> Indisponível: este navegador não tem WebGPU.</small>}
          </span>
        </label>
      )}
      {LOCAL_AI_ENABLED && settings.mode === 'local' && (
        <div className="key-box" data-testid="ai-models">
          {space && space.free !== null && (
            <p className="hint" data-testid="ai-space">
              O navegador informa <b>{formatBytes(space.free)}</b> livres para o app. Alguns navegadores (como o Brave) informam um número menor que o real para proteger a privacidade; por isso o app tenta baixar mesmo assim e só avisa (M4F-1014) se faltar espaço de verdade.
            </p>
          )}
          {LLM_KEYS.map((k) => {
            const m = LLM_MODELS[k];
            const fit = space ? modelFit(k, space.free, space.cached.has(k)) : 'desconhecido';
            return (
              <label className="hook" key={k} data-fit={fit}>
                <input type="radio" name="ai-model" checked={settings.model === k} onChange={() => set({ model: k })} data-testid={`ai-model-${k}`} />
                <span>
                  {m.label}
                  <small className="hint">
                    {' '}
                    {fit === 'baixado' ? 'Já baixado neste navegador' : `Download ~${gb(m.downloadMB)} na primeira vez`}; placa de vídeo com ~{gb(m.vramMB)} livres.
                    {fit === 'nao-cabe' && <b> Maior que o espaço que o navegador informa; pode não caber.</b>}
                  </small>
                </span>
              </label>
            );
          })}
          <p className="hint">Se der erro de memória (M4F-1013), escolha um modelo menor.</p>
        </div>
      )}
      <label className="hook">
        <input type="radio" name="ai" checked={settings.mode === 'chave'} onChange={() => set({ mode: 'chave' })} data-testid="ai-key" />
        <span>Minha chave do Google Gemini (gratuita)</span>
      </label>
      {settings.mode === 'chave' && (
        <div className="key-box">
          <p className="hint" data-testid="key-notice">
            Só texto é enviado ao Google: o seu pedido e um trecho da transcrição da fala. <b>O vídeo nunca sai do seu aparelho.</b> A chave fica guardada só neste navegador.
          </p>
          <input type="password" value={settings.key} onChange={(e) => set({ key: e.target.value })} placeholder="Cole sua chave aqui" aria-label="Chave do Google Gemini" autoComplete="off" data-testid="key-input" />
          <div className="actions">
            <button type="button" onClick={() => saveKey(settings.key)}>
              Guardar neste navegador
            </button>
            <button
              type="button"
              onClick={() => {
                set({ key: '' });
                saveKey('');
              }}
            >
              Apagar chave
            </button>
          </div>
        </div>
      )}
    </details>
  );
}
