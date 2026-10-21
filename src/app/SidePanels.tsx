import { useState } from 'react';
import { AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowRight, Circle, Heading1, RotateCcw, Square, Type } from 'lucide-react';
import type { EditPlan } from '../core/types';
import { EMOJI_SET, type Emoji } from '../core/emoji';
import { resetAllCaptionEdits, setCaptionPlacement, patchCaptionLook, type AddSpec } from '../editorial/manual';

/**
 * Painéis do menu da esquerda (v0.19), no padrão de CapCut/Canva: cada aba faz uma coisa, com o que
 * mais se usa primeiro e um clique para aplicar. Tudo entra na agulha e fica escolhido para ajustar.
 */

/** Texto: título, texto e chamadas prontas, adicionados na agulha (3 s). */
export function TextPanel({ onAdd, disabled }: { onAdd: (spec: AddSpec) => void; disabled: boolean }) {
  const presets: { label: string; hint: string; spec: AddSpec; big?: boolean }[] = [
    { label: 'Título', hint: 'Grande, para abrir ou destacar', spec: { kind: 'text', preset: 'title', text: 'Seu título aqui' }, big: true },
    { label: 'Texto', hint: 'Uma frase curta na tela', spec: { kind: 'text', preset: 'text', text: 'Seu texto aqui' } },
    { label: 'Chamada', hint: '"Siga para mais" no fim', spec: { kind: 'text', preset: 'text', text: 'Siga para mais dicas', placement: { y: 0.78 } } },
    { label: 'Pergunta', hint: 'Para prender a atenção', spec: { kind: 'text', preset: 'title', text: 'Você sabia?', placement: { y: 0.3 } } },
  ];
  return (
    <div className="stack">
      <div className="add-grid">
        {presets.map((p) => (
          <button key={p.label} type="button" className={`add-card ${p.big ? 'big' : ''}`} onClick={() => onAdd(p.spec)} disabled={disabled} data-testid={`add-text-${p.label.toLowerCase()}`}>
            {p.big ? <Heading1 size={20} aria-hidden /> : <Type size={18} aria-hidden />}
            <b>{p.label}</b>
            <small>{p.hint}</small>
          </button>
        ))}
      </div>
      <p className="hint">Entra onde está a agulha da linha do tempo. Depois é só arrastar na prévia, dar dois cliques para trocar o texto e puxar as pontas na linha do tempo.</p>
    </div>
  );
}

