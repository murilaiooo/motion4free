import { describe, expect, it } from 'vitest';
import { ASR_CANDIDATES, NO_CAPABILITY, PARAKEET_FILES, asrLadder, canRunParakeet, canRunTurbo, classifyGpu, defaultAsrMode, describeGpu, describeMode, estimateMinutes, formatMB, gpuDisplayName, modelWhereLabel, whisperOptions, type AsrCapability } from '../src/core/asr-models';

const GPU: AsrCapability = { webgpu: true, f16: true, memoryGB: 8, gpu: 'dedicada', gpuName: 'NVIDIA GeForce RTX 3060' };
const IGPU: AsrCapability = { webgpu: true, f16: true, memoryGB: 8, gpu: 'integrada', gpuName: 'Intel UHD Graphics 620' };
const UNKNOWN: AsrCapability = { webgpu: true, f16: true, memoryGB: 8, gpu: 'desconhecida', gpuName: null };

describe('escada de modelos de transcrição', () => {
  it('Parakeet v3 entra no Precisa logo depois do turbo, e só com 4 GB de memória ou mais', () => {
    expect(canRunParakeet(NO_CAPABILITY)).toBe(true);
    expect(canRunParakeet({ webgpu: false, f16: false, memoryGB: 4 })).toBe(true);
    expect(canRunParakeet({ webgpu: false, f16: false, memoryGB: 2 })).toBe(false);
    expect(asrLadder('precisa', { webgpu: false, f16: false, memoryGB: 2 })).toEqual(['small-wasm', 'base-wasm']);
    // o modo Rápida não muda (Whisper base)
    expect(asrLadder('rapida', IGPU)).not.toContain('parakeet-wasm');
    const p = ASR_CANDIDATES['parakeet-wasm'];
    expect(p).toMatchObject({ engine: 'parakeet', device: 'wasm', repo: 'ysdede/parakeet-tdt-0.6b-v3-onnx' });
    // download anunciado bate com a soma dos arquivos (± 10 MB)
    const bytes = PARAKEET_FILES.files.reduce((s, f) => s + f.bytes, 0);
    expect(Math.abs(bytes / 1e6 - p.downloadMB)).toBeLessThan(10);
  });

  it('texto da opção Precisa com placa integrada fala do Parakeet no processador, sem o aviso de "sem placa"', () => {
    const t = describeMode('precisa', IGPU);
    expect(t).toContain('Parakeet v3');
    expect(t).toContain('usa o processador');
    expect(t).not.toContain('sem placa de vídeo compatível');
  });

  it('Precisa com placa dedicada: turbo, small e base na placa; processador só depois', () => {
    expect(asrLadder('precisa', GPU)).toEqual(['turbo-webgpu', 'parakeet-wasm', 'small-webgpu', 'base-webgpu', 'small-wasm', 'base-wasm']);
  });

  it('Precisa com placa integrada: small na placa integrada antes do processador (sem o turbo)', () => {
    expect(asrLadder('precisa', IGPU)).toEqual(['parakeet-wasm', 'small-webgpu', 'base-webgpu', 'small-wasm', 'base-wasm']);
  });

  it('placa não identificada (Brave) tenta o turbo e desce sozinha', () => {
    expect(asrLadder('precisa', UNKNOWN)[0]).toBe('turbo-webgpu');
  });

  it('capacidade antiga sem o tipo de placa conta como dedicada', () => {
    expect(asrLadder('precisa', { webgpu: true, f16: true, memoryGB: 8 })[0]).toBe('turbo-webgpu');
  });

  it('Precisa sem WebGPU: small no processador, depois base', () => {
    expect(asrLadder('precisa', NO_CAPABILITY)).toEqual(['parakeet-wasm', 'small-wasm', 'base-wasm']);
  });

  it('WebGPU sem fp16 ou com pouca memória não tenta o turbo', () => {
    expect(canRunTurbo({ webgpu: true, f16: false, memoryGB: 8 })).toBe(false);
    expect(canRunTurbo({ webgpu: true, f16: true, memoryGB: 4 })).toBe(false);
    expect(canRunTurbo({ webgpu: true, f16: true, memoryGB: null })).toBe(true);
    expect(canRunTurbo(IGPU)).toBe(false);
    // placa sem fp16: small na placa com encoder fp32, ainda antes do processador
    expect(asrLadder('precisa', { webgpu: true, f16: false, memoryGB: 8 })).toEqual(['parakeet-wasm', 'small-webgpu-fp32', 'base-webgpu', 'small-wasm', 'base-wasm']);
    expect(ASR_CANDIDATES['small-webgpu-fp32'].dtype).toEqual({ encoder_model: 'fp32', decoder_model_merged: 'q4' });
  });

  it('Rápida usa o base (placa de vídeo se houver)', () => {
    expect(asrLadder('rapida', GPU)).toEqual(['base-webgpu', 'base-wasm']);
    expect(asrLadder('rapida', NO_CAPABILITY)).toEqual(['base-wasm']);
  });

  it('toda escada termina no base em WASM (sem beco sem saída)', () => {
    for (const mode of ['rapida', 'precisa'] as const)
      for (const c of [GPU, IGPU, UNKNOWN, NO_CAPABILITY, { webgpu: true, f16: false, memoryGB: 2 }]) expect(asrLadder(mode, c).at(-1)).toBe('base-wasm');
  });

  it('padrão é Precisa, menos com pouca memória informada', () => {
    expect(defaultAsrMode(GPU)).toBe('precisa');
    expect(defaultAsrMode(NO_CAPABILITY)).toBe('precisa');
    expect(defaultAsrMode({ webgpu: false, f16: false, memoryGB: 2 })).toBe('rapida');
  });

  it('todos os modelos são exportações "_timestamped" (tempo por palavra)', () => {
    for (const c of Object.values(ASR_CANDIDATES)) if (c.engine === 'whisper') expect(c.repo).toMatch(/^onnx-community\/whisper-[\w.-]+_timestamped$/);
  });

  it('mostra o tamanho do download e onde roda', () => {
    expect(formatMB(1400)).toBe('1,4 GB');
    expect(formatMB(250)).toBe('250 MB');
    expect(describeMode('precisa', GPU)).toBe('Whisper large-v3-turbo, usa a placa de vídeo; baixa cerca de 1,4 GB na primeira vez.');
    expect(describeMode('precisa', NO_CAPABILITY)).toContain('Parakeet v3, usa o processador; baixa cerca de 670 MB');
    expect(describeMode('precisa', NO_CAPABILITY)).toContain('demora alguns minutos');
    expect(describeMode('rapida', NO_CAPABILITY)).toBe('Whisper base, usa o processador; baixa cerca de 80 MB na primeira vez.');
    expect(describeMode('precisa', IGPU)).toBe('Parakeet v3, usa o processador; baixa cerca de 670 MB na primeira vez.');
    expect(describeMode('precisa', { ...IGPU, memoryGB: 2 })).toBe('Whisper small, usa a placa de vídeo integrada; baixa cerca de 380 MB na primeira vez.');
  });

  it('diz onde o modelo rodou e qual placa achou', () => {
    expect(modelWhereLabel('turbo-webgpu', GPU)).toBe('Whisper large-v3-turbo (placa de vídeo dedicada: NVIDIA GeForce RTX 3060)');
    expect(modelWhereLabel('small-webgpu', IGPU)).toBe('Whisper small (placa de vídeo integrada: Intel UHD Graphics 620)');
    expect(modelWhereLabel('small-webgpu', UNKNOWN)).toBe('Whisper small (placa de vídeo)');
    expect(modelWhereLabel('small-wasm', GPU)).toBe('Whisper small (processador)');
    expect(describeGpu(GPU)).toContain('dedicada (NVIDIA GeForce RTX 3060)');
    expect(describeGpu(IGPU)).toContain('Alto desempenho');
    expect(describeGpu(UNKNOWN)).toContain('Brave');
    expect(describeGpu(NO_CAPABILITY)).toContain('processador');
  });
});

