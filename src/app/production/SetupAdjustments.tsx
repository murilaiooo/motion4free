import { useEffect, useId, useRef, useState } from 'react';
import { LABELS } from '../../core/brief';
import type { CreativeSetup } from '../../core/production';
import { SetupChoices } from './SetupChoices';
import { HookDemo, MotionDemo, TransitionDemo } from './SetupDemos';

const COLORS = [
  { id: '#FFD400', label: 'Amarelo' }, { id: '#FFFFFF', label: 'Branco' }, { id: '#55BBFF', label: 'Azul' },
  { id: '#66DD99', label: 'Verde' }, { id: '#FF9955', label: 'Laranja' }, { id: '#FF88BB', label: 'Rosa' },
];
const CALLS = ['', 'Siga para mais', 'Salve para ver depois', 'Saiba mais no link'];
const FONTS: CreativeSetup['font'][] = ['Inter', 'DM Sans', 'Montserrat', 'IBM Plex Sans', 'Anton', 'Instrument Serif'];

export function SetupAdjustments({ value, onChange, callError = false }: { value: CreativeSetup; onChange: (changes: Partial<CreativeSetup>) => void; callError?: boolean }) {
  const [customCall, setCustomCall] = useState(!CALLS.includes(value.cta));
  const root = useRef<HTMLDetailsElement>(null);
  const callSection = useRef<HTMLDetailsElement>(null);
  const callInput = useRef<HTMLInputElement>(null);
  const callHintId = useId();
  useEffect(() => {
    if (!callError) return;
    if (root.current) root.current.open = true;
    if (callSection.current) callSection.current.open = true;
    callInput.current?.focus();
  }, [callError]);
  return <details ref={root} className="setup-adjustments">
    <summary>Ajustes opcionais</summary>
    <p>O vídeo já pode ser criado com as escolhas acima. Abra apenas o que quiser personalizar.</p>
    <details ref={callSection}><summary>Abertura e chamada final</summary><div className="setup-adjustment-content">
      <h3>Abertura</h3>
      <SetupChoices label="Título de abertura" className="setup-demo-choices" value={String(value.hook)} onSelect={hook => onChange({ hook: hook === 'true' })} options={[
        { id: 'true', label: 'Destacar uma frase', description: 'Usa uma frase real da gravação como título. Não reordena a fala.', visual: <HookDemo hook /> },
        { id: 'false', label: 'Sem título de abertura', description: 'Começa direto na gravação, sem título automático.', visual: <HookDemo hook={false} /> },
      ]} />
      <h3>Chamada final</h3>
      <SetupChoices label="Chamada final" value={customCall ? 'custom' : value.cta} onSelect={cta => { setCustomCall(cta === 'custom'); if (cta !== 'custom') onChange({ cta }); }} options={[
        { id: '', label: 'Automática', description: 'Usa a chamada definida na edição, quando houver.' },
        ...CALLS.slice(1).map(cta => ({ id: cta, label: cta, description: 'Mostra este texto no encerramento.' })),
        { id: 'custom', label: 'Escrever outra', description: 'Use seu próprio texto, com até 32 caracteres.' },
      ]} />
      {customCall && <label className="setup-input">Texto da chamada final<input ref={callInput} aria-invalid={callError || undefined} aria-describedby={callHintId} maxLength={32} value={value.cta} onChange={event => onChange({ cta: event.target.value })} /><span id={callHintId}>Quando preencher, use de 2 a 32 caracteres, sem emojis.</span></label>}
    </div></details>
    <details><summary>Cores e fonte</summary><div className="setup-adjustment-content">
      <h3>Cor de destaque</h3>
      <SetupChoices label="Cor de destaque" className="setup-small-choices" value={value.accent} onSelect={accent => onChange({ accent })} options={COLORS.map(color => ({ ...color, description: 'Palavra falada e detalhes.', visual: <span className="setup-color-swatch" style={{ background: color.id }} /> }))} />
      <label className="setup-input">Outra cor<input type="color" value={value.accent} onChange={event => onChange({ accent: event.target.value.toUpperCase() })} /></label>
      <h3>Fonte das legendas</h3>
      <SetupChoices label="Fonte das legendas" className="setup-small-choices" value={value.font} onSelect={font => onChange({ font: font as CreativeSetup['font'] })} options={[...new Set([...FONTS, value.font])].map(font => ({ id: font, label: font, description: 'Altera a letra das legendas.' }))} />
    </div></details>
    <details><summary>Movimento e transições</summary><div className="setup-adjustment-content">
      <h3>Movimento</h3>
      <SetupChoices label="Intensidade do movimento" className="setup-demo-choices" value={String(value.motion)} onSelect={motion => onChange({ motion: Number(motion) })} options={[
        { id: '0', label: 'Sem movimento', description: 'Desliga zoom, transições e animações fortes.', visual: <MotionDemo motion={0} /> },
        { id: '0.2', label: 'Sutil', description: 'Animações contidas para não disputar com a fala.', visual: <MotionDemo motion={0.2} /> },
        { id: '0.65', label: 'Marcante', description: 'Mais presença nas animações dos textos.', visual: <MotionDemo motion={0.65} /> },
      ]} />
      {![0, 0.2, 0.65].includes(value.motion) && <p>Intensidade personalizada mantida: {Math.round(value.motion * 100)}%.</p>}
      <h3>Transição entre cortes</h3>
      <SetupChoices label="Transições" className="setup-demo-choices" value={value.transition} onSelect={transition => onChange({ transition: transition as CreativeSetup['transition'] })} options={[
        { id: 'none', label: 'Corte direto', description: 'Troca de trecho sem efeito de passagem.', visual: <TransitionDemo transition="none" /> },
        { id: 'dip', label: 'Suave', description: 'Escurece brevemente na passagem.', visual: <TransitionDemo transition="dip" /> },
        { id: 'zoom', label: 'Aproximação', description: 'Um zoom curto marca a passagem.', visual: <TransitionDemo transition="zoom" /> },
        { id: 'flash', label: 'Flash', description: 'Um clarão curto marca a passagem.', visual: <TransitionDemo transition="flash" /> },
      ]} />
      {value.motion === 0 && <p role="status">Sem movimento também desliga as transições, mesmo se uma estiver selecionada.</p>}
      <h3>Ritmo visual</h3>
      <SetupChoices label="Ritmo visual" value={value.pace} onSelect={pace => onChange({ pace: pace as CreativeSetup['pace'] })} options={[
        { id: 'lento', label: 'Calmo', description: 'Menos destaques, com mais tempo na tela.' },
        { id: 'normal', label: 'Equilibrado', description: 'Destaques espaçados para acompanhar a fala.' },
        { id: 'rapido', label: 'Ágil', description: 'Destaques mais frequentes, sem acelerar a voz.' },
      ]} />
      <h3>Tom das animações</h3>
      <SetupChoices label="Tom das animações" className="setup-small-choices" value={value.tone} onSelect={tone => onChange({ tone: tone as CreativeSetup['tone'] })} options={Object.entries(LABELS.tone).map(([tone, label]) => ({ id: tone, label: label.charAt(0).toUpperCase() + label.slice(1), description: ['energetico', 'divertido'].includes(tone) ? 'Entradas de texto mais rápidas.' : ['calmo', 'elegante', 'serio', 'acolhedor'].includes(tone) ? 'Entradas de texto mais suaves.' : 'Mantém o tempo das animações do modelo.' }))} />
    </div></details>
    <details><summary>Pedido por escrito</summary><div className="setup-adjustment-content">
      <p>Opcional. Restrições visuais reconhecidas são aplicadas. Não há interpretação automática de público, assuntos ou links; essas anotações ficam para sua revisão.</p>
      <label className="setup-input">Pedido de edição<textarea rows={3} maxLength={500} value={value.prompt} onChange={event => onChange({ prompt: event.target.value })} placeholder="Ex.: sem emojis, destaque os números" /><span>O texto complementa os cartões. Restrições como “sem efeitos” podem limitar o movimento escolhido.</span></label>
      <label className="setup-input">O que evitar?<input maxLength={240} value={value.avoid} onChange={event => onChange({ avoid: event.target.value })} placeholder="Ex.: emojis, zoom" /></label>
      <details><summary>Anotações para sua revisão</summary><div className="setup-adjustment-content">
        <label className="setup-input">Público do vídeo<input maxLength={60} value={value.audience} onChange={event => onChange({ audience: event.target.value })} /></label>
        <label className="setup-input">O que preservar<input maxLength={240} value={value.preserve} onChange={event => onChange({ preserve: event.target.value })} /></label>
        <label className="setup-input">Referência<input maxLength={240} value={value.reference} onChange={event => onChange({ reference: event.target.value })} /><span>Links não são abertos ou analisados.</span></label>
      </div></details>
    </div></details>
  </details>;
}
