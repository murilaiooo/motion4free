import { useMemo, useState, type FormEvent } from 'react';
import { Bot, Check, Cpu, ExternalLink, Eye, EyeOff, KeyRound, ListChecks, Lock, PlugZap, RefreshCw, Search, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { AppError, toAppError } from '../../core/errors';
import { LOCAL_AI_ENABLED } from '../../ai/local-ai';
import {
  forgetKey,
  getKey,
  isRemembered,
  legacyGeminiKey,
  migrateLegacyGemini,
  rememberKey,
  removeLegacyGeminiKey,
  setSessionKey,
  unlockVault,
  createVault,
  useKeysVersion,
  vaultAvailable,
  vaultState,
} from '../../ai/credentials/keys';
import { MIN_PASSWORD } from '../../ai/credentials/vault';
import { listModels, testModel } from '../../ai/providers/client';
import { PRICING_LABEL, PROVIDERS, PROVIDER_IDS, keyLooksWrong, priceText, type ModelInfo, type ProviderId } from '../../ai/providers/registry';
import { ErrorBox } from '../ErrorBox';
import { LocalModelPicker, setAiSettings, useAiSettings, useWebGpu, type AiMode } from '../AiOptions';

/**
 * Configurações › IA e provedores (v0.27, issue #73): como o app entende os pedidos por texto.
 * Três caminhos: regras (padrão), IA no navegador e serviço de IA com a chave da própria pessoa.
 * Tudo é explicado em linguagem simples; nada aqui é enviado ao Motion4Free.
 */

/** Lista de modelos já buscada nesta aba (sem chave), para não buscar de novo a cada vez que a tela abre. */
const catalog = new Map<ProviderId, { models: ModelInfo[]; at: number }>();

const MODES: { id: AiMode; title: string; text: string; tags: string[]; Icon: typeof Bot }[] = [
  { id: 'regras', title: 'Só regras', text: 'O app reconhece palavras e frases comuns, como “legenda amarela”, “sem emojis” ou “cortes rápidos”. Não precisa de internet nem de cadastro.', tags: ['Grátis', 'Funciona em qualquer computador'], Icon: ListChecks },
  { id: 'local', title: 'IA no navegador', text: 'Um modelo de IA é baixado uma vez e roda dentro do seu computador. Entende pedidos mais soltos, e nada sai do aparelho.', tags: ['Grátis', 'Privado', 'Precisa de placa de vídeo'], Icon: Cpu },
  { id: 'provedor', title: 'Serviço de IA com sua chave', text: 'Usa a sua conta em um serviço de IA (Google, OpenRouter, Groq, OpenAI ou Claude). É o que melhor entende pedidos livres. Só texto é enviado, direto do seu navegador para o serviço.', tags: ['Tem opções grátis', 'Precisa de cadastro no serviço'], Icon: PlugZap },
];

/** Exemplo animado da diferença: o mesmo pedido entendido pelas regras e por uma IA. */
function PromptDemo() {
  return (
    <div className="set-demo" aria-label="Exemplo: o pedido “legenda amarela e um clima mais animado” entendido pelas regras e por uma IA">
      <p className="set-demo-prompt" aria-hidden>
        “legenda amarela e um clima mais animado”
      </p>
      <div className="set-demo-rows" aria-hidden>
        <div>
          <span className="set-demo-who">Regras</span>
          <span className="set-chip ok d1">legenda amarela</span>
          <span className="set-chip miss d2">clima animado ?</span>
        </div>
        <div>
          <span className="set-demo-who">IA</span>
          <span className="set-chip ok d1">legenda amarela</span>
          <span className="set-chip ok d2">mais movimento</span>
          <span className="set-chip ok d3">cortes rápidos</span>
        </div>
      </div>
    </div>
  );
}

export function AiSection() {
  const s = useAiSettings();
  const gpu = useWebGpu();
  return (
    <div className="stack">
      <p className="set-lead">
        Quando você escreve um pedido (na aba IA do editor, ou ao pedir para escolher clipes), o app precisa entender o que você quis dizer. Escolha como ele faz isso. Em todos os casos o seu vídeo continua neste computador.
      </p>
      <PromptDemo />
      <div className="set-modes" role="radiogroup" aria-label="Como o app entende seus pedidos">
        {MODES.filter((m) => m.id !== 'local' || LOCAL_AI_ENABLED).map(({ id, title, text, tags, Icon }) => {
          const off = id === 'local' && !gpu;
          return (
            <label key={id} className={`set-mode ${s.mode === id ? 'on' : ''} ${off ? 'off' : ''}`}>
              <input type="radio" name="ai-mode" checked={s.mode === id} disabled={off} onChange={() => setAiSettings({ mode: id })} data-testid={id === 'regras' ? 'ai-rules' : id === 'local' ? 'ai-local' : 'ai-key'} />
              <Icon size={20} aria-hidden />
              <span>
                <b>{title}</b>
                <small>{text}</small>
                <span className="set-tags">
                  {tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </span>
                {off && <small className="hint">Indisponível aqui: este navegador não tem WebGPU (acesso à placa de vídeo). Chrome e Edge atualizados costumam ter.</small>}
              </span>
            </label>
          );
        })}
      </div>
      {s.mode === 'local' && LOCAL_AI_ENABLED && <LocalModelPicker />}
      {s.mode === 'provedor' && <ProviderSetup />}
    </div>
  );
}

function ProviderSetup() {
  const s = useAiSettings();
  useKeysVersion();
  const legacy = legacyGeminiKey();
  const vault = vaultState();
  return (
    <div className="stack" data-testid="provider-setup">
      <div className="m4f-callout">
        <ShieldCheck size={16} aria-hidden />
        <span>
          <b>Como funciona:</b> você cria uma chave de acesso (API key) no site do serviço e cola aqui. O seu navegador fala direto com o serviço; o Motion4Free não tem servidor, não recebe a sua chave e não vê o que é enviado. Qualquer custo é da sua conta no serviço, nunca do Motion4Free.
        </span>
      </div>
      {legacy && <LegacyGemini />}
      {vault === 'trancado' && (
        <div className="set-sub">
          <p className="set-sub-title">
            <Lock size={15} aria-hidden /> Você tem chaves guardadas no cofre deste navegador
          </p>
          <p className="hint">Digite a senha do cofre para usá-las nesta aba.</p>
          <UnlockForm />
        </div>
      )}
      <div>
        <p className="set-sub-title">1. Escolha o serviço</p>
        <div className="set-providers" role="radiogroup" aria-label="Serviço de IA">
          {PROVIDER_IDS.map((id) => {
            const p = PROVIDERS[id];
            const ready = !!getKey(id);
            return (
              <label key={id} className={`set-provider ${s.provider === id ? 'on' : ''}`} data-testid={`provider-${id}`}>
                <input type="radio" name="ai-provider" checked={s.provider === id} onChange={() => setAiSettings({ provider: id, remote: s.provider === id ? s.remote : null })} />
                <b>{p.name}</b>
                <small>{p.short}</small>
                <span className="set-tags">
                  <span className={`tag ${p.hasFree ? 'free' : 'paid'}`}>{p.costTag}</span>
                  {ready && (
                    <span className="tag ok">
                      <Check size={11} aria-hidden /> chave aberta
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <p className="hint">Nunca usou nada disso? Comece pelo Google Gemini ou pelo OpenRouter: os dois têm uso gratuito e pedem só uma conta.</p>
      </div>
      {s.provider && <ProviderPanel key={s.provider} id={s.provider} />}
    </div>
  );
}

function LegacyGemini() {
  const [error, setError] = useState<AppError | null>(null);
  const open = vaultState() === 'aberto';
  return (
    <div className="set-sub warn" data-testid="legacy-gemini">
      <p className="set-sub-title">
        <KeyRound size={15} aria-hidden /> Encontrei uma chave do Google Gemini guardada do jeito antigo
      </p>
      <p className="hint">Até a versão 0.26 a chave ficava guardada neste navegador sem proteção. Escolha o que fazer com ela; a cópia antiga é apagada em seguida.</p>
      <div className="set-row">
        <button className="sm primary" onClick={() => void migrateLegacyGemini(false).then(() => setAiSettings({ provider: 'gemini' }))} data-testid="legacy-session">
          Usar só nesta aba
        </button>
        {open && (
          <button className="sm" onClick={() => void migrateLegacyGemini(true).catch((e) => setError(toAppError(e, 'COFRE_INDISPONIVEL')))}>
            Guardar no cofre (com senha)
          </button>
        )}
        <button className="sm ghost danger" onClick={removeLegacyGeminiKey} data-testid="legacy-delete">
          <Trash2 size={14} aria-hidden /> Apagar a chave antiga
        </button>
      </div>
      {!open && <p className="hint">Para guardar no cofre com senha: escolha “Usar só nesta aba” e depois marque “Lembrar neste navegador” logo abaixo.</p>}
      {error && <ErrorBox error={error} kind="error" />}
    </div>
  );
}

export function UnlockForm({ onDone }: { onDone?: () => void }) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await unlockVault(pw);
      setPw('');
      onDone?.();
    } catch (err) {
      setError(toAppError(err, 'COFRE_SENHA_ERRADA'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="set-row" onSubmit={(e) => void submit(e)}>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Senha do cofre" aria-label="Senha do cofre" autoComplete="current-password" data-testid="vault-unlock-input" />
      <button type="submit" className="sm primary" disabled={busy || !pw}>
        {busy ? <span className="spinner dark" aria-hidden /> : <Lock size={14} aria-hidden />} Destrancar
      </button>
      {error && <ErrorBox error={error} kind="error" />}
    </form>
  );
}

const thousand = (n: number) => `${Math.round(n / 1000).toLocaleString('pt-BR')} mil`;

function ProviderPanel({ id }: { id: ProviderId }) {
  const p = PROVIDERS[id];
  const s = useAiSettings();
  useKeysVersion();
  const key = getKey(id);
  const [draft, setDraft] = useState('');
  const [show, setShow] = useState(false);
  const [models, setModels] = useState<ModelInfo[] | null>(() => catalog.get(id)?.models ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todos' | 'gratis' | 'sugeridos'>('sugeridos');
  const [limit, setLimit] = useState(30);
  const [confirmPaid, setConfirmPaid] = useState<string | null>(null);
  const [test, setTest] = useState<{ kind: 'idle' } | { kind: 'busy' } | { kind: 'ok' } | { kind: 'error'; error: AppError }>({ kind: 'idle' });
  const chosen = s.provider === id ? s.remote : null;
  const consent = s.consent.includes(id);

  async function load(k: string) {
    setLoading(true);
    setError(null);
    try {
      const list = await listModels(id, k);
      catalog.set(id, { models: list, at: Date.now() });
      setModels(list);
      if (chosen && !list.some((m) => m.id === chosen.id)) setError(new AppError('PROVEDOR_MODELO_SUMIU', chosen.id));
    } catch (err) {
      setError(toAppError(err, 'PROVEDOR_ERRO'));
    } finally {
      setLoading(false);
    }
  }

  async function connect(e: FormEvent) {
    e.preventDefault();
    const k = draft.trim();
    if (!k) return;
    setSessionKey(id, k);
    setDraft('');
    setShow(false);
    // chave trocada de um serviço que estava no cofre: o cofre guarda a nova
    if (isRemembered(id) && vaultState() === 'aberto') await rememberKey(id, true).catch((err) => setError(toAppError(err, 'COFRE_INDISPONIVEL')));
    await load(k);
  }

  const shown = useMemo(() => {
    if (!models) return [];
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      if (q && !`${m.label} ${m.id}`.toLowerCase().includes(q)) return false;
      if (filter === 'gratis') return m.pricing === 'gratis' || m.pricing === 'cota';
      if (filter === 'sugeridos') return !!m.recommended;
      return true;
    });
  }, [models, query, filter]);

  function use(m: ModelInfo) {
    setConfirmPaid(null);
    setTest({ kind: 'idle' });
    setAiSettings({ mode: 'provedor', provider: id, remote: { id: m.id, label: m.label, pricing: m.pricing } });
  }

  const wrong = keyLooksWrong(id, draft);
  return (
    <div className="stack set-provider-panel" data-testid={`provider-panel-${id}`}>
      <div className="set-sub">
        <p className="set-sub-title">2. Crie a sua chave no {p.name}</p>
        <ol className="set-steps">
          {p.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p>
          <a className="btn sm" href={p.keyUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden /> Abrir a página de chaves do {p.name}
          </a>
        </p>
        <p className={`m4f-callout ${p.hasFree ? '' : 'warn'}`}>
          <Sparkles size={16} aria-hidden />
          <span>
            <b>Custo:</b> {p.billing}{' '}
            <a href={p.pricingUrl} target="_blank" rel="noopener noreferrer">
              Ver preços no site oficial
            </a>
            .
          </span>
        </p>
      </div>

      <div className="set-sub">
        <p className="set-sub-title">3. Cole a chave</p>
        {key ? (
          <div className="set-row" data-testid="key-open">
            <span className="tag ok">
              <Check size={12} aria-hidden /> Chave aberta nesta aba (termina em …{key.slice(-4)})
            </span>
            <button className="sm ghost" onClick={() => void load(key)} disabled={loading}>
              <RefreshCw size={14} aria-hidden /> Buscar modelos de novo
            </button>
            <button className="sm ghost danger" onClick={() => void forgetKey(id).then(() => setModels(null))} data-testid="key-forget">
              <Trash2 size={14} aria-hidden /> Esquecer esta chave
            </button>
          </div>
        ) : (
          <p className="hint">Por segurança, a chave fica só na memória desta aba: ao fechar ou recarregar, ela some. Para não colar toda vez, marque “Lembrar neste navegador” depois de conectar.</p>
        )}
        <form className="set-row" onSubmit={(e) => void connect(e)}>
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={key ? 'Colar outra chave (substitui a atual)' : `Cole aqui a chave${p.keyPrefix ? ` (começa com ${p.keyPrefix})` : ''}`}
            aria-label={`Chave do ${p.name}`}
            autoComplete="off"
            spellCheck={false}
            data-testid="key-input"
          />
          <button type="button" className="icon ghost" onClick={() => setShow((v) => !v)} aria-label={show ? 'Esconder a chave' : 'Mostrar a chave'} data-tip={show ? 'Esconder' : 'Mostrar'}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button type="submit" className="sm primary" disabled={!draft.trim() || loading} data-testid="key-connect">
            {loading ? <span className="spinner dark" aria-hidden /> : <PlugZap size={14} aria-hidden />} Conectar e ver modelos
          </button>
        </form>
        {wrong && <p className="hint warn-text">Esta chave não parece ser do {p.name}{p.keyPrefix ? ` (as chaves dele começam com “${p.keyPrefix}”)` : ''}. Confira se escolheu o serviço certo.</p>}
        {key && <RememberBox id={id} />}
        {loading && <p className="hint">Buscando os modelos que a sua chave pode usar… Isso não gasta cota.</p>}
        {error && <ErrorBox error={error} kind="error" onDismiss={() => setError(null)} />}
      </div>

      {key && models && (
        <div className="set-sub" data-testid="model-list">
          <p className="set-sub-title">4. Escolha o modelo</p>
          <p className="hint">
            “Modelo” é a versão da IA. Os sugeridos são rápidos e bons para entender pedidos de edição. A lista vem do próprio {p.name} agora; o preço só aparece quando o serviço informa.
          </p>
          <div className="set-row">
            <label className="set-search">
              <Search size={14} aria-hidden />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Procurar modelo" aria-label="Procurar modelo" />
            </label>
            <div className="chips" role="group" aria-label="Filtrar modelos">
              {(['sugeridos', 'gratis', 'todos'] as const).map((f) => (
                <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'sugeridos' ? 'Sugeridos' : f === 'gratis' ? 'Sem cobrança' : `Todos (${models.length})`}
                </button>
              ))}
            </div>
          </div>
          {shown.length === 0 ? (
            <p className="hint">Nenhum modelo neste filtro. Tente “Todos”.</p>
          ) : (
            <ul className="set-models">
              {shown.slice(0, limit).map((m) => {
                const inUse = chosen?.id === m.id;
                const price = priceText(m);
                return (
                  <li key={m.id} className={inUse ? 'on' : ''}>
                    <div className="set-model-main">
                      <b>{m.label}</b>
                      <span className="set-tags">
                        {m.recommended && <span className="tag ok">Sugerido</span>}
                        <span className={`tag ${m.pricing === 'pago' ? 'paid' : m.pricing === 'desconhecido' ? '' : 'free'}`}>{PRICING_LABEL[m.pricing]}</span>
                      </span>
                      <small className="hint">
                        {price && <>{price}. </>}
                        {m.context && <>Lê até uns {thousand(m.context * 0.75)} palavras de uma vez. </>}
                        <span className="set-id">ID técnico: {m.id}</span>
                      </small>
                    </div>
                    {inUse ? (
                      <span className="tag ok">
                        <Check size={12} aria-hidden /> Em uso
                      </span>
                    ) : confirmPaid === m.id ? (
                      <div className="set-confirm">
                        <small>Este modelo pode gerar cobrança na sua conta do {p.name}. Cada pedido costuma usar poucos milhares de tokens.</small>
                        <button className="sm primary" onClick={() => use(m)}>
                          Usar mesmo assim
                        </button>
                        <button className="sm ghost" onClick={() => setConfirmPaid(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button className="sm" onClick={() => (m.pricing === 'pago' || m.pricing === 'desconhecido' ? setConfirmPaid(m.id) : use(m))} data-testid={`use-model-${m.id}`}>
                        Usar este
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {shown.length > limit && (
            <button className="sm ghost" onClick={() => setLimit((n) => n + 60)}>
              Mostrar mais ({shown.length - limit})
            </button>
          )}
        </div>
      )}

      {chosen && (
        <div className="set-sub" data-testid="consent-box">
          <p className="set-sub-title">5. Autorize o envio de texto</p>
          <label className="set-check">
            <input type="checkbox" checked={consent} onChange={(e) => setAiSettings({ consent: e.target.checked ? [...s.consent.filter((c) => c !== id), id] : s.consent.filter((c) => c !== id) })} data-testid="consent-check" />
            <span>
              Autorizo enviar ao <b>{p.name}</b> o texto dos meus pedidos e trechos da transcrição da fala (até 1.500 letras por pedido). <b>Nunca o vídeo, o áudio ou arquivos.</b>
            </span>
          </label>
          <details className="set-details">
            <summary>Ver um exemplo do que é enviado</summary>
            <pre className="set-sample">{`Instruções do app: "Você traduz o pedido de edição em ajustes. Responda só em JSON…"
Pedido: "legenda amarela e um clima mais animado"
Trecho da fala: "hoje eu vou te mostrar três jeitos de…"`}</pre>
            <p className="hint">
              O que o {p.name} faz com esse texto segue a política dele:{' '}
              <a href={p.privacyUrl} target="_blank" rel="noopener noreferrer">
                ler a política de privacidade
              </a>
              . Você pode tirar a autorização a qualquer momento, aqui ou em Privacidade e segurança.
            </p>
          </details>
          <div className="set-row">
            <button
              className="sm"
              disabled={!consent || !key || test.kind === 'busy'}
              onClick={() => {
                if (!key) return;
                setTest({ kind: 'busy' });
                testModel(id, key, chosen.id).then(
                  () => setTest({ kind: 'ok' }),
                  (err) => setTest({ kind: 'error', error: toAppError(err, 'PROVEDOR_ERRO') }),
                );
              }}
              data-testid="model-test"
            >
              {test.kind === 'busy' ? <span className="spinner" aria-hidden /> : <PlugZap size={14} aria-hidden />} Testar resposta do modelo
            </button>
            <small className="hint">Faz um pedido bem pequeno. Pode gastar uma fração mínima da sua cota ou do seu crédito.</small>
          </div>
          {test.kind === 'ok' && (
            <p className="m4f-callout ok" role="status">
              <Check size={16} aria-hidden /> <span>Funcionou: {chosen.label} respondeu.</span>
            </p>
          )}
          {test.kind === 'error' && <ErrorBox error={test.error} kind="error" />}
          {consent && key && (
            <p className="m4f-callout ok" role="status" data-testid="ai-ready">
              <Check size={16} aria-hidden />
              <span>
                <b>Pronto.</b> Os pedidos por texto agora usam <b>{chosen.label}</b>. Se algo falhar, o app avisa com um código e usa as regras naquele pedido; ele nunca troca sozinho para outro modelo.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** "Lembrar neste navegador": guarda a chave no cofre cifrado com a senha da pessoa. */
function RememberBox({ id }: { id: ProviderId }) {
  useKeysVersion();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const state = vaultState();
  if (!vaultAvailable()) return <p className="hint">Este navegador não permite guardar a chave com proteção (M4F-1214). Ela vale até fechar a aba.</p>;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setOpen(false);
      setPw('');
      setPw2('');
    } catch (err) {
      setError(toAppError(err, 'COFRE_INDISPONIVEL'));
    } finally {
      setBusy(false);
    }
  };
  if (isRemembered(id))
    return (
      <div className="set-row">
        <span className="tag ok">
          <Lock size={12} aria-hidden /> Guardada no cofre deste navegador
        </span>
        <button className="sm ghost" disabled={busy || state !== 'aberto'} onClick={() => void run(() => rememberKey(id, false))}>
          Tirar do cofre
        </button>
        {error && <ErrorBox error={error} kind="error" />}
      </div>
    );
  return (
    <div className="set-remember">
      <label className="set-check">
        <input type="checkbox" checked={open} onChange={(e) => (state === 'aberto' ? void run(() => rememberKey(id, true)) : setOpen(e.target.checked))} data-testid="remember-check" />
        <span>
          <b>Lembrar neste navegador (protegida por senha)</b>
          <small className="hint">
            A chave fica guardada embaralhada (cifrada) com uma senha que só você sabe. Quando abrir o app de novo, digite a senha para usar a chave. A senha não é guardada em lugar nenhum: se esquecer, apague o cofre e cole a chave de novo.
          </small>
        </span>
      </label>
      {open && state === 'nenhum' && (
        <form
          className="set-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (pw === pw2)
              void run(async () => {
                await createVault(pw);
                await rememberKey(id, true);
              });
          }}
        >
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={`Crie uma senha (mínimo ${MIN_PASSWORD} caracteres)`} aria-label="Nova senha do cofre" autoComplete="new-password" data-testid="vault-new" />
          <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repita a senha" aria-label="Repita a senha do cofre" autoComplete="new-password" data-testid="vault-new2" />
          <button type="submit" className="sm primary" disabled={busy || !pw || pw !== pw2} data-testid="vault-create">
            {busy ? <span className="spinner dark" aria-hidden /> : <Lock size={14} aria-hidden />} Criar cofre e guardar
          </button>
          {pw2 && pw !== pw2 && <small className="hint warn-text">As duas senhas estão diferentes.</small>}
        </form>
      )}
      {open && state === 'trancado' && (
        <>
          <p className="hint">Já existe um cofre neste navegador. Destranque com a senha dele e a chave será guardada junto.</p>
          <UnlockForm onDone={() => void run(() => rememberKey(id, true))} />
        </>
      )}
      {open && state === 'danificado' && <ErrorBox error={new AppError('COFRE_CORROMPIDO')} kind="error" />}
      {error && <ErrorBox error={error} kind="error" />}
    </div>
  );
}
