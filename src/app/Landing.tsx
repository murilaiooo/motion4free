import { useState, type DragEvent, type ReactNode } from 'react';
import { Captions, Check, Clapperboard, Cpu, FileVideo, HardDrive, History, Layers, MessageSquareText, Move, RectangleVertical, Scissors, ShieldCheck, Upload, WandSparkles } from 'lucide-react';
import './landing.css';
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
        <a className="hide-sm" href="#como-funciona">Como funciona</a>
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

/** Modelos da vitrine (bem diferentes entre si). */
const SHOWCASE = ['pop', 'podcast', 'cinema', 'neon', 'documental'];

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Scissors size={18} aria-hidden />, title: 'Corte automático', text: 'Tira silêncios, pausas e respiros longos sem cortar palavras. Você revê cada corte e devolve o que quiser.' },
  { icon: <Captions size={18} aria-hidden />, title: 'Legendas palavra por palavra', text: 'Transcrição no próprio aparelho, com destaque na palavra falada. Clique numa palavra para corrigir.' },
  { icon: <Layers size={18} aria-hidden />, title: 'Linha do tempo de verdade', text: 'Divida, apare, copie, cole e reordene trechos. Camadas para textos, emojis e formas, com onda de áudio.' },
  { icon: <Move size={18} aria-hidden />, title: 'Arraste na prévia', text: 'Tire a legenda do rosto, mude o tamanho e encoste no centro com o ímã. Tudo volta com Ctrl+Z.' },
  { icon: <MessageSquareText size={18} aria-hidden />, title: 'Peça em português', text: '“Legenda amarela, mais rápido, gancho forte.” O app entende e diz com clareza o que ainda não sabe fazer.' },
  { icon: <Clapperboard size={18} aria-hidden />, title: 'Vários clipes, um vídeo', text: 'Solte até 30 clipes curtos. O app monta, corta e nivela o volume de todos numa edição só.' },
  { icon: <RectangleVertical size={18} aria-hidden />, title: 'Qualquer formato', text: 'Reels 9:16, feed 4:5, quadrado 1:1 ou YouTube 16:9. O enquadramento se ajusta sozinho e você corrige.' },
  { icon: <History size={18} aria-hidden />, title: 'Versões e projetos', text: 'Salve versões, compare antes e depois e continue amanhã. Os projetos ficam guardados neste navegador.' },
];

const FAQ: [string, string][] = [
  ['É grátis mesmo?', 'Sim. Não tem plano pago, cadastro nem marca d’água. O processamento é feito pelo seu próprio computador, então não há servidor para pagar.'],
  ['Meu vídeo é enviado para algum lugar?', 'Não. O vídeo e tudo o que o app gera ficam neste aparelho. Você vê e apaga o espaço usado em Armazenamento.'],
  ['Preciso instalar alguma coisa?', 'Não. Funciona no Chrome ou no Edge, no computador. Na primeira vez o app baixa o modelo de transcrição, uma vez só.'],
  ['Funciona com vídeo gravado no celular?', 'Sim. MP4, MOV ou WebM, até 3 minutos por clipe. O resultado sai em MP4, pronto para o Instagram.'],
];

