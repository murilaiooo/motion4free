import type { ClipRef, Framing } from '../core/types';
import type { Word, TimeRange } from '../core/types';
import { clipLayout, placeRanges, placeWords } from '../engine/clips';
import { AppError, describeError, toAppError } from '../core/errors';
import type { OpenedMedia } from './input';
import { openMedia } from './input';
import { decodeAudio, toMono16k, type DecodedAudio } from './audio';
import { findSilences } from '../analysis/silence';
import { clipGains, peakOf, speechLevelDb } from '../analysis/loudness';
import { cleanTranscript, toWords } from '../analysis/asr-merge';
import { planAsr } from '../analysis/asr-windows';
import type { Transcriber } from '../asr/transcriber';
import type { OnProgress } from '../core/progress';
import { DEFAULT_FRAMING } from '../core/types';

export interface OpenedClip {
  id: string;
  file: Blob;
  name: string;
  media: OpenedMedia;
  durationSec: number;
  words: Word[];
  silences: TimeRange[];
  audio: DecodedAudio | null;
}

export interface MultiSessionInput {
  clips: OpenedClip[];
  wordsByClip: Record<string, Word[]>;
  silencesByClip: Record<string, TimeRange[]>;
  audiosByClip: Record<string, DecodedAudio | null>;
  combinedAudio: DecodedAudio | null;
  asrModel: string | null;
  warnings: AppError[];
}

/**
 * Abre vários arquivos com análise completa por clip (áudio, silêncios, transcrição)
 */
export async function openClips(
  files: File[],
  transcriber?: Transcriber,
  onStep?: OnProgress,
  asrMode?: string,
  firstClipNumber = 1,
): Promise<MultiSessionInput> {
  if (files.length === 0) throw new AppError('SEM_VIDEO');
  if (files.length > 30) throw new AppError('CLIPES_DEMAIS', `${files.length} clipes (máximo 30)`);

  const clips: OpenedClip[] = [];
  const wordsByClip: Record<string, Word[]> = {};
  const silencesByClip: Record<string, TimeRange[]> = {};
  const audiosByClip: Record<string, DecodedAudio | null> = {};
  const warnings: AppError[] = [];
  let asrModel: string | null = null;
  let runningDuration = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const which = `clipe ${i + 1} de ${files.length}`;
    // cada etapa de dentro (ler áudio, baixar modelo, transcrever) diz também em qual clipe está
    const inner: OnProgress = (p) => onStep?.({ ...p, detail: p.detail ? `${which} · ${p.detail}` : which });
    onStep?.({ label: `Abrindo os vídeos`, phase: 'abrir', fraction: i / files.length, detail: `${which} · ${file.name}` });
    let media: OpenedMedia;
    try {
      media = await openMedia(file);
    } catch (err) {
      warnings.push(new AppError('CLIPE_ILEGIVEL', `${file.name}: ${describeError(err)}`));
      continue;
    }
    runningDuration += media.durationSec;
    if (runningDuration > 600) throw new AppError('CLIPES_LONGOS', `${runningDuration.toFixed(1)} s > 600 s`);
    // Somente arquivos válidos ganham IDs. O primeiro arquivo válido é sempre c1 num projeto novo.
    const id = `c${firstClipNumber + clips.length}`;
    let audio: DecodedAudio | null = null;
    if (media.audio) {
      try { audio = await decodeAudio(media.audio, media.durationSec, (fraction) => inner({ label: 'Lendo o áudio', phase: 'audio', fraction })); }
      catch (e) { warnings.push(new AppError('AUDIO_FALHOU', `${file.name}: ${describeError(e)}`)); }
    } else {
      warnings.push(new AppError('SEM_AUDIO', file.name));
    }
    let words: Word[] = [];
    let silences: TimeRange[] = [];
    if (audio) {
      try {
        const mono = await toMono16k(audio);
        inner({ label: 'Procurando silêncios', phase: 'silencios', fraction: null });
        silences = findSilences(mono, 16000);
        if (transcriber) {
          const r = await transcriber.transcribe(mono.slice(), media.durationSec, planAsr(silences, media.durationSec), inner, asrMode as any);
          words = toWords(cleanTranscript(r.words, silences)).map((w) => ({ ...w, id: `${id}:${w.id}` })); // IDs únicos entre clipes
          asrModel ??= r.model;
          warnings.push(...r.notices);
        }
      } catch (e) {
        warnings.push(toAppError(e, 'TRANSCRICAO_FALHOU'));
      }
    }
    audiosByClip[id] = audio;
    wordsByClip[id] = words;
    silencesByClip[id] = silences;
    clips.push({ id, file, name: file.name, media, durationSec: media.durationSec, words, silences, audio });
  }

  if (clips.length === 0) throw new AppError('NENHUM_CLIPE', 'Nenhum arquivo de vídeo pôde ser aberto.');
  const refs = buildClipRefs(clips);
  const combinedAudio = combineAudios(refs, audiosByClip, silencesByClip);

  return { clips, wordsByClip, silencesByClip, audiosByClip, combinedAudio, warnings, asrModel };
}

export function buildClipRefs(clips: OpenedClip[], framingOverride?: Framing | null): ClipRef[] {
  return clips.map((c) => ({
    id: c.id,
    name: c.name,
    duration: c.durationSec,
    framing: framingOverride ?? null,
  }));
}

