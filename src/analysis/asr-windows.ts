import type { TimeRange } from '../core/types';

/**
 * Divide o áudio em janelas de até `maxSec` para o Whisper, cortando no meio de silêncios.
 * Janela que corta no meio de uma palavra faz o Whisper partir a palavra em duas
 * ("cada janela" virava "cadeja" + "anela"); cortando em pausa isso não acontece.
 * Sem silêncio disponível, corta no limite (raro em fala natural).
 */
export function planAsrWindows(silences: TimeRange[], durationSec: number, maxSec = 28, minSec = 5): TimeRange[] {
  const cuts = silences.map((s) => (s.start + s.end) / 2).filter((t) => t > 0 && t < durationSec);
  const windows: TimeRange[] = [];
  let cursor = 0;
  while (durationSec - cursor > maxSec) {
    const limit = cursor + maxSec;
    const candidates = cuts.filter((t) => t >= cursor + minSec && t <= limit);
    const cut = candidates.length > 0 ? candidates[candidates.length - 1]! : limit;
    windows.push({ start: cursor, end: cut });
    cursor = cut;
  }
  if (durationSec - cursor > 0) windows.push({ start: cursor, end: durationSec });
  return windows;
}

/**
 * Janela que o Whisper recebe: `own` é o pedaço pelo qual ela responde; `feed` é o áudio que ela ouve,
 * com uma folga de cada lado. A folga dá contexto e salva a palavra que cai bem no corte (quando não há
 * silêncio e o corte é no limite). As palavras da folga são descartadas na junção (ver asr-merge.ts).
 * `skip`: a janela é quase só silêncio e não vai ao Whisper (no silêncio ele inventa frases como
 * "Legendas pela comunidade Amara.org").
 */
export interface AsrWindow {
  own: TimeRange;
  feed: TimeRange;
  skip: boolean;
}

/** Folga padrão de cada lado: com janelas de até 28 s, o Whisper nunca recebe mais que 30 s. */
export const ASR_OVERLAP_SEC = 1;

/** Fração de `range` coberta pelos silêncios. */
export function silentFraction(range: TimeRange, silences: TimeRange[]): number {
  const len = range.end - range.start;
  if (len <= 0) return 1;
  let covered = 0;
  for (const s of silences) covered += Math.max(0, Math.min(s.end, range.end) - Math.max(s.start, range.start));
  return Math.min(1, covered / len);
}

export function withOverlap(windows: TimeRange[], silences: TimeRange[], durationSec: number, padSec = ASR_OVERLAP_SEC): AsrWindow[] {
  return windows.map((own) => ({
    own,
    feed: { start: Math.max(0, own.start - padSec), end: Math.min(durationSec, own.end + padSec) },
    skip: own.end - own.start < 0.2 || silentFraction(own, silences) >= 0.95,
  }));
}

/** Janelas prontas para o Whisper: corte em silêncio (≤ 28 s), folga de 1 s e janelas mudas marcadas. */
export function planAsr(silences: TimeRange[], durationSec: number): AsrWindow[] {
  return withOverlap(planAsrWindows(silences, durationSec), silences, durationSec);
}
