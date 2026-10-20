import { describe, expect, it } from 'vitest';
import { MODEL_ID, mirrorCdnUrl, upstreamUrl } from '../src/core/mirror';

describe('espelho do modelo', () => {
  it('repassa arquivos do modelo usado pelo app ao Hugging Face', () => {
    expect(upstreamUrl(`/hf/${MODEL_ID}/resolve/main/config.json`)).toBe(`https://huggingface.co/${MODEL_ID}/resolve/main/config.json`);
    expect(upstreamUrl(`/hf/${MODEL_ID}/resolve/main/onnx/decoder_model_merged_quantized.onnx`)).toBe(
      `https://huggingface.co/${MODEL_ID}/resolve/main/onnx/decoder_model_merged_quantized.onnx`,
    );
  });

  it('repassa o runtime ONNX ao jsdelivr', () => {
    const p = '/cdn/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm';
    expect(upstreamUrl(p)).toBe('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/ort-wasm-simd-threaded.asyncify.wasm');
  });

  it('recusa outros modelos, pacotes e caminhos com ..', () => {
    expect(upstreamUrl('/hf/outro/modelo/resolve/main/config.json')).toBeNull();
    expect(upstreamUrl('/cdn/npm/react@19/dist/x.js')).toBeNull();
    expect(upstreamUrl(`/hf/${MODEL_ID}/resolve/main/../../x`)).toBeNull();
    expect(upstreamUrl('/index.html')).toBeNull();
  });

  it('troca o jsdelivr pelo endereço do site', () => {
    expect(mirrorCdnUrl('https://cdn.jsdelivr.net/npm/onnxruntime-web@1/dist/a.mjs', 'https://site.dev')).toBe('https://site.dev/cdn/npm/onnxruntime-web@1/dist/a.mjs');
  });
});
