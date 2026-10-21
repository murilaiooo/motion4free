import { useState, type CSSProperties } from 'react';
import { Scan, Settings2 } from 'lucide-react';
import { z } from 'zod';
import type { CreativeSetup } from '../../core/production';

const GUIDE_KEY = 'm4f.composition-guide.v1';
const margin = z.number().finite().min(0).max(35);
const guideSchema = z.object({ version: z.literal(1), enabled: z.boolean(), preset: z.enum(['reels', 'tiktok', 'shorts', 'custom']), top: margin, bottom: margin, left: margin, right: margin });
type GuideState = z.infer<typeof guideSchema>;
const LABELS = { reels: 'Reels', tiktok: 'TikTok', shorts: 'Shorts', custom: 'Personalizado' };

export function useCompositionGuide(platform?: CreativeSetup['platform']) {
  const [guide, setGuide] = useState<GuideState>(() => {
    try {
      const parsed = guideSchema.safeParse(JSON.parse(localStorage.getItem(GUIDE_KEY) ?? 'null'));
      if (parsed.success) return parsed.data;
    } catch {}
    return { version: 1, enabled: false, preset: platform === 'tiktok' || platform === 'shorts' ? platform : 'reels', top: 12, bottom: 20, left: 6, right: 12 };
  });
  const update = (patch: Partial<GuideState>) => {
    const next = guideSchema.safeParse({ ...guide, ...patch });
    if (!next.success) return;
    setGuide(next.data);
    try { localStorage.setItem(GUIDE_KEY, JSON.stringify(next.data)); } catch {}
  };
  return { guide, update };
}

type GuideControl = ReturnType<typeof useCompositionGuide>;

export function GuideOverlay({ state, portrait }: { state: GuideControl; portrait: boolean }) {
  if (!state.guide.enabled) return null;
  const { guide } = state;
  const preset = portrait ? { reels: { top: 12, bottom: 20, left: 6, right: 12 }, tiktok: { top: 12, bottom: 24, left: 6, right: 16 }, shorts: { top: 10, bottom: 22, left: 6, right: 16 }, custom: guide }[guide.preset] : { top: 6, bottom: 10, left: 6, right: 6 };
  const rect = guide.preset === 'custom' ? guide : preset;
  const style = Object.fromEntries(['top', 'bottom', 'left', 'right'].map(edge => [edge, `${rect[edge as keyof typeof rect]}%`])) as CSSProperties;
  return <div className="safe-zone" style={style} aria-hidden data-testid="guide-overlay"><span>{LABELS[guide.preset]} · margem sugerida</span></div>;
}

export function CompositionGuideControls({ state }: { state: GuideControl }) {
  const { guide, update } = state;
  return <div className="guide-controls"><button className="icon ghost" aria-pressed={guide.enabled} onClick={() => update({ enabled: !guide.enabled })} aria-label={guide.preset === 'reels' ? 'Mostrar área segura do Reels' : `Mostrar guia de ${LABELS[guide.preset]}`}><Scan size={17} aria-hidden /></button>
    <details className="guide-options"><summary className="btn icon ghost" aria-label="Opções de guias" data-testid="guide-options"><Settings2 size={15} aria-hidden /></summary><div className="guide-options-body">
      <label>Guia de composição<select value={guide.preset} onChange={event => update({ preset: event.target.value as GuideState['preset'] })}>{Object.entries(LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className="guide-enable"><input type="checkbox" checked={guide.enabled} onChange={event => update({ enabled: event.target.checked })} /> Mostrar guia</label>
      {guide.preset === 'custom' && (['top', 'bottom', 'left', 'right'] as const).map((edge, index) => <label key={edge}>{['Margem superior (%)', 'Margem inferior (%)', 'Margem esquerda (%)', 'Margem direita (%)'][index]}<input type="number" min={0} max={35} value={guide[edge]} onChange={event => update({ [edge]: event.target.valueAsNumber })} /></label>)}
      <p className="hint">Margens sugeridas, ajustáveis. As interfaces das plataformas variam. Estas linhas aparecem só aqui, nunca no vídeo exportado.</p>
    </div></details>
  </div>;
}
