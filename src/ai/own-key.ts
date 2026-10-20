import { AppError, describeError } from '../core/errors';
import { GEMINI_ENDPOINT, geminiErrorKey, geminiRequest, geminiText, type AiMessages, type Completer } from '../editorial/ai-brief';

/**
 * Chave própria do Google Gemini (opcional). A chave fica só no localStorage deste navegador,
 * vai no cabeçalho (nunca na URL, para não aparecer em mensagens de erro) e só texto é enviado:
 * o pedido e um trecho da transcrição. O vídeo nunca sai do aparelho.
 * Não testado ponta a ponta no ambiente de desenvolvimento (sem acesso ao Google).
 */

const STORAGE_KEY = 'm4f-gemini-key';
const TIMEOUT_MS = 30_000;

export function loadKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveKey(key: string): void {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sem armazenamento: a chave vale só até fechar a aba
  }
}

export function geminiCompleter(key: string): Completer {
  return async (m: AiMessages) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(GEMINI_ENDPOINT(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(geminiRequest(m)),
        signal: ctrl.signal,
      });
    } catch (err) {
      throw new AppError('IA_CHAVE_FALHOU', `generativelanguage.googleapis.com: ${describeError(err)}`);
    } finally {
      clearTimeout(timer);
    }
    const body = await res.text();
    if (!res.ok) throw new AppError(geminiErrorKey(res.status, body), `HTTP ${res.status}`);
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new AppError('IA_RESPOSTA_INVALIDA', 'resposta do serviço não é JSON');
    }
    const text = geminiText(json);
    if (!text) throw new AppError('IA_RESPOSTA_INVALIDA', 'resposta sem texto');
    return text;
  };
}
