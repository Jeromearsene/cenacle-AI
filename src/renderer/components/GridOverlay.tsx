import type { Divider } from '../../shared/grid';
import { dropPreview } from '../../shared/grid';
import type { PublicState } from '../../shared/types';
import { useT } from '../i18n';
import type { DragState } from '../use-grid-drag';

interface Props {
  state: PublicState;
  drag: DragState | null;
  resizing: boolean;
  onDividerDown: (divider: Divider, event: PointerEvent) => void;
}

/** What the interface draws over the service pages in grid mode: the resize handles, and, while
 * something is dragged (the pages are hidden then), the cells and where a drop would land. */
export function GridOverlay({ state, drag, resizing, onDividerDown }: Props) {
  const t = useT();
  const busy = drag !== null || resizing;
  const dragged = drag ? state.accounts.find((a) => a.id === drag.id) : undefined;
  const target = drag?.over ? state.rects.find((r) => r.id === drag.over?.cellId) : undefined;
  const preview = target && drag?.over ? dropPreview(target, drag.over.zone) : null;
  return (
    <div class="pointer-events-none absolute inset-0">
      {busy &&
        state.rects.map((r) => {
          const acc = state.accounts.find((a) => a.id === r.id);
          return (
            <div
              key={r.id}
              class="cell-body absolute grid place-items-center border-t border-line bg-panel text-muted"
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
      {preview && (
        <div
          class="drop-preview absolute rounded-sm border-2 border-accent bg-accent/25"
          data-zone={drag?.over?.zone}
          style={{
            left: `${preview.x}px`,
            top: `${preview.y}px`,
            width: `${preview.width}px`,
            height: `${preview.height}px`,
          }}
        />
      )}
      {state.dividers.map((d) => (
        // biome-ignore lint/a11y/useSemanticElements: a resize handle is a "window splitter", an <hr> cannot take the pointer
        <div
          key={`${d.path.join('.')}/${d.index}`}
          role="separator"
          aria-orientation={d.axis === 'row' ? 'vertical' : 'horizontal'}
          title={t('grid.resize')}
          class={`divider pointer-events-auto absolute hover:bg-accent/60 ${d.axis === 'row' ? 'cursor-col-resize' : 'cursor-row-resize'} ${resizing ? 'bg-accent/60' : ''}`}
          style={{
            left: `${d.x}px`,
            top: `${d.y}px`,
            width: `${d.width}px`,
            height: `${d.height}px`,
          }}
          onPointerDown={(e) => onDividerDown(d, e)}
        />
      ))}
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
