import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { Divider } from '../shared/grid';
import { cellAt, type DropZone, dropZone, MIN_SIZE } from '../shared/grid';
import type { PublicState } from '../shared/types';
import { api } from './use-multi';

/** Distance (px) the pointer must travel before a press becomes a drag: a click stays a click. */
const DRAG_THRESHOLD = 5;

export interface DropTarget {
  cellId: string;
  zone: DropZone;
}

export interface DragState {
  /** The account being dragged and where the pointer is. */
  id: string;
  x: number;
  y: number;
  over: DropTarget | null;
}

/** Runs `onMove` / `onEnd` for the pointer until it is released, Escape is pressed or the window
 * loses focus. Returns a function that stops listening. */
function trackPointer(
  onMove: (e: PointerEvent) => void,
  onEnd: (e: PointerEvent | null, cancelled: boolean) => void
): () => void {
  const stop = () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('keydown', key);
    window.removeEventListener('blur', blur);
  };
  const up = (e: PointerEvent) => {
    stop();
    onEnd(e, false);
  };
  const key = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    stop();
    onEnd(null, true);
  };
  const blur = () => {
    stop();
    onEnd(null, true);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', up);
  window.addEventListener('keydown', key);
  window.addEventListener('blur', blur);
  return stop;
}

/** The click that ends a drag must not also select or rename an account. */
function swallowNextClick(): void {
  const block = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
  };
  window.addEventListener('click', block, { capture: true, once: true });
  setTimeout(() => window.removeEventListener('click', block, { capture: true }), 50);
}

/** Dragging an account (from the sidebar or from a cell header) onto a cell of the grid. */
export function useAccountDrag(state: PublicState | null) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const latest = useRef(state);
  latest.current = state;

  const start = useCallback((id: string, down: PointerEvent) => {
    if (down.button !== 0 || latest.current?.layout !== 'grid') return;
    const origin = { x: down.clientX, y: down.clientY };
    let active = false;
    let over: DropTarget | null = null;

    const targetAt = (x: number, y: number): DropTarget | null => {
      const cell = cellAt(latest.current?.rects ?? [], x, y);
      // Dropping an account on its own cell would change nothing.
      if (!cell || cell.id === id) return null;
      return { cellId: cell.id, zone: dropZone(cell, x, y) };
    };

    trackPointer(
      (e) => {
        if (!active) {
          if (Math.hypot(e.clientX - origin.x, e.clientY - origin.y) < DRAG_THRESHOLD) return;
          active = true;
          void api.setDragging(true);
        }
        over = targetAt(e.clientX, e.clientY);
        setDrag({ id, x: e.clientX, y: e.clientY, over });
      },
      (e, cancelled) => {
        if (active) {
          if (!cancelled && e) over = targetAt(e.clientX, e.clientY);
          if (!cancelled && over) void api.placeAccount(id, over.cellId, over.zone);
          void api.setDragging(false);
          swallowNextClick();
        }
        setDrag(null);
      }
    );
  }, []);

  return { drag, start };
}

/** Dragging a resize handle between two cells. `resizing` is true meanwhile. */
export function useDividerDrag() {
  const [resizing, setResizing] = useState(false);

  const start = useCallback((divider: Divider, down: PointerEvent) => {
    if (down.button !== 0) return;
    down.preventDefault();
    const row = divider.axis === 'row';
    const origin = row ? down.clientX : down.clientY;
    let frame = 0;
    let size = divider.size;
    const send = () => {
      frame = 0;
      void api.resizeGrid(divider.path, divider.index, size);
    };
    setResizing(true);
    void api.setDragging(true);
    trackPointer(
      (e) => {
        const delta = (row ? e.clientX : e.clientY) - origin;
        const shift = divider.total > 0 ? delta / divider.total : 0;
        size = Math.min(Math.max(divider.size + shift, MIN_SIZE), divider.pair - MIN_SIZE);
        if (!frame) frame = requestAnimationFrame(send);
      },
      () => {
        if (frame) cancelAnimationFrame(frame);
        void api.resizeGrid(divider.path, divider.index, size);
        void api.setDragging(false);
        setResizing(false);
      }
    );
  }, []);

  return { resizing, start };
}

/** Grabbing cursor everywhere while something is being dragged. */
export function useGrabCursor(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    document.body.style.cursor = 'grabbing';
    return () => {
      document.body.style.cursor = '';
    };
  }, [active]);
}
