import { useEffect, useState } from 'react';
import { detectAsrCapability } from '../asr/capability';
import { ASR_MENU, ASR_MENU_KEYS, ASR_MODES, NO_CAPABILITY, chosenLadder, defaultAsrMode, describeMode, type AsrCandidateId, type AsrCapability, type AsrMenuKey, type AsrMode, type AsrRequest } from '../core/asr-models';

const KEY = 'm4f.precisaoLegenda';
/** IA escolhida no cardápio (v0.38): 'auto' ou uma chave de ASR_MENU */
const MODEL_KEY = 'm4f.iaLegenda';
/** conferência dupla ligada ('1') ou não */
const CHECK_KEY = 'm4f.conferenciaDupla';
/** avisa as outras telas abertas (Configurações e a área de envio) que a escolha mudou */
const EVENT = 'm4f-precisao-legenda';

export type AsrModelChoice = 'auto' | AsrMenuKey;

interface Saved {
  mode: AsrMode | null;
  model: AsrModelChoice;
  check: boolean;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // sem armazenamento: vale só nesta aba
  }
}

function readSaved(): Saved {
  const mode = read(KEY);
  const model = read(MODEL_KEY);
  return {
    mode: mode && (ASR_MODES as string[]).includes(mode) ? (mode as AsrMode) : null,
    model: model && (ASR_MENU_KEYS as string[]).includes(model) ? (model as AsrMenuKey) : 'auto',
    check: read(CHECK_KEY) === '1',
  };
}

export interface AsrPrecision {
  mode: AsrMode;
  setMode(mode: AsrMode): void;
  /** IA escolhida no cardápio; 'auto' = o app escolhe pela placa de vídeo e pelo modo */
  model: AsrModelChoice;
  setModel(model: AsrModelChoice): void;
  /** conferência dupla: uma segunda IA ouve de novo e marca as palavras em que discordam */
  check: boolean;
  setCheck(check: boolean): void;
  /** o modelo escolhido no cardápio, na versão que roda neste aparelho (null = automático ou não roda aqui) */
  chosen: AsrCandidateId | null;
  /** o pedido que vai para a transcrição (modo ou escada, com ou sem conferência) */
  request: AsrRequest;
  capability: AsrCapability;
  /** texto curto de cada opção (modelo, onde roda, download na primeira vez) */
  describe(mode: AsrMode): string;
}

/** Pedido de transcrição a partir das escolhas (puro: usado pelo hook e pelos testes). */
export function buildRequest(mode: AsrMode, model: AsrModelChoice, check: boolean, c: AsrCapability): { request: AsrRequest; chosen: AsrCandidateId | null } {
  const chosen = model === 'auto' ? null : ASR_MENU[model].pick(c);
  const ladder: AsrMode | AsrCandidateId[] = chosen ? chosenLadder(chosen, c) : mode;
  return { request: check ? { ladder, check: true } : ladder, chosen };
}

/**
 * Configuração da legenda: precisão (Rápida / Precisa), IA escolhida no cardápio e conferência dupla. Hook sem
 * layout próprio: qualquer tela lê e muda (Configurações › Transcrição; a área de envio mostra um resumo).
 * As escolhas ficam lembradas neste navegador.
 */
export function useAsrPrecision(): AsrPrecision {
  const [capability, setCapability] = useState<AsrCapability>(NO_CAPABILITY);
  const [saved, setSaved] = useState<Saved>(readSaved);
  useEffect(() => {
    const sync = () => setSaved(readSaved());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  useEffect(() => {
    let alive = true;
    detectAsrCapability().then((c) => alive && setCapability(c));
    return () => {
      alive = false;
    };
  }, []);
  const update = (next: Partial<Saved>) => {
    const merged = { ...saved, ...next };
    setSaved(merged);
    if (next.mode) write(KEY, next.mode);
    if (next.model) write(MODEL_KEY, next.model);
    if (next.check !== undefined) write(CHECK_KEY, next.check ? '1' : '0');
    window.dispatchEvent(new CustomEvent(EVENT));
  };
  const mode = saved.mode ?? defaultAsrMode(capability);
  const { request, chosen } = buildRequest(mode, saved.model, saved.check, capability);
  return {
    mode,
    setMode: (m) => update({ mode: m }),
    model: saved.model,
    setModel: (m) => update({ model: m }),
    check: saved.check,
    setCheck: (v) => update({ check: v }),
    chosen,
    request,
    capability,
    describe: (m) => describeMode(m, capability),
  };
}
