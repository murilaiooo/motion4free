import { useEffect, useState } from 'react';
import { Check, CloudOff, Download, Moon, Redo2, Replace, Sun, Undo2 } from 'lucide-react';

export type SaveState = 'saved' | 'saving' | 'off';

type Theme = 'dark' | 'light';
const THEME_KEY = 'm4f-tema';

function readTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

/** Tema da interface (escuro padrão; claro opcional, lembrado neste navegador). */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // sem armazenamento: o tema vale só nesta visita
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button className="icon ghost theme-toggle" onClick={toggle} aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'} data-tip={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="logo-mark">
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M9 22V10l7 7 7-7v12" fill="none" stroke="var(--brand-ink)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface Props {
  fileName: string;
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onReplaceFile: (f: File) => void;
  busy: boolean;
  onExport: () => void;
  exporting: number | null;
  exportDisabled: boolean;
}

export function TopBar({ fileName, saveState, canUndo, canRedo, onUndo, onRedo, onReplaceFile, busy, onExport, exporting, exportDisabled }: Props) {
  const project = fileName.replace(/\.[^.]+$/, '');
  return (
    <header className="topbar">
      <div className="topbar-left">
        <a className="brand" href="./" aria-label="Motion4Free">
          <Logo />
          <span className="brand-name">Motion4Free</span>
        </a>
        <span className="topbar-sep" aria-hidden />
        <div className="project">
          <span className="project-name" title={fileName}>
            {project}
          </span>
          <span className={`save-state ${saveState}`} data-testid={saveState === 'saved' ? 'saved' : 'saving'}>
            {saveState === 'saved' ? (
              <>
                <Check size={13} aria-hidden /> Salvo neste navegador
              </>
            ) : saveState === 'saving' ? (
              <>
                <span className="dot" aria-hidden /> Salvando…
              </>
            ) : (
              <>
                <CloudOff size={13} aria-hidden /> Não salva neste navegador
              </>
            )}
          </span>
        </div>
      </div>
      <div className="topbar-right">
        <button className="icon ghost" onClick={onUndo} disabled={!canUndo} data-testid="undo" aria-label="Desfazer" aria-keyshortcuts="Control+Z" data-tip="Desfazer (Ctrl+Z)">
          <Undo2 size={18} />
        </button>
        <button className="icon ghost" onClick={onRedo} disabled={!canRedo} data-testid="redo" aria-label="Refazer" aria-keyshortcuts="Control+Shift+Z" data-tip="Refazer (Ctrl+Shift+Z)">
          <Redo2 size={18} />
        </button>
        <span className="topbar-sep" aria-hidden />
        <label className={`btn ghost replace ${busy ? 'disabled' : ''}`} data-tip="O projeto atual será substituído">
          <Replace size={16} aria-hidden />
          <span className="hide-sm">Trocar vídeo</span>
          <input className="sr-only" type="file" accept="video/*" disabled={busy} data-testid="file-input-replace" aria-label="Trocar vídeo (o projeto atual será substituído)" onChange={(e) => e.target.files?.[0] && onReplaceFile(e.target.files[0])} />
        </label>
        <ThemeToggle />
        <button className="primary export-btn" onClick={onExport} disabled={exportDisabled} data-testid="export">
          {exporting !== null ? <span className="spinner dark" aria-hidden /> : <Download size={16} aria-hidden />}
          {exporting !== null ? `Exportando ${Math.round(exporting * 100)}%` : 'Exportar'}
        </button>
      </div>
    </header>
  );
}
