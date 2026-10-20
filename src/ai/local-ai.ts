import { AppError, describeError } from '../core/errors';
import { LLM_MODEL_ID, llmModelRecord } from '../core/mirror';
import type { AiMessages, Completer } from '../editorial/ai-brief';

/**
 * IA no navegador (opcional, experimental): Qwen2.5 0.5B via WebLLM, rodando na GPU (WebGPU) num Worker.
 * A biblioteca (~6 MB) só é baixada quando a pessoa liga a opção (import dinâmico); o modelo (~300 MB)
 * vem pelo espelho do site e fica no cache do navegador. Nada sai do aparelho além desses downloads.
 * Não foi testado ponta a ponta no ambiente de desenvolvimento (sem acesso ao Hugging Face); qualquer
 * falha cai para as regras com aviso M4F-1005/1006.
 */

/** Liga/desliga a opção no build: VITE_IA_LOCAL=0 esconde. */
export const LOCAL_AI_ENABLED = import.meta.env.VITE_IA_LOCAL !== '0';

export function webGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu;
}

const TIMEOUT_MS = 60_000;
let engine: Promise<{ complete: Completer }> | null = null;

export function loadLocalAi(onProgress: (fraction: number, text: string) => void): Promise<{ complete: Completer }> {
  if (!webGpuAvailable()) return Promise.reject(new AppError('IA_LOCAL_INDISPONIVEL', 'navigator.gpu ausente'));
  engine ??= (async () => {
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
      const origin = import.meta.env.DEV ? null : self.location.origin;
      const e = await webllm.CreateWebWorkerMLCEngine(worker, LLM_MODEL_ID, {
        appConfig: { model_list: [llmModelRecord(origin)] },
        initProgressCallback: (r) => onProgress(r.progress, r.text),
      });
      const complete: Completer = async (m: AiMessages) => {
        const run = e.chat.completions.create({
          messages: [
            { role: 'system', content: m.system },
            { role: 'user', content: m.user },
          ],
          temperature: 0,
          max_tokens: 300,
          response_format: { type: 'json_object' },
        });
        const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new AppError('IA_LOCAL_FALHOU', `sem resposta em ${TIMEOUT_MS / 1000} s`)), TIMEOUT_MS));
        const reply = await Promise.race([run, timeout]);
        return reply.choices[0]?.message?.content ?? '';
      };
      return { complete };
    } catch (err) {
      engine = null;
      throw err instanceof AppError ? err : new AppError('IA_LOCAL_FALHOU', describeError(err));
    }
  })();
  return engine;
}
