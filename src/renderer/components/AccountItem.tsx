import type { Account } from '../../shared/types';
import { api } from '../use-multi';
import { IconButton } from './IconButton';
import { RenameInput } from './RenameInput';

interface Props {
  account: Account;
  providerLabel: string;
  active: boolean;
  removable: boolean;
  editing: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
}

export function AccountItem({
  account,
  providerLabel,
  active,
  removable,
  editing,
  onStartRename,
  onRename,
  onCancelRename,
}: Props) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: la ligne contient d'autres boutons (renommer, supprimer) ; un <button> imbriqué serait invalide
    <div
      role="button"
      tabIndex={0}
      aria-current={active}
      class={`account group flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 hover:bg-hover focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent ${active ? 'active bg-active' : ''}`}
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
        class="dot size-[9px] flex-none rounded-full"
        style={{ backgroundColor: account.color }}
      />
      {editing ? (
        <RenameInput initial={account.name} onCommit={onRename} onCancel={onCancelRename} />
      ) : (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: raccourci souris ; l'équivalent clavier est le bouton « Renommer » */}
          <span
            class="name min-w-0 flex-1 truncate"
            title={account.name}
            onDblClick={onStartRename}
          >
            {account.name}
          </span>
          <span class="tag flex-none text-[11px] text-muted group-focus-within:hidden group-hover:hidden">
            {providerLabel}
          </span>
          <span class="actions hidden gap-0.5 group-focus-within:flex group-hover:flex">
            <IconButton label="Renommer" glyph="✎" onClick={onStartRename} />
            {removable && (
              <IconButton
                label="Supprimer"
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
