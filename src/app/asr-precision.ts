import { useEffect, useState } from 'react';
import { detectAsrCapability } from '../asr/capability';
import { ASR_MODES, NO_CAPABILITY, defaultAsrMode, describeMode, type AsrCapability, type AsrMode } from '../core/asr-models';

const KEY = 'm4f.precisaoLegenda';

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
 * (hoje o componente AsrPrecisionOption na área de envio). A escolha fica lembrada neste navegador.
 */
export function useAsrPrecision(): AsrPrecision {
  const [capability, setCapability] = useState<AsrCapability>(NO_CAPABILITY);
  const [saved, setSaved] = useState<AsrMode | null>(readSaved);
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
    },
    capability,
    describe: (mode) => describeMode(mode, capability),
  };
}
