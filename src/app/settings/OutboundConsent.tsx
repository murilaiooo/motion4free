import { useEffect, useRef } from 'react';
import { answerRequest, useOutboundRequest } from '../../ai/providers/consent';
import { PROVIDERS } from '../../ai/providers/registry';
import './settings.css';

/** Diálogo nativo no top layer: funciona também sobre Configurações, com foco e Escape locais. */
export function OutboundConsent() {
  const request = useOutboundRequest();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (request && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [request?.id]);
  if (!request) return null;
  const provider = PROVIDERS[request.provider];
  const cancel = () => answerRequest(request.id, false);
  return (
    <dialog ref={ref} className="set-outbound" aria-labelledby="outbound-title"
      onCancel={(event) => { event.preventDefault(); cancel(); }}
      onKeyDownCapture={(event) => event.stopPropagation()}
      onClick={(event) => { if (event.target === event.currentTarget) cancel(); }}>
      <div className="stack">
        <h2 id="outbound-title">Enviar este texto ao {provider.name}?</h2>
        <p>Modelo: <b>{request.model}</b>. O pedido abaixo vai diretamente para <b>{provider.host}</b>. Pode consumir cota ou gerar cobrança na sua conta de API. Vídeo, áudio e arquivos ficam neste computador.</p>
        {request.batch && <p className="hint">Esta análise lê o vídeo em várias partes. As próximas partes têm o mesmo formato, só com outro trecho da fala. Se autorizar todas, o app não pergunta de novo até esta análise terminar.</p>}
        <p className="hint">Confira todo o conteúdo antes de autorizar. Uma correção da resposta também pede autorização. Cancelar mantém a edição pelas regras.</p>
        <details open>
          <summary>Conteúdo completo que será enviado</summary>
          <pre className="set-outbound-body">{request.body}</pre>
        </details>
        <p><a href={provider.privacyUrl} target="_blank" rel="noopener noreferrer">Política de privacidade do {provider.name}</a></p>
        <div className="set-row">
          <button type="button" className="sm" autoFocus onClick={cancel}>Cancelar envio</button>
          <button type="button" className={`sm${request.batch ? '' : ' primary'}`} onClick={() => answerRequest(request.id, true)}>Autorizar este envio</button>
          {request.batch && <button type="button" className="sm primary" onClick={() => answerRequest(request.id, true, true)} data-testid="consent-batch">Autorizar este e as próximas partes desta análise</button>}
        </div>
      </div>
    </dialog>
  );
}
