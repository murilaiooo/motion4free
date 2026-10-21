import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Bot, Captions, Check, Film, HardDrive, Lock, LockOpen, Package, ShieldCheck, Trash2 } from 'lucide-react';
import { formatBytes } from '../core/bytes';
import { AppError, toAppError } from '../core/errors';
import { deleteEverything, deleteItem, measureStorage, type StorageDeps, type StorageItem, type StorageReport } from '../core/storage-report';
import { Dialog } from './Dialog';
import { ErrorBox } from './ErrorBox';
import { ProgressPanel } from './ProgressPanel';
import type { Progress } from '../core/progress';
import './library.css';

/** Medir percorre todos os projetos e o cache dos modelos: em aparelhos com muita coisa leva alguns segundos. */
const MEASURING: Progress = { label: 'Medindo o espaço usado (projetos, modelos e cache)', phase: 'medir', fraction: null };

const testId = (id: string) => id.replace(/[^a-zA-Z0-9]+/g, '-');
const CONFIRM_WORD = 'APAGAR';

interface Props {
  deps: StorageDeps;
  currentProjectId: string | null;
  onClose: () => void;
  /** um projeto saiu (pela lista desta tela) */
  onProjectDeleted: (id: string) => void;
  /** "Apagar tudo" terminou */
  onEverythingDeleted: () => void;
}

function Row({ item, current, onDelete }: { item: StorageItem; current: boolean; onDelete: (item: StorageItem) => Promise<void> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const what =
    item.kind === 'project'
      ? 'Apaga a cópia do vídeo, as edições e as versões deste projeto. O vídeo original no seu computador não é tocado.'
      : item.kind === 'other'
        ? 'Apaga estes arquivos. Se o app precisar deles, baixa de novo.'
        : 'Apaga o modelo. Ele é baixado de novo (uma vez) na próxima vez que for usado.';
  return (
    <li className="st-row" data-testid={`storage-item-${testId(item.id)}`}>
      <div className="st-row-main">
        <span className="st-row-label">
          {item.label}
          {current && <span className="tag">aberto agora</span>}
        </span>
        <span className="hint st-row-detail">{item.detail}</span>
      </div>
      <b className="tnum st-row-size" data-testid="storage-item-size">
        {item.bytes === null ? 'tamanho não informado' : formatBytes(item.bytes)}
      </b>
      {asking ? (
        <div className="st-confirm" role="group" aria-label={`Confirmar apagar ${item.label}`}>
          <span className="hint">{what}</span>
          <div className="st-confirm-btns">
            <button className="sm" onClick={() => setAsking(false)} disabled={busy}>
              Cancelar
            </button>
            <button
              className="sm danger-solid"
              disabled={busy}
              data-testid="storage-confirm-delete"
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(item);
                } finally {
                  setBusy(false);
                  setAsking(false);
                }
              }}
            >
              {busy ? <span className="spinner" aria-hidden /> : <Trash2 size={14} aria-hidden />} Sim, apagar
            </button>
          </div>
        </div>
      ) : (
        <button className="sm ghost danger" onClick={() => setAsking(true)} data-testid="storage-delete" aria-label={`Apagar ${item.label}`}>
          <Trash2 size={14} aria-hidden /> Apagar
        </button>
      )}
    </li>
  );
}

function Section({ title, icon, items, empty, current, onDelete, extra }: { title: string; icon: ReactNode; items: StorageItem[]; empty: string; current: string | null; onDelete: (i: StorageItem) => Promise<void>; extra?: ReactNode }) {
  const total = items.reduce((s, i) => s + (i.bytes ?? 0), 0);
  return (
    <section className="st-section">
      <h3>
        {icon} {title}
        <span className="hint tnum">{items.length ? formatBytes(total) : ''}</span>
      </h3>
      {items.length === 0 && !extra ? (
        <p className="hint st-empty">{empty}</p>
      ) : (
        <ul className="st-list">
          {items.map((i) => (
            <Row key={i.id} item={i} current={!!current && i.project?.id === current} onDelete={onDelete} />
          ))}
          {extra}
        </ul>
      )}
    </section>
  );
}

