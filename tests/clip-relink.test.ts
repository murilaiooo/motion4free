import { describe, expect, it } from 'vitest';
import { matchOriginalClips } from '../src/core/clip-relink';

const clips = [
  { id: 'c1', name: 'primeiro.mp4', duration: 4 },
  { id: 'c2', name: 'segundo.webm', duration: 3.5 },
];
const primary = { name: 'primeiro.mp4', size: 80 };

describe('reassociação segura de vídeos de um projeto salvo', () => {
  it('preserva IDs mesmo com seleção em ordem contrária', () => {
    const found = matchOriginalClips(clips, [
      { name: 'segundo.webm', durationSec: 3.5, size: 50 },
      { name: 'primeiro.mp4', durationSec: 4, size: 80 },
    ], primary);
    expect([...found!.entries()]).toEqual([['c1', 1], ['c2', 0]]);
  });

  it('recusa vídeos faltantes, duração errada e c1 de tamanho diferente', () => {
    expect(matchOriginalClips(clips, [{ name: 'primeiro.mp4', durationSec: 4, size: 80 }], primary)).toBeNull();
    expect(matchOriginalClips(clips, [
      { name: 'primeiro.mp4', durationSec: 4, size: 80 },
      { name: 'segundo.webm', durationSec: 5, size: 50 },
    ], primary)).toBeNull();
    expect(matchOriginalClips(clips, [
      { name: 'primeiro.mp4', durationSec: 4, size: 81 },
      { name: 'segundo.webm', durationSec: 3.5, size: 50 },
    ], primary)).toBeNull();
  });

  it('recusa escolha ambígua, sem atribuir um arquivo arbitrário ao clipe', () => {
    expect(matchOriginalClips(clips, [
      { name: 'primeiro.mp4', durationSec: 4, size: 80 },
      { name: 'segundo.webm', durationSec: 3.5, size: 50 },
      { name: 'segundo.webm', durationSec: 3.5, size: 60 },
    ], primary)).toBeNull();
  });

  it('aceita único clipe sobrevivente que não é o original', () => {
    const found = matchOriginalClips([clips[1]!], [{ name: 'segundo.webm', durationSec: 3.5, size: 50 }], primary);
    expect(found?.get('c2')).toBe(0);
  });
});
