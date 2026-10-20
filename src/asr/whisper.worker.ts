/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { groupPieces, looksDegenerate, type AsrChunk, type WindowResult } from '../analysis/asr-merge';
import type { AsrWindow } from '../analysis/asr-windows';
import { ASR_CANDIDATES, whisperOptions, type AsrCandidateId } from '../core/asr-models';
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

/** Carrega um degrau da escada, tentando o espelho e depois o servidor original. */
async function load(id: AsrCandidateId): Promise<AutomaticSpeechRecognitionPipeline> {
  const c = ASR_CANDIDATES[id];
  if (c.device === 'webgpu' && !('gpu' in navigator)) throw new AppError('MODELO_CARREGAR', `${id}: navegador sem WebGPU`);
  const files = new Map<string, number>();
  const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
    if (p.status === 'progress' && p.file) {
      files.set(p.file, p.progress ?? 0);
      const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size / 100;
      post({ type: 'progress', stage: 'download', fraction: avg, model: id });
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
      throw toAppError(err, 'MODELO_CARREGAR');
    }
  }
  const last = networkFailures[networkFailures.length - 1]!;
  throw new AppError(last.key, networkFailures.map((f) => f.detail).join(' | '));
}

/** Uma janela: o Whisper ouve `feed` (com folga); os tempos voltam relativos ao início de `feed`. */
async function transcribeWindow(asr: AutomaticSpeechRecognitionPipeline, audio: Float32Array, w: AsrWindow): Promise<{ chunks: AsrChunk[]; retried: boolean }> {
  const piece = audio.subarray(Math.floor(w.feed.start * SAMPLE_RATE), Math.ceil(w.feed.end * SAMPLE_RATE));
  const run = async (retry: boolean) => {
    const out = await asr(piece, whisperOptions(retry));
    const result = Array.isArray(out) ? out[0]! : out;
    return (result.chunks ?? []) as AsrChunk[];
  };
  const first = await run(false);
  const sec = w.feed.end - w.feed.start;
  const firstWords = groupPieces(first);
  if (!looksDegenerate(firstWords, sec)) return { chunks: first, retried: false };
  // Cara de laço ("e aí e aí e aí…"): mais uma tentativa proibindo repetição; fica a melhor das duas.
  const second = await run(true);
  const secondWords = groupPieces(second);
  return { chunks: !looksDegenerate(secondWords, sec) || secondWords.length < firstWords.length ? second : first, retried: true };
}

async function dispose(asr: AutomaticSpeechRecognitionPipeline | null) {
  try {
    await asr?.dispose();
  } catch {
    // liberar memória é melhor esforço
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  const { audio, windows, ladder } = e.data;
  const results: WindowResult[] = [];
  const failures: AppError[] = [];
  let step = 0;
  let asr: AutomaticSpeechRecognitionPipeline | null = null;
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

  let i = 0;
  while (i < windows.length) {
    const w = windows[i]!;
    if (w.skip) {
      results.push({ window: w, chunks: [] });
      i++;
      continue;
    }
    if (!asr) {
      try {
        asr = await load(ladder[step]!);
      } catch (err) {
        if (fallBack(err, 'MODELO_CARREGAR')) continue;
        const last = failures[failures.length - 1]!;
        post({ type: 'error', key: last.key, detail: failures.map((f) => f.detail).join(' | ') });
        return;
      }
    }
    post({ type: 'progress', stage: 'transcribe', fraction: i / windows.length, model: ladder[step]!, window: i + 1, windows: windows.length });
    try {
      const r = await transcribeWindow(asr, audio, w);
      results.push({ window: w, chunks: r.chunks });
      if (r.retried) retried++;
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
  post({ type: 'done', results, model, device: ASR_CANDIDATES[model].device, retried });
};
