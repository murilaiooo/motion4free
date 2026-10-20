/// <reference lib="webworker" />
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { AppError, describeError, networkErrorFromUrl, toAppError } from '../core/errors';
import type { FromWorker, ToWorker } from './protocol';
import type { AsrChunk } from './words';

/** Modelo multilíngue pequeno; baixado uma vez e guardado no cache do navegador. */
export const MODEL_ID = 'onnx-community/whisper-base_timestamped';

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let device = 'wasm';

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

/** Toda falha de rede vira M4F-301 com o servidor que falhou (modelo no Hugging Face ou runtime no jsdelivr). */
const rawFetch = self.fetch.bind(self);
const trackedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  try {
    return await rawFetch(input, init);
  } catch (err) {
    throw networkErrorFromUrl(url, err);
  }
};
self.fetch = trackedFetch;
env.fetch = trackedFetch;

async function load(): Promise<AutomaticSpeechRecognitionPipeline> {
  if (asr) return asr;
  device = 'gpu' in navigator ? 'webgpu' : 'wasm';
  const files = new Map<string, number>();
  const progress_callback = (p: { status: string; file?: string; progress?: number }) => {
    if (p.status === 'progress' && p.file) {
      files.set(p.file, p.progress ?? 0);
      const avg = [...files.values()].reduce((a, b) => a + b, 0) / files.size / 100;
      post({ type: 'progress', stage: 'download', fraction: avg });
    }
  };
  try {
    asr = (await pipeline('automatic-speech-recognition', MODEL_ID, { device: device as 'webgpu', dtype: 'fp32', progress_callback })) as AutomaticSpeechRecognitionPipeline;
  } catch (gpuErr) {
    if (gpuErr instanceof AppError) throw gpuErr;
    device = 'wasm';
    try {
      asr = (await pipeline('automatic-speech-recognition', MODEL_ID, { device: 'wasm', dtype: 'q8', progress_callback })) as AutomaticSpeechRecognitionPipeline;
    } catch (wasmErr) {
      if (wasmErr instanceof AppError) throw wasmErr;
      throw new AppError('MODELO_CARREGAR', `webgpu: ${describeError(gpuErr)} | wasm: ${describeError(wasmErr)}`);
    }
  }
  return asr;
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
    post({ type: 'progress', stage: 'transcribe', fraction: 0 });
    const out = await model(e.data.audio, {
      language: e.data.language,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
    const result = Array.isArray(out) ? out[0]! : out;
    post({ type: 'done', chunks: (result.chunks ?? []) as AsrChunk[], device });
  } catch (err) {
    const app = toAppError(err, 'TRANSCRICAO_FALHOU');
    post({ type: 'error', key: app.key, detail: `${app.detail} [device=${device}]` });
  }
};
