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
