import { useRef, useState } from 'react';
import { CircleAlert, Copy, Check, TriangleAlert, X } from 'lucide-react';
import { formatReport, type AppError } from '../core/errors';
import { VERSION_LABEL } from '../version';

/** Mostra o código do erro, o que aconteceu e um botão para copiar os detalhes para o feedback. */
export function ErrorBox({ error, kind, onDismiss }: { error: AppError; kind: 'error' | 'warning'; onDismiss?: () => void }) {
  const [copied, setCopied] = useState<'no' | 'yes' | 'select'>('no');
  const details = useRef<HTMLDetailsElement>(null);
  const pre = useRef<HTMLPreElement>(null);
  const report = formatReport(error, VERSION_LABEL, navigator.userAgent);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied('yes');
    } catch {
      // sem permissão de área de transferência (ou navegador antigo): abre os detalhes já selecionados para Ctrl+C
      if (details.current) details.current.open = true;
      const sel = window.getSelection();
      if (pre.current && sel) {
        const range = document.createRange();
        range.selectNodeContents(pre.current);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      setCopied('select');
    }
  }

  const Icon = kind === 'error' ? CircleAlert : TriangleAlert;
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={`${kind}-${error.code}`}>
      <div className="notice-row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <Icon size={16} aria-hidden style={{ marginTop: 2, flex: 'none', color: kind === 'error' ? 'var(--red)' : 'var(--amber)' }} />
        <p>
          <b className="code">
            {kind === 'error' ? 'Erro' : 'Aviso'} {error.code}
          </b>
          : {error.title}
          {kind === 'warning' && error.key.startsWith('MODELO') && error.key !== 'MODELO_RESERVA' ? ' O vídeo foi editado mesmo assim, sem legendas e sem título.' : ''}
          {kind === 'warning' && error.key === 'TRANSCRICAO_FALHOU' ? ' O vídeo foi editado mesmo assim, sem legendas e sem título.' : ''}
        </p>
        {onDismiss && (
          <button className="icon sm ghost" onClick={onDismiss} aria-label={`Dispensar o aviso ${error.code}`} style={{ marginLeft: 'auto', flex: 'none' }} data-testid={`dismiss-${error.code}`}>
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
      <div className="notice-row" style={{ justifyContent: 'space-between', paddingLeft: 24 }}>
        <details ref={details}>
          <summary>Detalhes técnicos</summary>
          <pre ref={pre}>{report}</pre>
        </details>
        <button className="sm" onClick={copy}>
          {copied === 'yes' ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied === 'yes' ? 'Copiado' : copied === 'select' ? 'Selecionado: aperte Ctrl+C' : 'Copiar detalhes'}
        </button>
      </div>
    </div>
  );
}
