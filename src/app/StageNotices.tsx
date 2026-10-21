import { useState, type ReactNode } from 'react';
import { ChevronDown, TriangleAlert } from 'lucide-react';

/** Keep editor warnings accessible without stealing space from the video preview. */
export function StageNotices({ children, count }: { children: ReactNode; count: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="stage-notices" data-testid="stage-notices">
      {count > 0 ? (
        <div className="stage-warning-group" data-testid="stage-warning-group">
          <button className="stage-warning-toggle sm" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} data-testid="stage-warning-toggle">
            <TriangleAlert size={15} aria-hidden /> {count} {count === 1 ? 'aviso' : 'avisos'} da edição
            <ChevronDown size={15} aria-hidden className={open ? 'expanded' : ''} />
          </button>
          {open && <div className="stage-warning-content" data-testid="stage-warning-content">{children}</div>}
        </div>
      ) : children}
    </div>
  );
}
