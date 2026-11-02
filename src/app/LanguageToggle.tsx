import { useSyncExternalStore } from 'react';
import { Languages } from 'lucide-react';
import { getLocale, LOCALES, setLocale, subscribeLocale, type Locale } from '../i18n/locale';
import './language-toggle.css';

const NAMES: Record<Locale, { short: string; full: string }> = {
  en: { short: 'EN', full: 'English' },
  pt: { short: 'PT', full: 'Português' },
};

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

/**
 * Botão de idioma (v0.40), sempre visível ao lado de Configurações em todas as telas.
 * Os nomes "EN"/"PT" ficam fora da tradução (translate="no") para a pessoa achar o próprio idioma.
 */
export function LanguageToggle({ large = false }: { large?: boolean }) {
  const locale = useLocale();
  return (
    <div className={`lang-toggle ${large ? 'large' : ''}`} role="group" aria-label="Idioma do app" data-tip="Trocar o idioma do app" data-testid="language-toggle">
      <Languages size={large ? 16 : 15} aria-hidden className="lang-icon" />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          translate="no"
          lang={l === 'en' ? 'en' : 'pt-BR'}
          className={l === locale ? 'on' : ''}
          aria-pressed={l === locale}
          title={NAMES[l].full}
          onClick={() => setLocale(l)}
          data-testid={`language-${l}`}
        >
          {large ? NAMES[l].full : NAMES[l].short}
        </button>
      ))}
    </div>
  );
}
