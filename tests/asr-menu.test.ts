import { describe, expect, it } from 'vitest';
import { ASR_CANDIDATES, ASR_MENU, ASR_MENU_KEYS, NO_CAPABILITY, accuracyLabel, asrLadder, checkLadder, chosenLadder, requestChecks, requestIsAuto, requestLadder, speedLabel, type AsrCapability } from '../src/core/asr-models';
import { buildRequest } from '../src/app/asr-precision';

const GPU: AsrCapability = { webgpu: true, f16: true, memoryGB: 8, gpu: 'dedicada', gpuName: 'NVIDIA GeForce RTX 3060' };
const IGPU: AsrCapability = { webgpu: true, f16: true, memoryGB: 8, gpu: 'integrada', gpuName: 'Intel UHD Graphics 620' };
const LOWMEM: AsrCapability = { webgpu: false, f16: false, memoryGB: 2 };

describe('cardápio "IA da legenda"', () => {
  it('cada item escolhe a versão que roda neste aparelho, ou diz que não roda', () => {
    expect(ASR_MENU.turbo.pick(GPU)).toBe('turbo-webgpu');
    expect(ASR_MENU.turbo.pick(NO_CAPABILITY)).toBeNull();
    expect(ASR_MENU['parakeet-gpu'].pick(GPU)).toBe('parakeet-webgpu');
    expect(ASR_MENU.parakeet.pick(NO_CAPABILITY)).toBe('parakeet-wasm');
    expect(ASR_MENU.parakeet.pick(LOWMEM)).toBeNull();
    expect(ASR_MENU.small.pick(IGPU)).toBe('small-webgpu');
    expect(ASR_MENU.small.pick(NO_CAPABILITY)).toBe('small-wasm');
    expect(ASR_MENU.base.pick(LOWMEM)).toBe('base-wasm');
    // todo item que pode não rodar explica o porquê
    for (const k of ASR_MENU_KEYS) if (ASR_MENU[k].pick(LOWMEM) === null) expect(ASR_MENU[k].why).not.toBe('');
  });

  it('ordem do cardápio vai do mais preciso para o mais leve', () => {
    const errs = ASR_MENU_KEYS.map((k) => ASR_MENU[k].ptErrorPct);
    expect([...errs].sort((a, b) => a - b)).toEqual(errs);
    expect(accuracyLabel(4.2)).toBe('excelente');
    expect(accuracyLabel(13.9)).toBe('básico');
    expect(speedLabel('parakeet-webgpu')).toBe('muito rápida');
    expect(speedLabel('small-wasm')).toBe('lenta');
  });

  it('modelo escolhido vai primeiro e a escada automática continua como reserva, sem repetir', () => {
    const l = chosenLadder('parakeet-webgpu', GPU);
    expect(l[0]).toBe('parakeet-webgpu');
    expect(l.slice(1)).toEqual(asrLadder('precisa', GPU));
    const s = chosenLadder('small-webgpu', GPU);
    expect(new Set(s).size).toBe(s.length);
    expect(s.at(-1)).toBe('base-wasm');
  });

  it('Automático manda o modo; escolhido manda a escada; conferência embrulha os dois', () => {
    expect(buildRequest('precisa', 'auto', false, GPU)).toEqual({ request: 'precisa', chosen: null });
    const chosen = buildRequest('rapida', 'parakeet', false, GPU);
    expect(chosen.chosen).toBe('parakeet-wasm');
    expect(requestLadder(chosen.request, GPU)[0]).toBe('parakeet-wasm');
    expect(requestIsAuto(chosen.request)).toBe(false);
    const checked = buildRequest('precisa', 'auto', true, GPU).request;
    expect(requestChecks(checked)).toBe(true);
    expect(requestIsAuto(checked)).toBe(true);
    expect(requestLadder(checked, GPU)).toEqual(asrLadder('precisa', GPU));
    expect(requestChecks('precisa')).toBe(false);
    // modelo que não roda aqui volta ao automático
    expect(buildRequest('precisa', 'turbo', false, NO_CAPABILITY)).toEqual({ request: 'precisa', chosen: null });
  });

  it('a conferência usa sempre uma IA de outra família', () => {
    for (const c of [GPU, IGPU, NO_CAPABILITY]) {
      for (const id of Object.keys(ASR_CANDIDATES) as (keyof typeof ASR_CANDIDATES)[]) {
        const second = checkLadder(id, c);
        for (const s of second) expect(ASR_CANDIDATES[s].engine).not.toBe(ASR_CANDIDATES[id].engine);
      }
    }
    expect(checkLadder('turbo-webgpu', GPU)[0]).toBe('parakeet-webgpu');
    expect(checkLadder('parakeet-wasm', IGPU)[0]).toBe('small-webgpu');
    expect(checkLadder('parakeet-wasm', GPU)[0]).toBe('turbo-webgpu');
    expect(checkLadder('small-wasm', LOWMEM)).toEqual([]);
  });
});
