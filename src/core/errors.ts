/**
 * Catálogo de erros com código próprio por problema.
 * O código aparece na tela para quem testa e identifica a causa sem ambiguidade.
 * Faixas: 1xx arquivo/vídeo, 2xx áudio, 3xx transcrição, 4xx exportação, 5xx edição e trechos,
 * 6xx projeto salvo e armazenamento, 7xx player, 8xx estilo e animações, 9xx desconhecido, 10xx pedido por texto e IA,
 * 11xx criador de clipes de vídeo longo, 12xx configurações, serviços de IA com chave própria e cofre de chaves.
 */
export const ERRORS = {
  FORMATO_DESCONHECIDO: { code: 'M4F-101', title: 'Formato de arquivo não reconhecido.' },
  SEM_VIDEO: { code: 'M4F-102', title: 'O arquivo não tem faixa de vídeo.' },
  VIDEO_NAO_DECODIFICA: { code: 'M4F-103', title: 'Este navegador não consegue ler o vídeo deste arquivo.' },
  VIDEO_LONGO: { code: 'M4F-104', title: 'Nesta versão de teste o vídeo pode ter no máximo 3 minutos.' },
  ABRIR_FALHOU: { code: 'M4F-105', title: 'Não foi possível abrir o vídeo.' },
  CLIPES_DEMAIS: { code: 'M4F-106', title: 'Dá para juntar no máximo 30 vídeos num projeto. Escolha menos vídeos.' },
  CLIPES_LONGOS: { code: 'M4F-107', title: 'Os vídeos juntos podem ter no máximo 10 minutos. Escolha menos vídeos ou vídeos mais curtos.' },
  CLIPE_ILEGIVEL: { code: 'M4F-108', title: 'Um dos vídeos não pôde ser lido e ficou de fora; os outros foram montados normalmente.' },
  MEMORIA_CLIPES: { code: 'M4F-109', title: 'O aparelho ficou sem memória para ler todos os vídeos. Tente com menos vídeos, vídeos mais curtos ou feche outras abas.' },
  NENHUM_CLIPE: { code: 'M4F-110', title: 'Nenhum dos vídeos escolhidos pôde ser lido.' },
  AUDIO_FALHOU: { code: 'M4F-201', title: 'Não foi possível ler o áudio do vídeo.' },
  SEM_AUDIO: { code: 'M4F-202', title: 'O vídeo não tem som: ele fica sem legendas e sem cortes de pausas. Dá para escolher estilo e gerar o vídeo final.' },
  MUSICA_ILEGIVEL: { code: 'M4F-203', title: 'Não foi possível ler esta música. Use um arquivo MP3, M4A, WAV ou OGG.' },
  MUSICA_GRANDE: { code: 'M4F-204', title: 'A música pode ter no máximo 60 MB. Escolha um arquivo menor.' },
  MUSICA_SUMIU: { code: 'M4F-205', title: 'A música de fundo deste projeto não foi encontrada neste navegador; o vídeo sai sem ela. Escolha a música de novo na aba Áudio.' },
  MUSICA_NAO_SALVA: { code: 'M4F-206', title: 'A música foi colocada no vídeo, mas não pôde ser guardada no projeto (pode faltar espaço). Ela vale até fechar a aba.' },
  MODELO_REDE: { code: 'M4F-301', title: 'Não foi possível baixar o modelo de transcrição.' },
  MODELO_CARREGAR: { code: 'M4F-302', title: 'O modelo de transcrição baixou, mas não conseguiu iniciar neste navegador.' },
  TRANSCRICAO_FALHOU: { code: 'M4F-303', title: 'A transcrição da fala falhou.' },
  WORKER_FALHOU: { code: 'M4F-304', title: 'O processo de transcrição parou inesperadamente.' },
  MODELO_HTTP: { code: 'M4F-305', title: 'O servidor do modelo de transcrição respondeu com erro.' },
  SEM_FALA: { code: 'M4F-306', title: 'Não encontrei fala neste vídeo: ele fica sem legendas e sem título. Dá para escolher estilo e gerar o vídeo final.' },
  MODELO_RESERVA: { code: 'M4F-307', title: 'O modelo de legenda escolhido não funcionou neste aparelho; usei um modelo mais leve, e a legenda pode ter mais erros.' },
  SEM_ENCODER: { code: 'M4F-401', title: 'Este navegador não consegue gerar vídeo. Use Chrome ou Edge atualizados no computador.' },
  EXPORTACAO_FALHOU: { code: 'M4F-402', title: 'A geração do vídeo falhou.' },
  EXPORTACAO_CLIPE: { code: 'M4F-404', title: 'A geração do vídeo não conseguiu ler um dos clipes.' },
  EXPORTACAO_FONTES: { code: 'M4F-405', title: 'Falta um vídeo usado na montagem. Reconecte o arquivo original antes de exportar; suas edições continuam salvas.' },
  EXPORTACAO_PLANO: { code: 'M4F-406', title: 'O projeto tem uma parte inválida e o vídeo não foi gerado. Desfaça a última edição e tente exportar de novo.' },
  SEM_H264: { code: 'M4F-403', title: 'Seu navegador não gera H.264: o vídeo funciona aqui, mas o Instagram pode recusar. Para o arquivo final, use Chrome ou Edge no computador.' },
  LEGENDA_VAZIA: { code: 'M4F-501', title: 'A legenda não pode ficar vazia.' },
  LEGENDA_LONGA: { code: 'M4F-502', title: 'A legenda pode ter no máximo 120 caracteres.' },
  CORTE_TOTAL: { code: 'M4F-503', title: 'Não dá para cortar o vídeo inteiro.' },
  TRECHO_TRAVADO: { code: 'M4F-504', title: 'Este trecho está travado. Destrave para mudar.' },
  TRECHO_CURTO: { code: 'M4F-505', title: 'O trecho precisa ter pelo menos meio segundo dentro do vídeo editado.' },
  CLIPE_UNICO: { code: 'M4F-507', title: 'O vídeo precisa de pelo menos um clipe: não dá para tirar o último.' },
  MONTAGEM_LONGA: { code: 'M4F-508', title: 'O vídeo montado passa de 3 minutos, o máximo do Reels. Tire clipes ou corte mais para publicar como Reels.' },
  TRECHO_SOBREPOSTO: { code: 'M4F-506', title: 'Este pedaço encosta num trecho já ajustado. Clique no trecho existente ou escolha outro pedaço.' },
  ELEMENTO_SUMIU: { code: 'M4F-510', title: 'Este elemento não está mais no vídeo (uma mudança anterior o tirou). Escolha outro.' },
  TEXTO_VAZIO: { code: 'M4F-511', title: 'O texto não pode ficar vazio. Para tirar o elemento, use Apagar.' },
  TEXTO_LONGO: { code: 'M4F-512', title: 'Texto longo demais para este elemento.' },
  LIMITE_ELEMENTOS: { code: 'M4F-513', title: 'Limite de 60 elementos adicionados. Apague um para adicionar outro.' },
  PEDACO_CURTO: { code: 'M4F-514', title: 'O pedaço do vídeo ficaria curto demais (mínimo 0,1 s).' },
  AGULHA_FORA: { code: 'M4F-515', title: 'Para dividir, coloque a agulha no meio de um pedaço do vídeo, longe das pontas.' },
  PALAVRAS_JA_CORTADAS: { code: 'M4F-516', title: 'As palavras escolhidas já estão fora do vídeo. Nada mudou.' },
  ELEMENTO_CURTO: { code: 'M4F-517', title: 'O elemento precisa aparecer por pelo menos 0,2 s.' },
  ORDEM_PROPRIA: { code: 'M4F-518', title: 'Os pedaços do vídeo estão numa ordem sua, diferente da gravação. Ajuste as pontas puxando o pedaço na linha do tempo Edição.' },
  LEGENDA_NAO_COPIA: { code: 'M4F-519', title: 'Legenda não dá para copiar sozinha: ela vem da fala. Copie o pedaço do vídeo (a legenda vai junto) ou adicione um texto.' },
  NADA_COPIADO: { code: 'M4F-520', title: 'Nada copiado ainda. Selecione um pedaço ou elemento na linha do tempo e aperte Copiar (Ctrl+C).' },
  EDICAO_INVALIDA: { code: 'M4F-522', title: 'Esta edição deixaria o projeto num estado inválido; nada mudou. Tente de outro jeito ou desfaça a última ação.' },
  NADA_SELECIONADO: { code: 'M4F-521', title: 'Selecione primeiro um pedaço do vídeo ou um elemento na linha do tempo.' },
  LEGENDA_SEM_TEXTO: { code: 'M4F-523', title: 'O vídeo ainda não tem legendas para baixar (não há fala transcrita).' },
  LIMITE_PONTOS: { code: 'M4F-524', title: 'Limite de 24 pontos de animação neste elemento. Apague um ponto para criar outro.' },
  SELECAO_TUDO: { code: 'M4F-525', title: 'Não dá para apagar todos os pedaços do vídeo de uma vez: deixe pelo menos um.' },
  VARIOS_SELECIONADOS: { code: 'M4F-526', title: 'Com vários itens escolhidos dá para apagar ou copiar pedaços do vídeo. Para duplicar ou copiar um elemento, escolha só ele.' },
  SALVAR_FALHOU: { code: 'M4F-601', title: 'Não foi possível salvar o projeto neste navegador. As edições se perdem ao fechar a aba.' },
  PROJETO_CORROMPIDO: { code: 'M4F-602', title: 'O projeto salvo não pôde ser aberto. Ele continua em Meus projetos; você pode apagá-lo.' },
  VIDEO_DIFERENTE: { code: 'M4F-603', title: 'Este não é o mesmo vídeo do projeto salvo.' },
  VIDEO_AUSENTE: { code: 'M4F-604', title: 'Para continuar o projeto salvo, escolha de novo o vídeo original.' },
  CLIPES_AUSENTES: { code: 'M4F-615', title: 'Faltam vídeos do projeto salvo neste navegador. Escolha de novo os vídeos originais.' },
  IMPORTACAO_INTERROMPIDA: { code: 'M4F-617', title: 'A última importação parou antes de salvar a primeira edição (a aba foi fechada ou faltou espaço). Nada do seu vídeo original foi perdido: abra o vídeo de novo.' },
  CLIPE_DIFERENTE: { code: 'M4F-616', title: 'Um dos vídeos escolhidos não é de nenhum clipe do projeto salvo; ele foi ignorado.' },
  VERSAO_LIMITE: { code: 'M4F-605', title: 'Limite de 20 versões guardadas. Apague uma para guardar outra.' },
  ESPACO_INSUFICIENTE: { code: 'M4F-606', title: 'Pode faltar espaço neste navegador para guardar este vídeo (e o modelo de legenda, se ainda não foi baixado). Libere espaço em Armazenamento ou continue mesmo assim.' },
  MEDIDA_INDISPONIVEL: { code: 'M4F-607', title: 'Este navegador não informa quanto espaço o app está usando; os tamanhos mostrados são só o que deu para medir.' },
  PROJETOS_INDISPONIVEIS: { code: 'M4F-608', title: 'Este navegador não deixa o app guardar projetos (comum em janela anônima). Dá para editar e exportar, mas nada fica salvo.' },
  CACHE_INDISPONIVEL: { code: 'M4F-609', title: 'Este navegador não deixa ver os modelos baixados; não dá para medir nem apagar esses arquivos por aqui.' },
  APAGAR_FALHOU: { code: 'M4F-610', title: 'Não foi possível apagar tudo o que foi pedido. O que não saiu continua na lista.' },
  PERSISTENCIA_NEGADA: { code: 'M4F-611', title: 'O navegador não aceitou guardar os dados de forma permanente. Eles continuam salvos, mas ele pode apagá-los se o computador ficar sem espaço.' },
  DUPLICAR_FALHOU: { code: 'M4F-612', title: 'Não foi possível duplicar o projeto (pode faltar espaço). Nada mudou.' },
  MIGRACAO_FALHOU: { code: 'M4F-613', title: 'Não foi possível passar o projeto da versão anterior para "Meus projetos". Ele continua guardado; o app tenta de novo na próxima vez.' },
  LISTA_FALHOU: { code: 'M4F-614', title: 'Não foi possível ler a lista de projetos salvos neste navegador.' },
  PLAYER_FALHOU: { code: 'M4F-701', title: 'Não foi possível tocar a prévia.' },
  PLAYER_CLIPE: { code: 'M4F-702', title: 'A prévia não conseguiu ler um dos clipes; esse pedaço aparece preto na prévia.' },
  FONTE_FALHOU: { code: 'M4F-801', title: 'As fontes do estilo não carregaram; o vídeo usa uma fonte reserva.' },
  CRIATIVO_GRAFO: { code: 'M4F-806', title: 'O grafo de composição da POC está fora dos limites permitidos.' },
  CRIATIVO_MIDIA: { code: 'M4F-808', title: 'A POC precisa de um vídeo local decodificável de pelo menos 12 s e de um seek concluído antes de salvar o frame.' },
  CRIATIVO_GPU: { code: 'M4F-807', title: 'A POC não conseguiu carregar o adaptador Three.js ou criar WebGL. Canvas2D continua disponível.' },
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
  IA_SEM_ESPACO: { code: 'M4F-1014', title: 'O navegador recusou guardar o modelo de IA por falta de espaço; usei as regras. Escolha um modelo menor ou libere espaço em Armazenamento.' },
  PEDIDO_ELEMENTO_NAO_ENTENDIDO: { code: 'M4F-1015', title: 'Não entendi o pedido para o elemento escolhido; nada mudou. Tente “maior”, “amarelo”, “em cima”, “negrito” ou “apagar”.' },
  IA_CHAVE_RECUSADA: { code: 'M4F-1009', title: 'O serviço recusou a sua chave (confira se ela está certa ou se o limite gratuito acabou); usei as regras.' },
  PRODUCAO_INVALIDA: { code: 'M4F-1016', title: 'A edição planejada não passou na validação. O vídeo original e suas preferências foram preservados. Tente novamente com uma direção mais simples.' },
  BRIEF_INVALIDO: { code: 'M4F-1017', title: 'Revise os campos da direção criativa antes de continuar. Use texto simples na chamada final e respeite os limites indicados.' },
  PREFERENCIAS_FALHOU: { code: 'M4F-618', title: 'Não foi possível guardar suas preferências neste navegador. Você pode continuar; elas valem nesta visita.' },
  LAYOUT_NAO_SALVO: { code: 'M4F-619', title: 'Não foi possível guardar o layout. A organização da mesa vale nesta visita.' },
  LONGO_DEMAIS: { code: 'M4F-1101', title: 'Para fazer clipes, o vídeo pode ter no máximo 2 horas. Corte o vídeo em partes e envie uma de cada vez.' },
  LONGO_SEM_FALA: { code: 'M4F-1102', title: 'Não encontrei fala neste vídeo, então não dá para escolher os melhores momentos. O criador de clipes precisa de fala (podcast, aula, live, entrevista).' },
  LONGO_CURTO: { code: 'M4F-1103', title: 'Este vídeo é curto para virar vários clipes (menos de 2 minutos). Use "Editar meus vídeos" para editá-lo inteiro.' },
  CORTE_FALHOU: { code: 'M4F-1104', title: 'Não foi possível recortar este trecho do vídeo longo.' },
  LINK_NAO_BAIXA: { code: 'M4F-1105', title: 'O navegador não consegue baixar vídeos de links (YouTube, Instagram, TikTok). Baixe o arquivo e solte aqui.' },
  IA_MOMENTOS_FALHOU: { code: 'M4F-1106', title: 'A IA não conseguiu ordenar os momentos; usei a escolha automática por regras.' },
  SEM_MOMENTOS: { code: 'M4F-1107', title: 'Não achei trechos de fala contínua do tamanho escolhido. Tente clipes mais curtos.' },
  CLIPE_LOTE_FALHOU: { code: 'M4F-1108', title: 'Um dos clipes não pôde ser gerado; os outros continuaram normalmente.' },
  MEMORIA_LONGO: { code: 'M4F-1109', title: 'O aparelho ficou sem memória para ler o áudio do vídeo longo. Feche outras abas ou envie um pedaço menor do vídeo.' },
  IA_SEM_MODELO: { code: 'M4F-1201', title: 'Nenhum modelo de IA foi escolhido. Escolha um em Configurações › IA e provedores; desta vez usei as regras.' },
  IA_SEM_CHAVE: { code: 'M4F-1202', title: 'A chave do serviço de IA não está aberta nesta aba (ela some ao fechar a aba, ou o cofre está trancado). Abra Configurações › IA e provedores; desta vez usei as regras.' },
  IA_SEM_AUTORIZACAO: { code: 'M4F-1203', title: 'Você ainda não autorizou enviar texto para este serviço de IA. Autorize em Configurações › IA e provedores; desta vez usei as regras.' },
  PROVEDOR_CHAVE_INVALIDA: { code: 'M4F-1204', title: 'O serviço de IA não aceitou a chave. Ela pode estar errada, incompleta, apagada ou vencida. Confira a chave em Configurações.' },
  PROVEDOR_SEM_PERMISSAO: { code: 'M4F-1205', title: 'A chave foi aceita, mas não tem permissão para este modelo ou recurso (configuração da conta, região ou do próprio serviço).' },
  PROVEDOR_LIMITE: { code: 'M4F-1206', title: 'O serviço de IA pediu para esperar: o limite de uso da sua conta foi atingido por agora. Tente daqui a pouco ou escolha outro modelo.' },
  PROVEDOR_SEM_CREDITO: { code: 'M4F-1207', title: 'A conta deste serviço de IA está sem crédito ou saldo para uso por chave (API). Isso é resolvido na conta do serviço, não no Motion4Free.' },
  PROVEDOR_BLOQUEADO: { code: 'M4F-1208', title: 'Não foi possível falar com o serviço de IA direto deste navegador. Pode ser falta de internet, uma extensão bloqueando ou o serviço não aceitar conexão direta do navegador.' },
  PROVEDOR_MODELO_SUMIU: { code: 'M4F-1209', title: 'O modelo escolhido não existe mais ou não está liberado para a sua chave. Escolha outro em Configurações › IA e provedores.' },
  PROVEDOR_DEMOROU: { code: 'M4F-1210', title: 'O serviço de IA demorou demais para responder. Tente de novo ou escolha outro modelo.' },
  PROVEDOR_ERRO: { code: 'M4F-1211', title: 'O serviço de IA respondeu com um erro do lado dele. Tente de novo mais tarde.' },
  PROVEDOR_LISTA_FALHOU: { code: 'M4F-1212', title: 'O serviço respondeu, mas a lista de modelos veio num formato que o app não reconhece.' },
  COFRE_SENHA_ERRADA: { code: 'M4F-1213', title: 'Senha do cofre errada. As chaves continuam guardadas e trancadas; tente de novo.' },
  COFRE_INDISPONIVEL: { code: 'M4F-1214', title: 'Este navegador não permite guardar chaves cifradas. A chave vale só até fechar a aba.' },
  COFRE_SENHA_CURTA: { code: 'M4F-1215', title: 'A senha do cofre precisa ter pelo menos 8 caracteres.' },
  COFRE_CORROMPIDO: { code: 'M4F-1216', title: 'O cofre de chaves deste navegador está danificado e não pode ser aberto. Apague o cofre em Privacidade e segurança e conecte as chaves de novo.' },
  PROVEDOR_SEM_TEXTO: { code: 'M4F-1217', title: 'O serviço aceitou o teste, mas não enviou uma resposta de texto. Não foi possível confirmar que este modelo funciona.' },
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
