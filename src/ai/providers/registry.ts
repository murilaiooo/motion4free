import type { ErrorKey } from '../../core/errors';
import { GEMINI_ENDPOINT, REPLY_MAX_TOKENS, chatTurns, geminiRequest, geminiText, type AiMessages } from '../../editorial/ai-brief';

/**
 * Serviços de IA que a pessoa pode ligar com a PRÓPRIA chave (issue #73, ADR-0028). Tudo aqui é puro:
 * monta pedidos HTTP e lê respostas, sem rede e sem navegador (testado em tests/providers.test.ts).
 * A rede fica em client.ts. Nada passa por servidor do Motion4Free: o navegador fala direto com o serviço.
 * Endereços são fixos por serviço (lista permitida): o app nunca aceita um endereço digitado junto com a chave.
 */

export const PROVIDER_IDS = ['openrouter', 'groq', 'gemini', 'openai', 'anthropic'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** Custo do modelo, como o serviço informa. "cota": grátis dentro do limite da conta, que o serviço pode mudar. */
export type PricingKind = 'gratis' | 'cota' | 'pago' | 'desconhecido';

export interface ModelInfo {
  id: string;
  label: string;
  pricing: PricingKind;
  /** preço em dólares por milhão de tokens, quando o serviço informa */
  inPerM?: number;
  outPerM?: number;
  /** quanto texto o modelo lê de uma vez (tokens), quando informado */
  context?: number;
  recommended?: boolean;
}

export interface HttpRequest {
  url: string;
  method: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: string;
}

export interface ProviderSpec {
  id: ProviderId;
  name: string;
  /** uma linha para o cartão */
  short: string;
  /** etiqueta de custo no cartão */
  costTag: string;
  /** o serviço tem modelos sem cobrança (dentro de limites) */
  hasFree: boolean;
  keyUrl: string;
  pricingUrl: string;
  privacyUrl: string;
  /** começo típico da chave, só para avisar quando parece colada no serviço errado */
  keyPrefix: string | null;
  /** passo a passo para criar a chave, em português simples */
  steps: string[];
  /** aviso de cobrança e de assinatura ≠ API */
  billing: string;
  /** domínio permitido para esta chave; qualquer outro é recusado antes de enviar */
  host: string;
  modelsRequest(key: string, page: string | null): HttpRequest;
  parseModels(json: unknown): { models: ModelInfo[]; next: string | null } | null;
  completeRequest(key: string, modelId: string, m: AiMessages, maxTokens?: number): HttpRequest;
  parseCompletion(json: unknown): string | null;
}

const MAX_OUT = REPLY_MAX_TOKENS + 300;
const json = (body: unknown) => JSON.stringify(body);
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const arr = (v: unknown): unknown[] | null => (Array.isArray(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** Mensagens no formato de chat (OpenAI, OpenRouter, Groq): sistema, exemplos, pedido e correção. */
function chatMessages(m: AiMessages) {
  return chatTurns(m).map((t) => ({ role: t.role, content: t.content }));
}

function chatText(body: unknown): string | null {
  const c = (body as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content;
  if (typeof c === 'string') return c || null;
  // alguns modelos devolvem o conteúdo em partes
  if (Array.isArray(c)) return c.map((p) => (typeof p?.text === 'string' ? p.text : '')).join('') || null;
  return null;
}

/** Nome amigável a partir do ID técnico: "llama-3.3-70b-versatile" → "Llama 3.3 70b versatile". */
export function friendlyName(id: string): string {
  const base = id.split('/').pop() ?? id;
  const words = base.replace(/[:_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Famílias que não são de texto (fala, voz, imagem, moderação, vetores): ficam fora da lista de modelos para editar. */
const NOT_TEXT = /whisper|tts|transcribe|audio|realtime|speech|embed|moderation|guard|dall-e|image|imagen|veo|sora|orpheus|playai|aqa|computer-use|search-preview/i;

const openrouter: ProviderSpec = {
  id: 'openrouter',
  name: 'OpenRouter',
  short: 'Uma chave só para centenas de modelos, incluindo vários gratuitos (marcados ":free").',
  costTag: 'Tem modelos grátis',
  hasFree: true,
  keyUrl: 'https://openrouter.ai/settings/keys',
  pricingUrl: 'https://openrouter.ai/models',
  privacyUrl: 'https://openrouter.ai/privacy',
  keyPrefix: 'sk-or-',
  steps: [
    'Abra o site do OpenRouter e entre com sua conta Google ou e-mail.',
    'Vá em "Keys" e clique em "Create Key". Dê um nome, por exemplo "Motion4Free".',
    'Se quiser, coloque um limite de gasto (Credit limit). Para usar só modelos grátis, deixe sem crédito.',
    'Copie a chave (começa com "sk-or-") e cole no campo abaixo.',
  ],
  billing: 'Modelos com ":free" no nome não cobram, mas têm limite de uso por dia. Os outros usam créditos que você coloca na sua conta OpenRouter.',
  host: 'openrouter.ai',
  modelsRequest: (key) => ({ url: 'https://openrouter.ai/api/v1/models', method: 'GET', headers: { authorization: `Bearer ${key}` } }),
  parseModels(body) {
    const data = arr((body as { data?: unknown })?.data);
    if (!data) return null;
    const models: ModelInfo[] = [];
    for (const raw of data) {
      const m = raw as { id?: unknown; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown }; context_length?: unknown; architecture?: { input_modalities?: unknown; output_modalities?: unknown } };
      const id = str(m.id);
      if (!id) continue;
      const out = arr(m.architecture?.output_modalities);
      const inp = arr(m.architecture?.input_modalities);
      if (out && !out.includes('text')) continue;
      if (inp && !inp.includes('text')) continue;
      const pIn = num(m.pricing?.prompt);
      const pOut = num(m.pricing?.completion);
      const known = pIn !== undefined && pOut !== undefined && pIn >= 0 && pOut >= 0;
      const free = known && pIn === 0 && pOut === 0;
      const context = num(m.context_length);
      models.push({
        id,
        label: str(m.name) ?? friendlyName(id),
        pricing: !known ? 'desconhecido' : free ? 'gratis' : 'pago',
        ...(known && !free ? { inPerM: pIn! * 1e6, outPerM: pOut! * 1e6 } : {}),
        ...(context ? { context } : {}),
        recommended: free && (context ?? 0) >= 16000,
      });
    }
    return { models, next: null };
  },
  completeRequest: (key, modelId, m, maxTokens = MAX_OUT) => ({
    url: 'https://openrouter.ai/api/v1/chat/completions',
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: json({ model: modelId, messages: chatMessages(m), temperature: 0, max_tokens: maxTokens }),
  }),
  parseCompletion: chatText,
};

const groq: ProviderSpec = {
  id: 'groq',
  name: 'Groq',
  short: 'Modelos abertos (Llama, Qwen e outros) muito rápidos, com plano gratuito com limites.',
  costTag: 'Plano grátis com limite',
  hasFree: true,
  keyUrl: 'https://console.groq.com/keys',
  pricingUrl: 'https://groq.com/pricing',
  privacyUrl: 'https://groq.com/privacy-policy',
  keyPrefix: 'gsk_',
  steps: [
    'Abra o GroqCloud e entre com sua conta Google, GitHub ou e-mail.',
    'Vá em "API Keys" e clique em "Create API Key". Dê um nome, por exemplo "Motion4Free".',
    'Copie a chave (começa com "gsk_") na hora: ela só aparece uma vez.',
    'Cole a chave no campo abaixo.',
  ],
  billing: 'O plano gratuito tem limite de pedidos por minuto e por dia, que a Groq pode mudar. Só há cobrança se você mesmo ativar um plano pago na sua conta.',
  host: 'api.groq.com',
  modelsRequest: (key) => ({ url: 'https://api.groq.com/openai/v1/models', method: 'GET', headers: { authorization: `Bearer ${key}` } }),
  parseModels(body) {
    const data = arr((body as { data?: unknown })?.data);
    if (!data) return null;
    const models: ModelInfo[] = [];
    for (const raw of data) {
      const m = raw as { id?: unknown; active?: unknown; context_window?: unknown };
      const id = str(m.id);
      // a Groq não diz o tipo do modelo na lista: fala (Whisper), voz e moderação saem pelo nome da família
      if (!id || m.active === false || NOT_TEXT.test(id)) continue;
      const context = num(m.context_window);
      models.push({ id, label: friendlyName(id), pricing: 'cota', ...(context ? { context } : {}), recommended: (context ?? 0) >= 32000 });
    }
    return { models, next: null };
  },
  completeRequest: (key, modelId, m, maxTokens = MAX_OUT) => ({
    url: 'https://api.groq.com/openai/v1/chat/completions',
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: json({ model: modelId, messages: chatMessages(m), temperature: 0, max_tokens: maxTokens }),
  }),
  parseCompletion: chatText,
};

const gemini: ProviderSpec = {
  id: 'gemini',
  name: 'Google Gemini',
  short: 'Modelos do Google. A conta gratuita do Google AI Studio já dá um bom limite de uso.',
  costTag: 'Plano grátis com limite',
  hasFree: true,
  keyUrl: 'https://aistudio.google.com/app/apikey',
  pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  privacyUrl: 'https://ai.google.dev/gemini-api/terms',
  keyPrefix: 'AIza',
  steps: [
    'Abra o Google AI Studio e entre com sua conta Google.',
    'Clique em "Get API key" (Obter chave de API) e depois em "Create API key".',
    'Copie a chave (começa com "AIza") e cole no campo abaixo.',
  ],
  billing: 'Sem cartão cadastrado, o Google usa o nível gratuito, com limite por minuto e por dia. Se você ativar o faturamento no Google Cloud, o uso pode ser cobrado na sua conta Google.',
  host: 'generativelanguage.googleapis.com',
  modelsRequest: (key, page) => ({
    url: `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000${page ? `&pageToken=${encodeURIComponent(page)}` : ''}`,
    method: 'GET',
    headers: { 'x-goog-api-key': key },
  }),
  parseModels(body) {
    const list = arr((body as { models?: unknown })?.models);
    if (!list) return null;
    const models: ModelInfo[] = [];
    for (const raw of list) {
      const m = raw as { name?: unknown; displayName?: unknown; inputTokenLimit?: unknown; supportedGenerationMethods?: unknown };
      const name = str(m.name);
      const methods = arr(m.supportedGenerationMethods);
      if (!name || !methods?.includes('generateContent')) continue;
      const id = name.replace(/^models\//, '');
      if (NOT_TEXT.test(id)) continue;
      const context = num(m.inputTokenLimit);
      models.push({ id, label: str(m.displayName) ?? friendlyName(id), pricing: 'cota', ...(context ? { context } : {}), recommended: /flash/i.test(id) && !/preview|exp/i.test(id) });
    }
    return { models, next: str((body as { nextPageToken?: unknown }).nextPageToken) };
  },
  completeRequest(key, modelId, m, maxTokens = MAX_OUT) {
    const req = geminiRequest(m) as { generationConfig: Record<string, unknown> };
    return {
      url: GEMINI_ENDPOINT(encodeURIComponent(modelId)),
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: json({ ...req, generationConfig: { ...req.generationConfig, maxOutputTokens: maxTokens } }),
    };
  },
  parseCompletion: geminiText,
};

const openai: ProviderSpec = {
  id: 'openai',
  name: 'OpenAI (API)',
  short: 'Modelos GPT pela API da OpenAI. É paga por uso e separada da assinatura do ChatGPT.',
  costTag: 'Pago na sua conta',
  hasFree: false,
  keyUrl: 'https://platform.openai.com/api-keys',
  pricingUrl: 'https://openai.com/api/pricing/',
  privacyUrl: 'https://openai.com/policies/row-privacy-policy/',
  keyPrefix: 'sk-',
  steps: [
    'Abra a plataforma de API da OpenAI (platform.openai.com) e entre com sua conta.',
    'Em "Billing", coloque créditos e, se quiser, um limite de gasto mensal. Sem crédito a API não responde.',
    'Vá em "API keys" e clique em "Create new secret key".',
    'Copie a chave (começa com "sk-") na hora e cole no campo abaixo.',
  ],
  billing: 'Cada pedido gasta um pouco do crédito da SUA conta de API da OpenAI. A assinatura ChatGPT Plus ou Pro NÃO inclui crédito de API: são cobranças separadas.',
  host: 'api.openai.com',
  modelsRequest: (key) => ({ url: 'https://api.openai.com/v1/models', method: 'GET', headers: { authorization: `Bearer ${key}` } }),
  parseModels(body) {
    const data = arr((body as { data?: unknown })?.data);
    if (!data) return null;
    const models: ModelInfo[] = [];
    for (const raw of data) {
      const id = str((raw as { id?: unknown }).id);
      // a lista da OpenAI não traz tipo nem preço: ficam as famílias de chat (gpt-*, o1/o3/o4…) sem as de fala/imagem
      if (!id || !/^(gpt-|o\d|chatgpt-)/.test(id) || NOT_TEXT.test(id)) continue;
      models.push({ id, label: friendlyName(id).replace(/^Gpt/, 'GPT'), pricing: 'pago', recommended: /mini/.test(id) && !/\d{4}-\d{2}-\d{2}/.test(id) });
    }
    return { models, next: null };
  },
  completeRequest: (key, modelId, m, maxTokens = MAX_OUT) => ({
    url: 'https://api.openai.com/v1/chat/completions',
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    // modelos que "pensam" (o1, o3…) não aceitam temperature; max_completion_tokens vale para todos
    body: json({ model: modelId, messages: chatMessages(m), max_completion_tokens: maxTokens }),
  }),
  parseCompletion: chatText,
};

const ANTHROPIC_HEADERS = (key: string) => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });

const anthropic: ProviderSpec = {
  id: 'anthropic',
  name: 'Claude (API da Anthropic)',
  short: 'Modelos Claude pela API da Anthropic. É paga por uso e separada do Claude Pro ou Max.',
  costTag: 'Pago na sua conta',
  hasFree: false,
  keyUrl: 'https://platform.claude.com/settings/keys',
  pricingUrl: 'https://www.anthropic.com/pricing#api',
  privacyUrl: 'https://www.anthropic.com/legal/privacy',
  keyPrefix: 'sk-ant-',
  steps: [
    'Abra o Console da Claude (platform.claude.com) e entre com sua conta.',
    'Em "Billing", coloque créditos. Sem crédito a API não responde.',
    'Vá em "API keys" e clique em "Create Key". Dê um nome, por exemplo "Motion4Free".',
    'Copie a chave (começa com "sk-ant-") e cole no campo abaixo.',
  ],
  billing: 'Cada pedido gasta um pouco do crédito da SUA conta de API da Anthropic. A assinatura Claude Pro ou Max NÃO inclui crédito de API: são cobranças separadas. Algumas organizações bloqueiam o uso direto pelo navegador.',
  host: 'api.anthropic.com',
  modelsRequest: (key, page) => ({
    url: `https://api.anthropic.com/v1/models?limit=1000${page ? `&after_id=${encodeURIComponent(page)}` : ''}`,
    method: 'GET',
    headers: ANTHROPIC_HEADERS(key),
  }),
  parseModels(body) {
    const b = body as { data?: unknown; has_more?: unknown; last_id?: unknown };
    const data = arr(b?.data);
    if (!data) return null;
    const models: ModelInfo[] = [];
    for (const raw of data) {
      const m = raw as { id?: unknown; display_name?: unknown };
      const id = str(m.id);
      if (!id) continue;
      models.push({ id, label: str(m.display_name) ?? friendlyName(id), pricing: 'pago', recommended: /haiku|sonnet/i.test(id) });
    }
    return { models, next: b.has_more === true ? str(b.last_id) : null };
  },
  completeRequest(key, modelId, m, maxTokens = MAX_OUT) {
    const turns = chatTurns(m);
    return {
      url: 'https://api.anthropic.com/v1/messages',
      method: 'POST',
      headers: { ...ANTHROPIC_HEADERS(key), 'content-type': 'application/json' },
      body: json({
        model: modelId,
        system: turns[0]!.content,
        messages: turns.slice(1).map((t) => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.content })),
        max_tokens: maxTokens,
        temperature: 0,
      }),
    };
  },
  parseCompletion(body) {
    const c = arr((body as { content?: unknown })?.content);
    if (!c) return null;
    const text = c.map((p) => ((p as { type?: unknown }).type === 'text' && typeof (p as { text?: unknown }).text === 'string' ? (p as { text: string }).text : '')).join('');
    return text || null;
  },
};

export const PROVIDERS: Record<ProviderId, ProviderSpec> = { openrouter, groq, gemini, openai, anthropic };

export function isProviderId(v: unknown): v is ProviderId {
  return typeof v === 'string' && (PROVIDER_IDS as readonly string[]).includes(v);
}

/** O pedido só pode ir para o domínio fixo do serviço, em HTTPS. Protege a chave de ir parar em outro lugar. */
export function allowedUrl(id: ProviderId, url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.host === PROVIDERS[id].host && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Status HTTP + corpo → código de erro com sentido para a pessoa. 401 ≠ 403 ≠ 429 ≠ sem crédito. */
export function providerErrorKey(status: number, bodyText: string): ErrorKey {
  const body = bodyText.toLowerCase();
  const noCredit = /insufficient_quota|insufficient credits|credit balance|billing|payment required|exceeded your current quota/.test(body);
  if (status === 402 || noCredit) return 'PROVEDOR_SEM_CREDITO';
  if (status === 401) return 'PROVEDOR_CHAVE_INVALIDA';
  if (status === 400 && /api[_ ]?key|invalid x-api-key|authentication/.test(body)) return 'PROVEDOR_CHAVE_INVALIDA';
  if (status === 403) return 'PROVEDOR_SEM_PERMISSAO';
  if (status === 404) return 'PROVEDOR_MODELO_SUMIU';
  if (status === 429) return 'PROVEDOR_LIMITE';
  return 'PROVEDOR_ERRO';
}

/** Tira a chave de qualquer texto (detalhe de erro, corpo de resposta) antes de mostrar ou copiar. */
export function redact(text: string, key: string): string {
  let out = text;
  const k = key.trim();
  if (k.length >= 6) out = out.split(k).join('[chave]');
  // padrões comuns de chave, mesmo que não seja a digitada
  return out.replace(/\b(sk-[A-Za-z0-9_-]{8,}|gsk_[A-Za-z0-9]{8,}|AIza[0-9A-Za-z_-]{20,})/g, '[chave]');
}

/** Ordem da lista: recomendados, depois grátis, depois por nome. */
export function sortModels(models: ModelInfo[]): ModelInfo[] {
  const rank = (m: ModelInfo) => (m.recommended ? 0 : 1) * 10 + (m.pricing === 'gratis' ? 0 : m.pricing === 'cota' ? 1 : m.pricing === 'desconhecido' ? 2 : 3);
  return [...models].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, 'pt-BR'));
}

/** A chave colada parece de outro serviço (ex.: chave "sk-or-" no campo da OpenAI). Só aviso; não bloqueia. */
export function keyLooksWrong(id: ProviderId, key: string): boolean {
  const k = key.trim();
  if (!k) return false;
  const own = PROVIDERS[id].keyPrefix;
  if (own && !k.startsWith(own)) return true;
  // "sk-" da OpenAI também é começo das chaves da OpenRouter e da Anthropic
  if (id === 'openai' && (k.startsWith('sk-or-') || k.startsWith('sk-ant-'))) return true;
  return false;
}

export const PRICING_LABEL: Record<PricingKind, string> = {
  gratis: 'Preço zero informado pelo catálogo (pode mudar)',
  cota: 'Cota varia conforme sua conta (pode cobrar)',
  pago: 'Pode gerar cobrança na sua conta',
  desconhecido: 'Preço não informado',
};

/** "US$ 0,15 / US$ 0,60 por milhão de tokens" */
export function priceText(m: ModelInfo): string | null {
  if (m.inPerM === undefined || m.outPerM === undefined) return null;
  const f = (n: number) => `US$ ${n < 0.01 ? n.toFixed(4) : n.toFixed(2)}`.replace('.', ',');
  return `${f(m.inPerM)} para ler e ${f(m.outPerM)} para escrever, por milhão de tokens`;
}
