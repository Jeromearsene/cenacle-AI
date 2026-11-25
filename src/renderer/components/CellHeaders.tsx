import type { PublicState } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { IconButton } from './IconButton';
import { GripIcon } from './icons';

interface Props {
  state: PublicState;
  isMac: boolean;
  providerLabel: (id: string) => string;
  shortcutOf: (id: string) => string | null;
  /** A press on the grip of a header: the start of a drag. */
  onDragStart: (id: string, event: PointerEvent) => void;
}

/** A header above each cell; the service views are placed by the main process. */
export function CellHeaders({ state, isMac, providerLabel, shortcutOf, onDragStart }: Props) {
  const t = useT();
  const grid = state.layout === 'grid';
  // With a single cell there is nothing to rearrange and the last one cannot be removed.
  const editable = grid && state.rects.length > 1;
  return (
    <div class="pointer-events-none absolute inset-0">
      {state.rects.map((r) => {
        const acc = state.accounts.find((a) => a.id === r.id);
        if (!acc) return null;
        const current = grid && acc.id === state.activeId;
        // On macOS the top row of headers is the title bar: it moves the window, so only the grip
        // starts a drag there. Everywhere else the whole header does.
        const titleBar = isMac && r.y === 0;
        const windowDrag = titleBar ? '[-webkit-app-region:drag]' : '';
        const headerDrag = editable && !titleBar;
        return (
          <div
            key={r.id}
            class={`cell-head pointer-events-auto absolute flex items-center gap-2 border-b border-line bg-bg pr-2 pl-3 ${windowDrag} ${current ? 'active' : ''} ${headerDrag ? 'cursor-grab' : ''}`}
            onPointerDown={(e) => {
              if (headerDrag && !(e.target as Element).closest('button')) onDragStart(acc.id, e);
            }}
            style={{
              left: `${r.x}px`,
              top: `${r.y}px`,
              width: `${r.width}px`,
              height: `${r.headerH}px`,
              boxShadow: current ? `inset 0 -2px 0 ${acc.color}` : undefined,
            }}
          >
            {editable && (
              <button
                type="button"
                title={t('cell.move')}
                aria-label={t('cell.move')}
                class="grip -ml-1.5 grid size-[22px] flex-none cursor-grab place-items-center rounded-[5px] border-0 bg-transparent p-0 text-muted [-webkit-app-region:no-drag] hover:bg-active hover:text-ink"
                onPointerDown={(e) => onDragStart(acc.id, e)}
              >
                <GripIcon />
              </button>
            )}
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
              label={t('cell.reload')}
              glyph="↻"
              onClick={() => void api.reloadAccount(acc.id)}
            />
            {editable && (
              <IconButton
                label={t('cell.remove')}
                glyph="✕"
                onClick={() => void api.removeFromGrid(acc.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
