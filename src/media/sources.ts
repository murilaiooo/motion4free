import { CanvasSink, type InputVideoTrack } from 'mediabunny';
import type { EditPlan } from '../core/types';
import type { SourceFrame } from '../render/frame';
import { framingFor, trackAt, type FaceTrack } from '../render/framing';

/**
 * Quadros dos clipes para o player e a exportação (v0.14). Um `CanvasSink` por clipe, criado só quando
 * o clipe é usado; o decodificador do Mediabunny vive enquanto a leitura daquele pedaço está aberta e
 * fecha no fim dela (um por clipe ativo). Cada quadro sai no tamanho de origem (até `maxSide`), com a
 * proporção real, e vira um `SourceFrame` que `drawFrame` enquadra no formato de saída.
 */

export interface ClipSource {
  id: string;
  video: InputVideoTrack;
  /** tamanho de exibição (já com a rotação do arquivo) */
  width: number;
  height: number;
}

/** Tamanho de decodificação: a proporção da origem com o lado maior até `maxSide` (nunca aumenta). */
export function decodeSize(width: number, height: number, maxSide: number): { width: number; height: number } {
  const k = Math.min(1, maxSide / Math.max(width, height));
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(width * k), height: even(height * k) };
}

/** Lado maior de decodificação: prévia leve; exportação perto do original (recorte de vídeo deitado para vertical precisa de pixels). */
export const PREVIEW_MAX_SIDE = 1280;
export const EXPORT_MAX_SIDE = 2880;

export class ClipFrames {
  private readonly sinks = new Map<string, CanvasSink>();
  private readonly sizes = new Map<string, { width: number; height: number }>();
  private backdrops: OffscreenCanvas[] = [];
  private flip = 0;

  constructor(
    private readonly sources: ReadonlyMap<string, ClipSource>,
    private readonly opts: { maxSide: number; poolSize: number },
    private readonly tracks: Readonly<Record<string, FaceTrack | null | undefined>> = {},
  ) {}

  has(id: string): boolean {
    return this.sources.has(id);
  }

  sink(id: string): CanvasSink | null {
    const cached = this.sinks.get(id);
    if (cached) return cached;
    const src = this.sources.get(id);
    if (!src) return null;
    const size = decodeSize(src.width, src.height, this.opts.maxSide);
    const sink = new CanvasSink(src.video, { width: size.width, height: size.height, fit: 'fill', poolSize: this.opts.poolSize });
    this.sinks.set(id, sink);
    this.sizes.set(id, size);
    return sink;
  }

  /** Solta o leitor de um clipe que não vai mais ser usado (a memória dos quadros volta). */
  release(id: string): void {
    this.sinks.delete(id);
    this.sizes.delete(id);
  }

  /** Quadro decodificado → quadro com o que o enquadramento precisa (foco do rosto, fundo desfocado). */
  frame(plan: Pick<EditPlan, 'framing' | 'clips'>, id: string, image: HTMLCanvasElement | OffscreenCanvas, local: number): SourceFrame {
    const framing = framingFor(plan, id);
    const width = image.width;
    const height = image.height;
    return {
      kind: 'clip',
      image,
      width,
      height,
      clipId: id,
      focus: framing.mode === 'smart' ? trackAt(this.tracks[id], local) : null,
      backdrop: framing.mode === 'fit' && framing.fill === 'blur' ? this.backdrop(image) : null,
    };
  }

  /** Cópia minúscula do quadro (em dois passos, para não serrilhar): esticada, vira um desfoque. */
  private backdrop(image: HTMLCanvasElement | OffscreenCanvas): OffscreenCanvas | null {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const aspect = image.height / Math.max(1, image.width);
    const mid = { w: 96, h: Math.max(2, Math.round(96 * aspect)) };
    const small = { w: 24, h: Math.max(2, Math.round(24 * aspect)) };
    // dois conjuntos alternados: o quadro anterior ainda pode estar na tela enquanto o próximo é preparado
    const i = (this.flip = (this.flip + 1) % 2) * 2;
    const a = (this.backdrops[i] ??= new OffscreenCanvas(mid.w, mid.h));
    const b = (this.backdrops[i + 1] ??= new OffscreenCanvas(small.w, small.h));
    if (a.width !== mid.w || a.height !== mid.h) {
      a.width = mid.w;
      a.height = mid.h;
    }
    if (b.width !== small.w || b.height !== small.h) {
      b.width = small.w;
      b.height = small.h;
    }
    const ca = a.getContext('2d');
    const cb = b.getContext('2d');
    if (!ca || !cb) return null;
    ca.imageSmoothingQuality = 'high';
    ca.drawImage(image, 0, 0, mid.w, mid.h);
    cb.imageSmoothingQuality = 'high';
    cb.drawImage(a, 0, 0, small.w, small.h);
    return b;
  }
}
