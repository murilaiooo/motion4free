import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, FileVideo, FolderOpen, HardDrive, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import { formatBytes, formatClock, formatWhen } from '../core/bytes';
import { NAME_MAX, type ProjectSummary } from '../core/project-library';
import { TEMPLATE_NAMES, type TemplateId } from '../core/templates';
import './library.css';

interface Props {
  projects: ProjectSummary[];
  busy: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (p: ProjectSummary) => void;
  onStorage: () => void;
}

function Thumb({ blob }: { blob: Blob | null }) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url ? <img className="proj-thumb" src={url} alt="" /> : <span className="proj-thumb empty"><FileVideo size={22} aria-hidden /></span>;
}

function ProjectCard({ p, busy, onOpen, onRename, onDuplicate, onDelete }: { p: ProjectSummary } & Omit<Props, 'projects' | 'onStorage'>) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const template = TEMPLATE_NAMES[p.templateId as TemplateId] ?? p.templateId;
  const commit = () => {
    setEditing(false);
    if (name.trim() && name.trim() !== p.name) onRename(p.id, name);
    else setName(p.name);
  };
  return (
    <li className={`proj-card ${p.broken ? 'broken' : ''}`} data-testid={`project-${p.id}`} data-project-name={p.name}>
      <button className="proj-open" onClick={() => onOpen(p.id)} disabled={busy || p.broken || editing} aria-label={`Abrir o projeto ${p.name}`} data-testid="project-open">
        <Thumb blob={p.thumb} />
      </button>
      <div className="proj-info">
        {editing ? (
          <form
            className="proj-rename"
            onSubmit={(e) => {
              e.preventDefault();
              commit();
            }}
          >
            <input
              aria-label="Novo nome do projeto"
              value={name}
              maxLength={NAME_MAX}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setName(p.name);
                  setEditing(false);
                }
              }}
              data-testid="project-rename-input"
            />
            <button type="submit" className="icon sm" aria-label="Salvar nome" data-testid="project-rename-save">
              <Check size={15} />
            </button>
            <button type="button" className="icon sm ghost" aria-label="Cancelar" onClick={() => (setName(p.name), setEditing(false))}>
              <X size={15} />
            </button>
          </form>
        ) : (
          <button className="proj-name link" onClick={() => onOpen(p.id)} disabled={busy || p.broken} title={p.name} data-testid="project-name">
            {p.name}
          </button>
        )}
        {p.status === 'interrupted' ? (
          <p className="proj-meta warn" data-testid="project-interrupted" title={p.problem}>
            <TriangleAlert size={13} aria-hidden /> A importação parou antes do primeiro salvamento, então não há edições aqui. O vídeo original continua no seu
            computador: apague para liberar espaço e abra o vídeo de novo.
          </p>
        ) : p.broken ? (
          <p className="proj-meta warn" data-testid="project-damaged" title={p.problem}>
            <TriangleAlert size={13} aria-hidden /> Os dados deste projeto estão danificados e ele não abre (M4F-602). Você pode apagá-lo.
          </p>
        ) : (
          <p className="proj-meta">
            <span className="tnum">{formatClock(p.editedSec)}</span>
            {template && <span className="tag">{template}</span>}
            <span>editado {formatWhen(p.updatedAt, Date.now())}</span>
          </p>
        )}
        <p className="proj-meta">
          <HardDrive size={13} aria-hidden />
          <span className="tnum" data-testid="project-size">
            {formatBytes(p.sizeBytes)}
          </span>
          {!p.hasVideo && !p.broken && <span className="muted">· vídeo não guardado (o app pede de novo)</span>}
        </p>
        <div className="proj-actions">
          <button className="sm" onClick={() => onOpen(p.id)} disabled={busy || p.broken} data-testid="project-open-btn">
            <FolderOpen size={14} aria-hidden /> Abrir
          </button>
          <button className="icon sm ghost" onClick={() => setEditing(true)} disabled={busy || p.broken} aria-label="Renomear" data-tip="Renomear" data-testid="project-rename">
            <Pencil size={15} />
          </button>
          <button className="icon sm ghost" onClick={() => onDuplicate(p.id)} disabled={busy || p.broken} aria-label="Duplicar" data-tip="Duplicar" data-testid="project-duplicate">
            <Copy size={15} />
          </button>
          <button className="icon sm ghost danger" onClick={() => onDelete(p)} disabled={busy} aria-label="Apagar" data-tip="Apagar" data-testid="project-delete">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </li>
  );
}

/** "Meus projetos" na primeira tela: cada projeto salvo neste navegador, com abrir, renomear, duplicar e apagar. */
export function ProjectsList(props: Props) {
  const { projects, onStorage } = props;
  const total = projects.reduce((s, p) => s + p.sizeBytes, 0);
  return (
    <section className="projects" aria-labelledby="projects-title" data-testid="projects">
      <header className="projects-head">
        <h2 id="projects-title">Meus projetos</h2>
        <span className="hint tnum">
          {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'} · {formatBytes(total)}
        </span>
        <button className="sm ghost" onClick={onStorage}>
          <HardDrive size={14} aria-hidden /> Ver armazenamento
        </button>
      </header>
      <ul className="proj-grid">
        {projects.map((p) => (
          <ProjectCard key={p.id} p={p} {...props} />
        ))}
      </ul>
      <p className="hint projects-note">Ficam só neste navegador, neste computador. Cada vídeo novo vira um projeto novo; nada é substituído.</p>
    </section>
  );
}
