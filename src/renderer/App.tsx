import { useCallback, useEffect, useState } from 'preact/hooks';
import { ColumnHeaders } from './components/ColumnHeaders';
import { Sidebar } from './components/Sidebar';
import { api, useMultiState, useRenameRequest } from './use-multi';

const isMac = api.platform === 'darwin';

export function App() {
  const state = useMultiState();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  useRenameRequest(useCallback((id: string) => setRenamingId(id), []));

  useEffect(() => {
    if (state) document.title = state.appName;
  }, [state?.appName]);

  if (!state) return null;
  const providerLabel = (id: string) => state.providers.find((p) => p.id === id)?.label ?? id;

  return (
    <>
      <Sidebar
        state={state}
        isMac={isMac}
        renamingId={renamingId}
        setRenamingId={setRenamingId}
        providerLabel={providerLabel}
      />
      <ColumnHeaders state={state} providerLabel={providerLabel} />
    </>
  );
}
