import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import './library.css';

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"])';

/**
 * Janela por cima da tela (diálogo modal): fundo escurecido, Esc ou o X fecham, foco vai para dentro
 * ao abrir, Tab circula só dentro dela, e o foco volta para onde estava ao fechar.
 */
export function Dialog({ title, onClose, children, wide = false, testId }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; testId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? ref.current;
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      // Tab fica dentro da janela (senão o foco ia parar nos botões escondidos atrás do fundo escuro)
      if (e.key === 'Tab' && ref.current) {
        const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null);
        if (items.length === 0) return;
        const firstItem = items[0]!;
        const last = items[items.length - 1]!;
        const active = document.activeElement;
        if (e.shiftKey && (active === firstItem || active === ref.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      before?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="m4f-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={`m4f-dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} data-testid={testId}>
        <header className="m4f-dialog-head">
          <h2 id={titleId}>{title}</h2>
          <button className="icon ghost" onClick={onClose} aria-label="Fechar" data-tip="Fechar (Esc)">
            <X size={18} />
          </button>
        </header>
        <div className="m4f-dialog-body">{children}</div>
      </div>
    </div>
  );
}
