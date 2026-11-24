// The layout of the "grid" mode: a tree of splits, like the editor groups of a code editor.
// Pure functions only (no Electron, no DOM) so the main process, the interface and the tests
// share them. Trees are never mutated: every function returns a new tree.

/** `row`: children side by side. `column`: children stacked. */
export type Axis = 'row' | 'column';
export type Edge = 'left' | 'right' | 'top' | 'bottom';
/** Where an account is dropped on a cell: on one of its edges (split) or on its center (swap). */
export type DropZone = Edge | 'center';

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
/** A cell never gets smaller than this share of its split. */
export const MIN_SIZE = 0.1;
const MAX_DEPTH = 8;
const ID_RE = /^[\w-]{1,32}$/;

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
    return typeof node.id === 'string' && ID_RE.test(node.id) ? leaf(node.id) : null;
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
  if (!node || id === target || !leaves(node).includes(target)) return node;
  const placed = leaves(node).includes(id);
  if (zone === 'center') {
    if (placed) return mapLeaves(node, (l) => (l === id ? target : l === target ? id : l));
    return mapLeaves(node, (l) => (l === target ? id : l));
  }
  const without = removeLeaf(node, id);
  return without && insertBeside(without, id, target, zone);
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
  const first = Math.min(Math.max(size, MIN_SIZE), pair - MIN_SIZE);
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
        dividers.push({
          path,
          index: i,
          axis: n.axis,
          x: row ? start + length : box.x,
          y: row ? box.y : start + length,
          width: row ? GRID_GAP : box.width,
          height: row ? box.height : GRID_GAP,
          size: n.sizes[i] as number,
          pair: (n.sizes[i] as number) + (n.sizes[i + 1] as number),
          total,
        });
      }
      offset += length;
    });
  };
  if (node) walk(node, area, []);
  return { cells, dividers };
}

export function cellAt<T extends Area>(cells: T[], x: number, y: number): T | undefined {
  return cells.find((c) => x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.height);
}

/** The drop zone under a point of a cell: the center, or the nearest edge. */
export function dropZone(cell: Area, x: number, y: number): DropZone {
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

/** The part of a cell that a drop would take (half of it for an edge, all of it for the center). */
export function dropPreview(cell: Area, zone: DropZone): Area {
  const halfW = Math.floor(cell.width / 2);
  const halfH = Math.floor(cell.height / 2);
  switch (zone) {
    case 'left':
      return { x: cell.x, y: cell.y, width: halfW, height: cell.height };
    case 'right':
      return { x: cell.x + halfW, y: cell.y, width: cell.width - halfW, height: cell.height };
    case 'top':
      return { x: cell.x, y: cell.y, width: cell.width, height: halfH };
    case 'bottom':
      return { x: cell.x, y: cell.y + halfH, width: cell.width, height: cell.height - halfH };
    default:
      return { x: cell.x, y: cell.y, width: cell.width, height: cell.height };
  }
}