export function Landing({ onFile, busy, pendingName, pendingClipCount, notices, options, projects, onStorage }: { onFile: (files: File[]) => void; busy: boolean; pendingName: string | null; pendingClipCount?: number; notices: ReactNode; options?: ReactNode; projects?: ReactNode; onStorage?: () => void }) {
  const [over, setOver] = useState(false);
  const all = listTemplates();
  const examples = SHOWCASE.map((id) => all.find((t) => t.id === id)).filter((t) => t !== undefined);
  const hero = examples[0];
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|webm)$/i)) : [];
    if (files.length && !busy) onFile(files);
  };
  const toStart = () => {
    document.getElementById('comecar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector<HTMLInputElement>('[data-testid="file-input"]')?.focus();
  };
  return (
    <div className="land lp">
      <Header onStorage={onStorage} />

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-kicker">
              <span className="lp-dot" aria-hidden /> Editor de vídeo para Reels · no navegador
            </p>
            <h1>
              Grave. Solte aqui.
              <br />
              <em>Poste editado.</em>
            </h1>
            <p className="lp-lead">O Motion4Free corta as pausas, escreve as legendas e anima seu vídeo em poucos minutos. Depois você ajusta tudo numa linha do tempo de verdade e baixa o MP4. Sem enviar o vídeo para ninguém.</p>

            {notices}

            <label
              id="comecar"
              className={`dropzone lp-drop ${over ? 'over' : ''} ${busy ? 'disabled' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={drop}
            >
              <input
                className="sr-only"
                type="file"
                accept="video/*"
                multiple
                disabled={busy}
                data-testid="file-input"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length) onFile(files);
                  e.currentTarget.value = '';
                }}
              />
              <span className="drop-icon" aria-hidden>
                {pendingName ? <FileVideo size={22} /> : <Upload size={22} />}
              </span>
              <span className="lp-drop-text">
                <span className="drop-title">{pendingName ? (pendingClipCount ? (pendingClipCount === 1 ? 'Selecione novamente o vídeo original deste projeto' : `Selecione novamente os ${pendingClipCount} vídeos originais`) : `Escolha de novo o vídeo original (${pendingName})`) : 'Escolher vídeos'}</span>
                <span className="drop-sub">ou arraste aqui · até 30 clipes de até 3 min · MP4, MOV, WebM</span>
              </span>
            </label>

            {options}

            <ul className="lp-facts">
              <li>
                <ShieldCheck size={15} aria-hidden /> O vídeo não sai do aparelho
              </li>
              <li>
                <Check size={15} aria-hidden /> Grátis, sem cadastro
              </li>
              <li>
                <Check size={15} aria-hidden /> Sem marca d’água
              </li>
            </ul>
          </div>

          <div className="lp-hero-art" aria-label="Como o editor se parece">
            <div className="lp-window">
              <div className="lp-window-bar" aria-hidden>
                <i />
                <i />
                <i />
                <span>meu-reels.mp4</span>
              </div>
              <div className="lp-window-body">
                <div className="lp-rail" aria-hidden>
                  {['Modelos', 'Texto', 'Legendas', 'Mídia', 'IA'].map((x, i) => (
                    <span key={x} className={i === 2 ? 'on' : ''}>
                      {x}
                    </span>
                  ))}
                </div>
                <div className="lp-stage">{hero && <TemplateThumb styleId={hero.id} t={4.6} width={220} playing />}</div>
              </div>
              <div className="lp-tracks" aria-hidden>
                <div className="lp-track">
                  <b>Texto</b>
                  <span style={{ left: '6%', width: '22%' }} className="c1" />
                  <span style={{ left: '58%', width: '16%' }} className="c1" />
                </div>
                <div className="lp-track">
                  <b>Legendas</b>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i} style={{ left: `${4 + i * 13.4}%`, width: '11.5%' }} className="c2" />
                  ))}
                </div>
                <div className="lp-track">
                  <b>Vídeo</b>
                  <span style={{ left: '2%', width: '31%' }} className="c3" />
                  <span style={{ left: '34%', width: '27%' }} className="c3" />
                  <span style={{ left: '62%', width: '36%' }} className="c3" />
                </div>
                <div className="lp-track wave">
                  <b>Áudio</b>
                  <span style={{ left: '2%', width: '96%' }} className="c4" />
                </div>
                <i className="lp-head" />
              </div>
            </div>
          </div>
        </section>

        {projects && <section className="lp-section lp-projects">{projects}</section>}

        <section className="lp-section" id="como-funciona">
          <header className="lp-head-row">
            <span className="lp-num">01</span>
            <h2>Como funciona</h2>
          </header>
          <ol className="lp-steps">
            <li>
              <b>Solte o vídeo</b>
              <p>Um vídeo falado ou vários clipes curtos, gravados no celular. Nada é enviado.</p>
            </li>
            <li>
              <b>O app edita sozinho</b>
              <p>Transcreve, corta silêncios, põe legendas, título de abertura, zooms e emojis no ritmo da fala.</p>
            </li>
            <li>
              <b>Você ajusta e baixa</b>
              <p>Troque o modelo, peça mudanças por texto, mexa na linha do tempo e exporte o MP4 pronto.</p>
            </li>
          </ol>
        </section>

        <section className="lp-section">
          <header className="lp-head-row">
            <span className="lp-num">02</span>
            <h2>Tudo o que o editor faz</h2>
            <p>Automático no começo, manual quando você quiser.</p>
          </header>
          <div className="lp-grid">
            {FEATURES.map((f) => (
              <article key={f.title} className="lp-feature">
                <span className="lp-ico">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="lp-section">
          <header className="lp-head-row">
            <span className="lp-num">03</span>
            <h2>Modelos prontos</h2>
            <p>
              15 estilos de legenda e animação, desenhados ao vivo no seu navegador. <a href="?galeria">Ver todos</a>
            </p>
          </header>
          <div className="lp-reel">
            {examples.map((t, i) => (
              <figure key={t.id}>
                <TemplateThumb styleId={t.id} t={[1.3, 22.1, 4.6, 12.2, 8.4][i] ?? 1.3} width={180} />
                <figcaption>
                  <b>{t.name}</b>
                  <span>{t.tags[0]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="lp-privacy">
          <div>
            <span className="lp-num">04</span>
            <h2>Seu vídeo não sai daqui.</h2>
            <p>Transcrição, edição e exportação acontecem no seu computador. Não há upload, conta nem servidor guardando o que você grava.</p>
          </div>
          <ul>
            <li>
              <ShieldCheck size={18} aria-hidden /> <span>Nenhum envio de vídeo ou áudio</span>
            </li>
            <li>
              <HardDrive size={18} aria-hidden /> <span>Você vê e apaga o espaço usado</span>
            </li>
            <li>
              <Cpu size={18} aria-hidden /> <span>Funciona offline depois da primeira vez</span>
            </li>
          </ul>
        </section>

        <section className="lp-section">
          <header className="lp-head-row">
            <span className="lp-num">05</span>
            <h2>Perguntas</h2>
          </header>
          <dl className="lp-faq">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="lp-cta">
          <h2>Seu próximo Reels em poucos minutos.</h2>
          <button className="primary lp-cta-btn" onClick={toStart} disabled={busy}>
            <Upload size={17} aria-hidden /> Escolher vídeos
          </button>
        </section>
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
