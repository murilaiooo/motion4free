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
      <span className="lp-foot-left">
        <span className="lp-foot-sign">feito para quem cria sozinho</span>
        <span data-testid="version" title={`Gerado em ${APP_BUILT_AT}`}>
          Motion4Free {VERSION_LABEL}
        </span>
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

type Feature = { icon: ReactNode; title: string; text: string };

/** O que o editor faz, em três grupos: o que é automático, o que a pessoa ajusta e o que fica com ela. */
const FEATURE_GROUPS: { note: string; title: string; items: Feature[] }[] = [
  {
    note: 'o trabalho chato',
    title: 'Ele faz sozinho',
    items: [
      { icon: <Scissors size={18} aria-hidden />, title: 'Corta as pausas', text: 'Tira silêncios, respiros e “éééé” longos sem cortar palavras. Você revê cada corte e devolve o que quiser.' },
      { icon: <Captions size={18} aria-hidden />, title: 'Legenda palavra por palavra', text: 'Transcrição no próprio aparelho, com a palavra falada em destaque. Clique numa palavra para corrigir.' },
      { icon: <Film size={18} aria-hidden />, title: 'Clipes de vídeo longo', text: 'Podcast, aula ou live de até 2 horas vira cortes verticais com começo, meio e fim.' },
      { icon: <Clapperboard size={18} aria-hidden />, title: 'Vários clipes, um vídeo', text: 'Solte até 30 clipes curtos. O app monta, corta e nivela o volume de todos.' },
    ],
  },
  {
    note: 'do seu jeito',
    title: 'Você ajusta',
    items: [
      { icon: <Layers size={18} aria-hidden />, title: 'Linha do tempo de verdade', text: 'Divida, apare, copie e reordene trechos. Camadas para textos, emojis e formas, com onda de áudio.' },
      { icon: <Move size={18} aria-hidden />, title: 'Arraste na prévia', text: 'Tire a legenda do rosto, mude o tamanho e encoste no centro com o ímã. Tudo volta com Ctrl+Z.' },
      { icon: <MessageSquareText size={18} aria-hidden />, title: 'Peça em português', text: '“Legenda amarela, mais rápido, gancho forte.” O app entende e diz quando ainda não sabe fazer.' },
      { icon: <RectangleVertical size={18} aria-hidden />, title: 'Qualquer formato', text: 'Reels 9:16, feed 4:5, quadrado ou YouTube 16:9. O enquadramento se ajusta e você corrige.' },
    ],
  },
  {
    note: 'sem pegadinha',
    title: 'Fica com você',
    items: [
      { icon: <History size={18} aria-hidden />, title: 'Versões e projetos', text: 'Salve versões, compare antes e depois e continue amanhã, do ponto em que parou.' },
      { icon: <ShieldCheck size={18} aria-hidden />, title: 'Seu vídeo, seu aparelho', text: 'Nada é enviado para servidor. Você vê e apaga o espaço que o app usa.' },
      { icon: <Check size={18} aria-hidden />, title: 'Sem marca d’água', text: 'O MP4 sai limpo, pronto para o Instagram, TikTok ou YouTube. Sem plano pago.' },
    ],
  },
];

const FAQ: [string, string][] = [
  ['É grátis mesmo?', 'Sim. Não tem plano pago, cadastro nem marca d’água. O processamento é feito pelo seu próprio computador, então não há servidor para pagar.'],
  ['Meu vídeo é enviado para algum lugar?', 'Não. O vídeo e tudo o que o app gera ficam neste aparelho. Você vê e apaga o espaço usado em Armazenamento.'],
  ['Preciso instalar alguma coisa?', 'Não. Funciona no Chrome, no Edge ou no Brave, no computador. Na primeira vez o app baixa o modelo de transcrição, uma vez só.'],
  ['Dá para colar um link do YouTube?', 'Ainda não. O navegador não consegue baixar vídeo do YouTube, e os termos do YouTube só permitem baixar pelo próprio YouTube. Se o vídeo é seu, baixe no YouTube Studio e solte o arquivo no modo Clipes. Vídeo de outra pessoa, só com autorização dela.'],
  ['Funciona com vídeo gravado no celular?', 'Sim. MP4, MOV ou WebM, até 3 minutos por clipe no editor e até 2 horas no modo Clipes. O resultado sai em MP4, pronto para o Instagram.'],
];

