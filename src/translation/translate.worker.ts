/// <reference lib="webworker" />
import { AutoModelForSeq2SeqLM, AutoTokenizer, Tensor, env, type PreTrainedModel, type PreTrainedTokenizer } from '@huggingface/transformers';
import { LANGUAGES, isLanguageCode, type LanguageCode } from '../core/languages';
import { HF_PREFIX } from '../core/mirror';
import { checkTranslation, describeTranslationProblem, type TranslationProblem } from '../editorial/translation-check';
import { availableLanguageTokens, marianInputIds, type MarianTokenizerLike } from './marian';
import { m2mInputIds, m2mLanguageId, type M2MTokenizerLike } from './m2m';
import { TRANSLATION_MODELS, translationEngine, type TranslationEngine, type TranslationFromWorker, type TranslationToWorker } from './protocol';

const send = (message: TranslationFromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
env.allowLocalModels = false;

interface Loaded { tokenizer: PreTrainedTokenizer; model: PreTrainedModel }

async function loadModel(engine: TranslationEngine): Promise<Loaded> {
  const { repo, revision } = TRANSLATION_MODELS[engine];
  const hosts = [
    ...(self.location.hostname === 'localhost' ? [] : [`${self.location.origin}${HF_PREFIX}`]),
    'https://huggingface.co/',
  ];
  // progresso do download somando todos os arquivos do modelo
  const files = new Map<string, { loaded: number; total: number }>();
  const progress_callback = (p: { status?: string; file?: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress' || !p.file) return;
    files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
    let loaded = 0;
    let total = 0;
    for (const f of files.values()) { loaded += f.loaded; total += f.total; }
    send({ type: 'download', loaded, total });
  };
  let lastError: unknown = null;
  for (const host of hosts) {
    try {
      env.remoteHost = host;
      const opts = { revision, progress_callback };
      const tokenizer = await AutoTokenizer.from_pretrained(repo, opts);
      const model = await AutoModelForSeq2SeqLM.from_pretrained(repo, { ...opts, device: 'wasm', dtype: 'q8' });
      return { tokenizer, model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Modelo de tradução indisponível');
}

async function generate(loaded: Loaded, ids: number[], extra: Record<string, unknown> = {}): Promise<string> {
  const input_ids = new Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
  const attention_mask = new Tensor('int64', BigInt64Array.from(ids.map(() => 1n)), [1, ids.length]);
  const output = await loaded.model.generate({ input_ids, attention_mask, max_new_tokens: 200, num_beams: 1, do_sample: false, ...extra } as Parameters<PreTrainedModel['generate']>[0]);
  const [decoded] = loaded.tokenizer.batch_decode(output as Tensor, { skip_special_tokens: true });
  return (decoded ?? '').replace(/\s+/g, ' ').trim();
}

/** Uma função que traduz um trecho; cada motor pode tentar variações do código de língua. */
type Translate = (text: string) => Promise<string[]>;

function opusTranslator(loaded: Loaded): Translate {
  const languages = availableLanguageTokens(loaded.tokenizer as unknown as MarianTokenizerLike);
  if (languages.length === 0) throw Object.assign(new Error('O modelo de tradução não tem o código de português (pt_BR)'), { model: true });
  return async (text) => {
    const out: string[] = [];
    for (const language of languages) out.push(await generate(loaded, marianInputIds(loaded.tokenizer as unknown as MarianTokenizerLike, language.id, text)));
    return out;
  };
}

function m2mTranslator(loaded: Loaded, from: LanguageCode, to: LanguageCode): Translate {
  const tok = loaded.tokenizer as unknown as M2MTokenizerLike;
  const src = m2mLanguageId(tok, LANGUAGES[from].m2m);
  const tgt = m2mLanguageId(tok, LANGUAGES[to].m2m);
  if (src === null || tgt === null) throw Object.assign(new Error(`O modelo de tradução não conhece ${src === null ? from : to}`), { model: true });
  return async (text) => [await generate(loaded, m2mInputIds(tok, src, text), { forced_bos_token_id: tgt })];
}

self.onmessage = async (event: MessageEvent<TranslationToWorker>) => {
  const { texts, from, to } = event.data;
  if (!isLanguageCode(from) || !isLanguageCode(to) || from === to) {
    send({ type: 'error', code: 'TRADUCAO_FALHOU', message: 'Par de idiomas inválido para tradução' });
    return;
  }
  if (!Array.isArray(texts) || texts.length === 0 || texts.length > 1000 || texts.some((s) => typeof s !== 'string' || !s.trim() || s.length > 150)) {
    send({ type: 'error', code: 'TRADUCAO_FALHOU', message: 'Grupos de fala inválidos para tradução' });
    return;
  }
  const engine = translationEngine(from, to);
  let loaded: Loaded | null = null;
  try {
    loaded = await loadModel(engine);
  } catch (err) {
    send({ type: 'error', code: 'TRADUCAO_MODELO', message: err instanceof Error ? err.message.slice(0, 350) : 'Falha ao carregar o tradutor' });
    return;
  }
  try {
    let translate: Translate;
    try {
      translate = engine === 'opus' ? opusTranslator(loaded) : m2mTranslator(loaded, from, to);
    } catch (err) {
      send({ type: 'error', code: 'TRADUCAO_MODELO', message: err instanceof Error ? err.message : 'Tradutor sem o idioma pedido' });
      return;
    }
    const output: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      let accepted: string | null = null;
      let problem: TranslationProblem | null = null;
      // um trecho só passa se sair limpo no idioma pedido
      for (const candidate of await translate(texts[i]!)) {
        problem = checkTranslation(texts[i]!, candidate, to, from);
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
