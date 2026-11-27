import { useCallback, useEffect, useState } from 'preact/hooks';
import { translator } from '../shared/i18n';
import { accountShortcutLabel } from '../shared/shortcuts';
import { CellHeaders } from './components/CellHeaders';
import { GridOverlay } from './components/GridOverlay';
import { Sidebar } from './components/Sidebar';
import { I18nProvider } from './i18n';
import { useAccountDrag, useDividerDrag, useDragCursor } from './use-grid-drag';
import {
  api,
  useMultiState,
  useOpenSettingsRequest,
  useRenameRequest,
  useShortcutHint,
} from './use-multi';

const isMac = api.platform === 'darwin';

export function App() {
  const state = useMultiState();
  const showHints = useShortcutHint();
  const { drag, start: startAccountDrag } = useAccountDrag(state);
  const { resizing, start: startDividerDrag } = useDividerDrag();
  useDragCursor(
    drag ? 'grabbing' : resizing ? (resizing.axis === 'row' ? 'col-resize' : 'row-resize') : null
  );
  const [renamingId, setRenamingId] = useState<string | null>(null);
  useRenameRequest(useCallback((id: string) => setRenamingId(id), []));
  const openSettingsRequest = useOpenSettingsRequest();

  useEffect(() => {
    if (state) document.title = state.appName;
  }, [state?.appName]);
  useEffect(() => {
    if (state) document.documentElement.lang = state.locale;
  }, [state?.locale]);
  useEffect(() => {
    // 'system' removes the attribute: styles.css then follows prefers-color-scheme, as before
    // this setting existed. An explicit light/dark choice always wins (see styles.css).
    if (!state) return;
    if (state.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = state.theme;
  }, [state?.theme]);

  if (!state) return null;
  const providerLabel = (id: string) => state.providers.find((p) => p.id === id)?.label ?? id;
  // Shortcut of each account, only while ⌘ / Ctrl is held.
  const inGrid = new Set(state.rects.map((r) => r.id));
  const shortcutOf = (id: string): string | null =>
    // an account outside the grid cannot be switched to, so it has no shortcut either
    showHints && (state.layout !== 'grid' || inGrid.has(id))
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
        onDragStart={startAccountDrag}
        openSettingsRequest={openSettingsRequest}
      />
      <CellHeaders
        state={state}
        isMac={isMac}
        providerLabel={providerLabel}
        shortcutOf={shortcutOf}
        onDragStart={startAccountDrag}
      />
      <GridOverlay state={state} drag={drag} resizing={resizing} onDividerDown={startDividerDrag} />
    </I18nProvider>
  );
}
