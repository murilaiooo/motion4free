/**
 * Música de fundo (v0.26): mistura a música por baixo do áudio já montado do vídeo (tempo de saída).
 * Puro e determinístico: a prévia e o MP4 chamam a mesma função, então soam iguais.
 * A música começa no início do vídeo, entra com fade curto, sai com fade no fim e não se repete.
 * Com "abaixar na fala", o volume cai para DUCK_LEVEL enquanto há voz, com subida e descida suaves.
 */

export interface MusicMix {
  /** volume da música, 0 a 1 */
  volume: number;
  /** abaixar a música enquanto alguém fala */
  duck: boolean;
}

export interface MusicAudio {
  channels: Float32Array[];
  sampleRate: number;
}

export const MUSIC_FADE_IN_SEC = 0.4;
export const MUSIC_FADE_OUT_SEC = 1.5;
/** fração do volume escolhido que fica enquanto há fala */
export const DUCK_LEVEL = 0.3;
/** nível (RMS) acima do qual um bloco conta como fala: cerca de -34 dBFS */
export const SPEECH_RMS = 0.02;
const BLOCK_SEC = 0.02;
const ATTACK_SEC = 0.08;
const RELEASE_SEC = 0.35;
/** a música continua baixa um pouco depois da fala, para não subir entre uma palavra e outra */
const HOLD_SEC = 0.3;

/**
 * Ganho do abaixamento por bloco de 20 ms (1 = música normal, DUCK_LEVEL = durante a fala).
 * Olha um pouco à frente (ATTACK_SEC) para a música já estar baixa quando a fala começa.
 */
export function duckGains(speech: Float32Array[] | null, sampleRate: number, length: number): Float32Array {
  const block = Math.max(1, Math.round(BLOCK_SEC * sampleRate));
  const blocks = Math.ceil(length / block);
  const loud = new Uint8Array(blocks);
  if (speech && speech.length) {
    for (let b = 0; b < blocks; b++) {
      const a = b * block;
      const e = Math.min(length, a + block);
      let best = 0;
      for (const ch of speech) {
        let sum = 0;
        for (let i = a; i < e && i < ch.length; i++) sum += ch[i]! * ch[i]!;
        best = Math.max(best, Math.sqrt(sum / Math.max(1, e - a)));
      }
      loud[b] = best > SPEECH_RMS ? 1 : 0;
    }
  }
  // fala com folga: alguns blocos antes (para descer a tempo) e depois (para não subir entre palavras)
  const before = Math.round(ATTACK_SEC / BLOCK_SEC);
  const after = Math.round(HOLD_SEC / BLOCK_SEC);
  const target = new Float32Array(blocks).fill(1);
  for (let b = 0; b < blocks; b++) {
    if (!loud[b]) continue;
    for (let k = Math.max(0, b - before); k <= Math.min(blocks - 1, b + after); k++) target[k] = DUCK_LEVEL;
  }
  const down = 1 - Math.exp(-BLOCK_SEC / (ATTACK_SEC / 3));
  const up = 1 - Math.exp(-BLOCK_SEC / (RELEASE_SEC / 3));
  const gains = new Float32Array(blocks);
  let g = target[0] ?? 1;
  for (let b = 0; b < blocks; b++) {
    const t = target[b]!;
    g += (t - g) * (t < g ? down : up);
    gains[b] = g;
  }
  return gains;
}

/**
 * Áudio final: a fala montada (ou silêncio, se o vídeo não tem som) com a música por baixo.
 * Sai na taxa da fala, com a duração do vídeo e até 2 canais. Nunca altera os arrays de entrada.
 */
export function mixMusic(speech: Float32Array[] | null, sampleRate: number, durationSec: number, music: MusicAudio, mix: MusicMix): Float32Array[] {
  const length = speech?.[0]?.length ?? Math.max(1, Math.round(durationSec * sampleRate));
  const channels = Math.min(2, Math.max(speech?.length ?? 0, music.channels.length, 1));
  const out = Array.from({ length: channels }, (_, c) => {
    const src = speech?.[Math.min(c, speech.length - 1)];
    const ch = new Float32Array(length);
    if (src) ch.set(src.subarray(0, length));
    return ch;
  });
  const volume = Math.max(0, Math.min(1, mix.volume));
  const musicLen = music.channels[0]?.length ?? 0;
  if (volume === 0 || musicLen === 0) return out;
  const block = Math.max(1, Math.round(BLOCK_SEC * sampleRate));
  const gains = mix.duck ? duckGains(speech, sampleRate, length) : null;
  const ratio = music.sampleRate / sampleRate;
  // a música acaba onde acaba o arquivo ou o vídeo, o que vier primeiro; o fade de saída vai até esse ponto
  const end = Math.min(length, Math.floor((musicLen - 1) / ratio));
  const fadeIn = Math.max(1, Math.round(MUSIC_FADE_IN_SEC * sampleRate));
  const fadeOut = Math.max(1, Math.min(Math.round(MUSIC_FADE_OUT_SEC * sampleRate), Math.floor(end / 2)));
  for (let i = 0; i < end; i++) {
    let g = volume;
    if (i < fadeIn) g *= i / fadeIn;
    if (i > end - fadeOut) g *= (end - i) / fadeOut;
    if (gains) {
      // entre um bloco e o seguinte o ganho anda em linha reta (sem degrau audível)
      const pos = i / block;
      const b = Math.floor(pos);
      const g0 = gains[Math.min(b, gains.length - 1)]!;
      const g1 = gains[Math.min(b + 1, gains.length - 1)]!;
      g *= g0 + (g1 - g0) * (pos - b);
    }
    if (g === 0) continue;
    const at = i * ratio;
    const i0 = Math.floor(at);
    const f = at - i0;
    for (let c = 0; c < channels; c++) {
      const m = music.channels[Math.min(c, music.channels.length - 1)]!;
      const v = m[i0]! * (1 - f) + (m[i0 + 1] ?? m[i0]!) * f;
      const s = out[c]![i]! + v * g;
      out[c]![i] = s > 1 ? 1 : s < -1 ? -1 : s;
    }
  }
  return out;
}
