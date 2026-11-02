/// <reference lib="webworker" />
import { env, pipeline } from '@huggingface/transformers';
import { HF_PREFIX } from '../core/mirror';

/** Conversão ONNX de OPUS-MT en-ROMANCE; pesos CC-BY-4.0, não fazem parte do bundle. */
const MODEL = 'Xenova/opus-mt-en-ROMANCE';
const send = (message: object) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
env.allowLocalModels = false;

self.onmessage = async (event: MessageEvent<{ texts: string[] }>) => {
  const texts = event.data.texts;
  if (!Array.isArray(texts) || texts.length > 1000 || texts.some((s) => typeof s !== 'string' || s.length > 150)) {
    send({ type: 'error', message: 'Grupos de fala inválidos para tradução' });
    return;
  }
  try {
    let translator: Awaited<ReturnType<typeof pipeline<'translation'>>> | null = null;
    const hosts = [
      ...(self.location.hostname === 'localhost' ? [] : [`${self.location.origin}${HF_PREFIX}`]),
      'https://huggingface.co/',
    ];
    for (const host of hosts) {
      try {
        env.remoteHost = host;
        translator = await pipeline('translation', MODEL, { device: 'wasm', dtype: 'q8' });
        break;
      } catch (err) {
        if (host === hosts[hosts.length - 1]) throw err;
      }
    }
    if (!translator) throw new Error('Modelo de tradução indisponível');
    const output: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      const result = await translator(`>>pt_BR<< ${texts[i]}`, { max_new_tokens: 192 });
      const first = Array.isArray(result) ? result[0] : result;
      const translated = (first as { translation_text?: unknown }).translation_text;
      if (typeof translated !== 'string' || !translated.trim()) throw new Error(`Tradução vazia no trecho ${i + 1}`);
      output.push(translated.trim());
      send({ type: 'progress', done: i + 1, total: texts.length });
    }
    await translator.dispose();
    send({ type: 'done', texts: output });
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message.slice(0, 350) : 'Falha ao carregar o tradutor' });
  }
};
