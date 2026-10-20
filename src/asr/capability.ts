import { NO_CAPABILITY, type AsrCapability } from '../core/asr-models';

interface GpuAdapterLike {
  features: { has(name: string): boolean };
  info?: { isFallbackAdapter?: boolean };
  isFallbackAdapter?: boolean;
}
interface NavigatorLike {
  gpu?: { requestAdapter(opts?: { powerPreference?: string }): Promise<GpuAdapterLike | null> };
  deviceMemory?: number;
}

let cached: Promise<AsrCapability> | null = null;

/**
 * Mede o que o aparelho oferece para a transcrição: WebGPU de verdade (não o adaptador de software),
 * suporte a fp16 na placa e memória informada pelo navegador. Nunca falha: na dúvida, "sem WebGPU".
 */
export function detectAsrCapability(): Promise<AsrCapability> {
  cached ??= (async () => {
    const nav = (typeof navigator === 'undefined' ? {} : navigator) as NavigatorLike;
    const memoryGB = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
    if (!nav.gpu) return { ...NO_CAPABILITY, memoryGB };
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter || adapter.info?.isFallbackAdapter || adapter.isFallbackAdapter) return { ...NO_CAPABILITY, memoryGB };
      return { webgpu: true, f16: adapter.features.has('shader-f16'), memoryGB };
    } catch {
      return { ...NO_CAPABILITY, memoryGB };
    }
  })();
  return cached;
}
