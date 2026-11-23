import { useCallback, useEffect, useState } from 'preact/hooks';
import { accountShortcutLabel } from '../shared/shortcuts';
import { ColumnHeaders } from './components/ColumnHeaders';
import { Sidebar } from './components/Sidebar';
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

  if (!state) return null;
  const providerLabel = (id: string) => state.providers.find((p) => p.id === id)?.label ?? id;
  // Raccourci de chaque compte, seulement tant que ⌘ / Ctrl est maintenu.
  const shortcutOf = (id: string): string | null =>
    showHints
      ? accountShortcutLabel(
          state.accounts.findIndex((a) => a.id === id),
          isMac
        )
      : null;

  return (
    <>
      <Sidebar
        state={state}
        isMac={isMac}
        renamingId={renamingId}
        setRenamingId={setRenamingId}
        providerLabel={providerLabel}
        shortcutOf={shortcutOf}
      />
      <ColumnHeaders state={state} providerLabel={providerLabel} shortcutOf={shortcutOf} />
    </>
  );
}
