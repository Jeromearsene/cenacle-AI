import { useCallback, useEffect, useState } from 'preact/hooks';
import { translator } from '../shared/i18n';
import { accountShortcutLabel } from '../shared/shortcuts';
import { ColumnHeaders } from './components/ColumnHeaders';
import { Sidebar } from './components/Sidebar';
import { I18nProvider } from './i18n';
import { api, useMultiState, useRenameRequest, useShortcutHint } from './use-multi';

const isMac = api.platform === 'darwin';

export function App() {
  const state = useMultiState();
  const showHints = useShortcutHint();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  useRenameRequest(useCallback((id: string) => setRenamingId(id), []));

  useEffect(() => {
    if (state) document.title = state.appName;
  }, [state?.appName]);
  useEffect(() => {
    if (state) document.documentElement.lang = state.locale;
  }, [state?.locale]);

  if (!state) return null;
  const providerLabel = (id: string) => state.providers.find((p) => p.id === id)?.label ?? id;
  // Shortcut of each account, only while ⌘ / Ctrl is held.
  const shortcutOf = (id: string): string | null =>
    showHints
      ? accountShortcutLabel(
          state.accounts.findIndex((a) => a.id === id),
          isMac
        )
      : null;

  return (
    <I18nProvider value={translator(state.locale)}>
      <Sidebar
        state={state}
        isMac={isMac}
        renamingId={renamingId}
        setRenamingId={setRenamingId}
        providerLabel={providerLabel}
        shortcutOf={shortcutOf}
      />
      <ColumnHeaders state={state} providerLabel={providerLabel} shortcutOf={shortcutOf} />
    </I18nProvider>
  );
}
