import { stylesOf } from '../editorial/ranges';
import { AudioSample, AudioSampleSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import { AppError, toAppError } from '../core/errors';
import type { EditPlan, Segment } from '../core/types';
import { outputToClip } from '../engine/clips';
import { outputDuration } from '../engine/timeline';
import { drawFrame } from '../render/frame';
import type { FaceTrack } from '../render/framing';
import { chooseCodecs } from './codecs';
import { ensureEmojiFont, ensureFonts } from './fonts';
import { planUsesEmoji } from '../core/emoji';
import { ClipFrames, EXPORT_MAX_SIDE, type ClipSource } from './sources';
import { splicePlan, type ClipAudio } from './splice';

export interface ExportOptions {
  /** Exporta só os primeiros N segundos (prévia rápida). */
  maxDurationSec?: number;
  /** 1 = tamanho do formato; 0.5 = prévia leve. */
  scale?: number;
  onProgress?: (fraction: number) => void;
}

export interface ExportResult {
  blob: Blob;
  degraded: boolean;
  codec: string;
  /** vazio = fontes do estilo carregadas; senão, detalhe do aviso M4F-801 (vídeo saiu com fonte reserva) */
  fontWarning: string;
  /** a fonte dos emojis não carregou (M4F-805) */
  emojiWarning: string;
}

/** Áudio já emendado do vídeo editado (feito na tela, para o Worker não receber o áudio de todos os clipes). */
export interface OutputAudio {
  channels: Float32Array[];
  sampleRate: number;
}

/** Como abrir cada clipe na hora em que ele entra (no Worker, a partir do arquivo). */
export type ClipOpener = (id: string) => Promise<ClipSource & { dispose?: () => void }>;

export interface ExportSources {
  open: ClipOpener;
  tracks: Readonly<Record<string, FaceTrack | null>>;
}

export async function exportPlan(sources: ExportSources, audio: OutputAudio | null, plan: EditPlan, opts: ExportOptions = {}): Promise<ExportResult> {
  try {
    return await exportPlanUnsafe(sources, audio, plan, opts);
  } catch (err) {
    throw toAppError(err, 'EXPORTACAO_FALHOU');
  }
}

/** Áudio do vídeo editado a partir do áudio dos clipes (até `maxDurationSec`). */
export function outputAudio(audio: ClipAudio | null, plan: EditPlan, maxDurationSec = Infinity): OutputAudio | null {
  if (!audio) return null;
  const duration = Math.min(outputDuration(plan.segments), maxDurationSec);
  return { channels: splicePlan(audio, plan, trimSegments(plan.segments, duration)), sampleRate: audio.sampleRate };
}

async function exportPlanUnsafe(sources: ExportSources, audio: OutputAudio | null, plan: EditPlan, opts: ExportOptions): Promise<ExportResult> {
  const scale = opts.scale ?? 1;
  const width = even(plan.output.width * scale);
  const height = even(plan.output.height * scale);
  const fps = plan.output.fps;
  const duration = Math.min(outputDuration(plan.segments), opts.maxDurationSec ?? Infinity);
  const frames = Math.floor(duration * fps);
  const codecs = await chooseCodecs(width, height);
  // as fontes precisam estar carregadas antes do primeiro quadro (também dentro do Worker)
  const fonts = await ensureFonts(stylesOf(plan));
  const emoji = planUsesEmoji(plan) ? await ensureEmojiFont() : { ok: true, detail: '' };

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const audioSource = audio ? new AudioSampleSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  // quadros agrupados por clipe, em ordem: cada clipe abre na sua vez e fecha quando não volta mais
  const runs: { clipId: string; times: number[]; first: number }[] = [];
  for (let i = 0; i < frames; i++) {
    const at = outputToClip(plan.segments, plan.clips, i / fps);
    const id = at?.clipId ?? plan.clips[0]!.id;
    const last = runs.at(-1);
    if (last && last.clipId === id) last.times.push(at?.local ?? 0);
    else runs.push({ clipId: id, times: [at?.local ?? 0], first: i });
  }
  const opened = new Map<string, ClipSource & { dispose?: () => void }>();
  let i = 0;
  for (const [r, run] of runs.entries()) {
    let src = opened.get(run.clipId);
    if (!src) {
      try {
        src = await sources.open(run.clipId);
      } catch (err) {
        const app = toAppError(err, 'EXPORTACAO_CLIPE');
        throw app.key === 'EXPORTACAO_CLIPE' ? app : new AppError('EXPORTACAO_CLIPE', `clipe ${plan.clips.find((c) => c.id === run.clipId)?.name || run.clipId}: ${app.code} ${app.detail}`);
      }
      opened.set(run.clipId, src);
    }
    const frameSource = new ClipFrames(new Map([[run.clipId, src]]), { maxSide: EXPORT_MAX_SIDE, poolSize: 2 }, sources.tracks);
    const sink = frameSource.sink(run.clipId)!;
    let k = 0;
    for await (const wrapped of sink.canvasesAtTimestamps(run.times)) {
      const t = i / fps;
      drawFrame(ctx, plan, t, wrapped ? frameSource.frame(plan, run.clipId, wrapped.canvas, run.times[k]!) : null);
      await videoSource.add(t, 1 / fps);
      i++;
      k++;
      if (i % 10 === 0) opts.onProgress?.((i / frames) * 0.95);
    }
    // clipe que não aparece mais: libera o arquivo
    if (!runs.slice(r + 1).some((x) => x.clipId === run.clipId)) {
      opened.get(run.clipId)?.dispose?.();
      opened.delete(run.clipId);
    }
  }
  for (const s of opened.values()) s.dispose?.();

  if (audio && audioSource && audio.channels[0]!.length > 0) {
    // AudioSample (e não AudioBuffer): funciona também dentro do Worker, onde não existe Web Audio.
    const len = audio.channels[0]!.length;
    const planar = new Float32Array(len * audio.channels.length);
    audio.channels.forEach((ch, c) => planar.set(ch, c * len));
    const sample = new AudioSample({ data: planar, format: 'f32-planar', numberOfChannels: audio.channels.length, sampleRate: audio.sampleRate, timestamp: 0 });
    await audioSource.add(sample);
    sample.close();
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video, fontWarning: fonts.ok ? '' : fonts.detail, emojiWarning: emoji.ok ? '' : emoji.detail };
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

export function trimSegments(segments: Segment[], maxOut: number): Segment[] {
  const out: Segment[] = [];
  let acc = 0;
  for (const s of segments) {
    const len = s.srcEnd - s.srcStart;
    if (acc + len <= maxOut) out.push(s);
    else {
      if (maxOut - acc > 0) out.push({ srcStart: s.srcStart, srcEnd: s.srcStart + (maxOut - acc) });
      break;
    }
    acc += len;
  }
  return out;
}
