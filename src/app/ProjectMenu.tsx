import { useState } from 'react';
import { FolderOpen, HardDrive, Pencil, Trash2 } from 'lucide-react';
import { NAME_MAX } from '../core/project-library';
import './library.css';

interface Props {
  name: string;
  busy: boolean;
  canSave: boolean;
  onRename: (name: string) => void;
  /** não usado desde a v0.20: "Trocar vídeo" tem botão próprio na barra */
  onReplaceFile?: (f: File) => void;
  onClose: () => void;
  onDelete: () => void;
  onStorage: () => void;
}

/**
 * Ações do projeto na barra do topo, sempre à vista (v0.20; antes ficavam num menu escondido no nome):
 * nome com lápis para renomear, Meus projetos (fecha; continua salvo), Armazenamento e Apagar.
 * "Trocar vídeo" já tem botão próprio na barra.
 */
export function ProjectMenu({ name, busy, canSave, onRename, onClose, onDelete, onStorage }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (draft.trim() && draft.trim() !== name) onRename(draft);
    };
    return (
      <form
        className="pmenu-rename"
        onSubmit={(e) => {
          e.preventDefault();
          commit();
        }}
      >
        <input
          value={draft}
          maxLength={NAME_MAX}
          autoFocus
          aria-label="Nome do projeto"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Escape' && (setDraft(name), setEditing(false))}
          data-testid="project-name-input"
        />
      </form>
    );
  }

  return (
    <div className="pmenu" data-testid="project-actions">
      <button className="pmenu-trigger ghost" onClick={() => (setDraft(name), setEditing(true))} disabled={!canSave} title="Renomear projeto" data-testid="project-menu">
        <span className="project-name">{name}</span>
        <Pencil size={13} aria-hidden data-testid="menu-rename" />
        <span className="sr-only">Renomear</span>
      </button>
      <div className="pmenu-actions" role="group" aria-label="Projeto">
        <button className="ghost sm" onClick={onClose} disabled={busy} data-tip="Volta para Meus projetos; este continua salvo" data-testid="menu-close">
          <FolderOpen size={15} aria-hidden /> <span className="hide-sm">Meus projetos</span>
        </button>
        <button className="ghost sm" onClick={onStorage} data-tip="Ver e liberar o espaço usado neste computador" data-testid="menu-storage">
          <HardDrive size={15} aria-hidden /> <span className="hide-sm">Armazenamento</span>
        </button>
        <button className="ghost sm danger" onClick={onDelete} disabled={busy || !canSave} data-tip="Apagar este projeto" aria-label="Apagar projeto" data-testid="menu-delete">
          <Trash2 size={15} aria-hidden /> <span className="hide-sm">Apagar</span>
        </button>
      </div>
    </div>
  );
}
