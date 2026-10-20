import { useState, type DragEvent, type ReactNode } from 'react';
import { Captions, Check, Cpu, FileVideo, HardDrive, Scissors, ShieldCheck, Sparkles, Upload, WandSparkles } from 'lucide-react';
import { PROCESSING_STEPS, processingStep } from '../core/steps';
import { listTemplates } from '../core/template-gallery';
import { APP_BUILT_AT, VERSION_LABEL } from '../version';
import { TemplateThumb } from './Templates';
import { Logo, ThemeToggle } from './TopBar';

function Header({ onStorage }: { onStorage?: () => void }) {
  return (
    <header className="land-nav">
      <a className="brand" href="./" aria-label="Motion4Free">
        <Logo />
        <span className="brand-name">Motion4Free</span>
      </a>
      <nav className="land-links">
        <a href="?galeria">Modelos</a>
        {onStorage && (
          <button className="ghost" onClick={onStorage} aria-label="Armazenamento" data-testid="open-storage">
            <HardDrive size={16} aria-hidden /> <span className="hide-sm">Armazenamento</span>
          </button>
        )}
        <ThemeToggle />
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="land-foot">
      <span data-testid="version" title={`Gerado em ${APP_BUILT_AT}`}>
        Motion4Free {VERSION_LABEL}
      </span>
      <span className="muted">
        Código aberto · sem cadastro · sem anúncios ·{' '}
        <a href="licencas-fontes.txt" target="_blank" rel="noreferrer">
          licenças das fontes
        </a>{' '}
        e{' '}
        <a href="licencas-icones.txt" target="_blank" rel="noreferrer">
          dos ícones
        </a>
      </span>
    </footer>
  );
}

/**
 * Primeira tela: promessa, área para soltar o vídeo, nota de privacidade e exemplos de modelos
 * desenhados de verdade (mesma `drawFrame` do vídeo final).
 */
/** Três modelos bem diferentes entre si para a vitrine da primeira tela. */
const SHOWCASE = ['pop', 'podcast', 'cinema'];

export function Landing({ onFile, busy, pendingName, pendingClipCount, notices, options, projects, onStorage }: { onFile: (files: File[]) => void; busy: boolean; pendingName: string | null; pendingClipCount?: number; notices: ReactNode; options?: ReactNode; projects?: ReactNode; onStorage?: () => void }) {
  const [over, setOver] = useState(false);
  const all = listTemplates();
  const examples = SHOWCASE.map((id) => all.find((t) => t.id === id)).filter((t) => t !== undefined);
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files).filter(f=> f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|webm)$/i)) : [];
    if (files.length && !busy) onFile(files);
  };
  return (
    <div className="land">
      <Header onStorage={onStorage} />
      <main className="hero">
        <section className="hero-copy">
          <span className="eyebrow pill">
            <Sparkles size={13} aria-hidden /> Grátis · sem cadastro · sem enviar nada
          </span>
          <h1>Edite Reels no seu navegador, de graça, sem enviar seu vídeo.</h1>
          <p className="lead">O Motion4Free corta os silêncios, escreve as legendas e anima o vídeo sozinho. Depois é só ajustar o que quiser e baixar.</p>

          {notices}

          <label
            className={`dropzone ${over ? 'over' : ''} ${busy ? 'disabled' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={drop}
          >
            <input className="sr-only" type="file" accept="video/*" multiple disabled={busy} data-testid="file-input" onChange={(e) => { const files = e.target.files ? Array.from(e.target.files) : []; if (files.length) onFile(files); e.currentTarget.value=""; }} />
            <span className="drop-icon" aria-hidden>
              {pendingName ? <FileVideo size={26} /> : <Upload size={26} />}
            </span>
            <span className="drop-title">{pendingName ? (pendingClipCount ? (pendingClipCount === 1 ? 'Selecione novamente o vídeo original deste projeto' : `Selecione novamente os ${pendingClipCount} vídeos originais`) : `Escolha de novo o vídeo original (${pendingName})`) : 'Arraste seu vídeo aqui'}</span>
            <span className="drop-sub">
              ou <u>clique para escolher</u> · até 30 clipes, cada um até 3 minutos (MP4, MOV ou WebM)
            </span>
          </label>

          {options}

          <p className="privacy">
            <ShieldCheck size={16} aria-hidden /> Seu vídeo nunca sai deste aparelho. Tudo é feito aqui no navegador.
          </p>

          <ol className="how-steps">
            <li>
              <Scissors size={16} aria-hidden /> <span>Corta pausas e silêncios</span>
            </li>
            <li>
              <Captions size={16} aria-hidden /> <span>Legendas palavra por palavra</span>
            </li>
            <li>
              <WandSparkles size={16} aria-hidden /> <span>Títulos, zoom e animações</span>
            </li>
          </ol>
        </section>

        {projects || (
        <section className="hero-show" aria-label="Exemplos de modelos">
          <div className="showcase">
            {examples.map((t, i) => (
              <figure key={t.id} className={`phone p${i}`}>
                <TemplateThumb styleId={t.id} t={[1.3, 22.1, 4.6, 12.2][i] ?? 1.3} width={200} />
                <figcaption>
                  <b>{t.name}</b>
                  <span>{t.tags[0]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="hint show-note">Quadros de exemplo desenhados agora, no seu navegador, com os modelos do app.</p>
        </section>
        )}
      </main>
      <Footer />
    </div>
  );
}

/** Tela de processamento: passos com o que já foi feito, o atual e a barra de progresso. */
export function Processing({ label, fraction, fileName }: { label: string; fraction: number; fileName: string | null }) {
  const step = processingStep(label);
  const overall = (step + Math.min(1, Math.max(0, fraction))) / PROCESSING_STEPS.length;
  return (
    <div className="land">
      <Header />
      <main className="processing">
        <div className="proc-card card" role="status" aria-live="polite" data-testid="processing">
          <div className="proc-head">
            <span className="proc-icon" aria-hidden>
              <WandSparkles size={22} />
            </span>
            <div>
              <h1>Editando seu vídeo</h1>
              {fileName && <p className="hint proc-file">{fileName}</p>}
            </div>
            <b className="proc-pct tnum">{Math.round(overall * 100)}%</b>
          </div>
          <div className="bar">
            <span style={{ width: `${Math.max(3, overall * 100)}%` }} />
          </div>
          <ol className="proc-steps">
            {PROCESSING_STEPS.map((s, i) => (
              <li key={s.id} className={i < step ? 'done' : i === step ? 'active' : ''}>
                <span className="proc-mark" aria-hidden>
                  {i < step ? <Check size={13} strokeWidth={3} /> : i === step ? <span className="spinner" /> : i + 1}
                </span>
                <span>
                  {s.label}
                  {i === step && <small className="hint">{label}…</small>}
                </span>
              </li>
            ))}
          </ol>
          <p className="privacy">
            <Cpu size={15} aria-hidden /> Processando no seu aparelho. Na primeira vez o modelo de transcrição é baixado (uma vez só).
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