/** Título com a palavra "marcada" como na legenda: o marca-texto amarelo passa por ela. */
function Marked({ children }: { children: ReactNode }) {
  return <mark className="lp-mark">{children}</mark>;
}

/** Celular da primeira dobra: um modelo tocando ao vivo, com anotações à mão do que o app fez. */
function HeroPhone({ styleId }: { styleId: string }) {
  return (
    <figure className="lp-phone-wrap" aria-hidden>
      <span className="lp-phone">
        <span className="lp-phone-notch" />
        <TemplateThumb styleId={styleId} t={4.6} width={232} playing />
      </span>
      <span className="lp-note n1">
        pausas cortadas sozinho
        <svg viewBox="0 0 80 40" className="lp-arrow"><path d="M2 8 C 30 4, 54 12, 74 32" /><path d="M64 31 L75 33 L72 22" /></svg>
      </span>
      <span className="lp-note n2">
        <svg viewBox="0 0 80 40" className="lp-arrow"><path d="M78 30 C 50 34, 24 26, 6 8" /><path d="M8 19 L5 7 L16 9" /></svg>
        legenda palavra por palavra
      </span>
      <span className="lp-note n3">
        MP4 pronto, sem marca d’água
        <svg viewBox="0 0 80 40" className="lp-arrow"><path d="M4 30 C 28 36, 52 24, 72 6" /><path d="M61 6 L73 5 L71 17" /></svg>
      </span>
    </figure>
  );
}

/** Exemplo do caminho "Editar": vários clipes que se juntam num vídeo só. */
function ClipsToVideoDemo() {
  return (
    <span className="ctv">
      <span className="ctv-in">
        <i className="a" />
        <i className="b" />
        <i className="c" />
      </span>
      <span className="ctv-out">
        <i />
        <b>Aa</b>
      </span>
    </span>
  );
}

export type LandingMode = 'editar' | 'clipes';

