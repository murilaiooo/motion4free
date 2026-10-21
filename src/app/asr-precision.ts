import { useEffect, useState } from 'react';
import { detectAsrCapability } from '../asr/capability';
import { ASR_MODES, NO_CAPABILITY, defaultAsrMode, describeMode, type AsrCapability, type AsrMode } from '../core/asr-models';

const KEY = 'm4f.precisaoLegenda';
/** avisa as outras telas abertas (Configurações e a área de envio) que a escolha mudou */
const EVENT = 'm4f-precisao-legenda';

function readSaved(): AsrMode | null {
  try {
    const v = localStorage.getItem(KEY);
    return v && (ASR_MODES as string[]).includes(v) ? (v as AsrMode) : null;
  } catch {
    return null;
  }
}

export interface AsrPrecision {
  mode: AsrMode;
  setMode(mode: AsrMode): void;
  capability: AsrCapability;
  /** texto curto de cada opção (modelo, onde roda, download na primeira vez) */
  describe(mode: AsrMode): string;
}

/**
 * Configuração "Precisão da legenda" (Rápida / Precisa). Hook sem layout próprio: qualquer tela lê e muda
 * (Configurações › Transcrição; a área de envio mostra um resumo). A escolha fica lembrada neste navegador.
 */
export function useAsrPrecision(): AsrPrecision {
  const [capability, setCapability] = useState<AsrCapability>(NO_CAPABILITY);
  const [saved, setSaved] = useState<AsrMode | null>(readSaved);
  useEffect(() => {
    const sync = (e: Event) => setSaved((e as CustomEvent<AsrMode>).detail);
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
  return {
    mode: saved ?? defaultAsrMode(capability),
    setMode(mode) {
      setSaved(mode);
      try {
        localStorage.setItem(KEY, mode);
      } catch {
        // sem armazenamento: vale só nesta aba
      }
      window.dispatchEvent(new CustomEvent<AsrMode>(EVENT, { detail: mode }));
    },
    capability,
    describe: (mode) => describeMode(mode, capability),
  };
}