/** Elementos: emojis e formas (seta, círculo, retângulo). */
export function ElementsPanel({ onAdd, disabled }: { onAdd: (spec: AddSpec) => void; disabled: boolean }) {
  const shapes = [
    { shape: 'arrow' as const, label: 'Seta', Icon: ArrowRight },
    { shape: 'circle' as const, label: 'Círculo', Icon: Circle },
    { shape: 'box' as const, label: 'Retângulo', Icon: Square },
  ];
  return (
    <div className="stack">
      <section>
        <h3 className="section-title">Formas</h3>
        <div className="shape-row">
          {shapes.map(({ shape, label, Icon }) => (
            <button key={shape} type="button" className="add-card" onClick={() => onAdd({ kind: 'shape', shape })} disabled={disabled} data-testid={`add-shape-${shape}`}>
              <Icon size={20} aria-hidden />
              <b>{label}</b>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="section-title">Emojis</h3>
        <div className="emoji-grid" role="list">
          {EMOJI_SET.map((e) => (
            <button key={e} type="button" role="listitem" className="emoji-btn" onClick={() => onAdd({ kind: 'emoji', emoji: e as Emoji })} disabled={disabled} aria-label={`Adicionar ${e}`} data-testid={`add-emoji-${e}`}>
              {e}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

const POSITIONS = [
  { id: 'top', label: 'Em cima', y: 0.22, Icon: AlignVerticalJustifyStart },
  { id: 'middle', label: 'No meio', y: 0.5, Icon: AlignVerticalJustifyCenter },
  { id: 'bottom', label: 'Embaixo', y: 0.74, Icon: AlignVerticalJustifyEnd },
] as const;

/** Estilo de todas as legendas: posição, tamanho e cores (o mesmo que arrastar na prévia, em um clique). */
export function CaptionStylePanel({ plan, onApply, disabled }: { plan: EditPlan; onApply: (op: (p: EditPlan) => EditPlan) => void; disabled: boolean }) {
  const place = plan.edits.captionPlacement;
  const look = plan.edits.captionLook;
  const P = plan.style.palette;
  const [size, setSize] = useState<number | null>(null);
  const scale = size ?? place?.scale ?? 1;
  const at = (y: number, s = place?.scale ?? 1) => ({ x: place?.x ?? 0.5, y, scale: s, rotate: place?.rotate ?? 0 });
  const current = place ? POSITIONS.find((p) => Math.abs(p.y - place.y) < 0.04)?.id : null;
  const commitSize = () => {
    if (size === null) return;
    const s = size;
    setSize(null);
    onApply((p) => setCaptionPlacement(p, 'all', null, at(place?.y ?? 0.74, s)));
  };
  return (
    <div className="stack cap-style" data-testid="caption-style">
      <div className="field">
        <span className="field-label">Posição</span>
        <div className="segmented full" role="group" aria-label="Posição das legendas">
          {POSITIONS.map(({ id, label, y, Icon }) => (
            <button key={id} type="button" aria-pressed={current === id} disabled={disabled} onClick={() => onApply((p) => setCaptionPlacement(p, 'all', null, at(y)))} data-testid={`cap-pos-${id}`}>
              <Icon size={14} aria-hidden /> {label}
            </button>
          ))}
        </div>
        <small className="hint">Ou arraste a legenda direto no vídeo.</small>
      </div>
      <label className="field">
        <span className="row-between">
          <span className="field-label">Tamanho</span>
          <b className="tnum">{Math.round(scale * 100)}%</b>
        </span>
        <input type="range" min={0.6} max={1.8} step={0.05} value={scale} disabled={disabled} onChange={(e) => setSize(e.target.valueAsNumber)} onPointerUp={commitSize} onKeyUp={commitSize} onBlur={commitSize} data-testid="cap-size" />
      </label>
      <div className="color-row">
        <ColorPick label="Texto" value={look.text ?? P.text} disabled={disabled} onCommit={(v) => onApply((p) => patchCaptionLook(p, 'all', null, { text: v }))} testId="cap-color-text" />
        <ColorPick label="Destaque" value={look.highlight ?? P.accent} disabled={disabled} onCommit={(v) => onApply((p) => patchCaptionLook(p, 'all', null, { highlight: v }))} testId="cap-color-highlight" />
        <ColorPick label="Contorno" value={look.stroke ?? '#000000'} disabled={disabled} onCommit={(v) => onApply((p) => patchCaptionLook(p, 'all', null, { stroke: v }))} testId="cap-color-stroke" />
      </div>
      <button type="button" className="sm ghost" disabled={disabled} onClick={() => onApply(resetAllCaptionEdits)} data-testid="cap-reset">
        <RotateCcw size={13} aria-hidden /> Voltar ao estilo do modelo
      </button>
    </div>
  );
}

/** Cor que só vira uma entrada do desfazer ao fechar o seletor (e não a cada tom arrastado). */
function ColorPick({ label, value, onCommit, disabled, testId }: { label: string; value: string; onCommit: (v: string) => void; disabled: boolean; testId: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft.toLowerCase() !== value.toLowerCase()) onCommit(draft);
    setDraft(null);
  };
  return (
    <label className="color-pick">
      <input type="color" value={draft ?? value} disabled={disabled} onChange={(e) => setDraft(e.target.value)} onBlur={commit} data-testid={testId} />
      {label}
    </label>
  );
}
