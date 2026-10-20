import { TEMPLATES, type Template } from '../core/templates';

/** Miniatura do modelo feita só com os dados do registro (cores, fontes e destaque da legenda). */
function Swatch({ template }: { template: Template }) {
  const P = template.preview;
  const d = P.titleFont;
  const c = P.captionFont;
  const boxed = template.style.shape.panel === 'box';
  const card = boxed && template.style.layout.align === 'left';
  const word = P.highlight === 'box' ? { background: P.accent, color: P.onPanel, borderRadius: 4, padding: '0 3px' } : P.highlight === 'marker' ? { background: P.accent, color: '#151515', padding: '0 3px', transform: 'rotate(-2deg)', display: 'inline-block' } : P.highlight === 'underline' ? { textDecoration: `underline 3px ${P.accent}` } : P.highlight === 'color' ? { color: P.accent } : {};
  const textCase = (x: string) => (x === 'upper' ? 'uppercase' : x === 'lower' ? 'lowercase' : 'none');
  return (
    <span className="swatch" aria-hidden style={{ background: P.background }}>
      <span
        className="swatch-title"
        style={{
          fontFamily: `"${d.family}"`,
          fontWeight: d.weight,
          fontStyle: d.style,
          textTransform: textCase(d.case),
          background: boxed ? P.panel : 'transparent',
          color: boxed ? P.onPanel : P.text,
          borderLeft: card ? `4px solid ${P.accent}` : undefined,
          borderRadius: boxed && !card ? 8 : card ? 2 : 0,
        }}
      >
        {template.name}
      </span>
      <span className="swatch-caption" style={{ fontFamily: `"${c.family}"`, fontWeight: c.weight, fontStyle: c.style, textTransform: textCase(c.case), color: P.text }}>
        <span>isso </span>
        <span style={word}>muda</span>
        <span style={{ opacity: P.highlight === 'reveal' ? template.style.captions.upcomingAlpha : 1 }}> tudo</span>
      </span>
    </span>
  );
}

/** Seletor de estilo: um cartão por modelo do registro (`core/templates.ts`), na ordem dele. */
export function StylePicker({ current, onPick, disabled }: { current: string; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <section className="styles" aria-label="Estilo do vídeo">
      <h2>Estilo</h2>
      <p className="hint">Muda letras, cores, animações e ritmo. Dá para desfazer.</p>
      <div className="style-grid">
        {TEMPLATES.map((tp) => (
          <button key={tp.id} className={`style-card ${current === tp.id ? 'selected' : ''}`} aria-pressed={current === tp.id} onClick={() => onPick(tp.id)} disabled={disabled} data-testid={`style-${tp.id}`} title={tp.tags.join(', ')}>
            <Swatch template={tp} />
            <span className="style-about">{tp.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
