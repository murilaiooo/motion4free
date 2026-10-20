/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { AppError, describeError, httpErrorFromUrl, networkErrorFromUrl, toAppError } from '../core/errors';
import { HF_PREFIX, MODEL_ID, mirrorCdnUrl } from '../core/mirror';
import type { FromWorker, ToWorker } from './protocol';
import type { AsrChunk } from './words';


const SAMPLE_RATE = 16000;
let asr: AutomaticSpeechRecognitionPipeline | null = null;
let device = 'wasm';

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

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (asr) return asr;
  const files = new Map<string, number>();
  const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
    if (p.status === 'progress' && p.file) {
      files.set(p.file, p.progress ?? 0);
      const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size / 100;
      post({ type: 'progress', stage: 'download', fraction: avg });
    }
  };
  const networkFailures: AppError[] = [];
  for (const source of SOURCES) {
    env.remoteHost = source.remoteHost;
    if (onnxWasm) onnxWasm.wasmPaths = source.wasmPaths;
    try {
      asr = await loadFrom(progress_callback);
      return asr;
    } catch (err) {
      // Falha de download: tenta a próxima origem. Qualquer outra falha é do modelo, não da rede.
      if (err instanceof AppError && (err.key === 'MODELO_REDE' || err.key === 'MODELO_HTTP')) {
        networkFailures.push(new AppError(err.key, `[${source.name}] ${err.detail}`));
        continue;
      }
      throw err;
    }
  }
  const last = networkFailures[networkFailures.length - 1]!;
  throw new AppError(last.key, networkFailures.map((f) => f.detail).join(' | '));
}

async function loadFrom(progress_callback: (p: { status: string; file?: string; progress?: number }) => void): Promise<AutomaticSpeechRecognitionPipeline> {
  device = 'gpu' in navigator ? 'webgpu' : 'wasm';
  try {
    return (await pipeline('automatic-speech-recognition', MODEL_ID, { device: device as 'webgpu', dtype: 'fp32', progress_callback })) as AutomaticSpeechRecognitionPipeline;
  } catch (gpuErr) {
    if (gpuErr instanceof AppError) throw gpuErr;
    device = 'wasm';
    try {
      return (await pipeline('automatic-speech-recognition', MODEL_ID, { device: 'wasm', dtype: 'q8', progress_callback })) as AutomaticSpeechRecognitionPipeline;
    } catch (wasmErr) {
      if (wasmErr instanceof AppError) throw wasmErr;
      throw new AppError('MODELO_CARREGAR', `webgpu: ${describeError(gpuErr)} | wasm: ${describeError(wasmErr)}`);
    }
  }
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  let model: AutomaticSpeechRecognitionPipeline;
  try {
    model = await load();
  } catch (err) {
    const app = toAppError(err, 'MODELO_CARREGAR');
    post({ type: 'error', key: app.key, detail: app.detail });
    return;
  }
  try {
    const { audio, windows, language } = e.data;
    const chunks: AsrChunk[] = [];
    // Uma chamada por janela (≤ 30 s, cortada em silêncio): o Whisper nunca vê uma palavra partida na borda.
    for (const [i, w] of windows.entries()) {
      post({ type: 'progress', stage: 'transcribe', fraction: i / windows.length });
      const piece = audio.subarray(Math.floor(w.start * SAMPLE_RATE), Math.ceil(w.end * SAMPLE_RATE));
      if (piece.length < SAMPLE_RATE * 0.2) continue;
      const out = await model(piece, { language, task: 'transcribe', return_timestamps: 'word' });
      const result = Array.isArray(out) ? out[0]! : out;
      for (const [j, c] of ((result.chunks ?? []) as AsrChunk[]).entries()) {
        // A primeira palavra da janela é palavra nova mesmo sem espaço (chunksToWords cola pedaços sem espaço).
        const text = j === 0 && !/^\s/.test(c.text) ? ` ${c.text}` : c.text;
        const end = c.timestamp[1];
        chunks.push({ text, timestamp: [c.timestamp[0] + w.start, end === null ? null : end + w.start] });
      }
    }
    post({ type: 'done', chunks, device });
  } catch (err) {
    const app = toAppError(err, 'TRANSCRICAO_FALHOU');
    post({ type: 'error', key: app.key, detail: `${app.detail} [device=${device}]` });
  }
};
