import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleCheck } from 'lucide-react';
import { AppError } from '../../core/errors';
import { FORMAT_IDS, OUTPUT_FORMATS } from '../../core/formats';
import { creativeSetupSchema, PLATFORM_LABELS, type CreativeSetup } from '../../core/production';
import { TEMPLATE_NAMES, type TemplateId } from '../../core/templates';
import { ErrorBox } from '../ErrorBox';
import { ProgressPanel } from '../ProgressPanel';
import type { Progress } from '../../core/progress';
import { Logo, SettingsButton } from '../TopBar';
import { SetupAdjustments } from './SetupAdjustments';
import { SetupChoices, type SetupChoice } from './SetupChoices';
import { CaptionDemo, CutDemo, DurationDemo, FormatDemo, StyleDemo, type CutMode } from './SetupDemos';
import './production.css';

const STEPS = [
  { id: 'platform', label: 'Destino', title: 'Onde você vai publicar?', description: 'O vídeo já sai no formato certo para esse lugar.' },
  { id: 'style', label: 'Visual', title: 'Qual visual você prefere?', description: 'Os exemplos se mexem como no vídeo pronto: títulos, destaques e legendas.' },
  { id: 'captions', label: 'Legendas', title: 'Como quer as legendas?', description: 'A fala vira legenda sincronizada. Escolha como o texto aparece.' },
  { id: 'editing', label: 'Cortes', title: 'Quanto cortar?', description: 'O app tira as pausas sem trocar palavras nem mudar a ordem da fala. Escolha também a duração.' },
  { id: 'review', label: 'Pronto', title: 'Tudo certo? Confira e crie.', description: 'Estas escolhas montam o primeiro rascunho. No editor você ainda muda tudo.' },
] as const;
type SetupStep = typeof STEPS[number]['id'];

const EDITING_MODES: (SetupChoice & { id: CutMode; settings: Pick<CreativeSetup, 'cutPolicy' | 'pace' | 'tone' | 'motion'> })[] = [
  { id: 'preserve', label: 'Sem cortes', description: 'Mantém a gravação inteira, incluindo as pausas.', detail: 'Para preservar uma explicação ou depoimento completo.', settings: { cutPolicy: 'preserve', pace: 'lento', tone: 'calmo', motion: 0.15 } },
  { id: 'natural', label: 'Natural', description: 'Remove só as pausas longas. Usa poucos destaques e movimento sutil nos textos.', detail: 'Para conversas, relatos e conteúdo mais tranquilo.', settings: { cutPolicy: 'gentle', pace: 'lento', tone: 'calmo', motion: 0.2 } },
  { id: 'direct', label: 'Direto', description: 'Encurta as pausas com cuidado e equilibra os destaques na tela.', detail: 'Para dicas, tutoriais e conteúdo do dia a dia.', settings: { cutPolicy: 'balanced', pace: 'normal', tone: 'calmo', motion: 0.35 } },
  { id: 'dynamic', label: 'Dinâmico', description: 'Encurta as pausas e usa destaques visuais mais frequentes e marcantes.', detail: 'Para uma apresentação com mais energia.', settings: { cutPolicy: 'balanced', pace: 'rapido', tone: 'energetico', motion: 0.65 } },
];
const STYLE_OPTIONS: { id: TemplateId; description: string; detail: string }[] = [
  { id: 'editorial', description: 'Títulos com serifa e composição limpa.', detail: 'Dicas, opiniões e conteúdo pessoal.' },
  { id: 'documental', description: 'Painéis escuros e títulos sóbrios.', detail: 'Explicações, entrevistas e negócios.' },
  { id: 'pop', description: 'Textos grandes e alto contraste.', detail: 'Conteúdo expressivo e chamadas em destaque.' },
  { id: 'minimal', description: 'Poucos elementos disputando atenção.', detail: 'Quando a imagem e a fala são o foco.' },
  { id: 'cinema', description: 'Títulos e composição cinematográficos.', detail: 'Relatos, histórias e apresentações.' },
  { id: 'podcast', description: 'Destaques visuais para trechos de conversa.', detail: 'Podcasts e entrevistas.' },
];
const PLATFORM_DESCRIPTIONS: Record<CreativeSetup['platform'], string> = {
  reels: 'Vídeo vertical para o Reels do Instagram.', tiktok: 'Vídeo vertical para o TikTok.', shorts: 'Vídeo vertical para o Shorts do YouTube.',
  youtube: 'Vídeo horizontal para assistir em tela ampla.', feed: 'Vídeo em retrato para o feed e anúncios.', other: 'Escolha o formato que quiser no próximo ajuste.',
};
const captionLabel = (setup: CreativeSetup) => setup.captionStyle === 'highlight' ? 'Palavra em destaque' : 'Discreta';
const durationLabel = (setup: CreativeSetup) => setup.durationSec ? `${setup.durationSec} segundos` : 'Vídeo completo';
const editingMode = (setup: CreativeSetup) => EDITING_MODES.find(mode => Object.entries(mode.settings).every(([key, expected]) => setup[key as keyof CreativeSetup] === expected));
const editingLabel = (setup: CreativeSetup) => editingMode(setup)?.label ?? 'Personalizada';

