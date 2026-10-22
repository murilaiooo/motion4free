import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { Captions, Check, Clapperboard, Cpu, FileVideo, Film, HardDrive, History, Layers, MessageSquareText, Move, RectangleVertical, Scissors, ShieldCheck, Upload, WandSparkles } from 'lucide-react';
import './landing.css';
import './clips.css';
import { PROCESSING_STEPS, processingStep } from '../core/steps';
import type { Progress } from '../core/progress';
import { ProgressView, useProgressClock } from './ProgressPanel';
import { listTemplates } from '../core/template-gallery';
import { APP_BUILT_AT, VERSION_LABEL } from '../version';
import { TemplateThumb } from './Templates';
import { Logo, SettingsButton } from './TopBar';

function Header(_: { onStorage?: () => void }) {
  return (
    <header className="land-nav">
      <a className="brand" href="./" aria-label="Motion4Free">
        <Logo />
        <span className="brand-name">Motion4Free</span>
      </a>
      <nav className="land-links">
        <a className="hide-sm" href="#como-funciona">Como funciona</a>
        <a href="?galeria">Modelos</a>
        <SettingsButton />
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
        </a>{' '}·{' '}<a href="licencas-runtime.txt" target="_blank" rel="noreferrer">bibliotecas</a>{' '}·{' '}<a href="asset-provenance.json" target="_blank" rel="noreferrer">proveniência</a>
      </span>
    </footer>
  );
}

/** Modelos da vitrine (bem diferentes entre si). */
const SHOWCASE = ['pop', 'podcast', 'cinema', 'neon', 'documental'];

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Film size={18} aria-hidden />, title: 'Clipes de vídeo longo', text: 'Solte um podcast, aula ou live de até 2 horas. O app acha os melhores momentos e entrega cada corte vertical, com legenda e pronto para postar.' },
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
  ['Dá para colar um link do YouTube?', 'Ainda não. O navegador não consegue baixar vídeo do YouTube, e os termos do YouTube só permitem baixar pelo próprio YouTube. Se o vídeo é seu, baixe no YouTube Studio e solte o arquivo no modo Clipes. Vídeo de outra pessoa, só com autorização dela.'],
  ['Funciona com vídeo gravado no celular?', 'Sim. MP4, MOV ou WebM, até 3 minutos por clipe no editor e até 2 horas no modo Clipes. O resultado sai em MP4, pronto para o Instagram.'],
];

export type LandingMode = 'editar' | 'clipes';

/** Modo Clipes: o app só trabalha com o arquivo (não baixa de links, ADR-0023); diz como consegui-lo. */
function FileHelp() {
  return (
    <div className="lp-link" data-testid="file-help">
      <p className="hint">Onde conseguir o arquivo do vídeo:</p>
      <ol>
        <li>
          <b>Vídeo seu no YouTube:</b> YouTube Studio → Conteúdo → três pontinhos do vídeo → <b>Baixar</b>.
        </li>
        <li>
          <b>Vídeo de outra pessoa:</b> peça o arquivo ao dono, junto com a autorização (muitos podcasts liberam cortes).
        </li>
        <li>
          <b>Live ou reunião gravada:</b> use o arquivo que o programa salvou no computador (OBS, Zoom, Meet, StreamYard…).
        </li>
      </ol>
    </div>
  );
}

