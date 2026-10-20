import { PRESETS } from '../core/presets';
import type { StyleDNA } from '../core/style';

/** Descrição curta de cada estilo para quem escolhe (sem termos técnicos). */
const ABOUT: Record<string, string> = {
  pop: 'Energético: letras grandes, palavra falada em destaque amarelo, cortes com flash e muitas animações.',
  neon: 'Limpo e atual: letras brancas grossas, poucas palavras por vez e a palavra falada acendendo em verde.',
  editorial: 'Elegante: letra de revista, legenda que acende palavra por palavra, movimento lento e poucas animações.',
  documental: 'Sóbrio: painéis escuros à esquerda, letra técnica, quase sem movimento.',
};

function Swatch({ style }: { style: StyleDNA }) {
  const d = style.type.display;
  const t = style.type.text;
  const P = style.palette;
  const sticker = style.shape.panel === 'box' && style.layout.align === 'center';
  const card = style.shape.panel === 'box' && style.layout.align === 'left';
  return (
    <span className="swatch" aria-hidden>
      <span
        className="swatch-title"
        style={{
          fontFamily: `"${d.family}"`,
          fontWeight: d.weight,
          fontStyle: d.style,
          textTransform: d.case === 'upper' ? 'uppercase' : 'none',
          background: sticker || card ? P.panel : 'transparent',
          color: sticker || card ? P.onPanel : P.text,
          borderLeft: card ? `4px solid ${P.accent}` : undefined,
          borderRadius: sticker ? 8 : card ? 2 : 0,
        }}
      >
        {style.name}
      </span>
      <span className="swatch-caption" style={{ fontFamily: `"${t.family}"`, fontWeight: t.weight, textTransform: t.case === 'upper' ? 'uppercase' : 'none' }}>
        <span style={{ opacity: 1 }}>isso </span>
        <span style={style.captions.highlight === 'box' ? { background: P.accent, color: P.onPanel, borderRadius: 4, padding: '0 3px' } : style.captions.highlight === 'color' ? { color: P.accent } : {}}>muda</span>
        <span style={{ opacity: style.captions.highlight === 'reveal' ? style.captions.upcomingAlpha : 1 }}> tudo</span>
      </span>
    </span>
  );
}

export function StylePicker({ current, onPick, disabled }: { current: string; onPick: (id: string) => void; disabled?: boolean }) {
  return (
    <section className="styles" aria-label="Estilo do vídeo">
      <h2>Estilo</h2>
      <p className="hint">Muda letras, cores, animações e ritmo. Dá para desfazer.</p>
      <div className="style-grid">
        {PRESETS.map((s) => (
          <button key={s.id} className={`style-card ${current === s.id ? 'selected' : ''}`} aria-pressed={current === s.id} onClick={() => onPick(s.id)} disabled={disabled} data-testid={`style-${s.id}`}>
            <Swatch style={s} />
            <span className="style-about">{ABOUT[s.id]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
