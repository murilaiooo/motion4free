import type { ClipRef } from './types';

/** Associa arquivos escolhidos novamente aos IDs originais, sem depender da ordem selecionada. */
export interface RelinkCandidate {
  name: string;
  durationSec: number;
  size: number;
}

const DURATION_TOLERANCE = 0.1;

/**
 * Nunca associa por posição na lista. Sem hashes legados para os clipes 2..N,
 * nomes/durações indistinguíveis são rejeitados em vez de arriscar mídia trocada.
 */
export function matchOriginalClips(
  clips: readonly Pick<ClipRef, 'id' | 'name' | 'duration'>[],
  candidates: readonly RelinkCandidate[],
  primary: { name: string; size: number },
): Map<string, number> | null {
  if (clips.length === 0 || candidates.length < clips.length) return null;
  const matches = new Map<string, number>();
  const used = new Set<number>();
  for (const clip of clips) {
    const found: number[] = [];
    for (const [index, candidate] of candidates.entries()) {
      if (used.has(index) || candidate.name !== clip.name ||
          Math.abs(candidate.durationSec - clip.duration) >= DURATION_TOLERANCE) continue;
      // c1 tem tamanho conhecido no projeto; os demais ainda não possuem fingerprint legado.
      if (clip.id === 'c1' && (candidate.name !== primary.name || candidate.size !== primary.size)) continue;
      found.push(index);
    }
    if (found.length !== 1) return null;
    const index = found[0]!;
    used.add(index);
    matches.set(clip.id, index);
  }
  return matches;
}
