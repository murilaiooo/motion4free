import { useEffect, useMemo, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { presetById } from '../core/presets';
import { filterTemplates, listTemplates, templateTags, type TemplateInfo } from '../core/template-gallery';
import { ensureFonts } from '../media/fonts';
import { paintBackdrop, renderShot } from './Gallery';

let backdrop: HTMLCanvasElement | null = null;
const getBackdrop = () => (backdrop ??= paintBackdrop(540, 960));
let plainBackdrop: HTMLCanvasElement | null = null;
function getPlainBackdrop(): HTMLCanvasElement {
  if (!plainBackdrop) {
    plainBackdrop = document.createElement('canvas');
    plainBackdrop.width = 540;
    plainBackdrop.height = 960;
    const context = plainBackdrop.getContext('2d')!;
    context.fillStyle = '#343B45';
    context.fillRect(0, 0, 540, 960);
  }
  return plainBackdrop;
}

/** Duração do vídeo de demonstração (editorial/sample.ts). */
const DEMO_SEC = 28;

/**
 * Quadro do vídeo de demonstração desenhado com a mesma `drawFrame` do player, no estilo pedido.
 * Parado no instante `t`; anima enquanto `playing` (passar o mouse no cartão).
 */
export function TemplateThumb({ styleId, t, width = 180, playing = false, className = '', plain = false }: { styleId: string; t: number; width?: number; playing?: boolean; className?: string; plain?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);
  // só baixa as fontes e desenha quando o cartão chega perto da tela (15 modelos, ~13 famílias de letra)
  useEffect(() => {
    const c = ref.current;
    if (!c || seen) return;
    if (typeof IntersectionObserver === 'undefined') return setSeen(true);
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setSeen(true), { rootMargin: '300px' });
    io.observe(c);
    return () => io.disconnect();
  }, [seen]);
  useEffect(() => {
    let alive = true;
    const style = presetById(styleId);
    if (!style || !seen) return;
    void ensureFonts(style).then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [styleId, seen]);
  useEffect(() => {
    const c = ref.current;
    if (!c || !ready) return;
    if (!playing) {
      renderShot(c, styleId, t, plain ? getPlainBackdrop() : getBackdrop());
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      renderShot(c, styleId, (t + (now - t0) / 1000) % DEMO_SEC, plain ? getPlainBackdrop() : getBackdrop());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, playing, styleId, t, plain]);
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 1;
  const w = Math.round(width * dpr);
  return <canvas ref={ref} className={`tpl-thumb ${className}`} width={w} height={Math.round((w * 16) / 9)} aria-hidden data-ready={ready ? '1' : '0'} />;
}

/** Instante de cada modelo que mais mostra a cara dele (legenda + título). */
const COVER_T = 1.3;

/** Galeria de modelos: cartões com quadro de verdade, etiquetas e filtro. Clicar aplica (dá para desfazer). */
export function TemplateGallery({ current, onPick, disabled, templates }: { current: string; onPick: (id: string) => void; disabled?: boolean; templates?: TemplateInfo[] }) {
  const list = useMemo(() => templates ?? listTemplates(), [templates]);
  const tags = useMemo(() => templateTags(list), [list]);
  const [tag, setTag] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const shown = filterTemplates(list, tag);
  return (
    <section className="templates" aria-label="Modelos">
      <div className="chips scroll" role="group" aria-label="Filtrar modelos">
        <button type="button" className="chip" aria-pressed={tag === null} onClick={() => setTag(null)}>
          Todos
        </button>
        {tags.map((t) => (
          <button type="button" key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="template-grid">
        {shown.map((tpl) => {
          const selected = current === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              className={`tpl-card ${selected ? 'selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onPick(tpl.id)}
              onMouseEnter={() => setHover(tpl.id)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(tpl.id)}
              onBlur={() => setHover(null)}
              disabled={disabled}
              title={tpl.description}
              data-testid={`style-${tpl.id}`}
            >
              <span className="tpl-media">
                <TemplateThumb styleId={tpl.id} t={COVER_T} width={160} playing={hover === tpl.id} />
                {selected && (
                  <span className="tpl-check" aria-hidden>
                    <Check size={14} strokeWidth={3} />
                  </span>
                )}
              </span>
              <span className="tpl-meta">
                <span className="tpl-name">{tpl.name}</span>
                <span className="tpl-tags">
                  {tpl.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </span>
                <span className="tpl-about">{tpl.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
