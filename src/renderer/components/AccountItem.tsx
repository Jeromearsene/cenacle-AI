import { formatRemaining, formatTime, type QuotaInfo } from '../../shared/quota';
import type { Account } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { IconButton } from './IconButton';
import { QuotaBar, QuotaPill, quotaTooltip, toneClasses } from './Quota';
import { RenameInput } from './RenameInput';

interface Props {
  account: Account;
  providerLabel: string;
  /** Shortcut to show (⌘ / Ctrl held), or null. */
  shortcut: string | null;
  active: boolean;
  /** A notification from this account has not been seen yet. */
  unread: boolean;
  /** Grid mode, and this account is not in the grid. */
  outsideGrid: boolean;
  onDragStart: (event: PointerEvent) => void;
  removable: boolean;
  editing: boolean;
  /** Usage limit state of the account, if it is close or reached. */
  quota?: QuotaInfo;
  now: number;
  locale: string;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
}

export function AccountItem({
  account,
  providerLabel,
  shortcut,
  active,
  unread,
  outsideGrid,
  onDragStart,
  removable,
  editing,
  quota,
  now,
  locale,
  onStartRename,
  onRename,
  onCancelRename,
}: Props) {
  const t = useT();
  const tone = quota ? toneClasses(quota, now) : null;
  // What the hover says: that the account is out of the grid and, if close, its usage limit.
  const accountTitle =
    [
      outsideGrid ? t('account.notInGrid') : null,
      quota ? quotaTooltip(t, locale, account.name, quota, now) : null,
    ]
      .filter(Boolean)
      .join('\n') || undefined;
  return (
    // biome-ignore lint/a11y/useSemanticElements: the row contains other buttons (rename, delete); a nested <button> would be invalid
    <div
      role="button"
      tabIndex={0}
      aria-current={active}
      title={accountTitle}
      class={`account group flex cursor-pointer flex-col justify-center rounded-[7px] px-2 hover:bg-hover focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${active ? 'active bg-active' : ''} ${outsideGrid ? 'outside opacity-60' : ''}`}
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
      <div class="flex h-8 items-center gap-2">
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
              class={`name min-w-0 flex-1 truncate ${quota?.level === 'reached' ? 'opacity-70' : ''} ${unread ? 'font-semibold' : ''}`}
              title={account.name}
              onDblClick={onStartRename}
            >
              {account.name}
            </span>
            {unread && (
              <span
                role="img"
                aria-label={t('account.unread')}
                title={t('account.unread')}
                class="unread-dot size-[7px] flex-none rounded-full bg-accent"
              />
            )}
            {shortcut ? (
              <kbd class="shortcut flex-none rounded-full border border-line bg-bg px-2 font-sans text-[11px] font-medium text-muted">
                {shortcut}
              </kbd>
            ) : quota ? (
              <span class="flex-none group-focus-within:hidden group-hover:hidden">
                <QuotaPill info={quota} now={now} t={t} locale={locale} />
              </span>
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
      {quota && !editing && tone && (
        <div class="quota-detail flex flex-col gap-1.5 pr-0.5 pb-1.5 pl-[17px]">
          <span class={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] ${tone.text}`}>
            <span class="quota-at">
              {t('quota.backAt', { time: formatTime(quota.resetsAt, locale) })}
            </span>
            <span
              class={`quota-left whitespace-nowrap rounded-full px-1.5 py-px font-medium tabular-nums ${tone.pill}`}
            >
              {t('quota.left', { left: formatRemaining(quota.resetsAt - now) })}
            </span>
          </span>
          <QuotaBar info={quota} now={now} class="h-1" />
        </div>
      )}
    </div>
  );
}
