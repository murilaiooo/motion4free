/// <reference lib="webworker" />
import { AutoModelForSeq2SeqLM, AutoTokenizer, Tensor, env, type PreTrainedModel, type PreTrainedTokenizer } from '@huggingface/transformers';
import { HF_PREFIX } from '../core/mirror';
import { checkPortugueseTranslation, describeTranslationProblem, type TranslationProblem } from '../editorial/translation-check';
import { availableLanguageTokens, marianInputIds, type MarianTokenizerLike } from './marian';
import { TRANSLATION_MODEL, type TranslationFromWorker, type TranslationToWorker } from './protocol';

const send = (message: TranslationFromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
env.allowLocalModels = false;

async function loadModel(): Promise<{ tokenizer: PreTrainedTokenizer; model: PreTrainedModel }> {
  const hosts = [
    ...(self.location.hostname === 'localhost' ? [] : [`${self.location.origin}${HF_PREFIX}`]),
    'https://huggingface.co/',
  ];
  let lastError: unknown = null;
  for (const host of hosts) {
    try {
      env.remoteHost = host;
      const opts = { revision: TRANSLATION_MODEL.revision };
      const tokenizer = await AutoTokenizer.from_pretrained(TRANSLATION_MODEL.repo, opts);
      const model = await AutoModelForSeq2SeqLM.from_pretrained(TRANSLATION_MODEL.repo, { ...opts, device: 'wasm', dtype: 'q8' });
      return { tokenizer, model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Modelo de tradução indisponível');
}

async function translateOne(tokenizer: PreTrainedTokenizer, model: PreTrainedModel, languageId: number, text: string): Promise<string> {
  const ids = marianInputIds(tokenizer as unknown as MarianTokenizerLike, languageId, text);
  const input_ids = new Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
  const attention_mask = new Tensor('int64', BigInt64Array.from(ids.map(() => 1n)), [1, ids.length]);
  const output = await model.generate({ input_ids, attention_mask, max_new_tokens: 192, num_beams: 1, do_sample: false } as Parameters<PreTrainedModel['generate']>[0]);
  const [decoded] = tokenizer.batch_decode(output as Tensor, { skip_special_tokens: true });
  return (decoded ?? '').replace(/\s+/g, ' ').trim();
}

self.onmessage = async (event: MessageEvent<TranslationToWorker>) => {
  const texts = event.data.texts;
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > 1000 || texts.some((s) => typeof s !== 'string' || !s.trim() || s.length > 150)) {
    send({ type: 'error', code: 'TRADUCAO_FALHOU', message: 'Grupos de fala inválidos para tradução' });
    return;
  }
  let loaded: { tokenizer: PreTrainedTokenizer; model: PreTrainedModel } | null = null;
  try {
    loaded = await loadModel();
  } catch (err) {
    send({ type: 'error', code: 'TRADUCAO_MODELO', message: err instanceof Error ? err.message.slice(0, 350) : 'Falha ao carregar o tradutor' });
    return;
  }
  try {
    const { tokenizer, model } = loaded;
    const languages = availableLanguageTokens(tokenizer as unknown as MarianTokenizerLike);
    if (languages.length === 0) {
      send({ type: 'error', code: 'TRADUCAO_MODELO', message: 'O modelo de tradução não tem o código de português (pt_BR)' });
      return;
    }
    const output: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      let accepted: string | null = null;
      let problem: TranslationProblem | null = null;
      // tenta cada código de português do vocabulário; um trecho só passa se sair em português limpo
      for (const language of languages) {
        const candidate = await translateOne(tokenizer, model, language.id, texts[i]!);
        problem = checkPortugueseTranslation(texts[i]!, candidate);
        if (!problem) { accepted = candidate; break; }
      }
      if (accepted === null) {
        send({ type: 'error', code: 'TRADUCAO_INVALIDA', message: `trecho ${i + 1} de ${texts.length}: ${describeTranslationProblem(problem ?? 'vazia')}` });
        return;
      }
      output.push(accepted);
      send({ type: 'progress', done: i + 1, total: texts.length });
    }
    send({ type: 'done', texts: output });
  } catch (err) {
    send({ type: 'error', code: 'TRADUCAO_FALHOU', message: err instanceof Error ? err.message.slice(0, 350) : 'Falha ao traduzir legendas' });
  } finally {
    await loaded.model.dispose().catch(() => undefined);
  }
};
