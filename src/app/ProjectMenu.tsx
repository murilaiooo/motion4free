import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronDown, FolderClosed, HardDrive, Pencil, Replace, Trash2 } from 'lucide-react';
import { NAME_MAX } from '../core/project-library';
import './library.css';

interface Props {
  name: string;
  busy: boolean;
  canSave: boolean;
  onRename: (name: string) => void;
  onReplaceFile: (f: File) => void;
  onClose: () => void;
  onDelete: () => void;
  onStorage: () => void;
}

/**
 * Menu do projeto na barra do topo (clicar no nome): renomear, trocar vídeo, fechar (volta para
 * "Meus projetos", continua salvo), armazenamento e apagar projeto.
 */
export function ProjectMenu({ name, busy, canSave, onRename, onReplaceFile, onClose, onDelete, onStorage }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', key);
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const onMenuKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
  };

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

  const item = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="pmenu" ref={root}>
      <button className="pmenu-trigger ghost" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={name} data-testid="project-menu">
        <span className="project-name">{name}</span>
        <ChevronDown size={15} aria-hidden />
        <span className="sr-only">Menu do projeto</span>
      </button>
      {open && (
        <div className="pmenu-list" role="menu" aria-label="Projeto" onKeyDown={onMenuKey} data-testid="project-menu-list">
          <button role="menuitem" onClick={item(() => (setDraft(name), setEditing(true)))} disabled={!canSave} data-testid="menu-rename">
            <Pencil size={15} aria-hidden /> Renomear
          </button>
          <label role="menuitem" tabIndex={0} className={`btn ${busy ? 'disabled' : ''}`} aria-disabled={busy} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.click()}>
            <Replace size={15} aria-hidden />
            <span>
              Trocar vídeo
              <small>começa um projeto novo; este continua salvo</small>
            </span>
            <input
              className="sr-only"
              type="file"
              accept="video/*"
              tabIndex={-1}
              disabled={busy}
              data-testid="menu-replace-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setOpen(false);
                if (f) onReplaceFile(f);
              }}
            />
          </label>
          <button role="menuitem" onClick={item(onClose)} disabled={busy} data-testid="menu-close">
            <FolderClosed size={15} aria-hidden />
            <span>
              Fechar projeto
              <small>volta para Meus projetos; continua salvo</small>
            </span>
          </button>
          <button role="menuitem" onClick={item(onStorage)} data-testid="menu-storage">
            <HardDrive size={15} aria-hidden /> Armazenamento
          </button>
          <span className="pmenu-sep" role="separator" />
          <button role="menuitem" className="danger" onClick={item(onDelete)} disabled={busy || !canSave} data-testid="menu-delete">
            <Trash2 size={15} aria-hidden /> Apagar projeto…
          </button>
        </div>
      )}
    </div>
  );
}
