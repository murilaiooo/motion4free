import { useMemo } from 'react';
import { AppError, toAppError } from '../core/errors';
import { LLM_KEYS, LLM_MODELS, type LlmKey } from '../core/llm-models';
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
export async function prepareAi(s: AiSettings, setBusy: (text: string) => void): Promise<{ ai: AiChoice | null; warning: AppError | null }> {
  if (s.mode === 'local') {
    try {
      const local = await loadLocalAi(s.model, (f, t) => setBusy(`Preparando a IA no navegador (só na primeira vez): ${Math.round(f * 100)}% ${t.slice(0, 60)}`));
      setBusy('A IA no navegador está lendo o pedido…');
      return { ai: { complete: local.complete, source: 'ia-local' }, warning: null };
    } catch (err) {
      return { ai: null, warning: toAppError(err, 'IA_LOCAL_FALHOU') };
    }
  }
  if (s.mode === 'chave' && s.key.trim()) {
    setBusy('Consultando o serviço da sua chave (só texto)…');
    return { ai: { complete: geminiCompleter(s.key.trim()), source: 'ia-chave' }, warning: null };
  }
  return { ai: null, warning: null };
}

const gb = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1).replace('.', ',')} GB` : `${mb} MB`);

export function AiOptions({ settings, onChange }: { settings: AiSettings; onChange: (s: AiSettings) => void }) {
  const gpu = useMemo(webGpuAvailable, []);
  const set = (patch: Partial<AiSettings>) => onChange({ ...settings, ...patch });
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
          {LLM_KEYS.map((k) => {
            const m = LLM_MODELS[k];
            return (
              <label className="hook" key={k}>
                <input type="radio" name="ai-model" checked={settings.model === k} onChange={() => set({ model: k })} data-testid={`ai-model-${k}`} />
                <span>
                  {m.label}
                  <small className="hint">
                    {' '}
                    Download ~{gb(m.downloadMB)} na primeira vez; placa de vídeo com ~{gb(m.vramMB)} livres.
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
