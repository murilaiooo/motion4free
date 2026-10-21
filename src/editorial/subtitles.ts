import type { EditPlan } from '../core/types';
import { outputDuration } from '../engine/timeline';
import { resolvePlan } from './elements';

export interface Cue {
  start: number;
  end: number;
  text: string;
}

/** 00:01:02,345 (SRT usa vírgula antes dos milissegundos). */
export function srtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

/**
 * As legendas como aparecem no vídeo editado (v0.26): texto corrigido, tempos dos cortes e das edições
 * manuais, sem as escondidas, em ordem e sem sobreposição. Puro e testado.
 */
export function planCues(plan: EditPlan): Cue[] {
  const total = outputDuration(plan.segments);
  const cues = resolvePlan(plan)
    .captions.map(({ caption }) => ({ start: Math.max(0, caption.start), end: Math.min(total, caption.end), text: caption.text.replace(/\s+/g, ' ').trim() }))
    .filter((c) => c.text && c.end - c.start > 0.01)
    .sort((a, b) => a.start - b.start);
  // uma legenda acaba quando a seguinte começa: os players não mostram duas linhas ao mesmo tempo
  return cues.map((c, i) => ({ ...c, end: Math.min(c.end, cues[i + 1]?.start ?? c.end) })).filter((c) => c.end - c.start > 0.01);
}

/** Arquivo .srt (aceito pelo YouTube, Instagram via apps, CapCut, Premiere e players comuns). */
export function toSrt(cues: readonly Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`).join('\n');
}
