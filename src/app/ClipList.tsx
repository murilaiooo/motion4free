import { useRef, useState } from 'react';
import { GripVertical, Trash2, Plus, ArrowUp, ArrowDown } from 'lucide-react';

interface ClipItem {
  id: string;
  name: string;
  duration?: number | null;
  file: File;
}

interface Props {
  clips: ClipItem[];
  onReorder: (next: ClipItem[]) => void;
  onRemove: (id: string) => void;
  onAdd: (files: File[]) => void;
  max?: number;
  disabled?: boolean;
}

export function ClipList({ clips, onReorder, onRemove, onAdd, max = 30, disabled = false }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const full = clips.length >= max;
  const move = (from: number, to: number) => {
    if (disabled || to < 0 || to >= clips.length) return;
    const next = [...clips];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onReorder(next);
  };
  const drop = (id: string) => {
    if (disabled || !dragId || dragId === id) return;
    const from = clips.findIndex(c => c.id === dragId);
    const to = clips.findIndex(c => c.id === id);
    if (from < 0 || to < 0) return;
    move(from, to);
  };

  return (
    <div className="clip-list" data-testid="clip-list">
      <div className="clip-list-head">
        <h3>Clipes ({clips.length}/{max})</h3>
        {/* botão de verdade (Tab + Enter funcionam); o campo de arquivo fica escondido */}
        <button type="button" className="sm ghost clip-add" disabled={disabled || full} onClick={() => picker.current?.click()} data-testid="clip-add"
          title={full ? `Limite de ${max} clipes` : 'Adicionar vídeos ao fim da montagem'}>
          <Plus size={14} aria-hidden /> Adicionar
        </button>
        <input ref={picker} type="file" accept="video/*" multiple hidden disabled={disabled || full} aria-label="Escolher vídeos para adicionar" onChange={(e) => {
          const files = e.target.files ? Array.from(e.target.files) : [];
          if (files.length) onAdd(files);
          e.currentTarget.value = '';
        }} />
      </div>
      <p className="hint" style={{ margin: '4px 0 8px' }}>Ordem importa: o primeiro vira o início do vídeo. Arraste ou use as setas para reordenar. Até 30 clipes.</p>
      <ol className="clips">
        {clips.map((c, i) => (
          <li key={c.id} className={`clip-item ${dragId === c.id ? 'dragging' : ''}`} data-testid={`clip-${c.id}`}
            draggable={!disabled}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', c.id);
              setDragId(c.id);
            }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => { e.preventDefault(); drop(c.id); setDragId(null); }}
            onDragEnd={() => setDragId(null)}
          >
            <span className="clip-drag" aria-hidden><GripVertical size={14} /></span>
            <span className="clip-index tnum">{i + 1}</span>
            <span className="clip-name" title={c.name}>{c.name}</span>
            {c.duration != null && <span className="clip-dur tnum">{c.duration.toFixed(1)}s</span>}
            <span className="clip-actions">
              <button className="icon sm ghost" onClick={() => move(i, i - 1)} disabled={disabled || i === 0} aria-label="Mover para cima"><ArrowUp size={14} /></button>
              <button className="icon sm ghost" onClick={() => move(i, i + 1)} disabled={disabled || i === clips.length - 1} aria-label="Mover para baixo"><ArrowDown size={14} /></button>
              <button className="icon sm ghost danger" onClick={() => onRemove(c.id)} disabled={disabled || clips.length <= 1} aria-label="Remover" title={clips.length <= 1 ? 'O vídeo precisa de pelo menos um clipe' : 'Tirar da montagem (dá para desfazer)'}><Trash2 size={14} /></button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
