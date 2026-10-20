import { useState } from 'react';
import { HardDrive, ShieldCheck, Trash2 } from 'lucide-react';
import { formatBytes } from '../core/bytes';
import { Dialog } from './Dialog';

export interface DeleteTarget {
  id: string;
  name: string;
  videoName: string;
  /** espaço que sai junto (null enquanto mede) */
  sizeBytes: number | null;
}

/** Confirmação de "Apagar projeto": diz o que sai, quanto espaço libera, que não dá para desfazer e que o original fica. */
export function DeleteProjectDialog({ target, onConfirm, onCancel }: { target: DeleteTarget; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog title={`Apagar o projeto "${target.name}"?`} onClose={() => !busy && onCancel()} testId="delete-dialog">
      <p>Isto apaga deste navegador:</p>
      <ul className="m4f-list">
        <li>a cópia do vídeo que o app guardou;</li>
        <li>as edições, legendas corrigidas, versões e a miniatura.</li>
      </ul>
      <p className="m4f-callout">
        <HardDrive size={16} aria-hidden />
        <span>
          Libera <b data-testid="delete-dialog-size">{target.sizeBytes === null ? 'medindo…' : formatBytes(target.sizeBytes)}</b> de espaço no computador.
        </span>
      </p>
      <p className="m4f-callout ok">
        <ShieldCheck size={16} aria-hidden />
        <span>
          Seu arquivo original{target.videoName ? ` (${target.videoName})` : ''} continua no computador: o app nunca apaga nem altera ele.
        </span>
      </p>
      <p className="m4f-strong-warn">Não dá para desfazer.</p>
      <div className="m4f-dialog-actions">
        <button onClick={onCancel} disabled={busy} data-autofocus>
          Cancelar
        </button>
        <button
          className="danger-solid"
          disabled={busy}
          data-testid="delete-confirm"
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <span className="spinner" aria-hidden /> : <Trash2 size={16} aria-hidden />}
          Apagar projeto
        </button>
      </div>
    </Dialog>
  );
}
