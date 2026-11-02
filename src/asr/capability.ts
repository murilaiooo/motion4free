import { NO_CAPABILITY, classifyGpu, gpuDisplayName, type AsrCapability, type GpuInfo } from '../core/asr-models';

interface GpuAdapterLike {
  features: { has(name: string): boolean };
  info?: { isFallbackAdapter?: boolean; vendor?: string; architecture?: string; device?: string; description?: string };
  isFallbackAdapter?: boolean;
}
interface NavigatorLike {
  gpu?: { requestAdapter(opts?: { powerPreference?: string }): Promise<GpuAdapterLike | null> };
  deviceMemory?: number;
}

let cached: Promise<AsrCapability> | null = null;

/** Nome da placa pelo WebGL (reserva quando o WebGPU não informa o modelo). Nunca falha. */
function webglRenderer(): string | undefined {
  try {
    if (typeof document === 'undefined') return undefined;
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl) return undefined;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const r = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : undefined;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return typeof r === 'string' && r.trim() ? r : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Mede o que o aparelho oferece para a transcrição, sem a pessoa escolher nada (v0.36):
 * se há WebGPU de verdade (não o adaptador de software), se a placa é dedicada ou integrada,
 * se tem fp16 e quanta memória o navegador informa. Nunca falha: na dúvida, "sem WebGPU".
 */
export function detectAsrCapability(): Promise<AsrCapability> {
  cached ??= (async () => {
    const nav = (typeof navigator === 'undefined' ? {} : navigator) as NavigatorLike;
    const memoryGB = typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null;
    if (!nav.gpu) return { ...NO_CAPABILITY, memoryGB };
    try {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter || adapter.info?.isFallbackAdapter || adapter.isFallbackAdapter) return { ...NO_CAPABILITY, memoryGB };
      const low = await nav.gpu.requestAdapter({ powerPreference: 'low-power' }).catch(() => null);
      const info: GpuInfo = {
        vendor: adapter.info?.vendor,
        architecture: adapter.info?.architecture,
        device: adapter.info?.device,
        description: adapter.info?.description,
        lowPowerVendor: low?.info?.vendor,
      };
      // o WebGL pode estar noutra placa: só serve de reserva quando o WebGPU não disse o fabricante (Brave)
      if (!info.vendor?.trim() && !info.description?.trim()) info.renderer = webglRenderer();
      const gpu = classifyGpu(info);
      if (gpu === 'nenhuma') return { ...NO_CAPABILITY, memoryGB };
      return { webgpu: true, f16: adapter.features.has('shader-f16'), memoryGB, gpu, gpuName: gpuDisplayName(info) };
    } catch {
      return { ...NO_CAPABILITY, memoryGB };
    }
  })();
  return cached;
}