export function Landing({
  onFile,
  busy,
  pendingName,
  pendingClipCount,
  notices,
  options,
  projects,
  onStorage,
  focusProjects = false,
  onProjectsFocused,
  mode = 'editar',
  onMode,
  onLongFile,
  clipResume,
  onStart,
}: {
  onFile: (files: File[]) => void;
  busy: boolean;
  pendingName: string | null;
  pendingClipCount?: number;
  notices: ReactNode;
  options?: ReactNode;
  projects?: ReactNode;
  onStorage?: () => void;
  focusProjects?: boolean;
  onProjectsFocused?: () => void;
  mode?: LandingMode;
  onMode?: (m: LandingMode) => void;
  onLongFile?: (file: File) => void;
  /** aviso "voltar aos clipes" quando há um trabalho de clipes aberto */
  clipResume?: ReactNode;
  onStart?: () => void;
}) {
  const [over, setOver] = useState(false);
  useEffect(() => {
    if (!focusProjects) return;
    const heading = document.getElementById('projects-title');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    onProjectsFocused?.();
  }, [focusProjects, projects, onProjectsFocused]);
  // projeto salvo esperando o vídeo original: a entrada é sempre a do editor
  const clips = mode === 'clipes' && !pendingName && !!onLongFile;
  const all = listTemplates();
  const examples = SHOWCASE.map((id) => all.find((t) => t.id === id)).filter((t) => t !== undefined);
  const hero = examples[0];
  const drop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer.files ? Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|webm|mkv)$/i)) : [];
    if (!files.length || busy) return;
    if (clips) onLongFile!(files[0]!);
    else onFile(files);
  };
  const toStart = () => {
    if (!clips && !pendingName && onStart) { onStart(); return; }
    document.getElementById('comecar')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelector<HTMLInputElement>('#comecar input[type="file"]')?.focus();
  };
  return (
    <div className="land lp">
      <Header onStorage={onStorage} />

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            {onMode && !pendingName && (
              <div className="lp-modes" role="group" aria-label="O que você quer fazer">
                <button aria-pressed={!clips} onClick={() => onMode('editar')} disabled={busy} data-testid="mode-edit">
                  <WandSparkles size={16} aria-hidden /> Editar meus vídeos
                </button>
                <button aria-pressed={clips} onClick={() => onMode('clipes')} disabled={busy} data-testid="mode-clips">
                  <Scissors size={16} aria-hidden /> Clipes de vídeo longo
                </button>
              </div>
            )}
            <p className="lp-kicker">
              <span className="lp-dot" aria-hidden /> {clips ? 'Criador de clipes · vídeos longos · no navegador' : 'Editor de vídeo para Reels · no navegador'}
            </p>
            {clips ? (
              <h1>
                Um vídeo longo.
                <br />
                <em>Vários clipes prontos.</em>
              </h1>
            ) : (
              <h1>
                Comece com uma ideia.
                <br />
                <em>Crie do seu jeito.</em>
              </h1>
            )}
            <p className="lp-lead">
              {clips
                ? 'Solte um podcast, aula, live ou entrevista de até 2 horas. O Motion4Free transcreve tudo, acha os melhores momentos e entrega cada corte vertical, com legenda e animação, pronto para postar. Você revê, ajusta e baixa.'
                : 'Defina o que você quer criar. Depois escolha seus vídeos e receba um primeiro rascunho com cortes, legendas e sua identidade. Assista, personalize ou exporte. Tudo no seu navegador.'}
            </p>

            {notices}
            {clipResume}

            {!clips && !pendingName && onStart && <div className="lp-creative-start"><button className="primary" onClick={onStart} disabled={busy} data-testid="start-creative"><WandSparkles size={18} aria-hidden /> Começar meu vídeo</button><p>Intenção → direção criativa → seus vídeos → primeiro rascunho</p></div>}

            <div className="lp-quick">
              {!clips && !pendingName && onStart && <p className="lp-quick-label">Ou solte os vídeos direto aqui: o app usa as últimas escolhas que você fez (ou as escolhas padrão).</p>}

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
                multiple={!clips}
                disabled={busy}
                data-testid={clips ? 'long-file-input' : 'file-input'}
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length) {
                    if (clips) onLongFile!(files[0]!);
                    else onFile(files);
                  }
                  e.currentTarget.value = '';
                }}
              />
              <span className="drop-icon" aria-hidden>
                {pendingName ? <FileVideo size={22} /> : <Upload size={22} />}
              </span>
              <span className="lp-drop-text">
                <span className="drop-title">{clips ? 'Escolher vídeo longo' : pendingName ? (pendingClipCount ? (pendingClipCount === 1 ? 'Selecione novamente o vídeo original deste projeto' : `Selecione novamente os ${pendingClipCount} vídeos originais`) : `Escolha de novo o vídeo original (${pendingName})`) : 'Escolher vídeos'}</span>
                <span className="drop-sub">{clips ? 'ou arraste aqui · de 2 min a 2 horas · MP4, MOV, WebM · use vídeos seus ou com autorização' : 'ou arraste aqui · até 30 clipes de até 3 min · MP4, MOV, WebM'}</span>
              </span>
            </label>
            </div>

            {clips && <FileHelp />}
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
                {(
                  [
                    ['Texto', 'c1', [[6, 22], [58, 16]]],
                    ['Legendas', 'c2', [0, 1, 2, 3, 4, 5, 6].map((i) => [2 + i * 14, 12])],
                    ['Vídeo', 'c3', [[0, 32], [33, 28], [62, 38]]],
                    ['Áudio', 'c4', [[0, 100]]],
                  ] as [string, string, number[][]][]
                ).map(([name, cls, bars]) => (
                  <div key={name} className="lp-track">
                    <b>{name}</b>
                    <div className="lp-lane">
                      {bars.map(([l, w]) => (
                        <span key={l} className={cls} style={{ left: `${l}%`, width: `${w}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="lp-track lp-head-track">
                  <b />
                  <div className="lp-lane">
                    <i className="lp-head" />
                  </div>
                </div>
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
              <b>Conte sua intenção</b>
              <p>Escolha propósito, formato, estilo e ritmo. O briefing orienta a edição; você pode rever as escolhas.</p>
            </li>
            <li>
              <b>Escolha seus vídeos</b>
              <p>O app transcreve e monta um rascunho com cortes e recursos compatíveis com sua direção. Nada da mídia é enviado.</p>
            </li>
            <li>
              <b>Assista, personalize ou exporte</b>
              <p>Confira a prévia e as observações. Baixe o MP4 ou refine cada detalhe no editor, com desfazer e versões.</p>
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

/** Tela de processamento: passos com o que já foi feito, o atual e o progresso detalhado da etapa (v0.23). */
export function Processing({ progress, fileName, title = 'Editando seu vídeo', note }: { progress: Progress; fileName: string | null; title?: string; note?: string }) {
  const step = processingStep(progress.label, progress.phase);
  const snap = useProgressClock(progress);
  return (
    <div className="land">
      <Header />
      <main className="processing">
        <div className="proc-card card" data-testid="processing">
          <div className="proc-head">
            <span className="proc-icon" aria-hidden>
              <WandSparkles size={22} />
            </span>
            <div>
              <h1>{title}</h1>
              {fileName && <p className="hint proc-file">{fileName}</p>}
            </div>
            <b className="proc-stage tnum">
              Etapa {step + 1} de {PROCESSING_STEPS.length}
            </b>
          </div>
          {snap && <ProgressView snap={snap} testId="processing-progress" />}
          <ol className="proc-steps">
            {PROCESSING_STEPS.map((s, i) => (
              <li key={s.id} className={i < step ? 'done' : i === step ? 'active' : ''}>
                <span className="proc-mark" aria-hidden>
                  {i < step ? <Check size={13} strokeWidth={3} /> : i === step ? <span className="spinner" /> : i + 1}
                </span>
                <span>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
          <p className="privacy">
            <Cpu size={15} aria-hidden /> Processando no seu aparelho. Na primeira vez o modelo de transcrição é baixado (uma vez só).
          </p>
          {note && <p className="hint">{note}</p>}
        </div>
      </main>
      <Footer />
    </div>
  );
}