describe('detecção da placa de vídeo', () => {
  it('reconhece placas dedicadas', () => {
    expect(classifyGpu({ vendor: 'nvidia', architecture: 'ampere' })).toBe('dedicada');
    expect(classifyGpu({ vendor: 'amd', description: 'AMD Radeon RX 6600' })).toBe('dedicada');
    expect(classifyGpu({ vendor: 'intel', architecture: 'xe-hpg', description: 'Intel(R) Arc(TM) A770 Graphics' })).toBe('dedicada');
    expect(classifyGpu({ vendor: 'apple', architecture: 'metal-3' })).toBe('dedicada');
  });

  it('reconhece placas integradas ao processador', () => {
    expect(classifyGpu({ vendor: 'intel', architecture: 'gen-12lp' })).toBe('integrada');
    expect(classifyGpu({ vendor: 'intel', description: 'Intel(R) Arc(TM) Graphics' })).toBe('integrada');
    expect(classifyGpu({ vendor: 'amd', description: 'AMD Radeon(TM) Graphics' })).toBe('integrada');
    expect(classifyGpu({ vendor: 'amd', description: 'AMD Radeon 780M Graphics' })).toBe('integrada');
    expect(classifyGpu({ vendor: 'qualcomm', architecture: 'adreno-7xx' })).toBe('integrada');
  });

  it('duas placas: a de alto desempenho diferente da econômica é a dedicada', () => {
    expect(classifyGpu({ vendor: 'amd', lowPowerVendor: 'intel' })).toBe('dedicada');
  });

  it('usa o nome do WebGL quando o WebGPU esconde o modelo (Brave)', () => {
    const renderer = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002504) Direct3D11 vs_5_0 ps_5_0, D3D11)';
    expect(classifyGpu({ vendor: '', renderer })).toBe('dedicada');
    expect(gpuDisplayName({ renderer })).toBe('NVIDIA GeForce RTX 3060');
    expect(gpuDisplayName({ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' })).toBe('Intel UHD Graphics 620');
  });

  it('sem informação nenhuma: desconhecida; adaptador de software: nenhuma', () => {
    expect(classifyGpu({ vendor: '', architecture: '' })).toBe('desconhecida');
    expect(classifyGpu({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)' })).toBe('nenhuma');
    expect(classifyGpu({ description: 'Microsoft Basic Render Driver' })).toBe('nenhuma');
  });

  it('detecta automaticamente ou respeita português/inglês, sem traduzir a fala', () => {
    expect(whisperOptions()).toEqual({ task: 'transcribe', return_timestamps: 'word' });
    expect(whisperOptions(false, 'pt')).toEqual({ language: 'portuguese', task: 'transcribe', return_timestamps: 'word' });
    expect(whisperOptions(false, 'en')).toEqual({ language: 'english', task: 'transcribe', return_timestamps: 'word' });
    expect(whisperOptions(true, 'en')).toEqual({ language: 'english', task: 'transcribe', return_timestamps: 'word', no_repeat_ngram_size: 6 });
  });

  it('estima o tempo de transcrição', () => {
    expect(estimateMinutes('turbo-webgpu', 145)).toBe(1);
    expect(estimateMinutes('small-wasm', 145)).toBe(3);
  });
});
