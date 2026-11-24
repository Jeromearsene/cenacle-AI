// The layout of the "grid" mode: a tree of splits, like the editor groups of a code editor.
// Pure functions only (no Electron, no DOM) so the main process, the interface and the tests
// share them. Trees are never mutated: every function returns a new tree.

import { isId } from './id';

/** `row`: children side by side. `column`: children stacked. */
export type Axis = 'row' | 'column';
export type Edge = 'left' | 'right' | 'top' | 'bottom';
/** The four edges of the whole grid (not of one cell). */
export type RootZone = 'root-left' | 'root-right' | 'root-top' | 'root-bottom';
/** Where an account is dropped: on an edge of a cell (split it), on its center (swap or replace),
 * or on an edge of the whole grid (a new row or column spanning all of it). */
export type DropZone = Edge | 'center' | RootZone;
const DROP_ZONES: readonly string[] = [
  'left',
  'right',
  'top',
  'bottom',
  'center',
  'root-left',
  'root-right',
  'root-top',
  'root-bottom',
];
export const isDropZone = (v: unknown): v is DropZone =>
  typeof v === 'string' && DROP_ZONES.includes(v);

export interface GridLeaf {
  type: 'leaf';
  id: string;
}

export interface GridSplit {
  type: 'split';
  axis: Axis;
  children: GridNode[];
  /** Share of each child, in the same order; they add up to 1. */
  sizes: number[];
}

export type GridNode = GridLeaf | GridSplit;

/** Width of the gutter between two cells (px): room for the resize handle. */
export const GRID_GAP = 5;
/** Smallest cell a user action can create: below this, a chat page stops being readable. */
export const MIN_CELL_WIDTH = 320;
export const MIN_CELL_HEIGHT = 240; // header included
/** Fallback share for a cell when the size of the area is not known. */
export const MIN_SIZE = 0.1;
/** Width (px) of the band along the outer border of the grid where a drop targets the whole grid. */
export const ROOT_BAND = 24;
const MAX_DEPTH = 8;

export const leaf = (id: string): GridLeaf => ({ type: 'leaf', id });

/** Ids of the accounts in the tree, in reading order. */
export function leaves(node: GridNode | null): string[] {
  if (!node) return [];
  return node.type === 'leaf' ? [node.id] : node.children.flatMap(leaves);
}

const axisOf = (edge: Edge): Axis => (edge === 'left' || edge === 'right' ? 'row' : 'column');

function normalizeSizes(sizes: number[]): number[] {
  const total = sizes.reduce((a, b) => a + b, 0);
  return total > 0 ? sizes.map((s) => s / total) : sizes.map(() => 1 / sizes.length);
}

/** A split of the given children; a single child is returned as is, and a child split that has
 * the same axis is merged into its parent, so the tree stays as flat as possible. */
function makeSplit(axis: Axis, children: GridNode[], sizes?: number[]): GridNode | null {
  if (children.length === 0) return null;
  if (children.length === 1) return children[0] as GridNode;
  const shares = normalizeSizes(sizes ?? children.map(() => 1));
  const flatChildren: GridNode[] = [];
  const flatSizes: number[] = [];
  children.forEach((child, i) => {
    const share = shares[i] as number;
    if (child.type === 'split' && child.axis === axis) {
      child.children.forEach((c, j) => {
        flatChildren.push(c);
        flatSizes.push((child.sizes[j] as number) * share);
      });
    } else {
      flatChildren.push(child);
      flatSizes.push(share);
    }
  });
  return { type: 'split', axis, children: flatChildren, sizes: normalizeSizes(flatSizes) };
}

/** All accounts side by side, with equal widths. */
export function gridFromIds(ids: string[]): GridNode | null {
  return makeSplit('row', ids.map(leaf));
}

/** Keeps only the accounts of `valid` (each once) and tidies the tree. */
export function pruneTo(node: GridNode | null, valid: ReadonlySet<string>): GridNode | null {
  const seen = new Set<string>();
  const walk = (n: GridNode): GridNode | null => {
    if (n.type === 'leaf') {
      if (!valid.has(n.id) || seen.has(n.id)) return null;
      seen.add(n.id);
      return n;
    }
    const kept: GridNode[] = [];
    const sizes: number[] = [];
    n.children.forEach((child, i) => {
      const result = walk(child);
      if (result) {
        kept.push(result);
        sizes.push(n.sizes[i] as number);
      }
    });
    return makeSplit(n.axis, kept, sizes);
  };
  return node ? walk(node) : null;
}

export function removeLeaf(node: GridNode | null, id: string): GridNode | null {
  return pruneTo(node, new Set(leaves(node).filter((l) => l !== id)));
}

