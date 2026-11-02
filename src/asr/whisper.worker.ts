/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { groupPieces, looksDegenerate, type AsrChunk } from '../analysis/asr-merge';
import type { AsrWindow } from '../analysis/asr-windows';
import { parakeetWordsToChunks, type ParakeetWord } from '../analysis/parakeet-words';
import { ASR_CANDIDATES, PARAKEET_FILES, parakeetFiles, whisperOptions, type AsrCandidateId, type SpeechLanguage } from '../core/asr-models';
import { maxNewTokens } from '../core/asr-watchdog';
import { AppError, describeError, httpErrorFromUrl, networkErrorFromUrl, toAppError } from '../core/errors';
import { HF_PREFIX, mirrorCdnUrl } from '../core/mirror';
import type { FromWorker, ToWorker } from './protocol';

const SAMPLE_RATE = 16000;

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

/**
 * Toda falha de rede vira M4F-301 com o servidor que falhou; resposta de erro do servidor
 * (401/403/429/5xx) vira M4F-305. 404 passa: o Transformers.js usa 404 para arquivos opcionais.
 */
const rawFetch = self.fetch.bind(self);
const trackedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  let res: Response;
  try {
    res = await rawFetch(input, init);
  } catch (err) {
    throw networkErrorFromUrl(url, err);
  }
  if (res.status >= 500 || res.status === 401 || res.status === 403 || res.status === 429) throw httpErrorFromUrl(url, res.status);
  return res;
};
self.fetch = trackedFetch;
env.fetch = trackedFetch;

/**
 * De onde baixar: primeiro o espelho no próprio site (funciona para quem alcança o app),
 * depois os servidores originais. No `npm run dev` não há espelho, então vai direto.
 */
interface Source {
  name: string;
  remoteHost: string;
  wasmPaths: unknown;
}
const onnxWasm = env.backends.onnx.wasm as { wasmPaths?: unknown } | undefined;
const directWasm = onnxWasm?.wasmPaths;
const origin = self.location.origin;
const mirroredWasm =
  directWasm && typeof directWasm === 'object'
    ? Object.fromEntries(Object.entries(directWasm as Record<string, string>).map(([k, v]) => [k, mirrorCdnUrl(v, origin)]))
    : directWasm;
const SOURCES: Source[] = [
  ...(import.meta.env.DEV ? [] : [{ name: 'site', remoteHost: `${origin}${HF_PREFIX}`, wasmPaths: mirroredWasm }]),
  { name: 'direto', remoteHost: 'https://huggingface.co/', wasmPaths: directWasm },
];

/** O modelo já está no cache do navegador? (só muda o texto: "carregando" em vez de "baixando") */
async function repoCached(repo: string): Promise<boolean> {
  try {
    for (const name of await caches.keys()) {
      const keys = await (await caches.open(name)).keys();
      if (keys.some((r) => r.url.includes(`/${repo}/`))) return true;
    }
  } catch {
    // sem Cache Storage: trata como download
  }
  return false;
}

/**
 * Um modelo pronto para ouvir: recebe o trecho de áudio (16 kHz) e devolve as palavras com tempo,
 * relativas ao início do trecho. `retry` = segunda tentativa de uma janela com cara de laço.
 */
interface AsrEngineRun {
  /** o motor pode tentar de novo de outro jeito quando a saída parece um laço */
  canRetry: boolean;
  run(piece: Float32Array, retry: boolean): Promise<AsrChunk[]>;
  dispose(): Promise<void>;
}

/** Carrega um degrau da escada com o motor certo. */
async function load(id: AsrCandidateId, language: SpeechLanguage): Promise<AsrEngineRun> {
  if (ASR_CANDIDATES[id].engine === 'parakeet') return loadParakeet(id);
  const asr = await loadWhisper(id);
  return {
    canRetry: true,
    run: async (piece, retry) => {
      // teto de texto pelo tamanho do trecho: um laço em música ou ruído para cedo em vez de rodar minutos
      const out = await asr(piece, { ...whisperOptions(retry, language), max_new_tokens: maxNewTokens(piece.length / SAMPLE_RATE, language) });
      const result = Array.isArray(out) ? out[0]! : out;
      return (result.chunks ?? []) as AsrChunk[];
    },
    dispose: async () => {
      await asr.dispose();
    },
  };
}

