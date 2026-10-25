import { useState, type RefObject } from 'react';
import { CheckCheck, FileVideo2, Layers2, SquareCheckBig, SquareDashedMousePointer } from 'lucide-react';
import { OUTPUT_FORMATS } from '../core/formats';
import { clock } from '../editorial/highlights';
import type { ClipWork, ClipItem } from './ClipMaker';
import { ClipReviewCard } from './ClipReviewCard';
import { useClipStills } from './useClipStills';
import { ErrorBox } from './ErrorBox';
import { AppError } from '../core/errors';
import type { Progress } from '../core/progress';
import type { TranscriptIndex } from '../editorial/clip-context';

export function ClipReviewWorkspace({
  work, video, videoUrl, index, working, playing, previewing, contextPreview,
  opening, openingError, onVideoPlay, onVideoPause, onVideoTime,
  onSelect, onBulkSelect, onTitle, onPreview, onNudge, onRender, onEditor,
  onJobDismiss, onOpeningDismiss,
}: {
  work: ClipWork;
  video: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  index: TranscriptIndex;
  working: boolean;
  playing: boolean;
  previewing: string | null;
  contextPreview: boolean;
  opening: { uid: string; progress: Progress } | null;
  openingError: { uid: string; error: AppError } | null;
  onVideoPlay: () => void;
  onVideoPause: () => void;
  onVideoTime: (video: HTMLVideoElement) => void;
  onSelect: (uid: string, selected: boolean) => void;
  onBulkSelect: (checked: boolean) => void;
  onTitle: (uid: string, title: string) => void;
  onPreview: (item: ClipItem, context: boolean) => void;
  onNudge: (uid: string, edge: 'start' | 'end', direction: -1 | 1) => void;
  onRender: (item: ClipItem, number: number) => void;
  onEditor: (item: ClipItem, number: number) => void;
  onJobDismiss: (uid: string) => void;
  onOpeningDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const thumbnails = useClipStills(videoUrl, work.items, work.format);
  const selected = work.items.filter(it => it.checked).length;
  const ready = work.items.filter(it => it.job.kind === 'done').length;
  const playingItem = work.items.find(it => it.uid === previewing);
  return (
    <section className="clips-review" aria-label="Revisão dos momentos sugeridos" data-testid="clips-review">
      <div className="clips-review-heading">
        <div>
          <p className="lp-kicker">02 / Escolha os momentos</p>
          <h2>Revise seus clipes</h2>
          <p className="hint">Assista, ajuste e escolha quais deseja transformar em vídeo.</p>
        </div>
        <div className="clips-selection-tools" role="group" aria-label="Selecionar momentos">
          <span data-testid="clips-selection-count" aria-live="polite">{selected} de {work.items.length} selecionados</span>
          <button className="sm ghost" type="button" disabled={working || work.items.length === 0}
            onClick={() => onBulkSelect(true)} data-testid="clips-select-all">
            <SquareCheckBig size={15} aria-hidden /> Todos
          </button>
          <button className="sm ghost" type="button" disabled={working || selected === 0}
            onClick={() => onBulkSelect(false)} data-testid="clips-select-none">
            <SquareDashedMousePointer size={15} aria-hidden /> Nenhum
          </button>
        </div>
      </div>
      <div className="clips-body">
        <aside className="clips-preview" aria-label="Prévia do vídeo original">
          <div className="clips-preview-heading">
            <div className="clips-preview-icon"><FileVideo2 size={18} aria-hidden /></div>
            <div><strong>{playingItem ? `Prévia do clipe ${work.items.indexOf(playingItem) + 1}` : 'Gravação original'}</strong>
              <span>{OUTPUT_FORMATS[work.format].label} · {OUTPUT_FORMATS[work.format].ratio} na exportação</span></div>
          </div>
          <video ref={video} src={videoUrl} controls playsInline preload="metadata"
            onPlay={onVideoPlay} onPause={onVideoPause}
            onTimeUpdate={e => onVideoTime(e.currentTarget)} data-testid="clips-video" />
          <div className="clips-preview-caption" data-testid="clips-preview-context">
            {playingItem ? (
              <>
                <span className="clip-preview-status">Reproduzindo da fonte</span>
                <strong>{playingItem.m.title || `Clipe ${work.items.indexOf(playingItem) + 1}`}</strong>
                <span className="tnum">{clock(playingItem.m.start)} – {clock(playingItem.m.end)}
                  {contextPreview ? ' · com 6 segundos ao redor' : ''}</span>
              </>
            ) : (
              <><span className="clip-preview-status">Prévia pronta</span>
                <strong>Selecione “Assistir” em qualquer cartão.</strong>
                <span>A imagem mostra o vídeo original. Seu estilo e legendas são aplicados ao gerar.</span></>
            )}
          </div>
          {playingItem && (
            <div className="clips-preview-quick">
              <button className="sm ghost" onClick={() => {
                setExpanded(playingItem.uid);
                document.querySelector(`[data-testid="clip-card"]:has([aria-label="Selecionar clipe ${work.items.indexOf(playingItem) + 1}"])`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }}>
                <Layers2 size={14} aria-hidden /> Revisar este clipe
              </button>
            </div>
          )}
        </aside>
        <div className="clips-list" role="list" aria-label="Clipes sugeridos" data-testid="clips-list">
          {work.items.length === 0 && (
            <div className="clips-empty" role="status">
              <FileVideo2 size={36} aria-hidden />
              <h3>Nenhum momento encontrado ainda</h3>
              <p>Experimente outra duração ou analise novamente a gravação. Seu vídeo original não será alterado.</p>
            </div>
          )}
          {work.items.map((it, i) => (
            <div role="listitem" key={it.uid}>
              <ClipReviewCard item={it} index={i} still={thumbnails[it.uid]} sourceContext={index}
                expanded={expanded === it.uid} active={previewing === it.uid} playing={playing}
                busy={working} openingProgress={opening?.uid === it.uid ? opening.progress : null}
                openingError={openingError?.uid === it.uid ? openingError.error : null}
                onToggle={value => onSelect(it.uid, value)}
                onTitle={title => onTitle(it.uid, title)}
                onExpand={() => setExpanded(old => old === it.uid ? null : it.uid)}
                onPreview={context => onPreview(it, context)}
                onNudge={(edge, direction) => onNudge(it.uid, edge, direction)}
                onRender={() => onRender(it, i + 1)}
                onEditor={() => onEditor(it, i + 1)}
                onJobDismiss={() => onJobDismiss(it.uid)}
                onOpeningDismiss={onOpeningDismiss}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="clips-review-footnote">
        <CheckCheck size={15} aria-hidden />
        {ready ? `${ready} ${ready === 1 ? 'arquivo pronto' : 'arquivos prontos'}` : 'Você pode revisar todos antes de gerar'}.
        As sugestões não representam previsão de visualizações.
      </div>
    </section>
  );
}
