import { getKey, useKeysVersion } from '../ai/credentials/keys';
import { PROVIDERS } from '../ai/providers/registry';
import { useAsrRoute } from '../asr/route';
import { privacyStatus, type PrivacyStatus } from '../core/privacy-status';
import { useAiSettings } from './AiOptions';

/** Estado real do que sai do computador agora (#153), atualizado quando a rota, a chave ou a autorização mudam. */
export function usePrivacyStatus(): PrivacyStatus {
  const route = useAsrRoute();
  const ai = useAiSettings();
  useKeysVersion();
  return privacyStatus({
    asr: {
      kind: route.kind,
      providerName: route.provider ? PROVIDERS[route.provider].name : null,
      keyOpen: !!route.provider && !!getKey(route.provider),
      audioConsent: !!route.provider && route.audioConsent.includes(route.provider),
      fallbackLocal: route.fallbackLocal,
    },
    text: {
      kind: ai.mode,
      providerName: ai.provider ? PROVIDERS[ai.provider].name : null,
      keyOpen: !!ai.provider && !!getKey(ai.provider),
      textConsent: !!ai.provider && ai.consent.includes(ai.provider),
    },
  });
}