/** Carrega um Whisper, tentando o espelho e depois o servidor original. */
async function loadWhisper(id: AsrCandidateId): Promise<AutomaticSpeechRecognitionPipeline> {
  const c = ASR_CANDIDATES[id];
  if (c.device === 'webgpu' && !('gpu' in navigator)) throw new AppError('MODELO_CARREGAR', `${id}: navegador sem WebGPU`);
  const cached = await repoCached(c.repo);
  let prepared = false;
  // `progress_total` (Transformers.js 4.x) soma bytes de todos os arquivos do modelo: dá tamanho e velocidade reais
  const progress_callback = (p: { status: string; loaded?: number; total?: number }) => {
    if (p.status !== 'progress_total' || typeof p.loaded !== 'number' || typeof p.total !== 'number') return;
    post({ type: 'progress', stage: 'download', fraction: p.total > 0 ? p.loaded / p.total : 0, model: id, loaded: p.loaded, total: p.total, cached });
    if (!prepared && p.total > 0 && p.loaded >= p.total) {
      prepared = true;
      post({ type: 'progress', stage: 'prepare', model: id });
    }
  };
  const networkFailures: AppError[] = [];
  for (const source of SOURCES) {
    env.remoteHost = source.remoteHost;
    if (onnxWasm) onnxWasm.wasmPaths = source.wasmPaths;
    try {
      return (await pipeline('automatic-speech-recognition', c.repo, {
        device: c.device,
        dtype: c.dtype as 'fp32',
        progress_callback,
      })) as AutomaticSpeechRecognitionPipeline;
    } catch (err) {
      // Falha de download: tenta a próxima origem. Qualquer outra falha é do modelo, não da rede.
      if (err instanceof AppError && (err.key === 'MODELO_REDE' || err.key === 'MODELO_HTTP')) {
        networkFailures.push(new AppError(err.key, `[${source.name}] ${err.detail}`));
        continue;
      }
      // Espelho do próprio site sem o Worker (preview, hospedagem estática ou espelho
      // fora do ar) devolve a página do app (HTML) no lugar do modelo: o parse falha
      // com SyntaxError e, sem este desvio, a escada inteira morria com M4F-302 sem
      // nunca tentar a origem direta. Qualquer falha vinda do espelho tenta a próxima
      // origem; só a falha na origem direta encerra a tentativa deste degrau.
      if (source.name === 'site') {
        networkFailures.push(new AppError('MODELO_REDE', `[${source.name}] ${describeError(err)}`));
        continue;
      }
      throw toAppError(err, 'MODELO_CARREGAR');
    }
  }
  const last = networkFailures[networkFailures.length - 1]!;
  throw new AppError(last.key, networkFailures.map((f) => f.detail).join(' | '));
}

/** Onde o app guarda os arquivos do Parakeet neste aparelho (Cache Storage, como o Transformers.js faz). */
const PARAKEET_CACHE = 'motion4free-parakeet';

/**
 * Baixa um arquivo do modelo (ou lê do cache), contando os bytes para a barra de progresso.
 * Erro do servidor (inclusive 404) vira M4F-305; a página do app (HTML) no lugar do modelo vira M4F-301
 * para a escada tentar a próxima origem. Sem espaço no cache, segue sem guardar (nunca trava por cota).
 */
async function fetchModelFile(url: string, onBytes: (n: number) => void): Promise<Blob> {
  let cache: Cache | null = null;
  try {
    cache = await caches.open(PARAKEET_CACHE);
    const hit = await cache.match(url);
    if (hit) {
      const blob = await hit.blob();
      onBytes(blob.size);
      return blob;
    }
  } catch {
    cache = null;
  }
  const res = await fetch(url);
  if (!res.ok) throw httpErrorFromUrl(url, res.status);
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new AppError('MODELO_REDE', `resposta em HTML no lugar do modelo — ${url.slice(0, 160)}`);
  const parts: Uint8Array[] = [];
  if (res.body) {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value);
      onBytes(value.byteLength);
    }
  } else {
    const buf = new Uint8Array(await res.arrayBuffer());
    parts.push(buf);
    onBytes(buf.byteLength);
  }
  const blob = new Blob(parts as BlobPart[], { type: 'application/octet-stream' });
  try {
    await cache?.put(url, new Response(blob, { headers: { 'content-type': 'application/octet-stream', 'content-length': String(blob.size) } }));
  } catch {
    // cache cheio ou bloqueado: o modelo funciona do mesmo jeito, só baixa de novo na próxima vez
  }
  return blob;
}

