import { MB, formatBytes } from '../core/bytes';
import { AppError, describeError } from '../core/errors';
import { spaceCheck } from '../core/storage-report';
import { LLM_MODELS, localAiErrorKey, type LlmKey } from '../core/llm-models';
import { llmModelRecord } from '../core/mirror';
import { REPLY_MAX_TOKENS, chatTurns, type AiMessages, type Completer } from '../editorial/ai-brief';

/**
 * IA no navegador (opcional): Qwen2.5 0.5B (leve), Qwen2.5 1.5B (padrão) ou Qwen3 4B (forte) via WebLLM, na GPU (WebGPU) num Worker.
 * A biblioteca (~6 MB) só é baixada quando a pessoa liga a opção (import dinâmico); o modelo vem pelo
 * espelho do site e fica no cache do navegador. Nada sai do aparelho além desses downloads.
 * Não foi testado ponta a ponta no ambiente de desenvolvimento (sem acesso ao Hugging Face); qualquer
 * falha cai para as regras com aviso (M4F-1005/1006/1013).
 */

/** Liga/desliga a opção no build: VITE_IA_LOCAL=0 esconde. */
export const LOCAL_AI_ENABLED = import.meta.env.VITE_IA_LOCAL !== '0';

export function webGpuAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu;
}

interface Loaded {
  key: LlmKey;
  promise: Promise<{ complete: Completer }>;
  unload: () => Promise<void>;
}
let current: Loaded | null = null;

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const msg = describeError(err);
  return new AppError(localAiErrorKey(msg), msg);
}

export async function loadLocalAi(key: LlmKey, onProgress: (fraction: number, text: string) => void): Promise<{ complete: Completer }> {
  if (!webGpuAvailable()) throw new AppError('IA_LOCAL_INDISPONIVEL', 'navigator.gpu ausente');
  if (current && current.key === key) return current.promise;
  // trocar de modelo: libera a memória de vídeo do anterior antes de carregar o novo
  if (current) {
    const old = current;
    current = null;
    await old.unload().catch(() => undefined);
  }
  const model = LLM_MODELS[key];
  let unloadFn: () => Promise<void> = async () => undefined;
  const promise = (async () => {
    try {
      const webllm = await import('@mlc-ai/web-llm');
      const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
      const origin = import.meta.env.DEV ? null : self.location.origin;
      const appConfig = { model_list: [llmModelRecord(origin, key)] };
      // ainda não baixado e sem espaço: avisa antes de começar um download que não vai caber (M4F-1014)
      if (!(await webllm.hasModelInCache(model.id, appConfig).catch(() => true))) {
        const est = await navigator.storage?.estimate?.().catch(() => null);
        const check = spaceCheck(est && typeof est.usage === 'number' && typeof est.quota === 'number' ? { usage: est.usage, quota: est.quota } : null, model.downloadMB * MB);
        if (!check.ok) {
          worker.terminate();
          throw new AppError('IA_SEM_ESPACO', `livre para o app: ${formatBytes(check.free ?? 0)}; o modelo ${model.id} precisa de cerca de ${formatBytes(check.needed)}`);
        }
      }
      const e = await webllm.CreateWebWorkerMLCEngine(worker, model.id, {
        appConfig,
        initProgressCallback: (r) => onProgress(r.progress, r.text),
      });
      unloadFn = async () => {
        await e.unload();
        worker.terminate();
      };
      const timeoutMs = model.timeoutSec * 1000;
      const complete: Completer = async (m: AiMessages) => {
        const run = e.chat.completions.create({
          messages: chatTurns(m),
          temperature: 0,
          max_tokens: REPLY_MAX_TOKENS,
          ...(model.thinking ? { extra_body: { enable_thinking: false } } : {}),
          // Sem response_format: o modo JSON do WebLLM 0.2.85 falha ao iniciar a gramática
          // (GrammarMatcherInitError, visto no teste real). O prompt de sistema e os exemplos exigem
          // JSON; parseAiReply extrai o objeto e valida campo a campo; uma nova tentativa, depois regras.
        });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new AppError('IA_LOCAL_FALHOU', `sem resposta em ${model.timeoutSec} s`)), timeoutMs);
        });
        try {
          const reply = await Promise.race([run, timeout]);
          return reply.choices[0]?.message?.content ?? '';
        } catch (err) {
          throw toAppError(err);
        } finally {
          clearTimeout(timer);
        }
      };
      return { complete };
    } catch (err) {
      if ((current as Loaded | null)?.key === key) current = null;
      throw toAppError(err);
    }
  })();
  current = { key, promise, unload: () => unloadFn() };
  return promise;
}
