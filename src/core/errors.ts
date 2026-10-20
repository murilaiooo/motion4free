/**
 * Catálogo de erros com código próprio por problema.
 * O código aparece na tela para quem testa e identifica a causa sem ambiguidade.
 * Faixas: 1xx arquivo/vídeo, 2xx áudio, 3xx transcrição, 4xx exportação, 5xx edição e trechos,
 * 6xx projeto salvo, 7xx player, 8xx estilo e animações, 9xx desconhecido, 10xx pedido por texto e IA.
 */
export const ERRORS = {
  FORMATO_DESCONHECIDO: { code: 'M4F-101', title: 'Formato de arquivo não reconhecido.' },
  SEM_VIDEO: { code: 'M4F-102', title: 'O arquivo não tem faixa de vídeo.' },
  VIDEO_NAO_DECODIFICA: { code: 'M4F-103', title: 'Este navegador não consegue ler o vídeo deste arquivo.' },
  VIDEO_LONGO: { code: 'M4F-104', title: 'Nesta versão de teste o vídeo pode ter no máximo 3 minutos.' },
  ABRIR_FALHOU: { code: 'M4F-105', title: 'Não foi possível abrir o vídeo.' },
  AUDIO_FALHOU: { code: 'M4F-201', title: 'Não foi possível ler o áudio do vídeo.' },
  MODELO_REDE: { code: 'M4F-301', title: 'Não foi possível baixar o modelo de transcrição.' },
  MODELO_CARREGAR: { code: 'M4F-302', title: 'O modelo de transcrição baixou, mas não conseguiu iniciar neste navegador.' },
  TRANSCRICAO_FALHOU: { code: 'M4F-303', title: 'A transcrição da fala falhou.' },
  WORKER_FALHOU: { code: 'M4F-304', title: 'O processo de transcrição parou inesperadamente.' },
  MODELO_HTTP: { code: 'M4F-305', title: 'O servidor do modelo de transcrição respondeu com erro.' },
  SEM_ENCODER: { code: 'M4F-401', title: 'Este navegador não consegue gerar vídeo. Use Chrome ou Edge atualizados no computador.' },
  EXPORTACAO_FALHOU: { code: 'M4F-402', title: 'A geração do vídeo falhou.' },
  LEGENDA_VAZIA: { code: 'M4F-501', title: 'A legenda não pode ficar vazia.' },
  LEGENDA_LONGA: { code: 'M4F-502', title: 'A legenda pode ter no máximo 120 caracteres.' },
  CORTE_TOTAL: { code: 'M4F-503', title: 'Não dá para cortar o vídeo inteiro.' },
  TRECHO_TRAVADO: { code: 'M4F-504', title: 'Este trecho está travado. Destrave para mudar.' },
  TRECHO_CURTO: { code: 'M4F-505', title: 'O trecho precisa ter pelo menos meio segundo dentro do vídeo editado.' },
  TRECHO_SOBREPOSTO: { code: 'M4F-506', title: 'Este pedaço encosta num trecho já ajustado. Clique no trecho existente ou escolha outro pedaço.' },
  SALVAR_FALHOU: { code: 'M4F-601', title: 'Não foi possível salvar o projeto neste navegador. As edições se perdem ao fechar a aba.' },
  PROJETO_CORROMPIDO: { code: 'M4F-602', title: 'O projeto salvo não pôde ser aberto e foi descartado.' },
  VIDEO_DIFERENTE: { code: 'M4F-603', title: 'Este não é o mesmo vídeo do projeto salvo.' },
  VIDEO_AUSENTE: { code: 'M4F-604', title: 'Para continuar o projeto salvo, escolha de novo o vídeo original.' },
  VERSAO_LIMITE: { code: 'M4F-605', title: 'Limite de 20 versões guardadas. Apague uma para guardar outra.' },
  PLAYER_FALHOU: { code: 'M4F-701', title: 'Não foi possível tocar a prévia.' },
  FONTE_FALHOU: { code: 'M4F-801', title: 'As fontes do estilo não carregaram; o vídeo usa uma fonte reserva.' },
  ESTILO_DESCONHECIDO: { code: 'M4F-802', title: 'Este estilo não existe nesta versão do app.' },
  IMAGEM_FALHOU: { code: 'M4F-803', title: 'Não foi possível ler esta imagem. Use uma foto JPG, PNG ou WebP.' },
  IMAGEM_SEM_CORES: { code: 'M4F-804', title: 'A imagem é quase toda preta, branca ou cinza; as cores do estilo foram mantidas.' },
  EMOJI_FALHOU: { code: 'M4F-805', title: 'Os emojis não carregaram; o vídeo sai sem a fonte de emojis do app.' },
  PEDIDO_VAZIO: { code: 'M4F-1001', title: 'Escreva o que você quer antes de aplicar.' },
  PEDIDO_LONGO: { code: 'M4F-1002', title: 'O pedido pode ter no máximo 500 caracteres.' },
  PEDIDO_NAO_ENTENDIDO: { code: 'M4F-1003', title: 'Não entendi nenhum pedido neste texto; nada mudou. Veja os exemplos.' },
  GANCHO_SEM_FRASES: { code: 'M4F-1004', title: 'A fala não tem frases completas e curtas para sugerir um gancho.' },
  IA_LOCAL_INDISPONIVEL: { code: 'M4F-1005', title: 'A IA no navegador não funciona neste aparelho (precisa de WebGPU); usei as regras.' },
  IA_LOCAL_FALHOU: { code: 'M4F-1006', title: 'A IA no navegador não carregou ou parou; usei as regras.' },
  IA_RESPOSTA_INVALIDA: { code: 'M4F-1007', title: 'A IA respondeu fora do formato esperado; usei as regras.' },
  IA_CHAVE_FALHOU: { code: 'M4F-1008', title: 'O serviço da sua chave não respondeu; usei as regras.' },
  TRECHO_NAO_ENTENDIDO: { code: 'M4F-1010', title: 'Não entendi o pedido para este trecho; nada mudou. Veja os exemplos.' },
  TRECHO_SEM_ALTERNATIVA: { code: 'M4F-1011', title: 'Não há outra animação possível neste trecho (falta fala ou as animações foram proibidas).' },
  IA_RESPOSTA_INVALIDA_REPARO: { code: 'M4F-1012', title: 'A IA respondeu fora do formato duas vezes (mesmo depois de pedir correção); usei as regras.' },
  IA_MODELO_GRANDE: { code: 'M4F-1013', title: 'Este aparelho não tem memória de vídeo suficiente para o modelo de IA escolhido; usei as regras. Tente o modelo leve.' },
  IA_CHAVE_RECUSADA: { code: 'M4F-1009', title: 'O serviço recusou a sua chave (confira se ela está certa ou se o limite gratuito acabou); usei as regras.' },
  DESCONHECIDO: { code: 'M4F-999', title: 'Erro inesperado.' },
} as const;