/** Validates a tree read from state.json (anything can be in there). */
export function parseGrid(raw: unknown, depth = 0): GridNode | null {
  if (typeof raw !== 'object' || raw === null || depth > MAX_DEPTH) return null;
  const node = raw as Record<string, unknown>;
  if (node.type === 'leaf') {
    return isId(node.id) ? leaf(node.id) : null;
  }
  if (node.type !== 'split' || (node.axis !== 'row' && node.axis !== 'column')) return null;
  if (!Array.isArray(node.children)) return null;
  const children: GridNode[] = [];
  const sizes: number[] = [];
  node.children.forEach((child, i) => {
    const parsed = parseGrid(child, depth + 1);
    if (!parsed) return;
    const size = Array.isArray(node.sizes) ? node.sizes[i] : undefined;
    children.push(parsed);
    sizes.push(typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : 1);
  });
  return makeSplit(node.axis, children, sizes);
}

function insertBeside(node: GridNode, id: string, target: string, edge: Edge): GridNode {
  const axis = axisOf(edge);
  const after = edge === 'right' || edge === 'bottom';
  if (node.type === 'leaf') {
    if (node.id !== target) return node;
    const pair = after ? [node, leaf(id)] : [leaf(id), node];
    return { type: 'split', axis, children: pair, sizes: [0.5, 0.5] };
  }
  const i = node.children.findIndex((c) => c.type === 'leaf' && c.id === target);
  if (i >= 0 && node.axis === axis) {
    // Same direction as the parent: a new sibling takes half of the target's share.
    const half = (node.sizes[i] as number) / 2;
    const at = after ? i + 1 : i;
    const children = [...node.children];
    const sizes = [...node.sizes];
    children.splice(at, 0, leaf(id));
    sizes.splice(i, 1, half);
    sizes.splice(at, 0, half);
    return { ...node, children, sizes };
  }
  return { ...node, children: node.children.map((c) => insertBeside(c, id, target, edge)) };
}

function mapLeaves(node: GridNode, fn: (id: string) => string): GridNode {
  return node.type === 'leaf'
    ? leaf(fn(node.id))
    : { ...node, children: node.children.map((c) => mapLeaves(c, fn)) };
}

/** Drops `id` on `target`: next to it (an edge) or in its place (center). An account already in
 * the grid is moved, not duplicated. */
export function placeLeaf(
  node: GridNode | null,
  id: string,
  target: string,
  zone: DropZone
): GridNode | null {
  if (!node || !leaves(node).includes(target)) return node;
  if (zone.startsWith('root-')) return placeAtRoot(node, id, zone.slice(5) as Edge);
  if (id === target) return node;
  const placed = leaves(node).includes(id);
  if (zone === 'center') {
    if (placed) return mapLeaves(node, (l) => (l === id ? target : l === target ? id : l));
    return mapLeaves(node, (l) => (l === target ? id : l));
  }
  const without = removeLeaf(node, id);
  return without && insertBeside(without, id, target, zone as Edge);
}

/** A new row or column along one edge of the whole grid, as wide as its siblings. */
function placeAtRoot(node: GridNode, id: string, edge: Edge): GridNode {
  const without = removeLeaf(node, id);
  if (!without) return node;
  const axis = axisOf(edge);
  const siblings = without.type === 'split' && without.axis === axis ? without.children.length : 1;
  const share = 1 / (siblings + 1);
  const after = edge === 'right' || edge === 'bottom';
  const pair = after ? [without, leaf(id)] : [leaf(id), without];
  return makeSplit(axis, pair, after ? [1 - share, share] : [share, 1 - share]) as GridNode;
}

/** Adds an account at the end of the grid (a new column when the grid is made of columns). */
export function appendLeaf(node: GridNode | null, id: string): GridNode {
  if (!node) return leaf(id);
  if (leaves(node).includes(id)) return node;
  if (node.type === 'split' && node.axis === 'row') {
    const n = node.children.length;
    return {
      ...node,
      children: [...node.children, leaf(id)],
      sizes: [...node.sizes.map((s) => (s * n) / (n + 1)), 1 / (n + 1)],
    };
  }
  return makeSplit('row', [node, leaf(id)]) as GridNode;
}

export const clampShare = (size: number, min: number, max: number): number =>
  Math.min(Math.max(size, min), max);

/** Sets the share of child `index` of the split found at `path` (indexes from the root); its
 * next sibling takes the difference. Out-of-range values are clamped. */
export function setSplitSize(
  node: GridNode | null,
  path: number[],
  index: number,
  size: number
): GridNode | null {
  if (!node || !Number.isFinite(size)) return node;
  if (path.length > 0) {
    const [head, ...rest] = path as [number, ...number[]];
    if (node.type !== 'split' || !node.children[head]) return node;
    const children = node.children.map((c, i) =>
      i === head ? setSplitSize(c, rest, index, size) : c
    );
    return { ...node, children: children as GridNode[] };
  }
  if (
    node.type !== 'split' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= node.sizes.length - 1
  ) {
    return node;
  }
  const pair = (node.sizes[index] as number) + (node.sizes[index + 1] as number);
  const first = clampShare(size, MIN_SIZE, pair - MIN_SIZE);
  const sizes = [...node.sizes];
  sizes[index] = first;
  sizes[index + 1] = pair - first;
  return { ...node, sizes };
}

