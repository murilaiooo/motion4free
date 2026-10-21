import { useState } from 'react';
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
        <label className="sm ghost" style={{ cursor: 'pointer', border: '1px dashed var(--border)', padding: '4px 8px', borderRadius: 6 }}>
          <Plus size={14} /> Adicionar
          <input type="file" accept="video/*" multiple hidden disabled={disabled || clips.length >= max} onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (files.length) onAdd(files);
            e.currentTarget.value = '';
          }} />
        </label>
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
              <button className="icon sm ghost danger" onClick={() => onRemove(c.id)} disabled={disabled || clips.length <= 1} aria-label="Remover"><Trash2 size={14} /></button>
            </span>
          </li>
        ))}
      </ol>
      <style>{`
        .clip-list { border: 1px solid var(--border); border-radius: 10px; padding: 10px; background: var(--card); }
        .clip-list-head { display: flex; justify-content: space-between; align-items: center; }
        .clip-list-head h3 { margin: 0; font-size: 14px; }
        .clips { list-style: none; padding: 0; margin: 0; display: grid; gap: 6px; }
        .clip-item.dragging { opacity: 0.48; outline: 2px dashed var(--border); }
        .clip-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); }
        .clip-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
        .clip-index { font-weight: 600; font-size: 12px; color: var(--muted-fg); min-width: 16px; }
        .clip-dur { font-size: 12px; color: var(--muted-fg); }
        .clip-actions { display: flex; gap: 2px; }
      `}</style>
    </div>
  );
}
