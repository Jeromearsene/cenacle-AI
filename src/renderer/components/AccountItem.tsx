import type { Account } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { IconButton } from './IconButton';
import { RenameInput } from './RenameInput';

interface Props {
  account: Account;
  providerLabel: string;
  /** Shortcut to show (⌘ / Ctrl held), or null. */
  shortcut: string | null;
  active: boolean;
  /** Grid mode, and this account is not in the grid. */
  outsideGrid: boolean;
  onDragStart: (event: PointerEvent) => void;
  removable: boolean;
  editing: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
}

export function AccountItem({
  account,
  providerLabel,
  shortcut,
  active,
  outsideGrid,
  onDragStart,
  removable,
  editing,
  onStartRename,
  onRename,
  onCancelRename,
}: Props) {
  const t = useT();
  return (
    // biome-ignore lint/a11y/useSemanticElements: the row contains other buttons (rename, delete); a nested <button> would be invalid
    <div
      role="button"
      tabIndex={0}
      aria-current={active}
      title={outsideGrid ? t('account.notInGrid') : undefined}
      class={`account group flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 hover:bg-hover focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${active ? 'active bg-active' : ''} ${outsideGrid ? 'outside opacity-60' : ''}`}
      onPointerDown={(e) => {
        // A press on the buttons or the rename field stays a plain click.
        if (!editing && !(e.target as Element).closest('button, input')) onDragStart(e);
      }}
      onClick={() => void api.selectAccount(account.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          void api.selectAccount(account.id);
        }
      }}
    >
      <span
        class={`dot size-[9px] flex-none rounded-full ${outsideGrid ? 'hollow' : ''}`}
        style={
          outsideGrid
            ? { boxShadow: `inset 0 0 0 1.5px ${account.color}` }
            : { backgroundColor: account.color }
        }
      />
      {editing ? (
        <RenameInput initial={account.name} onCommit={onRename} onCancel={onCancelRename} />
      ) : (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: mouse shortcut; the keyboard equivalent is the "Rename" button */}
          <span
            class="name min-w-0 flex-1 truncate"
            title={account.name}
            onDblClick={onStartRename}
          >
            {account.name}
          </span>
          {shortcut ? (
            <kbd class="shortcut flex-none rounded border border-line bg-bg px-1.5 font-sans text-[11px] text-muted">
              {shortcut}
            </kbd>
          ) : (
            <span class="tag flex-none text-[11px] text-muted group-focus-within:hidden group-hover:hidden">
              {providerLabel}
            </span>
          )}
          <span
            class={`actions gap-0.5 ${shortcut ? 'hidden' : 'hidden group-focus-within:flex group-hover:flex'}`}
          >
            <IconButton label={t('account.rename')} glyph="✎" onClick={onStartRename} />
            {removable && (
              <IconButton
                label={t('account.delete')}
                glyph="✕"
                onClick={() => void api.removeAccount(account.id)}
              />
            )}
          </span>
        </>
      )}
    </div>
  );
}
