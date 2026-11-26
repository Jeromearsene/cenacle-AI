import { clampShare, type Divider } from '../../shared/grid';
import type { PublicState } from '../../shared/types';
import { useT } from '../i18n';
import type { DragState } from '../use-grid-drag';
import { api } from '../use-multi';
import { NoRoomIcon, ReplaceIcon, SwapIcon } from './icons';

/** Share of a split moved by one press of an arrow key. */
const KEY_STEP = 0.05;

interface Props {
  state: PublicState;
  drag: DragState | null;
  /** The handle being dragged. */
  resizing: Divider | null;
  onDividerDown: (divider: Divider, event: PointerEvent) => void;
}

/** What the interface draws over the service pages in grid mode: the resize handles, and, while
 * something is dragged (the pages are hidden then), the cells and where a drop would land. */
export function GridOverlay({ state, drag, resizing, onDividerDown }: Props) {
  const t = useT();
  const busy = drag !== null || resizing !== null;
  const dragged = drag ? state.accounts.find((a) => a.id === drag.id) : undefined;
  const plan = drag?.over ?? null;
  const inGrid = drag ? state.rects.some((r) => r.id === drag.id) : false;
  // On a center, the drop trades places with the cell, or replaces it for an account from outside.
  const verdict = !plan
    ? null
    : !plan.allowed
      ? { icon: <NoRoomIcon />, text: t('grid.noRoom') }
      : plan.zone === 'center'
        ? inGrid
          ? { icon: <SwapIcon />, text: t('grid.swap') }
          : { icon: <ReplaceIcon />, text: t('grid.replace') }
        : null;
  return (
    <div class="pointer-events-none absolute inset-0">
      {busy &&
        state.rects.map((r) => {
          const acc = state.accounts.find((a) => a.id === r.id);
          return (
            <div
              key={r.id}
              class="cell-body absolute grid place-items-start border-t p-3 border-line bg-panel text-muted"
              style={{
                left: `${r.x}px`,
                top: `${r.y + r.headerH}px`,
                width: `${r.width}px`,
                height: `${Math.max(0, r.height - r.headerH)}px`,
                opacity: drag?.id === r.id ? 0.5 : 1,
              }}
            >
              {acc?.name}
            </div>
          );
        })}
      {plan && (
        <div
          class={`drop-preview absolute grid place-items-center rounded-sm border-2 ${plan.allowed ? 'border-accent bg-accent/25 text-ink' : 'border-dashed border-danger bg-danger/15 text-danger'}`}
          data-zone={plan.zone}
          data-allowed={plan.allowed}
          style={{
            left: `${plan.preview.x}px`,
            top: `${plan.preview.y}px`,
            width: `${plan.preview.width}px`,
            height: `${plan.preview.height}px`,
          }}
        >
          {verdict && (
            <div class="verdict flex items-center gap-1.5 rounded-md bg-bg/90 px-2.5 py-1 font-medium shadow-sm">
              {verdict.icon}
              {verdict.text}
            </div>
          )}
        </div>
      )}
      {state.dividers.map((d) => {
        const key = `${d.path.join('.')}/${d.index}`;
        const grabbed = resizing !== null && key === `${resizing.path.join('.')}/${resizing.index}`;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a focusable "window splitter" (WAI-ARIA); an <hr> cannot take the pointer or the arrow keys
          <div
            key={key}
            role="separator"
            data-grabbed={grabbed}
            aria-orientation={d.axis === 'row' ? 'vertical' : 'horizontal'}
            aria-label={t('grid.resize')}
            aria-valuenow={Math.round(d.size * 100)}
            aria-valuemin={Math.round(d.min * 100)}
            aria-valuemax={Math.round(d.max * 100)}
            tabIndex={0}
            title={t('grid.resizeHint')}
            onKeyDown={(e) => {
              const [less, more] =
                d.axis === 'row' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
              const step = e.key === more ? KEY_STEP : e.key === less ? -KEY_STEP : 0;
              if (!step) return;
              e.preventDefault();
              void api.resizeGrid(d.path, d.index, clampShare(d.size + step, d.min, d.max));
            }}
            onDblClick={() => void api.equalizeGrid(d.path)}
            class={`divider pointer-events-auto absolute hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none ${d.axis === 'row' ? 'cursor-col-resize' : 'cursor-row-resize'} ${grabbed ? 'bg-accent/60' : ''}`}
            style={{
              left: `${d.x}px`,
              top: `${d.y}px`,
              width: `${d.width}px`,
              height: `${d.height}px`,
            }}
            onPointerDown={(e) => onDividerDown(d, e)}
          />
        );
      })}
      {drag && dragged && (
        <div
          class="drag-ghost absolute flex items-center gap-2 rounded-md border border-line bg-bg px-2.5 py-1 shadow-md"
          style={{ left: `${drag.x + 12}px`, top: `${drag.y + 12}px` }}
        >
          <span class="size-[9px] rounded-full" style={{ backgroundColor: dragged.color }} />
          {dragged.name}
        </div>
      )}
    </div>
  );
}
