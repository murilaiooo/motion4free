import type { Word } from '../core/types';
import type { Moment } from './highlights';

/**
 * Cenas sem fala (v0.39, ADR-0040). Em filmes, séries, shows e vlogs há momentos fortes sem nenhuma palavra:
 * música alta, luta, perseguição, aplauso, gol. A transcrição não vê nada ali, então as regras de fala nunca
 * os sugeriam. Aqui se procura, nos trechos sem fala, onde o som fica bem acima do normal do vídeo.
 * A nota é modesta de propósito (no máximo 70): fala com gancho continua na frente, a cena sem fala aparece
 * como opção e a pessoa decide. O começo e o fim do vídeo pesam menos (abertura, créditos).
 */

const FLOOR_DB = -90;
const MAX_SCORE = 70;
const MAX_SOUND_MOMENTS = 6;

export interface SoundLimit { min: number; max: number; ideal: number }

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function findSoundMoments(words: readonly Word[], duration: number, energy: ArrayLike<number>, step: number, limit: SoundLimit): Moment[] {
  if (!(step > 0) || energy.length < 4 || !(duration > limit.min)) return [];
  const db = (i: number) => { const v = energy[i]!; return Number.isFinite(v) ? Math.max(FLOOR_DB, v) : FLOOR_DB; };
  const all = Array.from({ length: energy.length }, (_, i) => db(i)).sort((a, b) => a - b);
  const median = all[Math.floor(all.length / 2)]!;
  if (median <= FLOOR_DB + 1) return [];
  const head = Math.max(60, duration * 0.04);
  const tail = duration - Math.max(90, duration * 0.08);

  // Trechos sem fala longos o bastante para um clipe (1 s de folga para não colar na frase vizinha).
  const gaps: [number, number][] = [];
  let cursor = 0;
  for (const w of [...words].sort((a, b) => a.start - b.start)) {
    if (w.start - 1 - cursor >= limit.min) gaps.push([cursor, w.start - 1]);
    cursor = Math.max(cursor, w.end + 1);
  }
  if (duration - cursor >= limit.min) gaps.push([cursor, duration]);

  const out: Moment[] = [];
  for (const [g0, g1] of gaps) {
    const len = Math.min(limit.ideal, g1 - g0);
    let best: { start: number; mean: number; spread: number; value: number } | null = null;
    for (let s = g0; s + len <= g1 + 0.001; s += Math.max(step, 2)) {
      const a = Math.floor(s / step), b = Math.min(energy.length, Math.ceil((s + len) / step));
      if (b - a < 3) continue;
      let sum = 0, sq = 0;
      for (let i = a; i < b; i++) { const v = db(i); sum += v; sq += v * v; }
      const mean = sum / (b - a);
      const spread = Math.sqrt(Math.max(0, sq / (b - a) - mean * mean));
      const mid = s + len / 2;
      const edge = mid < head || mid > tail ? 6 : 0;
      const value = mean - median + Math.min(spread, 8) * 0.3 - edge;
      if (!best || value > best.value) best = { start: s, mean, spread, value };
    }
    if (!best || best.mean - median < 2) continue;
    const lift = best.mean - median;
    const score = Math.round(Math.min(MAX_SCORE, 35 + lift * 4 + Math.min(best.spread, 8) * 1.5 - (best.value < lift ? 8 : 0)) * 10) / 10;
    const start = Math.round(best.start * 100) / 100;
    const end = Math.round((best.start + len) * 100) / 100;
    out.push({
      id: `som-${Math.round(start * 10)}`, rank: 0, start, end,
      title: `Cena sem fala em ${clock(start)}`, text: '', score, wordCount: 0,
      reasons: [
        `cena sem fala com som forte (${lift.toFixed(1)} dB acima do normal do vídeo)`,
        ...(best.spread > 4 ? ['som que muda bastante: ação, música ou plateia'] : []),
        'confira a imagem: o app só ouve o som nesta cena',
      ],
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_SOUND_MOMENTS);
}
