import type { ClipRef, Framing } from '../core/types';
import type { Word, TimeRange } from '../core/types';
import { clipLayout, placeRanges, placeWords } from '../engine/clips';
import { AppError } from '../core/errors';
import type { OpenedMedia } from './input';
import { openMedia } from './input';
import { decodeAudio, toMono16k, type DecodedAudio } from './audio';
import { findSilences } from '../analysis/silence';
import { cleanTranscript, toWords } from '../analysis/asr-merge';
import { planAsr } from '../analysis/asr-windows';
import type { Transcriber } from '../asr/transcriber';
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
}

/**
 * Abre vários arquivos com análise completa por clip (áudio, silêncios, transcrição)
 */
export async function openClips(
  files: File[],
  transcriber?: Transcriber,
  onStep?: (label: string, fraction: number) => void,
  asrMode?: string,
): Promise<MultiSessionInput> {
  if (files.length === 0) throw new AppError('SEM_VIDEO');
  if (files.length > 30) throw new AppError('CLIPES_DEMAIS', `${files.length} clipes (máximo 30)`);

  const clips: OpenedClip[] = [];
  const wordsByClip: Record<string, Word[]> = {};
  const silencesByClip: Record<string, TimeRange[]> = {};
  const audiosByClip: Record<string, DecodedAudio | null> = {};

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const media = await openMedia(file);
    const id = `c${i + 1}`;
    let audio: DecodedAudio | null = null;
    if (media.audio) {
      try { audio = await decodeAudio(media.audio, media.durationSec); } catch { audio = null; }
    }
    let words: Word[] = [];
    let silences: TimeRange[] = [];
    let asrModel: string | null = null;
    if (audio) {
      try {
        const mono = await toMono16k(audio);
        silences = findSilences(mono, 16000);
        if (transcriber) {
          onStep?.(`Transcrevendo clipe ${i+1}/${files.length}`, 0);
          const r = await transcriber.transcribe(mono.slice(), media.durationSec, planAsr(silences, media.durationSec), onStep ?? (()=>{}), asrMode as any);
          words = toWords(cleanTranscript(r.words, silences));
          asrModel = r.model;
        }
      } catch (e) {
        // silences/words stay empty, warnings handled upstream
      }
    }
    audiosByClip[id] = audio;
    wordsByClip[id] = words;
    silencesByClip[id] = silences;
    clips.push({ id, file, name: file.name, media, durationSec: media.durationSec, words, silences, audio });
  }

  const refs = buildClipRefs(clips);
  const combinedAudio = combineAudios(refs, audiosByClip);

  return { clips, wordsByClip, silencesByClip, audiosByClip, combinedAudio };
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

/**
 * Combina áudios de múltiplos clipes em timeline virtual (concatenação).
 * Lida com taxas diferentes via resample simples (OfflineAudioContext) quando necessário.
 */
export function combineAudios(refs: ClipRef[], audiosByClip: Record<string, DecodedAudio | null>): DecodedAudio | null {
  const withAudio = refs.filter(r => audiosByClip[r.id]);
  if (withAudio.length === 0) return null;
  // Escolhe taxa do primeiro com áudio como referência
  const refRate = audiosByClip[withAudio[0]!.id]!.sampleRate;
  const refChannels = Math.max(...withAudio.map(r => audiosByClip[r.id]!.channels.length));
  const totalDur = totalDuration(refs);
  const totalSamples = Math.ceil(totalDur * refRate);
  const channels: Float32Array[] = Array.from({ length: refChannels }, () => new Float32Array(totalSamples));
  let offsetSec = 0;
  for (const ref of refs) {
    const audio = audiosByClip[ref.id];
    if (!audio) { offsetSec += ref.duration; continue; }
    const offsetSamples = Math.round(offsetSec * refRate);
    // Resample se taxa diferente (simples:nearest, suficiente para preview; export resample melhor)
    let srcChannels = audio.channels;
    let srcRate = audio.sampleRate;
    if (srcRate !== refRate) {
      // Resample via linear interpolation (rápido, sem OfflineAudioContext no teste)
      const ratio = srcRate / refRate;
      const newLen = Math.ceil(audio.channels[0]!.length / ratio);
      srcChannels = audio.channels.map(ch => {
        const out = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
          const srcIdx = i * ratio;
          const i0 = Math.floor(srcIdx);
          const i1 = Math.min(ch.length - 1, i0 + 1);
          const f = srcIdx - i0;
          out[i] = ch[i0]! * (1 - f) + ch[i1]! * f;
        }
        return out;
      });
    }
    for (let c = 0; c < refChannels; c++) {
      const src = srcChannels[Math.min(c, srcChannels.length - 1)]!;
      const dst = channels[c]!;
      const available = Math.min(src.length, totalSamples - offsetSamples);
      if (available > 0) dst.set(src.subarray(0, available), offsetSamples);
    }
    offsetSec += ref.duration;
  }
  return { channels, sampleRate: refRate };
}