// ------------------------------------------------------------------ geometry

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Cell extends Area {
  id: string;
}

/** A resize handle in the gutter between two cells. */
export interface Divider extends Area {
  /** Which split it belongs to (child indexes from the root) and after which child. */
  path: number[];
  index: number;
  axis: Axis;
  /** Share of the child before the handle, and of the two children around it together. */
  size: number;
  pair: number;
  /** Pixels shared by the children of the split (its length without the gutters). */
  total: number;
  /** The share of the child before the handle stays between these, so no cell gets too small. */
  min: number;
  max: number;
}

export interface GridGeometry {
  cells: Cell[];
  dividers: Divider[];
}

/** Where each account is drawn inside `area`, and where the resize handles are. */
export function computeGrid(node: GridNode | null, area: Area): GridGeometry {
  const cells: Cell[] = [];
  const dividers: Divider[] = [];
  const walk = (n: GridNode, box: Area, path: number[]): void => {
    if (n.type === 'leaf') {
      cells.push({ id: n.id, ...box });
      return;
    }
    const count = n.children.length;
    const row = n.axis === 'row';
    const total = Math.max(0, (row ? box.width : box.height) - GRID_GAP * (count - 1));
    let offset = 0;
    n.children.forEach((child, i) => {
      const length =
        i === count - 1
          ? Math.max(0, total - offset)
          : Math.min(Math.round((n.sizes[i] as number) * total), Math.max(0, total - offset));
      const start = (row ? box.x : box.y) + offset + GRID_GAP * i;
      walk(
        child,
        row
          ? { x: start, y: box.y, width: length, height: box.height }
          : { x: box.x, y: start, width: box.width, height: length },
        [...path, i]
      );
      if (i < count - 1) {
        const next = n.children[i + 1] as GridNode;
        const pair = (n.sizes[i] as number) + (n.sizes[i + 1] as number);
        const lo = total > 0 ? minExtent(child, n.axis) / total : MIN_SIZE;
        const hi = pair - (total > 0 ? minExtent(next, n.axis) / total : MIN_SIZE);
        const size = n.sizes[i] as number;
        dividers.push({
          path,
          index: i,
          axis: n.axis,
          x: row ? start + length : box.x,
          y: row ? box.y : start + length,
          width: row ? GRID_GAP : box.width,
          height: row ? box.height : GRID_GAP,
          size,
          pair,
          total,
          // A window too small for the cells it holds: the handle stays where it is.
          min: lo <= hi ? lo : size,
          max: lo <= hi ? hi : size,
        });
      }
      offset += length;
    });
  };
  if (node) walk(node, area, []);
  return { cells, dividers };
}

/** Pixels a node needs along `axis` so that none of its cells is smaller than the minimum. */
export function minExtent(node: GridNode, axis: Axis): number {
  if (node.type === 'leaf') return axis === 'row' ? MIN_CELL_WIDTH : MIN_CELL_HEIGHT;
  const parts = node.children.map((c) => minExtent(c, axis));
  return node.axis === axis
    ? parts.reduce((a, b) => a + b, 0) + GRID_GAP * (parts.length - 1)
    : Math.max(...parts);
}

/** Whether every cell of the tree can keep its minimum size inside `area`. */
export function fits(node: GridNode | null, area: Area): boolean {
  return (
    !node || (minExtent(node, 'row') <= area.width && minExtent(node, 'column') <= area.height)
  );
}

/** The accounts side by side as long as they fit, then in rows; the ones that do not fit at all
 * are left out (they stay in the sidebar). */
export function arrangeGrid(ids: string[], area: Area): GridNode | null {
  const columns = Math.max(1, Math.floor((area.width + GRID_GAP) / (MIN_CELL_WIDTH + GRID_GAP)));
  const maxRows = Math.max(1, Math.floor((area.height + GRID_GAP) / (MIN_CELL_HEIGHT + GRID_GAP)));
  const shown = ids.slice(0, columns * maxRows);
  const rows = Math.ceil(shown.length / columns);
  const perRow = Math.ceil(shown.length / Math.max(1, rows));
  const lines: GridNode[] = [];
  for (let i = 0; i < shown.length; i += perRow) {
    const line = makeSplit('row', shown.slice(i, i + perRow).map(leaf));
    if (line) lines.push(line);
  }
  return makeSplit('column', lines);
}

/** Adds an account to the grid where there is room (a new column, or under an existing cell);
 * null when there is none. */