/**
 * Tela "Armazenamento": quanto o Motion4Free ocupa neste navegador (total do navegador e cada item medido),
 * cota, se o armazenamento é permanente, e botões para apagar cada coisa ou tudo.
 */
export function StorageScreen({ deps, currentProjectId, onClose, onProjectDeleted, onEverythingDeleted }: Props) {
  const [report, setReport] = useState<StorageReport | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<AppError[]>([]);
  const [confirmAll, setConfirmAll] = useState(false);
  const [word, setWord] = useState('');
  const [wiping, setWiping] = useState(false);

  const refresh = useCallback(async () => {
    setReport(await measureStorage(deps));
  }, [deps]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function remove(item: StorageItem) {
    setNotice(null);
    setErrors([]);
    try {
      const freed = await deleteItem(deps, item);
      if (item.project) onProjectDeleted(item.project.id);
      const size = formatBytes(freed);
      setNotice(
        item.kind === 'project'
          ? `Projeto "${item.label}" apagado (liberou ${size}). O vídeo original no seu computador continua lá.`
          : item.kind === 'other'
            ? `"${item.label}" apagado (liberou ${size}). Se o app precisar, baixa de novo.`
            : `${item.label} apagado (liberou ${size}). Ele será baixado de novo, uma vez, quando for preciso (${item.kind === 'asr-model' ? 'na próxima legenda' : 'na próxima vez que você ligar a IA'}).`,
      );
    } catch (err) {
      setErrors([toAppError(err, 'APAGAR_FALHOU')]);
    }
    await refresh();
  }

  async function wipe() {
    setWiping(true);
    setNotice(null);
    setErrors([]);
    try {
      await deleteEverything(deps);
      setNotice('Tudo do Motion4Free foi apagado deste navegador: projetos, modelos e preferências. Seus vídeos originais continuam no computador.');
    } catch (err) {
      setErrors([toAppError(err, 'APAGAR_FALHOU')]);
    }
    setConfirmAll(false);
    setWord('');
    setWiping(false);
    onEverythingDeleted();
    await refresh();
  }

  async function persist() {
    const ok = await deps.quota?.persist().catch(() => false);
    if (!ok) setErrors([new AppError('PERSISTENCIA_NEGADA', ok === null ? 'navigator.storage.persist ausente' : 'persist() devolveu false')]);
    else setErrors([]);
    await refresh();
  }

  const r = report;
  const used = r?.estimate?.usage ?? r?.measuredBytes ?? 0;
  const quota = r?.estimate?.quota ?? null;
  const all = r ? [...r.projects, ...r.asrModels, ...r.aiModels, ...r.other] : [];
  const unaccounted = r && r.unaccountedBytes > 0 && (
    <li className="st-row" data-testid="storage-item-unaccounted">
      <div className="st-row-main">
        <span className="st-row-label">Outros dados do navegador</span>
        <span className="hint st-row-detail">Espaço de controle do navegador e arquivos do próprio app (letras, ícones). Não dá para separar; sai com "Apagar tudo" ou nas configurações do navegador.</span>
      </div>
      <b className="tnum st-row-size">{formatBytes(r.unaccountedBytes)}</b>
      <span />
    </li>
  );

  return (
    <Dialog title="Armazenamento" onClose={onClose} wide testId="storage-screen">
      <p className="m4f-callout ok st-privacy">
        <ShieldCheck size={16} aria-hidden />
        <span>
          <b>Tudo fica só neste computador</b>, dentro deste navegador. Nada é enviado para a internet. O app guarda uma <i>cópia</i> dos vídeos: seus arquivos originais nunca são apagados nem alterados.
        </span>
      </p>

      {!r ? (
        <div className="st-loading">
          <ProgressPanel progress={MEASURING} compact testId="storage-measuring" />
        </div>
      ) : (
        <>
          <div className="st-summary card">
            <div className="st-total">
              <HardDrive size={22} aria-hidden />
              <div>
                <p>
                  O Motion4Free está usando <b className="tnum" data-testid="storage-total" data-bytes={used}>{formatBytes(used)}</b>
                  {quota !== null && (
                    <>
                      {' '}
                      de <span className="tnum" data-testid="storage-quota">{formatBytes(quota)}</span> que o navegador libera para ele
                    </>
                  )}
                  .
                </p>
                {quota !== null && (
                  <p className="hint" data-testid="storage-quota-note">
                    Este número vem do navegador. Alguns (como o Brave) mostram um limite menor que o real para proteger a privacidade; o app não se bloqueia por ele e só avisa se o navegador recusar guardar algo.
                  </p>
                )}
                {quota !== null && (
                  <div className="bar st-bar" aria-hidden>
                    <span style={{ width: `${Math.max(1, Math.min(100, (used / quota) * 100))}%` }} />
                  </div>
                )}
              </div>
            </div>
            <div className="st-persist" data-testid="storage-persist" data-persisted={String(r.persisted)}>
              {r.persisted ? (
                <p>
                  <Lock size={15} aria-hidden /> <b>Guardado de forma permanente:</b> o navegador só apaga se você mandar.
                </p>
              ) : (
                <>
                  <p>
                    <LockOpen size={15} aria-hidden /> {r.persisted === null ? 'Este navegador não diz se os dados são permanentes.' : 'O navegador pode apagar estes dados sozinho se o computador ficar sem espaço.'}
                  </p>
                  {r.persisted === false && (
                    <button className="sm" onClick={persist} data-testid="storage-persist-btn">
                      <Lock size={14} aria-hidden /> Pedir para guardar de forma permanente
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {[...r.problems, ...errors].map((e, i) => (
            <ErrorBox key={`${e.code}-${i}`} error={e} kind="warning" />
          ))}
          {notice && (
            <p className="m4f-callout ok" role="status" data-testid="storage-notice">
              <Check size={16} aria-hidden /> <span>{notice}</span>
            </p>
          )}

          <Section title="Projetos" icon={<Film size={16} aria-hidden />} items={r.projects} empty="Nenhum projeto salvo." current={currentProjectId} onDelete={remove} />
          <Section title="Modelos de legenda" icon={<Captions size={16} aria-hidden />} items={r.asrModels} empty="Nenhum modelo de legenda baixado ainda. Ele é baixado na primeira legenda." current={null} onDelete={remove} />
          <Section title="Modelos de IA" icon={<Bot size={16} aria-hidden />} items={r.aiModels} empty="Nenhum modelo de IA baixado (a IA no navegador é opcional)." current={null} onDelete={remove} />
          <Section title="Outros" icon={<Package size={16} aria-hidden />} items={r.other} empty="Nada mais." current={null} onDelete={remove} extra={unaccounted || undefined} />

          <section className="st-danger">
            <h3>Apagar tudo do Motion4Free</h3>
            <p className="hint">Tira deste navegador todos os projetos, modelos baixados, preferências (tema, precisão da legenda) e a chave de IA, se você guardou uma. Os vídeos originais no computador ficam.</p>
            {confirmAll ? (
              <form
                className="st-wipe"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (word.trim().toUpperCase() === CONFIRM_WORD) void wipe();
                }}
              >
                <p className="m4f-strong-warn">
                  Vai apagar {all.length} {all.length === 1 ? 'item' : 'itens'} ({formatBytes(used)}). Não dá para desfazer.
                </p>
                <label>
                  Para confirmar, digite <b>{CONFIRM_WORD}</b>:
                  <input value={word} onChange={(e) => setWord(e.target.value)} autoFocus autoComplete="off" data-testid="delete-all-input" />
                </label>
                <div className="st-confirm-btns">
                  <button type="button" onClick={() => (setConfirmAll(false), setWord(''))} disabled={wiping}>
                    Cancelar
                  </button>
                  <button type="submit" className="danger-solid" disabled={wiping || word.trim().toUpperCase() !== CONFIRM_WORD} data-testid="delete-all-confirm">
                    {wiping ? <span className="spinner" aria-hidden /> : <Trash2 size={15} aria-hidden />} Apagar tudo
                  </button>
                </div>
              </form>
            ) : (
              <button className="danger" onClick={() => setConfirmAll(true)} data-testid="delete-all">
                <Trash2 size={15} aria-hidden /> Apagar tudo do Motion4Free…
              </button>
            )}
          </section>
        </>
      )}
    </Dialog>
  );
}
