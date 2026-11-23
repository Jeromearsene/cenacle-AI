import type { PublicState } from '../../shared/types';
import { api } from '../use-multi';
import { IconButton } from './IconButton';

/** Un en-tête au-dessus de chaque colonne ; les vues des services sont posées par le processus principal. */
export function ColumnHeaders({
  state,
  providerLabel,
  shortcutOf,
}: {
  state: PublicState;
  providerLabel: (id: string) => string;
  shortcutOf: (id: string) => string | null;
}) {
  return (
    <div class="pointer-events-none absolute inset-0">
      {state.rects.map((r) => {
        const acc = state.accounts.find((a) => a.id === r.id);
        if (!acc) return null;
        const current = state.layout === 'columns' && acc.id === state.activeId;
        return (
          <div
            key={r.id}
            class={`col-head pointer-events-auto absolute top-0 flex items-center gap-2 border-b border-line bg-bg pr-2 pl-3 [-webkit-app-region:drag] ${current ? 'active' : ''}`}
            style={{
              left: `${r.x}px`,
              width: `${r.width}px`,
              height: `${r.headerH}px`,
              boxShadow: current ? `inset 0 -2px 0 ${acc.color}` : undefined,
            }}
          >
            <span
              class="dot size-[9px] flex-none rounded-full"
              style={{ backgroundColor: acc.color }}
            />
            <span class="name min-w-0 flex-1 truncate font-medium">{acc.name}</span>
            {shortcutOf(acc.id) ? (
              <kbd class="shortcut flex-none rounded border border-line bg-panel px-1.5 font-sans text-[11px] text-muted">
                {shortcutOf(acc.id)}
              </kbd>
            ) : (
              <span class="tag flex-none text-[11px] text-muted">
                {providerLabel(acc.provider)}
              </span>
            )}
            <IconButton
              label="Recharger"
              glyph="↻"
              onClick={() => void api.reloadAccount(acc.id)}
            />
          </div>
        );
      })}
    </div>
  );
}