/**
 * Carrega o Parakeet v3 (ADR-0039) pelo parakeet.js, no mesmo onnxruntime-web do Transformers.js
 * (o Vite troca `onnxruntime-web` por `onnxruntime-web/webgpu`; ver vite.config.ts). Tenta o espelho do
 * site e depois o Hugging Face, como o Whisper. A biblioteca só é baixada quando este degrau é usado.
 */
async function loadParakeet(id: AsrCandidateId): Promise<AsrEngineRun> {
  const c: { repo: string; device: string; parakeetFiles?: 'int8' | 'fp16' } = ASR_CANDIDATES[id];
  if (c.device === 'webgpu' && !('gpu' in navigator)) throw new AppError('MODELO_CARREGAR', `${id}: navegador sem WebGPU`);
  const files = parakeetFiles(c.parakeetFiles);
  const cached = await repoCached(c.repo);
  const total = files.reduce((sum, f) => sum + f.bytes, 0);
  const networkFailures: AppError[] = [];
  for (const source of SOURCES) {
    if (onnxWasm) onnxWasm.wasmPaths = source.wasmPaths;
    let loaded = 0;
    const urls: string[] = [];
    try {
      const blobs: Record<string, Blob> = {};
      for (const f of files) {
        const url = `${source.remoteHost}${c.repo}/resolve/${PARAKEET_FILES.revision}/${f.name}`;
        blobs[f.key] = await fetchModelFile(url, (n) => {
          loaded += n;
          post({ type: 'progress', stage: 'download', fraction: Math.min(1, loaded / total), model: id, loaded: Math.min(loaded, total), total, cached });
        });
      }
      post({ type: 'progress', stage: 'prepare', model: id });
      const url = (key: string) => {
        const u = URL.createObjectURL(blobs[key]!);
        urls.push(u);
        return u;
      };
      let model: { transcribe(a: Float32Array, sr: number, o: object): Promise<{ words?: ParakeetWord[] }> };
      try {
        const { ParakeetModel } = await import('parakeet.js');
        model = await ParakeetModel.fromUrls({
          encoderUrl: url('encoder'),
          decoderUrl: url('decoder'),
          tokenizerUrl: url('vocab'),
          // na placa: encoder no WebGPU e decodificador no processador (o parakeet.js faz assim)
          backend: c.device === 'webgpu' ? 'webgpu-hybrid' : 'wasm',
          preprocessorBackend: 'js',
        });
      } catch (err) {
        // os arquivos chegaram; falhar aqui é do modelo neste navegador (memória, wasm), não da rede
        throw toAppError(err, 'MODELO_CARREGAR');
      } finally {
        for (const u of urls) URL.revokeObjectURL(u);
      }
      return {
        canRetry: false,
        run: async (piece) => {
          const out = await model.transcribe(piece, SAMPLE_RATE, { returnTimestamps: true, enableProfiling: false });
          return parakeetWordsToChunks(out.words ?? []);
        },
        dispose: async () => {
          // o parakeet.js não expõe dispose; soltar a referência deixa o coletor liberar as sessões
          model = null as unknown as typeof model;
        },
      };
    } catch (err) {
      if (err instanceof AppError && err.key === 'MODELO_CARREGAR') throw err;
      if (err instanceof AppError && (err.key === 'MODELO_REDE' || err.key === 'MODELO_HTTP')) {
        networkFailures.push(new AppError(err.key, `[${source.name}] ${err.detail}`));
        continue;
      }
      if (source.name === 'site') {
        networkFailures.push(new AppError('MODELO_REDE', `[${source.name}] ${describeError(err)}`));
        continue;
      }
      throw toAppError(err, 'MODELO_CARREGAR');
    }
  }
  const last = networkFailures[networkFailures.length - 1]!;
  throw new AppError(last.key, networkFailures.map((f) => f.detail).join(' | '));
}

