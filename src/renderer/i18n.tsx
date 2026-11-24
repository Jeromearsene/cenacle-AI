import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { DEFAULT_LOCALE, type Translate, translator } from '../shared/i18n';

const I18nContext = createContext<Translate>(translator(DEFAULT_LOCALE));

export const I18nProvider = I18nContext.Provider;

/** The `t(key)` function for the interface language chosen by the main process. */
export function useT(): Translate {
  return useContext(I18nContext);
}
