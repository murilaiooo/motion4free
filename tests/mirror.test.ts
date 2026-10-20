import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ASR_MODEL_REPOS, llmModelRecord, mirrorCdnUrl, upstreamUrl } from '../src/core/mirror';
import { ASR_CANDIDATES } from '../src/core/asr-models';
import { DEFAULT_LLM, LLM_MODELS, localAiErrorKey } from '../src/core/llm-models';

describe('espelho do modelo', () => {
  const MODEL_ID = 'onnx-community/whisper-base_timestamped';

  it('repassa os três modelos de transcrição (turbo, small, base) ao Hugging Face', () => {
    expect(ASR_MODEL_REPOS).toEqual([
      'onnx-community/whisper-large-v3-turbo_timestamped',
      'onnx-community/whisper-small_timestamped',
      'onnx-community/whisper-base_timestamped',
    ]);
    for (const repo of ASR_MODEL_REPOS) {
      expect(upstreamUrl(`/hf/${repo}/resolve/main/config.json`)).toBe(`https://huggingface.co/${repo}/resolve/main/config.json`);
      expect(upstreamUrl(`/hf/${repo}/resolve/main/generation_config.json`)).toBe(`https://huggingface.co/${repo}/resolve/main/generation_config.json`);
    }
  });

  it('repassa cada arquivo ONNX que a escada de modelos pede (dtype -> sufixo do Transformers.js)', () => {
    const suffix = { fp32: '', fp16: '_fp16', q8: '_quantized', q4: '_q4' } as const;
    for (const c of Object.values(ASR_CANDIDATES)) {
      const dt = typeof c.dtype === 'string' ? { encoder_model: c.dtype, decoder_model_merged: c.dtype } : c.dtype;
      for (const [file, d] of Object.entries(dt)) {
        const p = `/hf/${c.repo}/resolve/main/onnx/${file}${suffix[d]}.onnx`;
        expect(upstreamUrl(p)).toBe(`https://huggingface.co${p.slice(3)}`);
      }
    }
    // pesos grandes em arquivo separado (external data) também passam
    expect(upstreamUrl(`/hf/${ASR_MODEL_REPOS[0]}/resolve/main/onnx/encoder_model_fp16.onnx_data`)).not.toBeNull();
  });

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
    expect(upstreamUrl('/hf/onnx-community/whisper-large-v3/resolve/main/config.json')).toBeNull();
    expect(upstreamUrl('/hf/onnx-community/whisper-small/resolve/main/config.json')).toBeNull();
    expect(upstreamUrl('/cdn/npm/react@19/dist/x.js')).toBeNull();
    expect(upstreamUrl(`/hf/${MODEL_ID}/resolve/main/../../x`)).toBeNull();
    expect(upstreamUrl('/index.html')).toBeNull();
  });

  it('troca o jsdelivr pelo endereço do site', () => {
    expect(mirrorCdnUrl('https://cdn.jsdelivr.net/npm/onnxruntime-web@1/dist/a.mjs', 'https://site.dev')).toBe('https://site.dev/cdn/npm/onnxruntime-web@1/dist/a.mjs');
  });
});

describe('espelho dos modelos de texto opcionais (WebLLM)', () => {
  const models = Object.values(LLM_MODELS);

  it('tem leve, padrão e forte; o padrão é o 1.5B; o forte é o Qwen3 4B sem "pensar"', () => {
    expect(LLM_MODELS.forte.id).toBe('Qwen3-4B-q4f16_1-MLC');
    expect(LLM_MODELS.forte.thinking).toBe(true);
    expect(Object.keys(LLM_MODELS)).toEqual(['leve', 'padrao', 'forte']);
    expect(LLM_MODELS[DEFAULT_LLM].id).toBe('Qwen2.5-1.5B-Instruct-q4f16_1-MLC');
    expect(LLM_MODELS.leve.id).toBe('Qwen2.5-0.5B-Instruct-q4f16_1-MLC');
  });

  for (const m of models) {
    it(`repassa só os arquivos de ${m.id} e sua biblioteca`, () => {
      expect(upstreamUrl(`/hf/${m.repo}/resolve/main/mlc-chat-config.json`)).toBe(`https://huggingface.co/${m.repo}/resolve/main/mlc-chat-config.json`);
      expect(upstreamUrl(`/hf/${m.repo}/resolve/main/params_shard_0.bin`)).toBe(`https://huggingface.co/${m.repo}/resolve/main/params_shard_0.bin`);
      expect(upstreamUrl(`/gh/${m.lib}`)).toBe(`https://raw.githubusercontent.com/${m.lib}`);
      expect(upstreamUrl(`/gh/${m.lib}/../x`)).toBeNull();
    });

    it(`registro de ${m.key} usa o espelho no site e os originais sem site`, () => {
      const site = llmModelRecord('https://m4f.dev', m.key);
      expect(site.model_id).toBe(m.id);
      expect(site.model).toBe(`https://m4f.dev/hf/${m.repo}`);
      expect(site.model_lib).toBe(`https://m4f.dev/gh/${m.lib}`);
      expect(site.vram_required_MB).toBe(m.vramMB);
      expect(upstreamUrl(new URL(`${site.model}/resolve/main/tokenizer.json`).pathname)).not.toBeNull();
      expect(upstreamUrl(new URL(site.model_lib).pathname)).not.toBeNull();
      const direct = llmModelRecord(null, m.key);
      expect(direct.model).toBe(`https://huggingface.co/${m.repo}`);
      expect(direct.model_lib).toBe(`https://raw.githubusercontent.com/${m.lib}`);
    });

    it(`${m.id} é o mesmo da lista oficial do @mlc-ai/web-llm instalado (id, biblioteca, memória)`, () => {
      const lib = readFileSync('node_modules/@mlc-ai/web-llm/lib/index.js', 'utf8');
      const version = /modelVersion = "([^"]+)"/.exec(lib)![1]!;
      const record = new RegExp(`model_id: "${m.id}",\\s*model_lib: modelLibURLPrefix \\+\\s*modelVersion \\+\\s*"([^"]+)",([^}]*)`).exec(lib);
      expect(record).not.toBeNull();
      expect(m.lib).toBe(`mlc-ai/binary-mlc-llm-libs/main/web-llm-models/${version}${record![1]}`);
      const vram = /vram_required_MB: ([\d.]+)/.exec(record![2]!)![1];
      expect(m.vramMB).toBe(Math.ceil(Number(vram)));
      expect(llmModelRecord(null, m.key).low_resource_required).toBe(/low_resource_required: true/.test(record![2]!));
      expect(record![2]).toContain('context_window_size: 4096');
      expect(lib).toContain(`model: "https://huggingface.co/${m.repo}"`);
    });
  }

  it('recusa outros modelos e bibliotecas', () => {
    expect(upstreamUrl('/hf/mlc-ai/Llama-3-8B-Instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json')).toBeNull();
    expect(upstreamUrl('/gh/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3-8B-Instruct-q4f16_1-ctx4k_cs1k-webgpu.wasm')).toBeNull();
    expect(upstreamUrl('/gh/qualquer/repo/main/x.js')).toBeNull();
  });

  it('erro de memória da GPU vira M4F-1013; outros, M4F-1006', () => {
    expect(localAiErrorKey('GPUOutOfMemoryError: Out of memory')).toBe('IA_MODELO_GRANDE');
    expect(localAiErrorKey('Device was lost during load')).toBe('IA_MODELO_GRANDE');
    expect(localAiErrorKey('Failed to fetch')).toBe('IA_LOCAL_FALHOU');
  });
});