export function totalDuration(clips: ClipRef[]): number {
  return clips.reduce((a, b) => a + b.duration, 0);
}

export function assembledWords(refs: ClipRef[], wordsByClip: Record<string, Word[]>): Word[] {
  return placeWords(refs, wordsByClip);
}

export function assembledSilences(refs: ClipRef[], silencesByClip: Record<string, TimeRange[]>): TimeRange[] {
  return placeRanges(refs, silencesByClip);
}

/** Nível da fala e pico de cada áudio, medidos uma vez só (o áudio decodificado nunca muda). */
const levelCache = new WeakMap<DecodedAudio, { silences: readonly TimeRange[] | undefined; level: number | null; peak: number }>();

function measure(audio: DecodedAudio, silences: readonly TimeRange[] | undefined): { level: number | null; peak: number } {
  const hit = levelCache.get(audio);
  if (hit && hit.silences === silences) return hit;
  // canal mais forte: microfone gravado só num lado do estéreo não conta como "baixo"
  const levels = audio.channels.map((ch) => speechLevelDb(ch, audio.sampleRate, silences ?? []));
  const known = levels.filter((l): l is number => l !== null);
  const level = known.length ? Math.max(...known) : null;
  const peak = Math.max(0, ...audio.channels.map(peakOf));
  levelCache.set(audio, { silences, level, peak });
  return { level, peak };
}

/**
 * Ganho de cada clipe para todos falarem no mesmo volume (issue #53): mediana dos clipes, até ±9 dB, sem
 * passar do pico 0,97 (src/analysis/loudness.ts). Calculado sempre a partir do áudio original de cada
 * clipe, nunca de um áudio já ajustado: por isso prévia, MP4, reabrir e desfazer dão o mesmo resultado
 * e o ganho nunca é aplicado duas vezes. Nada disso é salvo no projeto.
 */
export function clipLoudnessGains(
  refs: readonly ClipRef[],
  audiosByClip: Record<string, DecodedAudio | null>,
  silencesByClip?: Record<string, readonly TimeRange[]>,
): Record<string, number> {
  const ids = [...new Set(refs.map((r) => r.id))].filter((id) => audiosByClip[id]);
  const measured = ids.map((id) => measure(audiosByClip[id]!, silencesByClip?.[id]));
  const gains = clipGains(measured.map((m) => m.level), measured.map((m) => m.peak));
  return Object.fromEntries(ids.map((id, i) => [id, gains[i]!]));
}

/**
 * Combina áudios de múltiplos clipes em timeline virtual (concatenação), com o volume igualado entre clipes.
 * Lida com taxas diferentes via reamostragem linear.
 */
export function combineAudios(
  refs: ClipRef[],
  audiosByClip: Record<string, DecodedAudio | null>,
  silencesByClip?: Record<string, readonly TimeRange[]>,
): DecodedAudio | null {
  const withAudio = refs.filter(r => audiosByClip[r.id]);
  if (withAudio.length === 0) return null;
  // Escolhe taxa do primeiro com áudio como referência
  const refRate = audiosByClip[withAudio[0]!.id]!.sampleRate;
  const refChannels = Math.max(...withAudio.map(r => audiosByClip[r.id]!.channels.length));
  const totalDur = totalDuration(refs);
  const totalSamples = Math.ceil(totalDur * refRate);
  const channels: Float32Array[] = Array.from({ length: refChannels }, () => new Float32Array(totalSamples));
  const gains = clipLoudnessGains(refs, audiosByClip, silencesByClip);
  let offsetSec = 0;
  for (const ref of refs) {
    const audio = audiosByClip[ref.id];
    if (!audio) { offsetSec += ref.duration; continue; }
    const offsetSamples = Math.round(offsetSec * refRate);
    let srcChannels = audio.channels;
    if (audio.sampleRate !== refRate) {
      // Reamostragem linear (rápida, sem OfflineAudioContext, igual no teste e no navegador)
      const ratio = audio.sampleRate / refRate;
      const newLen = Math.ceil(audio.channels[0]!.length / ratio);
      srcChannels = audio.channels.map(ch => {
        const out = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          const srcIdx = i * ratio;
          const i0 = Math.min(ch.length - 1, Math.floor(srcIdx));
          const i1 = Math.min(ch.length - 1, i0 + 1);
          const f = srcIdx - Math.floor(srcIdx);
          out[i] = ch[i0]! * (1 - f) + ch[i1]! * f;
        }
        return out;
      });
    }
    const gain = gains[ref.id] ?? 1;
    // o clipe ocupa exatamente a sua duração: um áudio mais longo não invade o clipe seguinte
    const clipSamples = Math.min(Math.round(ref.duration * refRate), totalSamples - offsetSamples);
    for (let c = 0; c < refChannels; c++) {
      const src = srcChannels[Math.min(c, srcChannels.length - 1)]!;
      const dst = channels[c]!;
      const available = Math.min(src.length, clipSamples);
      if (available <= 0) continue;
      if (gain === 1) dst.set(src.subarray(0, available), offsetSamples);
      else for (let i = 0; i < available; i++) dst[offsetSamples + i] = src[i]! * gain;
    }
    offsetSec += ref.duration;
  }
  return { channels, sampleRate: refRate };
}
