import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import type { Caption, Segment, Word } from '../core/types';
import { activeToken, buildTranscript, pageOfCaption, paginate, type TranscriptBlock } from '../editorial/transcript';

const PER_PAGE = 80;
const fmt = (s: number) => `${s.toFixed(2).replace('.', ',')} s`;

interface Props {
  words: Word[];
  captions: Caption[];
  segments: Segment[];
  time: number;
  playing: boolean;
  onSeek: (t: number) => void;
  /** corrige o texto de uma legenda (erros aparecem na área de avisos do editor) */
  onEdit: (captionId: string, text: string) => void;
  disabled?: boolean;
}

/**
 * Editor de legendas em parágrafo (como um roteiro): cada legenda é um grupo de palavras; clicar numa
 * palavra leva a prévia até ela e abre a legenda para corrigir ali mesmo. Palavras de trechos cortados
 * aparecem riscadas. Vídeos longos são paginados.
 */
export function Transcript({ words, captions, segments, time, playing, onSeek, onEdit, disabled }: Props) {
  const blocks = useMemo(() => buildTranscript(words, captions, segments), [words, captions, segments]);
  const pages = useMemo(() => paginate(blocks, PER_PAGE), [blocks]);
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = activeToken(blocks, time);
  const activeKey = active ? `${active.captionId}:${active.index}` : '';
  // funções estáveis para o parágrafo (memo) não ser redesenhado a cada quadro do player
  const latest = useRef({ onSeek, onEdit, disabled });
  latest.current = { onSeek, onEdit, disabled };
  const seek = useCallback((t: number) => latest.current.onSeek(t), []);
  const edit = useCallback((id: string, text: string) => latest.current.onEdit(id, text), []);
  const open = useCallback((id: string) => !latest.current.disabled && setEditing(id), []);
  const close = useCallback(() => setEditing(null), []);

  useEffect(() => {
    if (page >= pages.length) setPage(Math.max(0, pages.length - 1));
  }, [page, pages.length]);

  // a página acompanha a fala enquanto toca
  useEffect(() => {
    if (!playing || !active) return;
    const p = pageOfCaption(pages, active.captionId);
    if (p >= 0 && p !== page) setPage(p);
  }, [playing, active?.captionId, pages, page]);

  // palavra falada em destaque, sem redesenhar o parágrafo inteiro a cada quadro
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll('[data-active]').forEach((el) => el.removeAttribute('data-active'));
    if (!active) return;
    const cap = root.querySelector(`[data-cap="${active.captionId}"]`);
    cap?.setAttribute('data-active', 'cap');
    const word = cap?.querySelector(`[data-w="${active.index}"]`);
    word?.setAttribute('data-active', 'word');
    if (playing && word instanceof HTMLElement) {
      const box = root.getBoundingClientRect();
      const r = word.getBoundingClientRect();
      if (r.top < box.top || r.bottom > box.bottom) word.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeKey, page, playing, pages, editing]);

  if (blocks.length === 0) {
    return <p className="hint">Este vídeo não tem legendas (nenhuma fala reconhecida).</p>;
  }

  const current = pages[Math.min(page, pages.length - 1)] ?? [];
  return (
    <div className="transcript-wrap">
      <p className="hint">Clique numa palavra para ir até ela e corrigir a legenda. Enter confirma, Esc cancela. Riscado = trecho cortado.</p>
      <div className="transcript" ref={rootRef} data-testid="transcript">
        <Paragraph blocks={current} editing={editing} onSeek={seek} onOpen={open} onClose={close} onEdit={edit} />
      </div>
      {pages.length > 1 && (
        <div className="pager" aria-label="Páginas da transcrição">
          <button className="sm icon ghost" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} aria-label="Página anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="hint tnum">
            Página {page + 1} de {pages.length}
          </span>
          <button className="sm icon ghost" onClick={() => setPage(Math.min(pages.length - 1, page + 1))} disabled={page >= pages.length - 1} aria-label="Próxima página">
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

const Paragraph = memo(function Paragraph({ blocks, editing, onSeek, onOpen, onClose, onEdit }: { blocks: TranscriptBlock[]; editing: string | null; onSeek: (t: number) => void; onOpen: (id: string) => void; onClose: () => void; onEdit: (id: string, text: string) => void }) {
  return (
    <p className="transcript-p">
      {blocks.map((b) =>
        b.kind === 'cut' ? (
          <span key={b.key} className="t-cut" title={`Cortado: ${fmt(b.srcStart)} a ${fmt(b.srcEnd)} do original`}>
            {b.words.join(' ')}{' '}
          </span>
        ) : editing === b.id ? (
          <CaptionInput key={`${b.id}:${b.text}`} id={b.id} text={b.text} start={b.start} onDone={onClose} onEdit={onEdit} />
        ) : (
          <span key={b.id} className={`t-cap ${b.edited ? 'edited' : ''}`} data-cap={b.id}>
            <span
              role="button"
              tabIndex={0}
              className="t-cap-text"
              data-testid={`caption-${b.id}`}
              aria-label={`Legenda em ${fmt(b.start)}: ${b.text}. Enter para corrigir.`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSeek(b.start + 0.01);
                  onOpen(b.id);
                }
              }}
            >
              {b.tokens.map((tok, i) => (
                <span
                  key={i}
                  className="t-w"
                  data-w={i}
                  onClick={() => {
                    onSeek(tok.start + 0.01);
                    onOpen(b.id);
                  }}
                >
                  {tok.text}
                  {i < b.tokens.length - 1 ? ' ' : ''}
                </span>
              ))}
            </span>
            <Pencil className="t-pen" size={11} aria-hidden />{' '}
          </span>
        ),
      )}
    </p>
  );
});

function CaptionInput({ id, text, start, onDone, onEdit }: { id: string; text: string; start: number; onDone: () => void; onEdit: (id: string, text: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return (
    <span className="t-edit">
      <input
        ref={ref}
        defaultValue={text}
        maxLength={140}
        size={Math.max(8, Math.min(48, text.length + 2))}
        data-testid={`caption-input-${id}`}
        aria-label={`Legenda em ${fmt(start)}`}
        onBlur={(e) => {
          if (!cancelled.current && e.target.value !== text) onEdit(id, e.target.value);
          onDone();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
      />{' '}
    </span>
  );
}
