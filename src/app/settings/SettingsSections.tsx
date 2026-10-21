import { useEffect, useState } from 'react';
import { Check, Copy, Download, KeyRound, Lock, Monitor, Moon, RotateCcw, ShieldCheck, Sun, Trash2, X } from 'lucide-react';
import { AppError, toAppError } from '../../core/errors';
import { APP_BUILT_AT, APP_COMMIT, APP_VERSION, VERSION_LABEL } from '../../version';
import { webGpuAvailable } from '../../ai/local-ai';
import { deleteVault, forgetKey, getKey, isRemembered, legacyGeminiKey, lockVault, removeLegacyGeminiKey, useKeysVersion, vaultState } from '../../ai/credentials/keys';
import { PROVIDERS, PROVIDER_IDS } from '../../ai/providers/registry';
import { AsrPrecisionOption } from '../AsrPrecisionOption';
import type { AsrPrecision } from '../asr-precision';
import { aiLabel, setAiSettings, useAiSettings } from '../AiOptions';
import { ErrorBox } from '../ErrorBox';
import { setTheme, useTheme, type Theme } from '../TopBar';
import { resetWorkbenchLayout } from '../workbench/EditorWorkspace';
import { UnlockForm } from './AiSection';
import { openSettings } from './route';

/* ---------- Transcrição ---------- */

