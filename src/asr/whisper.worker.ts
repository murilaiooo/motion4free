/// <reference lib="webworker" />
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import type { FromWorker, ToWorker } from './protocol';
import type { AsrChunk } from './words';

/** Modelo multilíngue pequeno; baixado uma vez e guardado no cache do navegador. */
export const MODEL_ID = 'onnx-community/whisper-base_timestamped';

let asr: AutomaticSpeechRecognitionPipeline | null = null;
let device = 'wasm';

const post = (m: FromWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

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
  } catch {
    device = 'wasm';
    asr = (await pipeline('automatic-speech-recognition', MODEL_ID, { device: 'wasm', dtype: 'q8', progress_callback })) as AutomaticSpeechRecognitionPipeline;
  }
  return asr;
}

self.onmessage = async (e: MessageEvent<ToWorker>) => {
  try {
    const model = await load();
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
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
