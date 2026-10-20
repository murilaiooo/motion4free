import { describe, expect, it } from 'vitest';
import { ASR_CANDIDATES, NO_CAPABILITY, asrLadder, canRunTurbo, defaultAsrMode, describeMode, estimateMinutes, formatMB, whisperOptions } from '../src/core/asr-models';

const GPU = { webgpu: true, f16: true, memoryGB: 8 };

describe('escada de modelos de transcrição', () => {
  it('Precisa com placa de vídeo boa: turbo, depois small, depois base', () => {
    expect(asrLadder('precisa', GPU)).toEqual(['turbo-webgpu', 'small-wasm', 'base-webgpu', 'base-wasm']);
  });

  it('Precisa sem WebGPU: small no processador, depois base', () => {
    expect(asrLadder('precisa', NO_CAPABILITY)).toEqual(['small-wasm', 'base-wasm']);
  });

  it('WebGPU sem fp16 ou com pouca memória não tenta o turbo', () => {
    expect(canRunTurbo({ webgpu: true, f16: false, memoryGB: 8 })).toBe(false);
    expect(canRunTurbo({ webgpu: true, f16: true, memoryGB: 4 })).toBe(false);
    expect(canRunTurbo({ webgpu: true, f16: true, memoryGB: null })).toBe(true);
    expect(asrLadder('precisa', { webgpu: true, f16: false, memoryGB: 8 })).toEqual(['small-wasm', 'base-webgpu', 'base-wasm']);
  });

  it('Rápida usa o base (placa de vídeo se houver)', () => {
    expect(asrLadder('rapida', GPU)).toEqual(['base-webgpu', 'base-wasm']);
    expect(asrLadder('rapida', NO_CAPABILITY)).toEqual(['base-wasm']);
  });

  it('toda escada termina no base em WASM (sem beco sem saída)', () => {
    for (const mode of ['rapida', 'precisa'] as const)
      for (const c of [GPU, NO_CAPABILITY, { webgpu: true, f16: false, memoryGB: 2 }]) expect(asrLadder(mode, c).at(-1)).toBe('base-wasm');
  });

  it('padrão é Precisa, menos com pouca memória informada', () => {
    expect(defaultAsrMode(GPU)).toBe('precisa');
    expect(defaultAsrMode(NO_CAPABILITY)).toBe('precisa');
    expect(defaultAsrMode({ webgpu: false, f16: false, memoryGB: 2 })).toBe('rapida');
  });

  it('todos os modelos são exportações "_timestamped" (tempo por palavra)', () => {
    for (const c of Object.values(ASR_CANDIDATES)) expect(c.repo).toMatch(/^onnx-community\/whisper-[\w.-]+_timestamped$/);
  });

  it('mostra o tamanho do download e onde roda', () => {
    expect(formatMB(1400)).toBe('1,4 GB');
    expect(formatMB(250)).toBe('250 MB');
    expect(describeMode('precisa', GPU)).toBe('Whisper large-v3-turbo, usa a placa de vídeo; baixa cerca de 1,4 GB na primeira vez.');
    expect(describeMode('precisa', NO_CAPABILITY)).toContain('Whisper small, usa o processador; baixa cerca de 250 MB');
    expect(describeMode('precisa', NO_CAPABILITY)).toContain('demora alguns minutos');
    expect(describeMode('rapida', NO_CAPABILITY)).toBe('Whisper base, usa o processador; baixa cerca de 80 MB na primeira vez.');
  });

  it('idioma português e tarefa transcrever sempre fixos; segunda tentativa proíbe repetição', () => {
    expect(whisperOptions()).toEqual({ language: 'portuguese', task: 'transcribe', return_timestamps: 'word' });
    expect(whisperOptions(true)).toEqual({ language: 'portuguese', task: 'transcribe', return_timestamps: 'word', no_repeat_ngram_size: 6 });
  });

  it('estima o tempo de transcrição', () => {
    expect(estimateMinutes('turbo-webgpu', 145)).toBe(1);
    expect(estimateMinutes('small-wasm', 145)).toBe(3);
  });
});