export function appendFitting(node: GridNode | null, id: string, area: Area): GridNode | null {
  if (!node) return fits(leaf(id), area) ? leaf(id) : null;
  if (leaves(node).includes(id)) return node;
  const candidates = [
    appendLeaf(node, id),
    ...leaves(node)
      .reverse()
      .map((target) => placeLeaf(node, id, target, 'bottom')),
  ];
  return candidates.find((c): c is GridNode => c !== null && fits(c, area)) ?? null;
}

/** The grid for the accounts that exist: unknown ones leave it, and a grid that was never
 * shown is arranged. In grid mode the active account must be one of the cells. */
export function syncGrid(
  grid: GridNode | null,
  ids: string[],
  activeId: string,
  area: Area
): { grid: GridNode | null; activeId: string } {
  const synced = pruneTo(grid, new Set(ids)) ?? arrangeGrid(ids, area);
  const inGrid = leaves(synced);
  const first = inGrid[0];
  return { grid: synced, activeId: first && !inGrid.includes(activeId) ? first : activeId };
}

/** Every split of the tree shares its length equally between its children. */
export function equalizeAll(node: GridNode | null): GridNode | null {
  if (!node || node.type === 'leaf') return node;
  const children = node.children.map((c) => equalizeAll(c) as GridNode);
  return { ...node, children, sizes: children.map(() => 1 / children.length) };
}

/** Same for the single split found at `path`. */
export function equalizeSplit(node: GridNode | null, path: number[]): GridNode | null {
  if (!node || node.type === 'leaf') return node;
  if (path.length === 0) return { ...node, sizes: node.sizes.map(() => 1 / node.sizes.length) };
  const [head, ...rest] = path as [number, ...number[]];
  if (!node.children[head]) return node;
  const children = node.children.map((c, i) =>
    i === head ? (equalizeSplit(c, rest) as GridNode) : c
  );
  return { ...node, children };
}

/** Moves a handle within the limits that keep every cell readable in `area`. */
export function resizeSplit(
  node: GridNode | null,
  area: Area,
  path: number[],
  index: number,
  size: number
): GridNode | null {
  const handle = computeGrid(node, area).dividers.find(
    (d) =>
      d.index === index && d.path.length === path.length && d.path.every((p, i) => p === path[i])
  );
  if (!handle || !Number.isFinite(size)) return node;
  return setSplitSize(node, path, index, clampShare(size, handle.min, handle.max));
}

/** What dropping `id` at a point would do. */
export interface DropPlan {
  /** The cell under the pointer and the zone of it (or of the whole grid) that is aimed at. */
  target: string;
  zone: DropZone;
  /** False when the result would leave a cell too small. */
  allowed: boolean;
  /** Where the dropped account would end up. */
  preview: Area;
}

function rootZoneAt(area: Area, x: number, y: number): RootZone | null {
  const distances: [RootZone, number][] = [
    ['root-left', x - area.x],
    ['root-right', area.x + area.width - x],
    ['root-top', y - area.y],
    ['root-bottom', area.y + area.height - y],
  ];
  const nearest = distances.reduce((best, d) => (d[1] < best[1] ? d : best));
  return nearest[1] < ROOT_BAND ? nearest[0] : null;
}

/** The drop under the pointer, or null when nothing would change. */
export function planDrop(
  node: GridNode | null,
  area: Area,
  cells: Cell[],
  id: string,
  x: number,
  y: number
): DropPlan | null {
  const cell = cellAt(cells, x, y);
  if (!node || !cell) return null;
  const zone = rootZoneAt(area, x, y) ?? dropZone(cell, x, y);
  if (cell.id === id && !zone.startsWith('root-')) return null;
  const next = placeLeaf(node, id, cell.id, zone);
  if (!next || next === node) return null;
  const preview = computeGrid(next, area).cells.find((c) => c.id === id) ?? cell;
  return {
    target: cell.id,
    zone,
    allowed: fits(next, area),
    preview: { x: preview.x, y: preview.y, width: preview.width, height: preview.height },
  };
}

export function cellAt<T extends Area>(cells: T[], x: number, y: number): T | undefined {
  return cells.find((c) => x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.height);
}

/** The drop zone under a point of a cell: the center, or the nearest edge. */
export function dropZone(cell: Area, x: number, y: number): Edge | 'center' {
  const rx = (x - cell.x) / Math.max(1, cell.width);
  const ry = (y - cell.y) / Math.max(1, cell.height);
  if (rx > 0.25 && rx < 0.75 && ry > 0.25 && ry < 0.75) return 'center';
  const distances: [Edge, number][] = [
    ['left', rx],
    ['right', 1 - rx],
    ['top', ry],
    ['bottom', 1 - ry],
  ];
  return distances.reduce((best, d) => (d[1] < best[1] ? d : best))[0];
}
