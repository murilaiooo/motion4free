/**
 * O que sai do computador agora (#153), separado em três tipos de dado. Fonte única para a tela
 * inicial, o envio de vídeos, Configurações › Privacidade e o Armazenamento: nenhuma tela promete
 * "o áudio nunca sai" quando a pessoa ligou a transcrição por API.
 *
 * Função pura: recebe o estado já lido (rota de transcrição, IA de texto, chaves abertas, autorizações).
 */
export interface PrivacyInputs {
  asr: { kind: 'local' | 'api'; providerName: string | null; keyOpen: boolean; audioConsent: boolean; fallbackLocal: boolean };
  text: { kind: 'regras' | 'local' | 'provedor'; providerName: string | null; keyOpen: boolean; textConsent: boolean };
}

/**
 * local: fica no computador.
 * blocked: a pessoa escolheu um serviço, mas falta chave ou autorização; nada é enviado.
 * sends: autorizado; vai direto deste navegador para o serviço quando houver trabalho.
 */
export type ShareState = 'local' | 'blocked' | 'sends';

export interface ShareLine {
  state: ShareState;
  /** frase curta: "Áudio da fala: fica neste computador" */
  text: string;
  destination: string | null;
}

export interface PrivacyStatus {
  video: ShareLine;
  audio: ShareLine;
  text: ShareLine;
  /** algo pode sair (áudio ou texto autorizado) */
  anySends: boolean;
  /** resumo de uma linha para o início e para o envio de vídeos */
  summary: string;
}

export function privacyStatus({ asr, text }: PrivacyInputs): PrivacyStatus {
  const video: ShareLine = { state: 'local', destination: null, text: 'Vídeo (imagem): fica neste computador, sempre.' };

  let audio: ShareLine;
  if (asr.kind !== 'api' || !asr.providerName) {
    audio = { state: 'local', destination: null, text: 'Áudio da fala: fica neste computador (transcrição pelo Whisper aqui mesmo).' };
  } else if (!asr.keyOpen || !asr.audioConsent) {
    const missing = !asr.keyOpen ? 'a chave não está aberta' : 'falta autorizar o envio do áudio';
    audio = {
      state: 'blocked',
      destination: asr.providerName,
      text: `Áudio da fala: escolhido para ${asr.providerName}, mas ${missing}; nada é enviado.${asr.fallbackLocal ? ' Enquanto isso, transcreve neste computador.' : ''}`,
    };
  } else {
    audio = { state: 'sends', destination: asr.providerName, text: `Áudio da fala (sem a imagem): vai direto deste navegador para ${asr.providerName} ao transcrever.` };
  }

  let textLine: ShareLine;
  if (text.kind !== 'provedor' || !text.providerName) {
    textLine = { state: 'local', destination: null, text: text.kind === 'local' ? 'Texto e transcrição: ficam neste computador (IA no navegador).' : 'Texto e transcrição: ficam neste computador.' };
  } else if (!text.keyOpen || !text.textConsent) {
    textLine = { state: 'blocked', destination: text.providerName, text: `Texto: escolhido para ${text.providerName}, mas ${!text.keyOpen ? 'a chave não está aberta' : 'falta autorizar o envio de texto'}; nada é enviado.` };
  } else {
    textLine = { state: 'sends', destination: text.providerName, text: `Texto: seus pedidos e trechos da fala vão direto para ${text.providerName} quando você usa a IA.` };
  }

  const anySends = audio.state === 'sends' || textLine.state === 'sends';
  const sent = [audio.state === 'sends' ? `o áudio da fala para ${audio.destination}` : null, textLine.state === 'sends' ? `texto para ${textLine.destination}` : null].filter(Boolean);
  const summary = anySends
    ? `O vídeo fica neste aparelho. Você autorizou enviar ${sent.join(' e ')}.`
    : 'Vídeo, áudio e transcrição ficam neste aparelho.';
  return { video, audio, text: textLine, anySends, summary };
}
