import { providersInUse, visibleAccounts } from '../../shared/provider-view';
import type { PublicState } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { useNow } from '../use-now';
import { AccountItem } from './AccountItem';
import { AddAccount } from './AddAccount';
import { EqualizeIcon } from './icons';
import { LayoutToggle } from './LayoutToggle';
import { ProviderFilter } from './ProviderFilter';
import { ResourceUsagePanel } from './ResourceUsagePanel';
import { Settings } from './Settings';

interface Props {
  state: PublicState;
  isMac: boolean;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  providerLabel: (id: string) => string;
  shortcutOf: (id: string) => string | null;
  /** A press on an account: it may turn into a drag onto the grid. */
  onDragStart: (id: string, event: PointerEvent) => void;
  openSettingsRequest: number | null;
}

export function Sidebar({
  state,
  isMac,
  renamingId,
  setRenamingId,
  providerLabel,
  shortcutOf,
  onDragStart,
  openSettingsRequest,
}: Props) {
  const t = useT();
  const gridIds = new Set(state.rects.map((r) => r.id));
  const unreadIds = new Set(state.unread);
  const now = useNow(30_000, Object.keys(state.quotas).length > 0);
  const { filter, sort } = state.accountView;
  const inUse = providersInUse(state.accounts, state.providers);
  // The filter and the grouping only matter once there are several services to tell apart.
  const several = inUse.length > 1;
  const listed = visibleAccounts(state.accounts, state.providers, state.accountView);
  return (
    <aside
      class="absolute inset-y-0 left-0 flex flex-col border-r border-line bg-panel px-2.5 pb-3"
      style={{ width: `${state.sidebarW}px` }}
    >
      {/* window drag area; on macOS, room for the window buttons */}
      <div class={`-mx-2.5 [-webkit-app-region:drag] ${isMac ? 'h-10' : 'h-3'}`} />
      <div class="brand px-2 pt-0.5 pb-2.5 font-semibold tracking-[0.01em]">{state.appName}</div>
      {several && (
        <ProviderFilter
          providers={inUse}
          total={state.accounts.length}
          filter={filter}
          onFilter={(next) => void api.setAccountView({ filter: next, sort })}
          sort={sort}
          onSort={(next) => void api.setAccountView({ filter, sort: next })}
        />
      )}
      <nav
        id="accounts"
        aria-label={t('sidebar.accounts')}
        class="flex flex-col gap-0.5 overflow-y-auto"
      >
        {listed.map((acc) => (
          <AccountItem
            key={acc.id}
            account={acc}
            providerLabel={providerLabel(acc.provider)}
            shortcut={shortcutOf(acc.id)}
            active={acc.id === state.activeId}
            unread={unreadIds.has(acc.id)}
            outsideGrid={state.layout === 'grid' && !gridIds.has(acc.id)}
            onDragStart={(e) => onDragStart(acc.id, e)}
            removable={state.accounts.length > 1}
            editing={renamingId === acc.id}
            quota={state.quotas[acc.id]}
            now={now}
            locale={state.locale}
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
      {state.layout === 'grid' && state.rects.length > 1 && (
        <button
          type="button"
          class="equalize mb-2 flex h-[28px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-transparent text-muted hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
          onClick={() => void api.equalizeGrid()}
        >
          <EqualizeIcon />
          {t('grid.equalize')}
        </button>
      )}
      <LayoutToggle layout={state.layout} />
      <ResourceUsagePanel accounts={state.accounts} locale={state.locale} />
      <Settings state={state} openRequest={openSettingsRequest} />
    </aside>
  );
}
