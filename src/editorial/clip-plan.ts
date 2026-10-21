import type { StyleDNA } from '../core/style';
import type { EditPlan, Framing, OutputProfile, TimeRange, Word } from '../core/types';
import { autoEdit } from './auto-edit';

/**
 * Um momento do vídeo longo vira um projeto comum (v0.22, ADR-0023). O trecho é recortado num arquivo
 * próprio que começa em `start`; aqui as palavras e os silêncios já transcritos passam para o tempo do
 * clipe (sem transcrever de novo) e o plano sai do mesmo `autoEdit` do fluxo normal.
 */

export interface ClipSlice {
  words: Word[];
  silences: TimeRange[];
  /** duração do arquivo recortado (s) */
  duration: number;
}

/**
 * Palavras inteiramente dentro de [start, start + duration] (deslocadas para começar em 0) e silêncios
 * cortados nas bordas. `duration` é a do arquivo recortado, que pode diferir um pouco de end − start.
 */
export function sliceForClip(range: TimeRange, duration: number, words: Word[], silences: TimeRange[]): ClipSlice {
  const start = range.start;
  const end = start + duration;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  return {
    duration,
    words: words
      .filter((w) => w.start >= start - 1e-6 && w.end <= end + 1e-6 && w.text.trim())
      .map((w) => ({ ...w, start: r3(Math.max(0, w.start - start)), end: r3(Math.min(duration, w.end - start)) })),
    silences: silences
      .filter((s) => s.end > start && s.start < end)
      .map((s) => ({ start: r3(Math.max(0, s.start - start)), end: r3(Math.min(duration, s.end - start)) }))
      .filter((s) => s.end - s.start > 0),
  };
}

export function clipPlan(slice: ClipSlice, style: StyleDNA, output: OutputProfile, framing?: Framing): EditPlan {
  return autoEdit(slice.duration, slice.silences, slice.words, style, { output, framing });
}

/** Nome de arquivo seguro: "podcast-clipe-03-o-erro-de-90.mp4". */
export function clipFileName(source: string, index: number, title: string): string {
  const slug = (s: string, max: number) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, max)
      .replace(/-+$/g, '');
  const base = slug(source.replace(/\.[^.]+$/, ''), 30) || 'video';
  const t = slug(title, 40);
  return `${base}-clipe-${String(index).padStart(2, '0')}${t ? `-${t}` : ''}.mp4`;
}
