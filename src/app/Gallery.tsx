import { useEffect, useRef, useState } from 'react';
import { PRESETS, presetById } from '../core/presets';
import { GALLERY_SHOTS, galleryPlan } from '../editorial/sample';
import { ensureFonts } from '../media/fonts';
import { drawFrame } from '../render/frame';

/**
 * Galeria de estilos (endereço com `?galeria`): as mesmas cenas desenhadas em cada estilo,
 * sobre um fundo sintético que imita uma pessoa falando. Serve para comparar os estilos
 * e para o teste automático de regressão visual.
 */

/** Fundo sintético: parede com luz de janela, pessoa (cabeça e ombros) no centro. */
export function paintBackdrop(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const wall = g.createLinearGradient(0, 0, 0, h);
  wall.addColorStop(0, '#7d8a93');
  wall.addColorStop(0.6, '#56626b');
  wall.addColorStop(1, '#2c3338');
  g.fillStyle = wall;
  g.fillRect(0, 0, w, h);
  const light = g.createRadialGradient(w * 0.15, h * 0.18, 0, w * 0.15, h * 0.18, w * 0.8);
  light.addColorStop(0, 'rgba(255, 244, 220, 0.55)');
  light.addColorStop(1, 'rgba(255, 244, 220, 0)');
  g.fillStyle = light;
  g.fillRect(0, 0, w, h);
  // estante desfocada ao fundo
  const shelves = ['#a0715a', '#c9b37e', '#5f7f8c', '#8e5d4f', '#d7c9a6', '#6b8a6f'];
  for (let i = 0; i < 14; i++) {
    g.fillStyle = shelves[i % shelves.length]!;
    g.globalAlpha = 0.35;
    g.fillRect(w * 0.62 + (i % 7) * w * 0.05, h * (0.2 + Math.floor(i / 7) * 0.12), w * 0.04, h * 0.09);
  }
  g.globalAlpha = 1;
  // pessoa
  const shirt = g.createLinearGradient(0, h * 0.55, 0, h);
  shirt.addColorStop(0, '#3b5f7d');
  shirt.addColorStop(1, '#22384a');
  g.fillStyle = shirt;
  g.beginPath();
  g.ellipse(w * 0.5, h * 1.02, w * 0.52, h * 0.42, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#b98a6e';
  g.fillRect(w * 0.44, h * 0.47, w * 0.12, h * 0.12);
  const skin = g.createRadialGradient(w * 0.46, h * 0.36, 0, w * 0.5, h * 0.4, w * 0.24);
  skin.addColorStop(0, '#e2b598');
  skin.addColorStop(1, '#b07f62');
  g.fillStyle = skin;
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.39, w * 0.17, h * 0.115, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3a2a22';
  g.beginPath();
  g.ellipse(w * 0.5, h * 0.315, w * 0.18, h * 0.06, 0, Math.PI, Math.PI * 2);
  g.fill();
  return c;
}

/** Desenha um quadro do plano de demonstração no estilo pedido. */
export function renderShot(canvas: HTMLCanvasElement, styleId: string, t: number, backdrop: HTMLCanvasElement): void {
  const style = presetById(styleId)!;
  const plan = galleryPlan(style);
  const ctx = canvas.getContext('2d')!;
  const s = canvas.width / plan.output.width;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  drawFrame(ctx, plan, t, backdrop);
}

declare global {
  interface Window {
    m4fGallery?: { render: (styleId: string, t: number, width?: number) => string; strip: (styleId: string) => string };
  }
}

export function Gallery() {
  const [ready, setReady] = useState(false);
  const backdrop = useRef<HTMLCanvasElement | null>(null);
  const refs = useRef(new Map<string, HTMLCanvasElement>());

  useEffect(() => {
    let alive = true;
    void Promise.all(PRESETS.map(ensureFonts)).then(() => {
      if (!alive) return;
      backdrop.current = paintBackdrop(1080, 1920);
      for (const style of PRESETS) {
        for (const shot of GALLERY_SHOTS) {
          const c = refs.current.get(`${style.id}-${shot.id}`);
          if (c) renderShot(c, style.id, shot.t, backdrop.current);
        }
      }
      window.m4fGallery = {
        render(styleId, t, width = 540) {
          const c = document.createElement('canvas');
          c.width = width;
          c.height = Math.round((width * 16) / 9);
          renderShot(c, styleId, t, backdrop.current!);
          return c.toDataURL('image/png');
        },
        // tira com todas as cenas de um estilo, para as imagens de comparação em docs/assets/fase3
        strip(styleId) {
          const tw = 240;
          const th = Math.round((tw * 16) / 9);
          const gap = 8;
          const out = document.createElement('canvas');
          out.width = GALLERY_SHOTS.length * (tw + gap) - gap;
          out.height = th;
          const g = out.getContext('2d')!;
          GALLERY_SHOTS.forEach((shot, i) => {
            const c = document.createElement('canvas');
            c.width = tw * 2;
            c.height = th * 2;
            renderShot(c, styleId, shot.t, backdrop.current!);
            g.drawImage(c, i * (tw + gap), 0, tw, th);
          });
          return out.toDataURL('image/png');
        },
      };
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="gallery" data-testid="gallery" data-ready={ready ? '1' : '0'}>
      <p className="hint">As mesmas animações em cada estilo, sobre um fundo de exemplo. No editor, o estilo vale para o vídeo inteiro.</p>
      {PRESETS.map((style) => (
        <div key={style.id}>
          <h2>{style.name}</h2>
          <div className="gallery-row">
            {GALLERY_SHOTS.map((shot) => (
              <canvas
                key={shot.id}
                width={540}
                height={960}
                title={shot.label}
                data-testid={`gal-${style.id}-${shot.id}`}
                ref={(el) => {
                  if (el) refs.current.set(`${style.id}-${shot.id}`, el);
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
