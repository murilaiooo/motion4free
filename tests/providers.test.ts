import { describe, expect, it } from 'vitest';
import { PROVIDERS, PROVIDER_IDS, allowedUrl, keyLooksWrong, providerErrorKey, redact, sortModels } from '../src/ai/providers/registry';
import type { AiMessages } from '../src/editorial/ai-brief';

const KEY = 'sk-or-v1-abcdefghijklmnop0123456789';
const MSG: AiMessages = { system: 'regras do app', examples: [{ user: 'exemplo', assistant: '{"x":1}' }], user: 'legenda amarela' };

describe('serviços de IA com chave própria (issue #73)', () => {
  it('todo pedido vai para o domínio fixo do serviço, em HTTPS, com a chave só no cabeçalho', () => {
    for (const id of PROVIDER_IDS) {
      const spec = PROVIDERS[id];
      for (const req of [spec.modelsRequest(KEY, null), spec.completeRequest(KEY, 'modelo-x', MSG)]) {
        expect(allowedUrl(id, req.url), `${id} ${req.url}`).toBe(true);
        expect(req.url).not.toContain(KEY);
        expect(Object.values(req.headers).some((v) => v.includes(KEY))).toBe(true);
      }
    }
  });

  it('recusa endereço fora da lista, sem HTTPS ou com usuário embutido', () => {
    expect(allowedUrl('openai', 'https://api.openai.com/v1/models')).toBe(true);
    expect(allowedUrl('openai', 'https://api.openai.com.evil.example/v1/models')).toBe(false);
    expect(allowedUrl('openai', 'http://api.openai.com/v1/models')).toBe(false);
    expect(allowedUrl('openai', 'https://user:pw@api.openai.com/v1/models')).toBe(false);
    expect(allowedUrl('gemini', 'https://api.openai.com/v1/models')).toBe(false);
    expect(allowedUrl('groq', 'não é url')).toBe(false);
  });

  it('OpenRouter: só modelos de texto, preço por milhão e grátis quando os dois preços são zero', () => {
    const parsed = PROVIDERS.openrouter.parseModels({
      data: [
        { id: 'meta/llama:free', name: 'Llama (free)', pricing: { prompt: '0', completion: '0' }, context_length: 131072, architecture: { input_modalities: ['text'], output_modalities: ['text'] } },
        { id: 'openai/gpt-x', name: 'GPT X', pricing: { prompt: '0.00000015', completion: '0.0000006' }, context_length: 128000, architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] } },
        { id: 'img/gen', name: 'Imagem', pricing: { prompt: '0', completion: '0' }, architecture: { input_modalities: ['text'], output_modalities: ['image'] } },
        { id: 'sem/preco', name: 'Sem preço' },
      ],
    })!;
    expect(parsed.models.map((m) => m.id)).toEqual(['meta/llama:free', 'openai/gpt-x', 'sem/preco']);
    expect(parsed.models[0]).toMatchObject({ pricing: 'gratis', recommended: true });
    expect(parsed.models[1]!.pricing).toBe('pago');
    expect(parsed.models[1]!.inPerM).toBeCloseTo(0.15);
    expect(parsed.models[1]!.outPerM).toBeCloseTo(0.6);
    expect(parsed.models[2]!.pricing).toBe('desconhecido');
  });

  it('Groq: tira fala (Whisper), voz e moderação; o resto é "grátis dentro do limite"', () => {
    const parsed = PROVIDERS.groq.parseModels({ data: [{ id: 'llama-3.3-70b-versatile', context_window: 131072 }, { id: 'whisper-large-v3' }, { id: 'meta-llama/llama-guard-4-12b' }, { id: 'playai-tts' }, { id: 'velho', active: false }] })!;
    expect(parsed.models.map((m) => m.id)).toEqual(['llama-3.3-70b-versatile']);
    expect(parsed.models[0]!.pricing).toBe('cota');
  });

  it('Gemini: só quem gera texto (generateContent), sem "models/", e segue a próxima página', () => {
    const parsed = PROVIDERS.gemini.parseModels({
      models: [
        { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', inputTokenLimit: 1048576, supportedGenerationMethods: ['generateContent', 'countTokens'] },
        { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
      ],
      nextPageToken: 'abc',
    })!;
    expect(parsed.models.map((m) => m.id)).toEqual(['gemini-2.5-flash']);
    expect(parsed.models[0]).toMatchObject({ label: 'Gemini 2.5 Flash', recommended: true });
    expect(parsed.next).toBe('abc');
    expect(PROVIDERS.gemini.modelsRequest(KEY, 'abc').url).toContain('pageToken=abc');
  });

  it('OpenAI: só famílias de chat; Anthropic: pagina pelo último ID', () => {
    const o = PROVIDERS.openai.parseModels({ data: [{ id: 'gpt-4o-mini' }, { id: 'whisper-1' }, { id: 'text-embedding-3-small' }, { id: 'gpt-4o-realtime-preview' }, { id: 'o3-mini' }] })!;
    expect(o.models.map((m) => m.id).sort()).toEqual(['gpt-4o-mini', 'o3-mini']);
    const a = PROVIDERS.anthropic.parseModels({ data: [{ id: 'claude-haiku-x', display_name: 'Claude Haiku X' }], has_more: true, last_id: 'claude-haiku-x' })!;
    expect(a.next).toBe('claude-haiku-x');
    expect(a.models[0]!.label).toBe('Claude Haiku X');
  });

  it('formato desconhecido de lista devolve null (vira M4F-1212)', () => {
    for (const id of PROVIDER_IDS) expect(PROVIDERS[id].parseModels({ coisa: 1 }), id).toBeNull();
  });

  it('pedido de resposta: chat com sistema primeiro; Claude com sistema no topo; leitura da resposta', () => {
    const chat = JSON.parse(PROVIDERS.groq.completeRequest(KEY, 'm', MSG).body!);
    expect(chat.messages[0]).toEqual({ role: 'system', content: 'regras do app' });
    expect(chat.messages.at(-1)).toEqual({ role: 'user', content: 'legenda amarela' });
    expect(PROVIDERS.groq.parseCompletion({ choices: [{ message: { content: '{"a":1}' } }] })).toBe('{"a":1}');

    const claude = JSON.parse(PROVIDERS.anthropic.completeRequest(KEY, 'm', MSG).body!);
    expect(claude.system).toBe('regras do app');
    expect(claude.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true);
    expect(PROVIDERS.anthropic.parseCompletion({ content: [{ type: 'text', text: 'oi' }] })).toBe('oi');
    expect(PROVIDERS.anthropic.completeRequest(KEY, 'm', MSG).headers['anthropic-dangerous-direct-browser-access']).toBe('true');

    const openai = JSON.parse(PROVIDERS.openai.completeRequest(KEY, 'o3-mini', MSG).body!);
    expect(openai.temperature).toBeUndefined();
    expect(openai.max_completion_tokens).toBeGreaterThan(0);

    expect(PROVIDERS.gemini.completeRequest(KEY, 'gemini-2.5-flash', MSG).url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(PROVIDERS.gemini.parseCompletion({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] })).toBe('ok');
  });

  it('cada falha HTTP tem o seu código: 401 ≠ 403 ≠ 429 ≠ sem crédito ≠ modelo sumiu', () => {
    expect(providerErrorKey(401, '')).toBe('PROVEDOR_CHAVE_INVALIDA');
    expect(providerErrorKey(400, 'API_KEY_INVALID')).toBe('PROVEDOR_CHAVE_INVALIDA');
    expect(providerErrorKey(403, '')).toBe('PROVEDOR_SEM_PERMISSAO');
    expect(providerErrorKey(429, 'rate limit')).toBe('PROVEDOR_LIMITE');
    expect(providerErrorKey(429, '{"error":{"code":"insufficient_quota"}}')).toBe('PROVEDOR_SEM_CREDITO');
    expect(providerErrorKey(400, 'Your credit balance is too low')).toBe('PROVEDOR_SEM_CREDITO');
    expect(providerErrorKey(402, '')).toBe('PROVEDOR_SEM_CREDITO');
    expect(providerErrorKey(404, '')).toBe('PROVEDOR_MODELO_SUMIU');
    expect(providerErrorKey(503, '')).toBe('PROVEDOR_ERRO');
  });

  it('a chave nunca aparece em texto de erro', () => {
    expect(redact(`chave ${KEY} recusada`, KEY)).toBe('chave [chave] recusada');
    expect(redact('veio gsk_ABCDEFGH12345678 e AIzaSyA1234567890123456789012', '')).not.toMatch(/gsk_|AIza/);
  });

  it('avisa quando a chave parece de outro serviço', () => {
    expect(keyLooksWrong('openai', 'sk-or-v1-xyz')).toBe(true);
    expect(keyLooksWrong('openai', 'sk-proj-xyz')).toBe(false);
    expect(keyLooksWrong('gemini', 'AIzaSyXYZ')).toBe(false);
    expect(keyLooksWrong('groq', 'AIzaSyXYZ')).toBe(true);
    expect(keyLooksWrong('groq', '')).toBe(false);
  });

  it('ordena sugeridos e grátis primeiro', () => {
    const sorted = sortModels([
      { id: 'b', label: 'B', pricing: 'pago' },
      { id: 'a', label: 'A', pricing: 'gratis' },
      { id: 'c', label: 'C', pricing: 'pago', recommended: true },
    ]);
    expect(sorted.map((m) => m.id)).toEqual(['c', 'a', 'b']);
  });
});