/** Uma janela: o Whisper ouve `feed` (com folga); os tempos voltam relativos ao início de `feed`. */
async function transcribeWindow(asr: AsrEngineRun, audio: Float32Array, w: AsrWindow): Promise<{ chunks: AsrChunk[]; retried: boolean }> {
  const piece = audio.subarray(Math.floor(w.feed.start * SAMPLE_RATE), Math.ceil(w.feed.end * SAMPLE_RATE));
  const run = (retry: boolean) => asr.run(piece, retry);
  const first = await run(false);
  const sec = w.feed.end - w.feed.start;
  const firstWords = groupPieces(first);
  if (!asr.canRetry || !looksDegenerate(firstWords, sec)) return { chunks: first, retried: false };
  // Cara de laço ("e aí e aí e aí…"): mais uma tentativa proibindo repetição; fica a melhor das duas.
  const second = await run(true);
  const secondWords = groupPieces(second);
  return { chunks: !looksDegenerate(secondWords, sec) || secondWords.length < firstWords.length ? second : first, retried: true };
}

async function dispose(asr: AsrEngineRun | null) {
  try {
    await asr?.dispose();
  } catch {
    // liberar memória é melhor esforço
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const { audio, windows, ladder, language } = e.data;
  // recomeço depois de um trecho travado (v0.45.1): os trechos antes de `from` já foram ouvidos por outro processo
  const from = Math.max(0, Math.min(windows.length, e.data.from ?? 0));
  const failures: AppError[] = [];
  let step = 0;
  let asr: AsrEngineRun | null = null;
  let retried = 0;

  /** Desce um degrau da escada. Devolve false quando não há mais modelos. */
  const fallBack = (err: unknown, fallbackKey: 'MODELO_CARREGAR' | 'TRANSCRICAO_FALHOU'): boolean => {
    const app = toAppError(err, fallbackKey);
    const from = ladder[step]!;
    failures.push(new AppError(app.key, `${from}: ${app.detail}`));
    step++;
    const to = ladder[step];
    if (to) post({ type: 'fallback', from, to, key: app.key, detail: `${from}: ${app.code} ${app.detail}`.slice(0, 600) });
    return !!to;
  };

  // progresso pelos segundos de áudio, não pelo número de janelas (janelas têm tamanhos diferentes)
  const spoken = (w: AsrWindow) => (w.skip ? 0 : Math.max(0, w.own.end - w.own.start));
  const totalSec = windows.reduce((sum, w) => sum + spoken(w), 0);
  let doneSec = windows.slice(0, from).reduce((sum, w) => sum + spoken(w), 0);
  let i = from;
  while (i < windows.length) {
    const w = windows[i]!;
    if (w.skip) {
      post({ type: 'window', index: i, result: { window: w, chunks: [] }, retried: false });
      i++;
      continue;
    }
    if (!asr) {
      try {
        asr = await load(ladder[step]!, language);
      } catch (err) {
        if (fallBack(err, 'MODELO_CARREGAR')) continue;
        const last = failures[failures.length - 1]!;
        post({ type: 'error', key: last.key, detail: failures.map((f) => f.detail).join(' | ') });
        return;
      }
    }
    post({ type: 'progress', stage: 'transcribe', fraction: totalSec > 0 ? doneSec / totalSec : i / windows.length, model: ladder[step]!, window: i + 1, windows: windows.length, doneSec, totalSec });
    try {
      const r = await transcribeWindow(asr, audio, w);
      // cada trecho sai assim que fica pronto: se um trecho seguinte travar, o já ouvido não se perde
      post({ type: 'window', index: i, result: { window: w, chunks: r.chunks }, retried: r.retried });
      if (r.retried) retried++;
      doneSec += spoken(w);
      i++;
    } catch (err) {
      // Falha no meio (memória da placa de vídeo, modelo sem atenção cruzada…): continua desta janela com o próximo modelo.
      await dispose(asr);
      asr = null;
      if (fallBack(err, 'TRANSCRICAO_FALHOU')) continue;
      const last = failures[failures.length - 1]!;
      post({ type: 'error', key: last.key, detail: `${failures.map((f) => f.detail).join(' | ')} [${describeError(err).slice(0, 80)}]` });
      return;
    }
  }
  const model = ladder[Math.min(step, ladder.length - 1)]!;
  post({ type: 'done', model, device: ASR_CANDIDATES[model].device, retried });
};