/** Exemplo animado do modo Clipes: um vídeo longo vira três clipes verticais. */
function LongToClipsDemo() {
  return (
    <span className="ltc">
      <span className="ltc-long">
        <i className="ltc-hit a" />
        <i className="ltc-hit b" />
        <i className="ltc-hit c" />
        <i className="ltc-head" />
      </span>
      <span className="ltc-clips">
        <i className="ltc-clip a"><b>1</b></i>
        <i className="ltc-clip b"><b>2</b></i>
        <i className="ltc-clip c"><b>3</b></i>
      </span>
    </span>
  );
}

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
}) {
  const [over, setOver] = useState<LandingMode | null>(null);
  useEffect(() => {
    if (!focusProjects) return;
    const heading = document.getElementById('projects-title');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'instant' });
    onProjectsFocused?.();
  }, [focusProjects, projects, onProjectsFocused]);
  // "Como funciona" acompanha o caminho escolhido (abas na própria seção)
  const clips = mode === 'clipes' && !pendingName && !!onLongFile;
  const all = listTemplates();
  const examples = SHOWCASE.map((id) => all.find((t) => t.id === id)).filter((t) => t !== undefined);
  const hero = examples[0];
  const videosOf = (list: FileList | null) => (list ? Array.from(list).filter((f) => f.type.startsWith('video/') || f.name.match(/\.(mp4|mov|webm|mkv)$/i)) : []);
  const dropOn = (kind: LandingMode) => ({
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setOver(kind);
    },
    onDragLeave: () => setOver(null),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      setOver(null);
      const files = videosOf(e.dataTransfer.files);
      if (!files.length || busy) return;
      if (kind === 'clipes' && onLongFile) onLongFile(files[0]!);
      else onFile(files);
    },
  });
  const toStart = () => {
    document.getElementById('comecar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.querySelector<HTMLInputElement>('#comecar input[type="file"]')?.focus();
  };
  return (
    <div className="land lp">
      <Header onStorage={onStorage} />

      <main>
        <section className="lp-start" id="comecar">
          <div className="lp-hero-grid">
            <div className="lp-start-intro">
              <p className="lp-kicker">
                <span className="lp-dot" aria-hidden /> Seu estúdio de bolso · grátis · sem cadastro
              </p>
              <h1>
                {pendingName ? (
                  <>Continue <Marked>seu projeto.</Marked></>
                ) : (
                  <>
                    Grave do seu jeito. <span className="lp-h1-soft">O resto sai com <Marked>cara de estúdio.</Marked></span>
                  </>
                )}
              </h1>
              <p className="lp-lead">
                {pendingName
                  ? 'Suas edições estão guardadas. Só falta escolher de novo o vídeo original.'
                  : 'Escolha por onde começar. O app corta as pausas, escreve a legenda e anima tudo, e você muda o que quiser depois.'}
              </p>

              {notices}
              {clipResume}

              {pendingName ? (
                <label className={`dropzone lp-drop ${over ? 'over' : ''} ${busy ? 'disabled' : ''}`} {...dropOn('editar')}>
                  <input className="sr-only" type="file" accept="video/*" multiple disabled={busy} data-testid="file-input" onChange={(e) => { const files = e.target.files ? Array.from(e.target.files) : []; if (files.length) onFile(files); e.currentTarget.value = ''; }} />
                  <span className="drop-icon" aria-hidden><FileVideo size={22} /></span>
                  <span className="lp-drop-text">
                    <span className="drop-title">{pendingClipCount ? (pendingClipCount === 1 ? 'Selecione novamente o vídeo original deste projeto' : `Selecione novamente os ${pendingClipCount} vídeos originais`) : `Escolha de novo o vídeo original (${pendingName})`}</span>
                    <span className="drop-sub">ou arraste aqui</span>
                  </span>
                </label>
              ) : (
                <div className="lp-paths">
                  <article className={`lp-path edit ${over === 'editar' ? 'over' : ''}`} data-testid="path-edit">
                    <label className={`lp-path-main ${busy ? 'disabled' : ''}`} {...dropOn('editar')}>
                      <input className="sr-only" type="file" accept="video/*" multiple disabled={busy} data-testid="file-input" onChange={(e) => { const files = e.target.files ? Array.from(e.target.files) : []; if (files.length) onFile(files); e.currentTarget.value = ''; }} />
                      <span className="lp-path-art" aria-hidden><ClipsToVideoDemo /></span>
                      <span className="lp-path-body">
                        <span className="lp-path-tag">Reels, TikTok e Shorts</span>
                        <strong>Editar meus vídeos</strong>
                        <span className="lp-path-text">Um vídeo ou vários clipes curtos viram um vídeo pronto, com pausas cortadas, legenda e animação.</span>
                        <span className="btn primary lp-path-btn"><Upload size={17} aria-hidden /> Escolher vídeos</span>
                        <span className="lp-path-sub">ou arraste aqui · até 30 clipes de até 3 min</span>
                      </span>
                    </label>
                  </article>
                  {onLongFile && (
                    <article className={`lp-path clips ${over === 'clipes' ? 'over' : ''}`} data-testid="path-clips">
                      <label className={`lp-path-main ${busy ? 'disabled' : ''}`} {...dropOn('clipes')}>
                        <input className="sr-only" type="file" accept="video/*" disabled={busy} data-testid="long-file-input" onChange={(e) => { const file = e.target.files?.[0]; if (file) onLongFile(file); e.currentTarget.value = ''; }} />
                        <span className="lp-path-art" aria-hidden><LongToClipsDemo /></span>
                        <span className="lp-path-body">
                          <span className="lp-path-tag">Podcast, aula, live</span>
                          <strong>Cortar um vídeo longo em clipes</strong>
                          <span className="lp-path-text">O app ouve o vídeo inteiro, acha os melhores momentos e entrega cada corte vertical com legenda.</span>
                          <span className="btn lp-path-btn"><Upload size={17} aria-hidden /> Escolher vídeo longo</span>
                          <span className="lp-path-sub">ou arraste aqui · de 2 min a 2 h · vídeos seus ou com autorização</span>
                        </span>
                      </label>
                      <div className="lp-path-extra">
                        {options}
                        <details className="lp-path-help">
                          <summary>Onde conseguir o arquivo do vídeo?</summary>
                          <FileHelp />
                        </details>
                      </div>
                    </article>
                  )}
                </div>
              )}

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
            {hero && <HeroPhone styleId={hero.id} />}
          </div>
        </section>

        {projects && <section className="lp-section lp-projects">{projects}</section>}

        <section className="lp-section" id="como-funciona">
          <header className="lp-head-row">
            <span className="lp-hand">três passos, sem mistério</span>
            <h2>Como funciona</h2>
            {onMode && !pendingName && (
              <div className="lp-modes" role="group" aria-label="Ver como funciona">
                <button aria-pressed={!clips} onClick={() => onMode('editar')} data-testid="mode-edit">
                  <WandSparkles size={16} aria-hidden /> Editar meus vídeos
                </button>
                <button aria-pressed={clips} onClick={() => onMode('clipes')} data-testid="mode-clips">
                  <Scissors size={16} aria-hidden /> Vídeo longo em clipes
                </button>
              </div>
            )}
          </header>
          {clips ? (
            <ol className="lp-steps">
              <li>
                <b>Solte o vídeo longo</b>
                <p>Podcast, aula, live ou entrevista de 2 minutos a 2 horas. O arquivo fica no seu computador.</p>
              </li>
              <li>
                <b>O app acha os melhores momentos</b>
                <p>Transcreve tudo, mede a energia da voz e sugere os trechos com começo, meio e fim, cada um com nota e motivo.</p>
              </li>
              <li>
                <b>Revise e baixe os clipes</b>
                <p>Escolha a duração, ajuste o começo e o fim, baixe um por um ou todos de uma vez, ou abra um clipe no editor.</p>
              </li>
            </ol>
          ) : (
            <ol className="lp-steps">
              <li>
                <b>Escolha seus vídeos</b>
                <p>Um vídeo ou até 30 clipes curtos. O app começa a preparar na hora, sem enviar nada para a internet.</p>
              </li>
              <li>
                <b>Responda enquanto ele prepara</b>
                <p>Onde vai publicar, visual, legendas e cortes, com exemplos animados. Na próxima vez, é só confirmar.</p>
              </li>
              <li>
                <b>Assista, ajuste e baixe</b>
                <p>O primeiro rascunho abre pronto. Baixe o MP4 ou mude qualquer detalhe no editor, com desfazer e versões.</p>
              </li>
            </ol>
          )}
        </section>

        <section className="lp-section">
          <header className="lp-head-row">
            <span className="lp-hand">automático no começo, manual quando quiser</span>
            <h2>Tudo o que o editor faz</h2>
          </header>
          <div className="lp-groups">
            {FEATURE_GROUPS.map((g) => (
              <div key={g.title} className="lp-group">
                <p className="lp-group-note">{g.note}</p>
                <h3>{g.title}</h3>
                <ul>
                  {g.items.map((f) => (
                    <li key={f.title} className="lp-feature">
                      <span className="lp-ico">{f.icon}</span>
                      <span>
                        <b>{f.title}</b>
                        <span>{f.text}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-section lp-models">
          <header className="lp-head-row">
            <span className="lp-hand">tocando ao vivo, no seu navegador</span>
            <h2>Escolha a cara do seu vídeo</h2>
            <p>
              15 estilos de legenda e animação para cada tipo de criador. <a href="?galeria">Ver todos os modelos</a>
            </p>
          </header>
          <div className="lp-reel">
            {examples.map((t, i) => (
              <figure key={t.id}>
                <span className="lp-mini-phone">
                  <TemplateThumb styleId={t.id} t={[1.3, 22.1, 4.6, 12.2, 8.4][i] ?? 1.3} width={180} />
                </span>
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
            <span className="lp-hand">promessa</span>
            <h2>Seu vídeo não sai daqui.</h2>
            <p>Transcrição, edição e exportação acontecem no seu computador. Não há upload, conta nem servidor guardando o que você grava.</p>
          </div>
          <ul>
            <li>
              <ShieldCheck size={20} aria-hidden /> <span>Nenhum envio de vídeo ou áudio</span>
            </li>
            <li>
              <HardDrive size={20} aria-hidden /> <span>Você vê e apaga o espaço usado</span>
            </li>
            <li>
              <Cpu size={20} aria-hidden /> <span>Funciona offline depois da primeira vez</span>
            </li>
          </ul>
        </section>

        <section className="lp-section">
          <header className="lp-head-row">
            <span className="lp-hand">o que todo mundo pergunta</span>
            <h2>Perguntas</h2>
          </header>
          <div className="lp-faq">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-cta">
          <span className="lp-hand">bora?</span>
          <h2>Seu próximo vídeo começa <Marked>agora.</Marked></h2>
          <button className="primary lp-cta-btn" onClick={toStart} disabled={busy}>
            <Upload size={17} aria-hidden /> Escolher meus vídeos
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
