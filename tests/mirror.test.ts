import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { LLM_LIB_PATH, LLM_MODEL_ID, LLM_REPO, MODEL_ID, llmModelRecord, mirrorCdnUrl, upstreamUrl } from '../src/core/mirror';

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

describe('espelho do modelo de texto opcional (WebLLM)', () => {
  it('repassa só os arquivos do modelo Qwen escolhido ao Hugging Face', () => {
    expect(upstreamUrl(`/hf/${LLM_REPO}/resolve/main/mlc-chat-config.json`)).toBe(`https://huggingface.co/${LLM_REPO}/resolve/main/mlc-chat-config.json`);
    expect(upstreamUrl(`/hf/${LLM_REPO}/resolve/main/params_shard_0.bin`)).toBe(`https://huggingface.co/${LLM_REPO}/resolve/main/params_shard_0.bin`);
    expect(upstreamUrl('/hf/mlc-ai/Llama-3-8B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json')).toBeNull();
  });

  it('repassa só a biblioteca WebGPU desse modelo ao GitHub', () => {
    expect(upstreamUrl(`/gh/${LLM_LIB_PATH}`)).toBe(`https://raw.githubusercontent.com/${LLM_LIB_PATH}`);
    expect(upstreamUrl('/gh/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm')).toBeNull();
    expect(upstreamUrl('/gh/qualquer/repo/main/x.js')).toBeNull();
    expect(upstreamUrl(`/gh/${LLM_LIB_PATH}/../x`)).toBeNull();
  });

  it('registro do modelo usa o espelho no site e os originais sem site', () => {
    const site = llmModelRecord('https://m4f.dev');
    expect(site.model).toBe(`https://m4f.dev/hf/${LLM_REPO}`);
    expect(site.model_lib).toBe(`https://m4f.dev/gh/${LLM_LIB_PATH}`);
    expect(upstreamUrl(new URL(`${site.model}/resolve/main/tokenizer.json`).pathname)).not.toBeNull();
    expect(upstreamUrl(new URL(site.model_lib).pathname)).not.toBeNull();
    const direct = llmModelRecord(null);
    expect(direct.model).toBe(`https://huggingface.co/${LLM_REPO}`);
    expect(direct.model_lib).toBe(`https://raw.githubusercontent.com/${LLM_LIB_PATH}`);
  });

  it('é o mesmo modelo e a mesma biblioteca da lista oficial do @mlc-ai/web-llm instalado', () => {
    const lib = readFileSync('node_modules/@mlc-ai/web-llm/lib/index.js', 'utf8');
    const version = /modelVersion = "([^"]+)"/.exec(lib)![1]!;
    const record = new RegExp(`model_id: "${LLM_MODEL_ID}",\\s*model_lib: modelLibURLPrefix \\+\\s*modelVersion \\+\\s*"([^"]+)"`).exec(lib);
    expect(record).not.toBeNull();
    expect(LLM_LIB_PATH).toBe(`mlc-ai/binary-mlc-llm-libs/main/web-llm-models/${version}${record![1]}`);
    expect(lib).toContain(`model: "https://huggingface.co/${LLM_REPO}"`);
  });
});
