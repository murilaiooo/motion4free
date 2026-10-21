import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MB } from '../src/core/bytes';
import { LLM_MODELS } from '../src/core/llm-models';

const capacity = vi.hoisted(() => ({ value: { free: 1700 * 1024 * 1024, cached: new Set<string>() } }));
const loader = vi.hoisted(() => ({ load: vi.fn(async () => ({ complete: async () => '{"ok":true}' })) }));
vi.mock('../src/ai/local-capacity', () => ({ localModelCapacity: async () => capacity.value }));
vi.mock('../src/ai/local-ai', () => ({ loadLocalAi: loader.load, LOCAL_AI_ENABLED: true, webGpuAvailable: () => true }));
import { prepareAi, type AiSettings } from '../src/app/AiOptions';
const settings = (model: 'forte' | 'padrao' | 'leve'): AiSettings => ({ mode: 'local', model, provider: null, remote: null, consent: [] });

describe('quota recovery applies to clips and automatic editor via shared prepareAi (#72)', () => {
  beforeEach(() => { loader.load.mockClear(); capacity.value = { free: 1700 * MB, cached: new Set<string>() }; });
  it('offers the standard model before downloading an oversized model', async () => {
    const result = await prepareAi(settings('forte'), () => undefined);
    expect(result.ai).toBeNull();
    expect(result.warning?.code).toBe('M4F-1014');
    expect(result.warning?.detail).toContain('Padrão');
    expect(loader.load).not.toHaveBeenCalled();
  });
  it('allows a smaller model in same session without silently switching to it', async () => {
    await prepareAi(settings('forte'), () => undefined);
    const result = await prepareAi(settings('padrao'), () => undefined);
    expect(result.warning).toBeNull();
    expect(result.ai?.source).toBe('ia-local');
    expect(loader.load).toHaveBeenCalledWith('padrao', expect.any(Function));
  });
  it('allows already cached strong model despite reported quota', async () => {
    capacity.value = { free: 0, cached: new Set(['forte']) };
    const result = await prepareAi(settings('forte'), () => undefined);
    expect(result.warning).toBeNull();
    expect(loader.load).toHaveBeenCalledTimes(1);
  });
  it('unknown quota does not block a selected model', async () => {
    capacity.value = { free: null as unknown as number, cached: new Set() };
    const result = await prepareAi(settings('forte'), () => undefined);
    expect(result.warning).toBeNull();
    expect(loader.load).toHaveBeenCalledTimes(1);
  });
});
