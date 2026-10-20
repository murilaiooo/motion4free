import { useState } from 'react';
import { formatReport, type AppError } from '../core/errors';
import { VERSION_LABEL } from '../version';

/** Mostra o código do erro, o que aconteceu e um botão para copiar os detalhes para o feedback. */
export function ErrorBox({ error, kind }: { error: AppError; kind: 'error' | 'warning' }) {
  const [copied, setCopied] = useState(false);
  const report = formatReport(error, VERSION_LABEL, navigator.userAgent);

  async function copy() {
    try {
      await navigator.clipboard.writeText(report);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'status'} data-testid={`${kind}-${error.code}`}>
      <p>
        <b>{kind === 'error' ? 'Erro' : 'Aviso'} {error.code}</b>: {error.title}
        {kind === 'warning' && error.key.startsWith('MODELO') ? ' O vídeo foi editado mesmo assim, sem legendas e sem título.' : ''}
        {kind === 'warning' && error.key === 'TRANSCRICAO_FALHOU' ? ' O vídeo foi editado mesmo assim, sem legendas e sem título.' : ''}
      </p>
      <details>
        <summary>Detalhes técnicos</summary>
        <pre>{report}</pre>
      </details>
      <button onClick={copy}>{copied ? 'Copiado' : 'Copiar detalhes'}</button>
    </div>
  );
}
