/**
 * Fundo das prévias de estilo (v0.33): quando a pessoa já escolheu um vídeo, os cartões de estilo mostram a
 * legenda animada em cima do vídeo dela, tocando, e não sobre um desenho. Um só <video> mudo, em loop num
 * trecho curto, é copiado (recorte vertical que preenche) para um canvas 540×960 compartilhado por todas as
 * prévias. Só roda enquanto alguma prévia está na tela. Se o navegador não conseguir abrir o vídeo, as prévias
 * continuam no fundo de exemplo, sem aviso: nada se perde.
 */
const W = 540;
const H = 960;
const LOOP_SEC = 8;

let canvas: HTMLCanvasElement | null = null;
let ready = false;
let video: HTMLVideoElement | null = null;
let url: string | null = null;
let raf = 0;
let start = 0;
const listeners = new Set<() => void>();

/** Canvas com o quadro atual do vídeo da pessoa, ou null enquanto não há vídeo pronto. */
export function userBackdrop(): HTMLCanvasElement | null {
  return ready ? canvas : null;
}

/** Avisa quando o fundo muda (vídeo novo pronto ou removido). Devolve a função para parar de ouvir. */
export function onUserBackdrop(fn: () => void): () => void {
  listeners.add(fn);
  tick();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) stop();
  };
}

function emit() {
  for (const fn of listeners) fn();
}

function paint() {
  if (!video || !canvas || video.readyState < 2) return;
  const g = canvas.getContext('2d');
  if (!g) return;
  const vw = video.videoWidth || W;
  const vh = video.videoHeight || H;
  const k = Math.max(W / vw, H / vh);
  const dw = vw * k;
  const dh = vh * k;
  g.drawImage(video, (W - dw) / 2, (H - dh) / 2, dw, dh);
  if (!ready) {
    ready = true;
    emit();
  }
}

function tick() {
  if (!video || raf || !listeners.size) return;
  if (video.paused) void video.play().catch(() => undefined);
  const loop = () => {
    raf = 0;
    if (!video || !listeners.size) return;
    if (video.currentTime >= start + LOOP_SEC || video.ended) video.currentTime = start;
    paint();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  video?.pause();
}

/** Usa este vídeo como fundo das prévias de estilo (null volta ao fundo de exemplo). */
export function setUserBackdropFile(file: Blob | null): void {
  stop();
  if (video) {
    video.removeAttribute('src');
    video.load();
  }
  if (url) URL.revokeObjectURL(url);
  video = null;
  url = null;
  const had = ready;
  ready = false;
  if (had) emit();
  if (!file || typeof document === 'undefined') return;
  canvas ??= Object.assign(document.createElement('canvas'), { width: W, height: H });
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  url = URL.createObjectURL(file);
  v.src = url;
  v.addEventListener('loadedmetadata', () => {
    // um trecho do começo, depois de eventuais segundos de silêncio/preparação
    const d = Number.isFinite(v.duration) ? v.duration : 0;
    start = d > LOOP_SEC + 2 ? Math.min(d * 0.15, d - LOOP_SEC - 1) : 0;
    v.currentTime = start;
  });
  v.addEventListener('seeked', () => {
    if (video === v && !ready) paint();
  });
  video = v;
  tick();
}
