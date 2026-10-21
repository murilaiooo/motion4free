import { useEffect, useMemo, useState } from 'react';
import { CanvasSink } from 'mediabunny';
import { FileVideo, LayoutGrid, List } from 'lucide-react';
import { formatBytes, formatClock } from '../../core/bytes';
import type { OpenedMedia } from '../../media/input';

export interface LibraryAsset {
  id: string;
  name: string;
  duration: number;
  file: Blob | null;
  media: OpenedMedia | null;
}

function AssetThumbnail({ media }: { media: OpenedMedia | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!media) return;
    let active = true;
    let objectUrl: string | null = null;
    void (async () => {
      const sink = new CanvasSink(media.video, { width: 240, height: 135, fit: 'contain' });
      const frame = await sink.getCanvas(Math.min(0.5, media.durationSec / 2));
      if (!frame || !active) return;
      const source = frame.canvas;
      const blob = source instanceof HTMLCanvasElement ? await new Promise<Blob | null>(resolve => source.toBlob(resolve, 'image/jpeg', 0.75)) : await source.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
      if (blob && active) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
    })().catch(() => undefined);
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [media]);
  return url ? <img src={url} alt="" loading="lazy" /> : <FileVideo size={24} aria-hidden />;
}

export function MediaLibrary({ assets, onSelect, disabled }: { assets: LibraryAsset[]; onSelect: (id: string) => void; disabled: boolean }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('order');
  const [grid, setGrid] = useState(true);
  const shown = useMemo(() => {
    const found = assets.filter(asset => asset.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    if (sort === 'name') found.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR') || left.id.localeCompare(right.id));
    if (sort === 'duration') found.sort((left, right) => left.duration - right.duration || left.id.localeCompare(right.id));
    return found;
  }, [assets, query, sort]);
  return <section className="asset-library" aria-label="Arquivos da montagem">
    <div className="asset-library-head"><h3>Seus arquivos</h3><div role="group" aria-label="Visualização da biblioteca"><button className="icon ghost sm" aria-label="Grade" aria-pressed={grid} onClick={() => setGrid(true)}><LayoutGrid size={14} /></button><button className="icon ghost sm" aria-label="Lista" aria-pressed={!grid} onClick={() => setGrid(false)}><List size={14} /></button></div></div>
    <input type="search" value={query} onChange={event => setQuery(event.target.value)} aria-label="Buscar arquivos" placeholder="Buscar por nome…" />
    <select aria-label="Ordenar arquivos" value={sort} onChange={event => setSort(event.target.value)}><option value="order">Ordem de importação</option><option value="name">Nome</option><option value="duration">Duração</option></select>
    <p className="hint">Organizar esta biblioteca não muda a montagem. Clique para localizar o trecho na linha do tempo.</p>
    <div className={`asset-cards ${grid ? 'grid' : 'list'}`}>{shown.map(asset => <button key={asset.id} className="asset-card" onClick={() => onSelect(asset.id)} disabled={disabled || !asset.media} data-testid="asset-card" aria-label={`Localizar ${asset.name}`}>
      <div className="asset-thumbnail"><AssetThumbnail media={asset.media} /><span>{formatClock(asset.duration)}</span></div>
      <div className="asset-caption"><strong title={asset.name}>{asset.name}</strong><span>{asset.media ? `${asset.media.width}×${asset.media.height}` : 'Original indisponível'}{asset.file ? ` · ${formatBytes(asset.file.size)}` : ''}</span></div>
    </button>)}</div>
    {!shown.length && <p className="hint">Nenhum arquivo com esse nome.</p>}
  </section>;
}
