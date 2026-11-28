import { Fragment } from 'preact';
import { providersInUse, visibleAccounts } from '../../shared/provider-view';
import {
  clampSidebarW,
  SIDEBAR_DEFAULT_W,
  SIDEBAR_MAX_W,
  SIDEBAR_MIN_W,
} from '../../shared/sidebar';
import type { PublicState } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { useNow } from '../use-now';
import { AccountItem } from './AccountItem';
import { AddAccount } from './AddAccount';
import { CenacleMark, EqualizeIcon } from './icons';
import { LayoutToggle } from './LayoutToggle';
import { ProviderFilter } from './ProviderFilter';
import { ProviderGroupHead } from './ProviderGroupHead';
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
  /** A press on the resize handle: it may turn into a drag of the sidebar's own width. */
  onResizeStart: (width: number, event: PointerEvent) => void;
  /** The resize handle is the one being dragged right now. */
  resizing: boolean;
}

/** Width moved by one press of an arrow key on the resize handle. */
const SIDEBAR_KEY_STEP = 16;

export function Sidebar({
  state,
  isMac,
  renamingId,
  setRenamingId,
  providerLabel,
  shortcutOf,
  onDragStart,
  openSettingsRequest,
  onResizeStart,
  resizing,
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
      {/* The top of the sidebar: the app name and mark, which also drag the window. On macOS the
          window buttons sit at its left, except in full screen where they are hidden. */}
      <header
        class={`-mx-2.5 mb-1 flex items-center gap-2 px-4 [-webkit-app-region:drag] ${isMac ? 'h-10' : 'h-12'}`}
      >
        {isMac && !state.fullscreen && <span class="w-[58px] flex-none" aria-hidden="true" />}
        <CenacleMark />
        <h1 class="brand m-0 truncate font-serif text-[20px] leading-none font-medium tracking-[-0.01em]">
          {state.appName}
        </h1>
      </header>
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
        {listed.map((acc, i) => (
          <Fragment key={acc.id}>
            {several && sort === 'provider' && acc.provider !== listed[i - 1]?.provider && (
              <ProviderGroupHead
                label={providerLabel(acc.provider)}
                icon={state.providers.find((p) => p.id === acc.provider)?.icon}
                count={listed.filter((a) => a.provider === acc.provider).length}
              />
            )}
            <AccountItem
              account={acc}
              providerLabel={providerLabel(acc.provider)}
              providerIcon={state.providers.find((p) => p.id === acc.provider)?.icon}
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
          </Fragment>
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
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable "window splitter" (WAI-ARIA); an <hr> cannot take the pointer or the arrow keys */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('sidebar.resize')}
        aria-valuenow={state.sidebarW}
        aria-valuemin={SIDEBAR_MIN_W}
        aria-valuemax={SIDEBAR_MAX_W}
        data-grabbed={resizing}
        tabIndex={0}
        title={t('sidebar.resizeHint')}
        class={`sidebar-handle absolute inset-y-0 right-0 w-[5px] cursor-col-resize [-webkit-app-region:no-drag] hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none ${resizing ? 'bg-accent/60' : ''}`}
        onPointerDown={(e) => onResizeStart(state.sidebarW, e)}
        onKeyDown={(e) => {
          const step =
            e.key === 'ArrowRight'
              ? SIDEBAR_KEY_STEP
              : e.key === 'ArrowLeft'
                ? -SIDEBAR_KEY_STEP
                : 0;
          if (!step) return;
          e.preventDefault();
          void api.resizeSidebar(clampSidebarW(state.sidebarW + step));
        }}
        onDblClick={() => void api.resizeSidebar(SIDEBAR_DEFAULT_W)}
      />
    </aside>
  );
}