export function ProductionHeader({ onBack, backLabel = 'Voltar' }: { onBack: () => void; backLabel?: string }) {
  return <header className="production-header"><button className="ghost" onClick={onBack}><ArrowLeft size={16} aria-hidden /> {backLabel}</button><span className="brand"><Logo size={24} /> Motion4Free</span><SettingsButton /></header>;
}

export function SetupSummary({ setup }: { setup: CreativeSetup }) {
  return <dl className="setup-summary">
    <div><dt>Destino</dt><dd>{PLATFORM_LABELS[setup.platform]} · {OUTPUT_FORMATS[setup.format].ratio}</dd></div>
    <div><dt>Edição</dt><dd>{editingLabel(setup)} · {durationLabel(setup).toLowerCase()}</dd></div>
    <div><dt>Visual</dt><dd>{TEMPLATE_NAMES[setup.preset]}</dd></div>
    <div><dt>Legendas</dt><dd>{captionLabel(setup)} · {setup.font}</dd></div>
  </dl>;
}

/** Preparo dos vídeos que roda enquanto o usuário responde (v0.32): progresso, pronto ou nada. */
export type SetupPrep = { fileLabel: string; progress: Progress | null; ready: boolean };

export function CreativeSetupScreen({ value, onChange, onComplete, onBack, revision = false, prep, startAtReview = false }: {
  value: CreativeSetup; onChange: (setup: CreativeSetup) => void; onComplete: (setup: CreativeSetup) => void; onBack: () => void; revision?: boolean;
  /** v0.32: os vídeos já foram escolhidos e estão sendo preparados enquanto as perguntas aparecem */
  prep?: SetupPrep;
  /** v0.32: quem já usou o app começa no resumo ("usar as mesmas escolhas") */
  startAtReview?: boolean;
}) {
  const steps = STEPS.filter(step => !revision || step.id !== 'editing');
  const [stepId, setStepId] = useState<SetupStep>(startAtReview ? 'review' : 'platform');
  const [returning] = useState(startAtReview);
  const [error, setError] = useState<AppError | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const stepIndex = steps.findIndex(step => step.id === stepId);
  const step = steps[stepIndex]!;
  const last = stepId === 'review';
  const patch = (changes: Partial<CreativeSetup>) => { setError(null); onChange({ ...value, ...changes }); };
  useLayoutEffect(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'nearest' }); }, [stepId]);
  const complete = () => {
    const parsed = creativeSetupSchema.safeParse(value);
    if (!parsed.success) {
      setStepId('review');
      setError(new AppError('BRIEF_INVALIDO', parsed.error.issues.some(issue => issue.path[0] === 'cta') ? 'Confira a chamada final nos ajustes opcionais: use de 2 a 32 caracteres, sem emojis.' : 'Confira suas escolhas antes de continuar.'));
      return;
    }
    onComplete(parsed.data);
  };
  const recap: { label: string; value: string; step: SetupStep }[] = [
    { label: 'Destino', value: `${PLATFORM_LABELS[value.platform]} · ${OUTPUT_FORMATS[value.format].ratio}`, step: 'platform' },
    { label: 'Visual', value: TEMPLATE_NAMES[value.preset], step: 'style' },
    { label: 'Legendas', value: `${captionLabel(value)} · ${value.font}`, step: 'captions' },
    { label: 'Cortes', value: `${editingLabel(value)} · ${durationLabel(value).toLowerCase()}`, step: 'editing' },
  ];
  const title = last && returning && !revision ? 'Usar as mesmas escolhas da última vez?' : step.title;
  const description = last && returning && !revision ? 'Guardamos o que você escolheu antes. Toque em “Alterar” para mudar só um item.' : step.description;
  const finalLabel = revision ? 'Aplicar escolhas' : prep?.ready ? 'Ver meu vídeo' : 'Criar meu vídeo';
  return <div className="production-page">
    <ProductionHeader onBack={onBack} backLabel={revision ? 'Cancelar' : 'Início'} />
    <main className="setup-shell" data-testid="setup-shell">
      {prep && <div className={`setup-prep ${prep.ready ? 'ready' : ''}`} data-testid="setup-prep" role="status">
        {prep.ready
          ? <p><CircleCheck size={18} aria-hidden /> <b>{prep.fileLabel}</b> {prep.fileLabel.includes(' vídeos') ? 'prontos' : 'pronto'}. Termine as escolhas e veja o resultado.</p>
          : <><p className="setup-prep-lead">Preparando <b>{prep.fileLabel}</b> enquanto você escolhe. Não precisa esperar.</p>{prep.progress && <ProgressPanel progress={prep.progress} compact testId="setup-prep-progress" />}</>}
      </div>}
      <nav className="setup-navigation" aria-label="Etapas da configuração"><ol>{steps.map((item, index) => <li key={item.id}><button type="button" aria-label={item.label} aria-current={stepId === item.id ? 'step' : undefined} onClick={() => setStepId(item.id)}><span aria-hidden>{index < stepIndex ? <Check size={14} /> : index + 1}</span>{item.label}</button></li>)}</ol></nav>
      <section className="setup-content" aria-label="Configuração do vídeo">
        <div className="setup-step-heading"><p className="setup-step-count">Etapa {stepIndex + 1} de {steps.length} <span>Suas escolhas ficam guardadas neste aparelho</span></p><h1 ref={heading} tabIndex={-1}>{title}</h1><p>{description}</p></div>
        {error && <ErrorBox error={error} kind="error" onDismiss={() => setError(null)} />}
        {stepId === 'platform' && <>
          <SetupChoices label="Destino do vídeo" className="setup-destinations" value={value.platform} onSelect={platform => patch({ platform: platform as CreativeSetup['platform'], format: platform === value.platform ? value.format : platform === 'youtube' ? 'horizontal' : platform === 'feed' ? 'retrato' : platform === 'other' ? value.format : 'vertical' })} options={Object.entries(PLATFORM_LABELS).map(([platform, label]) => {
            const format = platform === 'youtube' ? 'horizontal' : platform === 'feed' ? 'retrato' : 'vertical';
            return { id: platform, label, description: PLATFORM_DESCRIPTIONS[platform as CreativeSetup['platform']], visual: <FormatDemo format={platform === 'other' ? value.format : format} />, detail: platform === 'other' ? 'Vertical, horizontal, quadrado ou retrato' : `${OUTPUT_FORMATS[format].ratio} · ${OUTPUT_FORMATS[format].width} × ${OUTPUT_FORMATS[format].height}` };
          })} />
          {value.platform === 'other' && <div className="setup-format-adjust"><p className="setup-format-label">Qual formato?</p><SetupChoices label="Formato de saída" className="setup-small-choices" value={value.format} onSelect={format => patch({ format: format as CreativeSetup['format'] })} options={FORMAT_IDS.map(format => ({ id: format, label: OUTPUT_FORMATS[format].label, description: OUTPUT_FORMATS[format].ratio, visual: <FormatDemo format={format} /> }))} /></div>}
          <p className="setup-explanation" data-testid="setup-output-format">Saída: <strong>{OUTPUT_FORMATS[value.format].label} · {OUTPUT_FORMATS[value.format].ratio}</strong>. O app reenquadra o vídeo sozinho, e você pode trocar o formato depois no editor.</p>
        </>}
        {stepId === 'editing' && <>
          <SetupChoices label="Modo de edição" className="setup-editing-choices" value={editingMode(value)?.id ?? ''} onSelect={id => patch(EDITING_MODES.find(mode => mode.id === id)!.settings)} options={EDITING_MODES.map(mode => ({ ...mode, visual: <CutDemo mode={mode.id} /> }))} />
          {!editingMode(value) && <p className="setup-feedback" data-testid="setup-custom-mode">Você tem ajustes personalizados. Eles serão mantidos; só mudam se escolher outro modo.</p>}
          <p className="setup-explanation">No exemplo, as tesouras marcam as pausas que saem e as estrelas, os destaques na tela. A voz não é acelerada e nenhuma palavra é trocada.</p>
          <h2 className="setup-subtitle">Quanto deve durar?</h2>
          <SetupChoices label="Duração do vídeo" className="setup-duration-choices" value={value.durationSec?.toString() ?? 'full'} onSelect={duration => patch({ durationSec: duration === 'full' ? null : Number(duration) })} options={[
            { id: 'full', label: 'Vídeo completo', description: 'Sem limite. Fica tudo, só sem as pausas escolhidas acima.', visual: <DurationDemo seconds={null} /> },
            ...[15, 30, 60, 90, 180].map(duration => ({ id: String(duration), label: `${duration} segundos`, description: `Termina perto de ${duration} s, no fim de uma frase.`, visual: <DurationDemo seconds={duration} /> })),
          ]} />
          <p className="setup-explanation">O limite não escolhe os “melhores momentos”: ele encerra no fim de uma frase perto do tempo pedido. Para achar os melhores trechos de um vídeo longo, use “Cortar um vídeo longo em clipes” na tela inicial.</p>
          {value.cutPolicy === 'preserve' && value.durationSec && <p className="setup-feedback">“Sem cortes” preserva as pausas. O limite de {value.durationSec} segundos ainda pode encerrar o vídeo antes do fim.</p>}
        </>}
        {stepId === 'style' && <>
          <SetupChoices label="Visual do vídeo" className="setup-visual-choices" value={value.preset} onSelect={preset => patch({ preset: preset as TemplateId })} options={[
            ...STYLE_OPTIONS,
            ...(!STYLE_OPTIONS.some(option => option.id === value.preset) ? [{ id: value.preset, description: 'Seu modelo salvo foi mantido.', detail: 'Selecione outro apenas se quiser mudar.' }] : []),
          ].map(option => ({ ...option, label: TEMPLATE_NAMES[option.id], visual: <StyleDemo styleId={option.id} selected={value.preset === option.id} /> }))} />
          <p className="setup-explanation">O fundo é só ilustrativo: no seu vídeo aparece a sua gravação. No editor há mais 9 modelos e você pode trocar a qualquer momento.</p>
        </>}
        {stepId === 'captions' && <SetupChoices label="Estilo das legendas" className="setup-caption-choices" value={value.captionStyle} onSelect={captionStyle => patch({ captionStyle: captionStyle as CreativeSetup['captionStyle'] })} options={[
          { id: 'highlight', label: 'Palavra em destaque', description: 'As palavras entram uma a uma, no ritmo da voz. A palavra falada muda de cor e cresce.', detail: 'Para prender a atenção e acompanhar a fala.', visual: <CaptionDemo style="highlight" accent={value.accent} /> },
          { id: 'minimal', label: 'Discreta', description: 'A frase aparece inteira, sem animação. Só a cor acompanha a palavra falada.', detail: 'Para uma leitura tranquila, com menos movimento.', visual: <CaptionDemo style="minimal" accent={value.accent} /> },
        ]} />}
        {last && <>
          <div className="setup-review" data-testid="setup-review">{recap.filter(item => !revision || item.step !== 'editing').map(item => <div key={item.step}><span><small>{item.label}</small><strong>{item.value}</strong></span><button type="button" className="ghost" aria-label={`Alterar ${item.label.toLowerCase()}`} onClick={() => setStepId(item.step)}>Alterar <ArrowRight size={16} aria-hidden /></button></div>)}</div>
          <p className="setup-explanation">O áudio original acompanha os cortes. Música, textos e emojis você adiciona no editor, se quiser.</p>
          <SetupAdjustments value={value} onChange={patch} callError={!!error && !creativeSetupSchema.shape.cta.safeParse(value.cta).success} />
        </>}
        {revision && <p className="setup-feedback">Esta revisão muda o visual e o formato. Seus cortes, duração, legendas corrigidas e elementos manuais são preservados. Você pode desfazer a alteração.</p>}
      </section>
      <footer className="setup-actions"><button className="ghost" data-testid="setup-back" onClick={stepIndex && !(returning && last) ? () => setStepId(steps[stepIndex - 1]!.id) : onBack}><ArrowLeft size={18} aria-hidden /> {stepIndex && !(returning && last) ? 'Voltar' : revision ? 'Cancelar' : 'Início'}</button>{!last && <button className="ghost setup-use-defaults" data-testid="setup-skip" onClick={complete}>{revision ? 'Aplicar agora' : 'Pular perguntas'}</button>}{last ? <button className="primary" data-testid="setup-complete" onClick={complete}>{finalLabel} <ArrowRight size={18} aria-hidden /></button> : <button className="primary" data-testid="setup-next" onClick={() => setStepId(steps[stepIndex + 1]!.id)}>Próximo: {steps[stepIndex + 1]!.label} <ArrowRight size={18} aria-hidden /></button>}</footer>
    </main>
  </div>;
}