export type ErrorKey = keyof typeof ERRORS;

export class AppError extends Error {
  readonly key: ErrorKey;
  readonly code: string;
  readonly title: string;
  readonly detail: string;

  constructor(key: ErrorKey, detail = '') {
    super(`${ERRORS[key].code} ${ERRORS[key].title}${detail ? ` (${detail})` : ''}`);
    this.name = 'AppError';
    this.key = key;
    this.code = ERRORS[key].code;
    this.title = ERRORS[key].title;
    this.detail = detail;
  }
}

export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/** Converte qualquer erro em AppError, usando `fallback` quando não for um AppError. */
export function toAppError(err: unknown, fallback: ErrorKey = 'DESCONHECIDO'): AppError {
  if (err instanceof AppError) return err;
  return new AppError(fallback, describeError(err));
}

/** Erro de rede com o servidor que falhou, para saber se foi modelo, runtime ou outro. */
export function networkErrorFromUrl(url: string, cause: unknown): AppError {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // mantém a URL crua
  }
  return new AppError('MODELO_REDE', `servidor ${host}: ${describeError(cause)} — ${url.slice(0, 160)}`);
}

/** Resposta de erro (401/403/429/5xx) do servidor do modelo ou do runtime. */
export function httpErrorFromUrl(url: string, status: number): AppError {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // mantém a URL crua
  }
  return new AppError('MODELO_HTTP', `servidor ${host}: HTTP ${status} — ${url.slice(0, 160)}`);
}

/** Texto para copiar e colar no feedback. */
export function formatReport(err: AppError, version: string, userAgent = ''): string {
  return [`Erro ${err.code}: ${err.title}`, err.detail && `Detalhe: ${err.detail}`, `Versão: ${version}`, userAgent && `Navegador: ${userAgent}`]
    .filter(Boolean)
    .join('\n');
}
