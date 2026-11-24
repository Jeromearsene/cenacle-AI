import type { PublicState } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { AccountItem } from './AccountItem';
import { AddAccount } from './AddAccount';
import { LayoutToggle } from './LayoutToggle';

interface Props {
  state: PublicState;
  isMac: boolean;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  providerLabel: (id: string) => string;
  shortcutOf: (id: string) => string | null;
  /** A press on an account: it may turn into a drag onto the grid. */
  onDragStart: (id: string, event: PointerEvent) => void;
}

export function Sidebar({
  state,
  isMac,
  renamingId,
  setRenamingId,
  providerLabel,
  shortcutOf,
  onDragStart,
}: Props) {
  const t = useT();
  const gridIds = new Set(state.rects.map((r) => r.id));
  return (
    <aside
      class="absolute inset-y-0 left-0 flex flex-col border-r border-line bg-panel px-2.5 pb-3"
      style={{ width: `${state.sidebarW}px` }}
    >
      {/* window drag area; on macOS, room for the window buttons */}
      <div class={`-mx-2.5 [-webkit-app-region:drag] ${isMac ? 'h-10' : 'h-3'}`} />
      <div class="brand px-2 pt-0.5 pb-2.5 font-semibold tracking-[0.01em]">{state.appName}</div>
      <nav
        id="accounts"
        aria-label={t('sidebar.accounts')}
        class="flex flex-col gap-0.5 overflow-y-auto"
      >
        {state.accounts.map((acc) => (
          <AccountItem
            key={acc.id}
            account={acc}
            providerLabel={providerLabel(acc.provider)}
            shortcut={shortcutOf(acc.id)}
            active={acc.id === state.activeId}
            outsideGrid={state.layout === 'grid' && !gridIds.has(acc.id)}
            onDragStart={(e) => onDragStart(acc.id, e)}
            removable={state.accounts.length > 1}
            editing={renamingId === acc.id}
            onStartRename={() => setRenamingId(acc.id)}
            onCancelRename={() => setRenamingId(null)}
            onRename={(name) => {
              setRenamingId(null);
              const clean = name.trim();
              if (clean && clean !== acc.name) void api.renameAccount(acc.id, clean);
            }}
          />
        ))}
      </nav>
      <AddAccount providers={state.providers} />
      <div class="flex-1" />
      <LayoutToggle layout={state.layout} />
    </aside>
  );
}
