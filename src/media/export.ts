import { stylesOf } from '../editorial/ranges';
import { buildExportPreflight } from '../editorial/export-preflight';
import { AudioSample, AudioSampleSource, BufferTarget, CanvasSink, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny';
import { toAppError } from '../core/errors';
import type { EditPlan } from '../core/types';
import { outputDuration, outputToSource } from '../engine/timeline';
import { drawFrame } from '../render/frame';
import type { DecodedAudio } from './audio';
import { chooseCodecs } from './codecs';
import { ensureEmojiFont, ensureFonts } from './fonts';
import { planUsesEmoji } from '../core/emoji';
import type { OpenedMedia } from './input';
import { CLIP_CROSSFADE_SEC, spliceAudio } from './splice';
import { ClipFrames, EXPORT_MAX_SIDE, decodeSize, type ClipSource } from './sources';
import { clipLayout, outputToClip } from '../engine/clips';
import { mixMusic } from '../engine/music-mix';

export interface ExportOptions {
  maxDurationSec?: number;
  scale?: number;
  onProgress?: (fraction: number) => void;
  /** música de fundo decodificada (v0.26); entra só se o plano tem `music` */
  music?: DecodedAudio | null;
}

export interface ExportResult {
  blob: Blob;
  degraded: boolean;
  codec: string;
  fontWarning: string;
  emojiWarning: string;
}

// Keep single-media export for backward compat, but also support multi via clipSources
export async function exportPlan(media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, opts: ExportOptions = {}): Promise<ExportResult> {
  try {
    buildExportPreflight(plan, new Set([plan.clips[0]?.id ?? 'c1']), audio !== null);
    return await exportPlanUnsafe(media, audio, plan, opts);
  } catch (err) {
    throw toAppError(err, 'EXPORTACAO_FALHOU');
  }
}

// New multi-clip export: pass map of clip sources and optional combined audio
export async function exportPlanMulti(
  clipSources: Map<string, ClipSource>,
  audio: DecodedAudio | null,
  plan: EditPlan,
  opts: ExportOptions = {},
): Promise<ExportResult> {
  try {
    buildExportPreflight(plan, new Set(clipSources.keys()), audio !== null);
    return await exportPlanUnsafeMulti(clipSources, audio, plan, opts);
  } catch (err) {
    throw toAppError(err, 'EXPORTACAO_FALHOU');
  }
}

async function exportPlanUnsafe(media: OpenedMedia, audio: DecodedAudio | null, plan: EditPlan, opts: ExportOptions): Promise<ExportResult> {
  const scale = opts.scale ?? 1;
  const width = even(plan.output.width * scale);
  const height = even(plan.output.height * scale);
  const fps = plan.output.fps;
  const duration = Math.min(outputDuration(plan.segments), opts.maxDurationSec ?? Infinity);
  const frames = Math.floor(duration * fps);
  const codecs = await chooseCodecs(width, height, Boolean(audio || (opts.music && plan.music)));
  const fonts = await ensureFonts(stylesOf(plan));
  const emoji = planUsesEmoji(plan) ? await ensureEmojiFont() : { ok: true, detail: '' };

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const music = opts.music && plan.music ? opts.music : null;
  const audioSource = audio || music ? new AudioSampleSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const srcSize = decodeSize(media.width, media.height, EXPORT_MAX_SIDE);
  const sink = new CanvasSink(media.video, { ...srcSize, fit: 'fill', poolSize: 2 });
  // Um pedido só com todos os instantes (em ordem): o decodificador lê cada pedaço do arquivo uma vez.
  // Antes era um getCanvas por quadro, que pode voltar ao quadro-chave a cada quadro (exportação lenta).
  const times = Array.from({ length: frames }, (_, f) => outputToSource(plan.segments, f / fps) ?? 0);
  let f = 0;
  for await (const wrapped of sink.canvasesAtTimestamps(times)) {
    if (f >= frames) break;
    const t = f / fps;
    drawFrame(ctx as any, plan, t, (wrapped?.canvas as any) ?? null);
    await videoSource.add(t, 1 / fps);
    if (f % 10 === 0) opts.onProgress?.((f / frames) * 0.95);
    f++;
  }
  // o vídeo acabou antes do previsto (arquivo cortado): o resto sai só com o desenho do modelo, sem buraco no tempo
  for (; f < frames; f++) {
    drawFrame(ctx as any, plan, f / fps, null);
    await videoSource.add(f / fps, 1 / fps);
  }

  // quadros prontos: o resto é o áudio e o fechamento do arquivo (a tela mostra "Fechando o arquivo MP4")
  opts.onProgress?.(0.95);
  if (audioSource) {
    const trimmed = trimSegments(plan.segments, duration);
    const speech = audio ? spliceAudio(audio.channels, audio.sampleRate, trimmed) : null;
    await addAudio(audioSource, speech, audio?.sampleRate ?? music!.sampleRate, duration, plan, music);
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video, fontWarning: fonts.ok ? '' : fonts.detail, emojiWarning: emoji.ok ? '' : emoji.detail };
}

async function exportPlanUnsafeMulti(
  clipSources: Map<string, ClipSource>,
  audio: DecodedAudio | null,
  plan: EditPlan,
  opts: ExportOptions,
): Promise<ExportResult> {
  const scale = opts.scale ?? 1;
  const width = even(plan.output.width * scale);
  const height = even(plan.output.height * scale);
  const fps = plan.output.fps;
  const duration = Math.min(outputDuration(plan.segments), opts.maxDurationSec ?? Infinity);
  const frames = Math.floor(duration * fps);
  const codecs = await chooseCodecs(width, height, Boolean(audio || (opts.music && plan.music)));
  const fonts = await ensureFonts(stylesOf(plan));
  const emoji = planUsesEmoji(plan) ? await ensureEmojiFont() : { ok: true, detail: '' };

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: codecs.video, bitrate: QUALITY_HIGH });
  output.addVideoTrack(videoSource, { frameRate: fps });
  const music = opts.music && plan.music ? opts.music : null;
  const audioSource = audio || music ? new AudioSampleSource({ codec: 'aac', bitrate: 128_000 }) : null;
  if (audioSource) output.addAudioTrack(audioSource);
  await output.start();

  const clipFrames = new ClipFrames(clipSources, { maxSide: EXPORT_MAX_SIDE, poolSize: 2 });
  // Quadros agrupados em sequências do mesmo clipe; cada sequência é lida de uma vez, em ordem (ver acima).
  const infos = Array.from({ length: frames }, (_, f) => outputToClip(plan.segments, plan.clips, f / fps));
  let f = 0;
  while (f < frames) {
    const info = infos[f];
    const sink = info ? clipFrames.sink(info.clipId) : null;
    let end = f + 1;
    while (end < frames && infos[end]?.clipId === info?.clipId) end++;
    if (!info || !sink) {
      for (; f < end; f++) {
        drawFrame(ctx as any, plan, f / fps, null);
        await videoSource.add(f / fps, 1 / fps);
      }
      continue;
    }
    const locals = infos.slice(f, end).map((i) => i!.local);
    for await (const wrapped of sink.canvasesAtTimestamps(locals)) {
      if (f >= end) break;
      const t = f / fps;
      const frame = wrapped?.canvas ? clipFrames.frame(plan, info.clipId, wrapped.canvas as any, infos[f]!.local) : null;
      drawFrame(ctx as any, plan, t, frame);
      await videoSource.add(t, 1 / fps);
      if (f % 10 === 0) opts.onProgress?.((f / frames) * 0.95);
      f++;
    }
    for (; f < end; f++) {
      drawFrame(ctx as any, plan, f / fps, null);
      await videoSource.add(f / fps, 1 / fps);
    }
  }

  // quadros prontos: o resto é o áudio e o fechamento do arquivo (a tela mostra "Fechando o arquivo MP4")
  opts.onProgress?.(0.95);
  if (audioSource) {
    const trimmed = trimSegments(plan.segments, duration);
    const joins = { clips: clipLayout(plan.clips).map(c => ({ start: c.start, end: c.end })), crossfadeSec: CLIP_CROSSFADE_SEC };
    const speech = audio ? spliceAudio(audio.channels, audio.sampleRate, trimmed, 0.008, joins) : null;
    await addAudio(audioSource, speech, audio?.sampleRate ?? music!.sampleRate, duration, plan, music);
  }

  await output.finalize();
  opts.onProgress?.(1);
  const data = (output.target as BufferTarget).buffer!;
  return { blob: new Blob([data], { type: 'video/mp4' }), degraded: codecs.degraded, codec: codecs.video, fontWarning: fonts.ok ? '' : fonts.detail, emojiWarning: emoji.ok ? '' : emoji.detail };
}

/** Fala montada (ou silêncio) com a música por baixo, na mesma mistura da prévia, numa amostra só. */
async function addAudio(source: AudioSampleSource, speech: Float32Array[] | null, sampleRate: number, duration: number, plan: EditPlan, music: DecodedAudio | null): Promise<void> {
  const channels = music && plan.music ? mixMusic(speech, sampleRate, duration, music, plan.music) : speech;
  if (!channels?.length) return;
  const len = channels[0]!.length;
  const planar = new Float32Array(len * channels.length);
  channels.forEach((ch, c) => planar.set(ch, c * len));
  const sample = new AudioSample({ data: planar, format: 'f32-planar', numberOfChannels: channels.length, sampleRate, timestamp: 0 });
  await source.add(sample);
  sample.close();
}

function even(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

function trimSegments(segments: EditPlan['segments'], maxOut: number): EditPlan['segments'] {
  const out: EditPlan['segments'] = [];
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