/** Exemplo animado: a mesma fala escrita pelo modo Rápida (com um erro) e pelo Precisa. */
function CaptionDemo() {
  const fast = ['Hoje', 'vou', 'te', 'mostrar', 'três', 'dicas', 'de', 'edissão'];
  const precise = ['Hoje', 'vou', 'te', 'mostrar', 'três', 'dicas', 'de', 'edição'];
  return (
    <div className="set-demo" aria-label="Exemplo: o modo Rápida pode errar uma palavra (edissão); o Precisa acerta (edição)">
      {[
        ['Rápida', fast],
        ['Precisa', precise],
      ].map(([who, words]) => (
        <div key={who as string} className="set-demo-line" aria-hidden>
          <span className="set-demo-who">{who as string}</span>
          <span className="set-words">
            {(words as string[]).map((w, i) => (
              <span key={i} className={`w ${w === 'edissão' ? 'bad' : w === 'edição' ? 'good' : ''}`} style={{ animationDelay: `${i * 0.18}s` }}>
                {w}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TranscriptionSection({ precision }: { precision: AsrPrecision }) {
  const c = precision.capability;
  return (
    <div className="stack">
      <p className="set-lead">
        A transcrição é quando o app escuta a fala do vídeo e escreve o texto. Esse texto vira a legenda e também é usado para cortar as pausas, sugerir o gancho e achar os melhores momentos nos clipes. Tudo acontece neste computador: o áudio não é enviado para lugar nenhum.
      </p>
      <CaptionDemo />
      <AsrPrecisionOption precision={precision} />
      <ul className="set-facts">
        <li>
          <b>Vale para o próximo vídeo.</b> Mudar aqui não refaz a legenda de um projeto já aberto; para isso, abra o vídeo de novo.
        </li>
        <li>
          <b>Placa de vídeo:</b> {c.webgpu ? 'compatível (a transcrição fica mais rápida).' : 'não encontrada ou não liberada pelo navegador; a transcrição usa o processador e demora mais.'}
        </li>
        <li>
          <b>Idioma da fala:</b> português. Nesta versão o app só transcreve português.
        </li>
        <li>
          <b>Modelos baixados:</b> ficam guardados neste navegador para não baixar de novo. Veja o tamanho ou apague em{' '}
          <button className="link" onClick={() => openSettings('armazenamento')}>
            Armazenamento
          </button>
          .
        </li>
      </ul>
    </div>
  );
}

/* ---------- Editor e aparência ---------- */

const SHORTCUTS: [string, string][] = [
  ['Espaço', 'Tocar ou pausar a prévia'],
  ['J / K / L', 'Voltar 1 s / pausar / avançar 1 s'],
  ['← / →', 'Andar um quadro (com Shift, 1 segundo)'],
  ['Home / End', 'Ir ao início / ao fim'],
  ['S', 'Dividir o vídeo onde está a agulha'],
  ['Delete', 'Apagar o que está escolhido'],
  ['Esc', 'Tirar a seleção'],
  ['Ctrl + Z', 'Desfazer'],
  ['Ctrl + Shift + Z (ou Ctrl + Y)', 'Refazer'],
  ['Ctrl + C / X / V', 'Copiar / recortar / colar'],
  ['Ctrl + D', 'Duplicar'],
  ['Ctrl ou Shift + clique', 'Escolher vários itens na linha do tempo'],
  ['+ / − / 0', 'Aproximar / afastar / ajustar o zoom da linha do tempo'],
];

function ThemeCard({ value, current }: { value: Theme; current: Theme }) {
  const Icon = value === 'dark' ? Moon : Sun;
  return (
    <button className={`set-theme ${value}`} aria-pressed={current === value} onClick={() => setTheme(value)} aria-label={value === 'dark' ? 'Usar tema escuro' : 'Usar tema claro'} data-testid={`theme-${value}`}>
      <span className="set-theme-mock" aria-hidden>
        <span className="bar" />
        <span className="side" />
        <span className="stage" />
        <span className="line" />
      </span>
      <span className="set-theme-name">
        <Icon size={15} aria-hidden /> {value === 'dark' ? 'Escuro' : 'Claro'}
        {current === value && <Check size={14} aria-hidden />}
      </span>
      <small className="hint">{value === 'dark' ? 'Padrão. Cansa menos a vista e as cores do vídeo se destacam.' : 'Melhor em ambiente muito claro ou com sol na tela.'}</small>
    </button>
  );
}

export function AppearanceSection() {
  const [theme] = useTheme();
  const [reset, setReset] = useState<'no' | 'yes' | 'failed'>('no');
  return (
    <div className="stack">
      <div className="set-sub">
        <p className="set-sub-title">Tema</p>
        <p className="hint">As cores da tela do app. Não muda nada no vídeo que você exporta.</p>
        <div className="set-themes">
          <ThemeCard value="dark" current={theme} />
          <ThemeCard value="light" current={theme} />
        </div>
      </div>
      <div className="set-sub">
        <p className="set-sub-title">Painéis da mesa de edição</p>
        <p className="hint">
          Na mesa, você pode arrastar as bordas entre as ferramentas, a prévia, os detalhes e a linha do tempo para deixar cada parte do tamanho que preferir. O app lembra os tamanhos neste navegador. Se algo ficou pequeno demais ou sumiu, volte ao padrão:
        </p>
        <div className="set-row">
          <button className="sm" onClick={() => setReset(resetWorkbenchLayout() ? 'yes' : 'failed')} data-testid="layout-reset">
            <RotateCcw size={14} aria-hidden /> Restaurar tamanhos dos painéis
          </button>
          {reset === 'yes' && (
            <span className="tag ok" role="status">
              <Check size={12} aria-hidden /> Restaurado
            </span>
          )}
        </div>
        {reset === 'failed' && <ErrorBox error={new AppError('LAYOUT_NAO_SALVO')} kind="warning" />}
      </div>
      <div className="set-sub">
        <p className="set-sub-title">Atalhos de teclado</p>
        <p className="hint">Funcionam na mesa de edição quando você não está digitando num campo de texto.</p>
        <table className="set-keys">
          <tbody>
            {SHORTCUTS.map(([k, what]) => (
              <tr key={k}>
                <td>
                  <kbd>{k}</kbd>
                </td>
                <td>{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- Privacidade e segurança ---------- */

/** Desenho animado do caminho dos dados: o que fica no computador e o que (se você ligar) vai para o serviço de IA. */
function DataFlow({ sends, to }: { sends: boolean; to: string }) {
  return (
    <div className={`set-flow ${sends ? 'sends' : ''}`} aria-label={sends ? `Só texto vai deste computador para ${to}; vídeo, áudio e projetos ficam aqui` : 'Nada sai deste computador'}>
      <div className="set-flow-box" aria-hidden>
        <Monitor size={20} />
        <b>Este computador</b>
        <small>vídeos, áudio, legendas, projetos</small>
      </div>
      <div className="set-flow-path" aria-hidden>
        {sends ? <span className="set-flow-dot">texto</span> : <X size={18} />}
      </div>
      <div className={`set-flow-box ${sends ? '' : 'muted'}`} aria-hidden>
        <ShieldCheck size={20} />
        <b>{sends ? to : 'Nenhum serviço'}</b>
        <small>{sends ? 'só o texto do pedido e trechos da fala' : 'o Motion4Free não tem servidor'}</small>
      </div>
    </div>
  );
}

export function PrivacySection() {
  const s = useAiSettings();
  useKeysVersion();
  const [confirmVault, setConfirmVault] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const vault = vaultState();
  const sends = s.mode === 'provedor' && !!s.provider;
  const legacy = legacyGeminiKey();
  const keys = PROVIDER_IDS.filter((id) => getKey(id) || isRemembered(id));

  function exportSettings() {
    const data = {
      app: `Motion4Free ${VERSION_LABEL}`,
      exportadoEm: new Date().toISOString(),
      aviso: 'Configurações sem nenhuma chave de API.',
      ia: { modo: s.mode, tamanhoNoNavegador: s.model, servico: s.provider, modelo: s.remote?.id ?? null, autorizados: s.consent },
      tema: document.documentElement.dataset.theme === 'light' ? 'claro' : 'escuro',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'motion4free-configuracoes.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="stack">
      <p className="set-lead">
        O Motion4Free funciona inteiro dentro do seu navegador. Ele não tem servidor próprio, não tem conta de usuário e não recebe seus vídeos, suas chaves ou o que você escreve.
      </p>
      <DataFlow sends={sends} to={s.provider ? PROVIDERS[s.provider].name : ''} />
      <ul className="set-facts">
        <li>
          <b>Seus vídeos e o áudio</b> nunca saem deste computador. O app guarda uma cópia dentro do navegador para continuar o projeto depois; o arquivo original não é alterado.
        </li>
        <li>
          <b>Downloads:</b> na primeira vez o app baixa o modelo de legenda (e, se você ligar, a IA no navegador). Isso é só baixar; nada seu é enviado nessa hora.
        </li>
        <li>
          <b>IA agora:</b> {aiLabel(s)}.{' '}
          {sends ? `Ao fazer um pedido por texto, o seu navegador envia direto para ${PROVIDERS[s.provider!].name} o pedido e trechos da fala.` : 'Nenhum texto sai deste computador.'}
        </li>
      </ul>

      <div className="set-sub">
        <p className="set-sub-title">
          <KeyRound size={15} aria-hidden /> Chaves de serviços de IA
        </p>
        <p className="hint">
          Uma chave de API funciona como uma senha da sua conta no serviço: quem tiver a chave pode usar a sua cota ou gastar o seu crédito. Por isso: crie chaves com limite de gasto quando o serviço permitir, não instale extensões de navegador em que você não confia e apague a chave no site do serviço se achar que alguém viu.
        </p>
        {keys.length === 0 ? (
          <p className="hint">Nenhuma chave aberta ou guardada.</p>
        ) : (
          <ul className="set-list">
            {keys.map((id) => (
              <li key={id}>
                <span>
                  <b>{PROVIDERS[id].name}</b>
                  <small className="hint">
                    {getKey(id) ? 'aberta nesta aba' : 'não aberta nesta aba'}
                    {isRemembered(id) ? '; guardada no cofre' : '; não guardada (some ao fechar a aba)'}
                  </small>
                </span>
                <button className="sm ghost danger" onClick={() => void forgetKey(id).catch((e) => setError(toAppError(e, 'COFRE_INDISPONIVEL')))} data-testid={`forget-${id}`}>
                  <Trash2 size={14} aria-hidden /> Esquecer
                </button>
              </li>
            ))}
          </ul>
        )}
        {legacy && (
          <div className="set-row">
            <span className="hint">Ainda existe a chave antiga do Gemini guardada sem proteção.</span>
            <button className="sm ghost danger" onClick={removeLegacyGeminiKey}>
              <Trash2 size={14} aria-hidden /> Apagar chave antiga
            </button>
          </div>
        )}
      </div>

      <div className="set-sub" data-testid="vault-box">
        <p className="set-sub-title">
          <Lock size={15} aria-hidden /> Cofre de chaves
        </p>
        <p className="hint">
          {vault === 'nenhum'
            ? 'Não existe cofre neste navegador. Ele é criado quando você marca “Lembrar neste navegador” ao conectar uma chave.'
            : vault === 'aberto'
              ? 'O cofre está destrancado nesta aba. Trancar tira as chaves guardadas da memória até você digitar a senha de novo.'
              : vault === 'trancado'
                ? 'O cofre está trancado. Digite a senha para usar as chaves guardadas nesta aba.'
                : 'O cofre está danificado e não pode ser aberto (M4F-1216). Apague e conecte as chaves de novo.'}
        </p>
        {vault === 'trancado' && <UnlockForm />}
        {vault !== 'nenhum' && (
          <div className="set-row">
            {vault === 'aberto' && (
              <button className="sm" onClick={lockVault} data-testid="vault-lock">
                <Lock size={14} aria-hidden /> Trancar agora
              </button>
            )}
            {confirmVault ? (
              <>
                <small>Apaga todas as chaves guardadas neste navegador. Projetos e vídeos não são tocados.</small>
                <button className="sm danger-solid" onClick={() => {
                    deleteVault();
                    setConfirmVault(false);
                  }} data-testid="vault-delete-confirm">
                  Apagar cofre
                </button>
                <button className="sm ghost" onClick={() => setConfirmVault(false)}>
                  Cancelar
                </button>
              </>
            ) : (
              <button className="sm ghost danger" onClick={() => setConfirmVault(true)} data-testid="vault-delete">
                <Trash2 size={14} aria-hidden /> Apagar cofre…
              </button>
            )}
          </div>
        )}
      </div>

      <div className="set-sub">
        <p className="set-sub-title">
          <ShieldCheck size={15} aria-hidden /> Autorizações de envio
        </p>
        {s.consent.length === 0 ? (
          <p className="hint">Nenhum serviço está autorizado a receber texto.</p>
        ) : (
          <ul className="set-list">
            {s.consent.map((id) => (
              <li key={id}>
                <span>
                  <b>{PROVIDERS[id].name}</b>
                  <small className="hint">pode receber o texto dos pedidos e trechos da fala</small>
                </span>
                <button className="sm ghost" onClick={() => setAiSettings({ consent: s.consent.filter((c) => c !== id) })} data-testid={`revoke-${id}`}>
                  Tirar autorização
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="set-sub">
        <p className="set-sub-title">Copiar minhas configurações</p>
        <p className="hint">Baixa um arquivo com as suas escolhas (IA, tema), sem nenhuma chave. Útil para guardar ou mandar junto com um relato de problema.</p>
        <button className="sm" onClick={exportSettings} data-testid="settings-export">
          <Download size={14} aria-hidden /> Baixar configurações (sem chaves)
        </button>
      </div>
      {error && <ErrorBox error={error} kind="error" />}
    </div>
  );
}

/* ---------- Sobre e diagnóstico ---------- */

interface Capability {
  name: string;
  what: string;
  ok: boolean | null;
}

function useCapabilities(): Capability[] {
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    void navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);
  const has = (fn: () => boolean) => {
    try {
      return fn();
    } catch {
      return false;
    }
  };
  return [
    { name: 'Placa de vídeo (WebGPU)', what: 'deixa a legenda Precisa e a IA no navegador rápidas', ok: has(webGpuAvailable) },
    { name: 'Codificador de vídeo (WebCodecs)', what: 'gera o MP4 final dentro do navegador', ok: has(() => typeof (globalThis as { VideoEncoder?: unknown }).VideoEncoder === 'function') },
    { name: 'Pasta privada do site (OPFS)', what: 'guarda os projetos para continuar depois', ok: has(() => typeof navigator.storage?.getDirectory === 'function') },
    { name: 'Criptografia (Web Crypto)', what: 'protege as chaves guardadas no cofre', ok: has(() => !!globalThis.crypto?.subtle) },
    { name: 'Processamento em paralelo', what: 'usa vários núcleos do processador ao transcrever', ok: has(() => globalThis.crossOriginIsolated === true) },
    { name: 'Armazenamento permanente', what: 'o navegador não apaga os projetos sozinho quando falta espaço', ok: persisted },
  ];
}

export function AboutSection() {
  const caps = useCapabilities();
  const s = useAiSettings();
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no');
  const report = [
    `Motion4Free ${VERSION_LABEL}`,
    `Build: ${APP_BUILT_AT}`,
    `Navegador: ${navigator.userAgent}`,
    ...caps.map((c) => `${c.name}: ${c.ok === null ? 'não informado' : c.ok ? 'sim' : 'não'}`),
    `IA: ${s.mode}${s.provider ? ` / ${s.provider}` : ''}${s.remote ? ` / ${s.remote.id}` : ''} (sem chave)`,
  ].join('\n');
  return (
    <div className="stack">
      <div className="set-sub">
        <p className="set-sub-title">Versão</p>
        <p>
          Motion4Free <b data-testid="settings-version">v{APP_VERSION}</b> · código {APP_COMMIT}
        </p>
        <p className="hint">Gerada em {APP_BUILT_AT}. A versão também aparece no rodapé. Quando relatar um problema, diga qual versão você estava usando.</p>
      </div>
      <div className="set-sub">
        <p className="set-sub-title">O que este navegador permite</p>
        <p className="hint">O app usa recursos do próprio navegador. Quando um falta, ele usa um caminho mais lento ou avisa; nada quebra sem aviso.</p>
        <ul className="set-caps">
          {caps.map((c) => (
            <li key={c.name} data-ok={String(c.ok)}>
              {c.ok ? <Check size={15} aria-hidden /> : <X size={15} aria-hidden />}
              <span>
                <b>{c.name}</b>: {c.ok === null ? 'o navegador não informa' : c.ok ? 'sim' : 'não'}
                <small className="hint"> ({c.what})</small>
              </span>
            </li>
          ))}
        </ul>
        <button
          className="sm"
          onClick={() =>
            void navigator.clipboard.writeText(report).then(
              () => setCopied('yes'),
              () => setCopied('failed'),
            )
          }
          data-testid="copy-diagnostics"
        >
          {copied === 'yes' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied === 'yes' ? 'Copiado' : 'Copiar diagnóstico'}
        </button>
        {copied === 'failed' && <pre className="set-sample">{report}</pre>}
        <p className="hint">O diagnóstico traz só a versão, o navegador e os recursos acima. Nenhuma chave, nome de arquivo ou texto seu.</p>
      </div>
      <div className="set-sub">
        <p className="set-sub-title">Erros</p>
        <p className="hint">
          Quando algo dá errado, o app mostra um código como <b>M4F-1208</b> e o que aconteceu. Cada problema tem o seu código. Use o botão “Copiar detalhes” do aviso e mande junto com um print; isso basta para descobrir a causa.
        </p>
      </div>
      <div className="set-sub">
        <p className="set-sub-title">Licença e créditos</p>
        <p className="hint">
          O Motion4Free é código aberto, licença MIT. Usa, entre outros: React, Mediabunny (ler e gravar vídeo), Transformers.js com modelos Whisper (legenda), WebLLM com modelos Qwen (IA no navegador), Lucide (ícones) e fontes da coleção Fontsource. Cada um segue a própria licença.
        </p>
      </div>
    </div>
  );
}
