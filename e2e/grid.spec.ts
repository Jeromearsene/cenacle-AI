import type { ElectronApplication, Page } from '@playwright/test';
import { parseState } from '../src/main/state';
import {
  appendFitting,
  appendLeaf,
  arrangeGrid,
  computeGrid,
  dropZone,
  equalizeAll,
  equalizeSplit,
  fits,
  type GridNode,
  gridFromIds,
  leaf,
  leaves,
  MIN_CELL_HEIGHT,
  MIN_CELL_WIDTH,
  MIN_SIZE,
  minExtent,
  parseGrid,
  placeLeaf,
  planDrop,
  removeLeaf,
  resizeSplit,
  setSplitSize,
  syncGrid,
} from '../src/shared/grid';
import { accountNames, addAccount, expect, test } from './fixtures';

const row = (children: GridNode[], sizes?: number[]): GridNode => ({
  type: 'split',
  axis: 'row',
  children,
  sizes: sizes ?? children.map(() => 1 / children.length),
});
const column = (children: GridNode[], sizes?: number[]): GridNode =>
  ({
    ...(row(children, sizes) as object),
    axis: 'column',
  }) as GridNode;

test.describe('grid layout tree (without launching the app)', () => {
  test('all accounts side by side, with equal shares', () => {
    expect(gridFromIds(['a', 'b', 'c'])).toEqual(row([leaf('a'), leaf('b'), leaf('c')]));
    expect(gridFromIds(['a'])).toEqual(leaf('a'));
    expect(gridFromIds([])).toBeNull();
  });

  test('dropping on an edge in the direction of the split adds a sibling', () => {
    const grid = gridFromIds(['a', 'b']);
    expect(placeLeaf(grid, 'c', 'a', 'right')).toEqual(
      row([leaf('a'), leaf('c'), leaf('b')], [0.25, 0.25, 0.5])
    );
    expect(placeLeaf(grid, 'c', 'a', 'left')).toEqual(
      row([leaf('c'), leaf('a'), leaf('b')], [0.25, 0.25, 0.5])
    );
  });

  test('dropping on an edge across the split nests a new split', () => {
    const grid = placeLeaf(gridFromIds(['a', 'b']), 'c', 'a', 'bottom');
    expect(grid).toEqual(row([column([leaf('a'), leaf('c')]), leaf('b')]));
    const top = placeLeaf(gridFromIds(['a', 'b']), 'c', 'b', 'top');
    expect(top).toEqual(row([leaf('a'), column([leaf('c'), leaf('b')])]));
  });

  test('moving an account that is already placed does not duplicate it', () => {
    const grid = placeLeaf(gridFromIds(['a', 'b', 'c']), 'c', 'a', 'left');
    expect(leaves(grid)).toEqual(['c', 'a', 'b']);
    // the emptied slot is gone and the shares still add up to 1
    const sizes = (grid as { sizes: number[] }).sizes;
    expect(sizes).toHaveLength(3);
    expect(sizes.reduce((x, y) => x + y, 0)).toBeCloseTo(1);
  });

  test('moving the only sibling out of a nested split collapses it', () => {
    const start = row([column([leaf('a'), leaf('b')]), leaf('c')]);
    const moved = placeLeaf(start, 'b', 'c', 'right');
    expect(leaves(moved)).toEqual(['a', 'c', 'b']);
    expect((moved as { axis: string }).axis).toBe('row');
    expect((moved as { children: GridNode[] }).children.every((c) => c.type === 'leaf')).toBe(true);
  });

  test('dropping on the center swaps two placed accounts or replaces the target', () => {
    const grid = gridFromIds(['a', 'b', 'c']);
    expect(leaves(placeLeaf(grid, 'a', 'c', 'center'))).toEqual(['c', 'b', 'a']);
    expect(leaves(placeLeaf(grid, 'x', 'b', 'center'))).toEqual(['a', 'x', 'c']);
  });

  test('ignores a drop on itself or on a cell that is not in the grid', () => {
    const grid = gridFromIds(['a', 'b']);
    expect(placeLeaf(grid, 'a', 'a', 'left')).toEqual(grid);
    expect(placeLeaf(grid, 'c', 'zzz', 'left')).toEqual(grid);
  });

  test('removing an account collapses what is left', () => {
    expect(removeLeaf(gridFromIds(['a', 'b']), 'b')).toEqual(leaf('a'));
    const nested = row([column([leaf('a'), leaf('b')]), leaf('c')], [0.5, 0.5]);
    const left = removeLeaf(nested, 'b') as { sizes: number[] };
    expect(leaves(left as GridNode)).toEqual(['a', 'c']);
    expect(left.sizes).toEqual([0.5, 0.5]);
    expect(removeLeaf(leaf('a'), 'a')).toBeNull();
  });

  test('appending joins the end of a row of columns', () => {
    const grid = appendLeaf(gridFromIds(['a', 'b']), 'c') as { sizes: number[] };
    expect(leaves(grid as GridNode)).toEqual(['a', 'b', 'c']);
    for (const s of grid.sizes) expect(s).toBeCloseTo(1 / 3);
    expect(appendLeaf(null, 'a')).toEqual(leaf('a'));
    expect(appendLeaf(gridFromIds(['a', 'b']), 'a')).toEqual(gridFromIds(['a', 'b']));
  });

  test('resizing moves the share between two neighbours and keeps a minimum', () => {
    const grid = gridFromIds(['a', 'b', 'c']);
    const resized = setSplitSize(grid, [], 0, 0.5) as { sizes: number[] };
    expect(resized.sizes[0]).toBeCloseTo(0.5);
    expect(resized.sizes[1]).toBeCloseTo(1 / 3 + 1 / 3 - 0.5);
    expect(resized.sizes[2]).toBeCloseTo(1 / 3);
    const tooSmall = setSplitSize(grid, [], 0, 0) as { sizes: number[] };
    expect(tooSmall.sizes[0]).toBeCloseTo(MIN_SIZE);
    const tooBig = setSplitSize(grid, [], 0, 5) as { sizes: number[] };
    expect(tooBig.sizes[1]).toBeCloseTo(MIN_SIZE);
    // a nested split is reached through its path
    const nested = row([column([leaf('a'), leaf('b')]), leaf('c')]);
    const inner = setSplitSize(nested, [0], 0, 0.7) as { children: { sizes: number[] }[] };
    expect(inner.children[0]?.sizes[0]).toBeCloseTo(0.7);
    // wrong paths and indexes change nothing
    expect(setSplitSize(grid, [3], 0, 0.5)).toEqual(grid);
    expect(setSplitSize(grid, [], 7, 0.5)).toEqual(grid);
  });

  test('the cells fill the area, separated by gutters, with one handle between neighbours', () => {
    const area = { x: 220, y: 0, width: 1000, height: 600 };
    const nested = row([column([leaf('a'), leaf('b')]), leaf('c')], [0.4, 0.6]);
    const { cells, dividers } = computeGrid(nested, area);
    expect(cells.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(dividers).toHaveLength(2);
    const [a, b, c] = cells as [
      (typeof cells)[number],
      (typeof cells)[number],
      (typeof cells)[number],
    ];
    expect(a.x).toBe(220);
    expect(b.x).toBe(220);
    expect(a.width).toBe(b.width);
    expect(b.y).toBeGreaterThan(a.y + a.height - 1);
    expect(b.y + b.height).toBe(600);
    expect(c.x + c.width).toBe(1220);
    expect(c.x).toBeGreaterThan(a.x + a.width - 1);
    expect(computeGrid(null, area)).toEqual({ cells: [], dividers: [] });
  });

  test('the zone under the pointer: center, or the nearest edge', () => {
    const cell = { x: 100, y: 50, width: 400, height: 300 };
    expect(dropZone(cell, 300, 200)).toBe('center');
    expect(dropZone(cell, 105, 200)).toBe('left');
    expect(dropZone(cell, 495, 200)).toBe('right');
    expect(dropZone(cell, 300, 55)).toBe('top');
    expect(dropZone(cell, 300, 345)).toBe('bottom');
  });

  test('reading a saved tree: garbage is dropped, ids are checked', () => {
    expect(parseGrid('nope')).toBeNull();
    expect(parseGrid({ type: 'leaf', id: '../etc' })).toBeNull();
    const saved = {
      type: 'split',
      axis: 'row',
      children: [{ type: 'leaf', id: 'a' }, 7],
      sizes: [1, 1],
    };
    expect(parseGrid(saved)).toEqual(leaf('a'));
    expect(parseGrid({ type: 'split', axis: 'diagonal', children: [] })).toBeNull();
    let deep: unknown = { type: 'leaf', id: 'a' };
    for (let i = 0; i < 20; i++)
      deep = {
        type: 'split',
        axis: i % 2 ? 'row' : 'column',
        children: [deep, { type: 'leaf', id: `b${i}` }],
      };
    // too deep: the excess is cut instead of being trusted (the deepest account is lost)
    const cut = leaves(parseGrid(deep));
    expect(cut).toContain('b19');
    expect(cut).not.toContain('a');
  });

  test('the saved state: "columns" is read as the grid mode, unknown accounts leave the grid', () => {
    const account = (id: string) => ({ id, name: id, color: '#d97757', provider: 'claude' });
    const base = { accounts: [account('a'), account('b')], activeId: 'a' };
    expect(parseState({ ...base, layout: 'columns' }).layout).toBe('grid');
    expect(parseState({ ...base, layout: 'grid' }).layout).toBe('grid');
    expect(parseState({ ...base, layout: 'single' }).layout).toBe('single');
    expect(parseState(base).grid).toBeNull();
    const withGrid = parseState({ ...base, grid: gridFromIds(['b', 'gone', 'a']) });
    expect(leaves(withGrid.grid)).toEqual(['b', 'a']);
  });
});

test.describe('grid layout: sizes, rows, the whole-grid edges (without launching the app)', () => {
  const area = { x: 220, y: 0, width: 1000, height: 600 };

  test('a cell needs a minimum size, and so does what contains it', () => {
    expect(minExtent(leaf('a'), 'row')).toBe(MIN_CELL_WIDTH);
    expect(minExtent(leaf('a'), 'column')).toBe(MIN_CELL_HEIGHT);
    const three = gridFromIds(['a', 'b', 'c']) as GridNode;
    expect(minExtent(three, 'row')).toBe(3 * MIN_CELL_WIDTH + 2 * 5);
    expect(minExtent(three, 'column')).toBe(MIN_CELL_HEIGHT);
    expect(fits(three, { ...area, width: 970 })).toBe(true);
    expect(fits(three, { ...area, width: 969 })).toBe(false);
    const stacked = column([leaf('a'), leaf('b')]);
    expect(fits(stacked, { ...area, height: 2 * MIN_CELL_HEIGHT + 5 })).toBe(true);
    expect(fits(stacked, { ...area, height: 2 * MIN_CELL_HEIGHT + 4 })).toBe(false);
  });

  test('accounts are arranged side by side while they fit, then in rows, and the rest is left out', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `a${i}`);
    expect(arrangeGrid(ids(3), area)).toEqual(gridFromIds(ids(3)));
    const four = arrangeGrid(ids(4), area) as { axis: string; children: GridNode[] };
    expect(four.axis).toBe('column');
    expect(four.children.map((c) => leaves(c))).toEqual([
      ['a0', 'a1'],
      ['a2', 'a3'],
    ]);
    const five = arrangeGrid(ids(5), area) as { children: GridNode[] };
    expect(five.children.map((c) => leaves(c).length)).toEqual([3, 2]);
    // 3 columns and 2 rows fit in 1000 x 600: the 7th and the next ones stay out
    expect(leaves(arrangeGrid(ids(9), area))).toHaveLength(6);
    expect(fits(arrangeGrid(ids(9), area), area)).toBe(true);
    expect(arrangeGrid([], area)).toBeNull();
  });

  test('a new account takes a column if there is room, then goes under a cell, else is refused', () => {
    const two = gridFromIds(['a', 'b']);
    expect(leaves(appendFitting(two, 'c', area))).toEqual(['a', 'b', 'c']);
    const three = gridFromIds(['a', 'b', 'c']);
    const four = appendFitting(three, 'd', area) as GridNode;
    expect(leaves(four).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(fits(four, area)).toBe(true);
    expect(appendFitting(three, 'd', { ...area, height: 300 })).toBeNull();
    expect(appendFitting(null, 'a', area)).toEqual(leaf('a'));
  });

  test('syncing: unknown accounts leave, a missing grid is arranged, the active one stays visible', () => {
    const synced = syncGrid(gridFromIds(['a', 'gone', 'b']), ['a', 'b', 'c'], 'c', area);
    expect(leaves(synced.grid)).toEqual(['a', 'b']);
    expect(synced.activeId).toBe('a');
    const fresh = syncGrid(null, ['a', 'b'], 'b', area);
    expect(leaves(fresh.grid)).toEqual(['a', 'b']);
    expect(fresh.activeId).toBe('b');
  });

  test('equal sizes, for the whole tree or for one split', () => {
    const uneven = row([column([leaf('a'), leaf('b')], [0.8, 0.2]), leaf('c')], [0.7, 0.3]);
    const all = equalizeAll(uneven) as { sizes: number[]; children: { sizes: number[] }[] };
    expect(all.sizes).toEqual([0.5, 0.5]);
    expect(all.children[0]?.sizes).toEqual([0.5, 0.5]);
    const inner = equalizeSplit(uneven, [0]) as {
      sizes: number[];
      children: { sizes: number[] }[];
    };
    expect(inner.sizes).toEqual([0.7, 0.3]);
    expect(inner.children[0]?.sizes).toEqual([0.5, 0.5]);
    expect(equalizeSplit(uneven, [5])).toEqual(uneven);
  });

  test('a handle stops where a cell would get smaller than the minimum', () => {
    const grid = gridFromIds(['a', 'b']);
    const total = 1000 - 5;
    const low = resizeSplit(grid, area, [], 0, 0) as { sizes: number[] };
    expect(low.sizes[0]).toBeCloseTo(MIN_CELL_WIDTH / total);
    const high = resizeSplit(grid, area, [], 0, 1) as { sizes: number[] };
    expect(high.sizes[1]).toBeCloseTo(MIN_CELL_WIDTH / total);
    const { dividers } = computeGrid(grid, area);
    expect(dividers[0]?.min).toBeCloseTo(MIN_CELL_WIDTH / total);
    expect(dividers[0]?.max).toBeCloseTo(1 - MIN_CELL_WIDTH / total);
    // a window too small for its cells: the handle does not move
    const cramped = { ...area, width: 400 };
    expect(resizeSplit(grid, cramped, [], 0, 0.9)).toEqual(grid);
  });

  test('dropping on an edge of the whole grid makes a row or a column that spans all of it', () => {
    const grid = gridFromIds(['a', 'b']);
    expect(placeLeaf(grid, 'c', 'a', 'root-bottom')).toEqual(
      column([grid as GridNode, leaf('c')], [0.5, 0.5])
    );
    expect(placeLeaf(grid, 'c', 'b', 'root-top')).toEqual(
      column([leaf('c'), grid as GridNode], [0.5, 0.5])
    );
    // same direction as the grid: a column like the others
    const wider = placeLeaf(grid, 'c', 'a', 'root-right') as { sizes: number[] };
    expect(leaves(wider as GridNode)).toEqual(['a', 'b', 'c']);
    for (const share of wider.sizes) expect(share).toBeCloseTo(1 / 3);
    expect(leaves(placeLeaf(grid, 'c', 'b', 'root-left'))).toEqual(['c', 'a', 'b']);
    // a placed account can be moved there too
    const nested = row([column([leaf('a'), leaf('b')]), leaf('c')]);
    const moved = placeLeaf(nested, 'b', 'a', 'root-bottom');
    expect(leaves(moved)).toEqual(['a', 'c', 'b']);
    expect((moved as { axis: string }).axis).toBe('column');
  });

  test('what a drop would do under the pointer', () => {
    const grid = gridFromIds(['a', 'b']);
    const { cells } = computeGrid(grid, area);
    const [a] = cells as [(typeof cells)[number]];
    const mid = { x: a.x + a.width / 2, y: 300 };

    const center = planDrop(grid, area, cells, 'c', mid.x, mid.y);
    expect(center?.zone).toBe('center');
    expect(center?.target).toBe('a');
    expect(center?.preview).toEqual({ x: a.x, y: a.y, width: a.width, height: a.height });

    // near the outer border: the whole grid; near an inner edge: the cell
    expect(planDrop(grid, area, cells, 'c', area.x + 5, 300)?.zone).toBe('root-left');
    expect(planDrop(grid, area, cells, 'c', a.x + a.width - 20, 300)?.zone).toBe('right');
    const bottom = planDrop(grid, area, cells, 'c', mid.x, 595);
    expect(bottom?.zone).toBe('root-bottom');
    expect(bottom?.preview.width).toBe(1000);

    // an account dropped on its own cell, or outside the cells: nothing
    expect(planDrop(grid, area, cells, 'a', mid.x, mid.y)).toBeNull();
    expect(planDrop(grid, area, cells, 'c', 50, 50)).toBeNull();

    // a drop that would squeeze a cell is shown as refused
    const three = gridFromIds(['a', 'b', 'c']);
    const crowded = { ...area, width: 700 };
    const geometry = computeGrid(three, crowded);
    const first = geometry.cells[0] as (typeof cells)[number];
    const refused = planDrop(three, crowded, geometry.cells, 'd', first.x + 30, 300);
    expect(refused?.allowed).toBe(false);
  });
});

// ------------------------------------------------------------------ in the app

const heads = (sidebar: Page) => sidebar.locator('.cell-head');
const windowHeight = (sidebar: Page) => sidebar.evaluate(() => window.innerHeight);
const cellWidths = (sidebar: Page) =>
  heads(sidebar).evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)));
const headNames = (sidebar: Page) => sidebar.locator('.cell-head .name').allTextContents();

/** Press, move in small steps and release: what a user dragging with the mouse does. */
async function dragTo(
  sidebar: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  holdAtTarget?: () => Promise<void>
): Promise<void> {
  await sidebar.mouse.move(from.x, from.y);
  await sidebar.mouse.down();
  await sidebar.mouse.move(to.x, to.y, { steps: 12 });
  if (holdAtTarget) await holdAtTarget();
  await sidebar.mouse.up();
}

const centerOf = async (locator: ReturnType<Page['locator']>) => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('element not visible');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
};

/** The grip of the header of the `n`th cell (where a press starts moving the cell). */
const gripOf = (sidebar: Page, n: number) =>
  centerOf(heads(sidebar).nth(n).getByRole('button', { name: 'Drag to rearrange' }));

async function gridOfThree(launch: () => Promise<{ sidebar: Page }>): Promise<Page> {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(3);
  return sidebar;
}

test('a cell can be taken out of the grid; selecting it does nothing, dragging it back works', async ({
  launch,
}) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  await heads(sidebar).nth(1).getByRole('button', { name: 'Remove from the grid' }).click();
  await expect(heads(sidebar)).toHaveCount(1);
  // still in the sidebar, with a hollow dot
  await expect.poll(() => accountNames(sidebar)).toHaveLength(2);
  const outside = sidebar.locator('#accounts .account.outside');
  await expect(outside).toHaveCount(1);
  await expect(outside.locator('.dot.hollow')).toHaveCount(1);

  // a plain click does not bring it back
  await outside.click();
  await expect(heads(sidebar)).toHaveCount(1);
  await expect(outside).toHaveCount(1);
  await expect(sidebar.locator('#accounts .account.active')).not.toHaveClass(/outside/);

  // dragging it onto the edge of the cell does
  const from = await centerOf(outside);
  const cell = (await heads(sidebar).nth(0).boundingBox()) as { x: number; width: number };
  await dragTo(sidebar, { x: from.x, y: from.y }, { x: cell.x + cell.width - 80, y: 400 });
  await expect(heads(sidebar)).toHaveCount(2);
  await expect(sidebar.locator('#accounts .account.outside')).toHaveCount(0);
});

test('the last cell cannot be removed', async ({ launch }) => {
  const { sidebar } = await launch();
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(1);
  await expect(sidebar.getByRole('button', { name: 'Remove from the grid' })).toHaveCount(0);
});

test('dragging an account from the sidebar onto the edge of a cell splits it', async ({
  launch,
}) => {
  const sidebar = await gridOfThree(launch);
  await heads(sidebar).nth(2).getByRole('button', { name: 'Remove from the grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  const [first, second] = await heads(sidebar).all();
  const firstBox = (await first?.boundingBox()) as { x: number; y: number; width: number };
  const secondBox = (await second?.boundingBox()) as { x: number; y: number };
  const outside = await centerOf(sidebar.locator('#accounts .account.outside'));
  const height = await windowHeight(sidebar);

  await dragTo(
    sidebar,
    { x: outside.x, y: outside.y },
    { x: firstBox.x + firstBox.width / 2, y: height - 80 },
    async () => {
      // while dragging: the pages are replaced by the outline of the cells, with the drop preview
      await expect(sidebar.locator('.cell-body')).toHaveCount(2);
      await expect(sidebar.locator('.drop-preview')).toHaveAttribute('data-zone', 'bottom');
    }
  );

  await expect(heads(sidebar)).toHaveCount(3);
  await expect(sidebar.locator('.cell-body')).toHaveCount(0);
  // the newcomer is under the first cell: same left edge, lower; the second cell did not move left
  const placed = await sidebar.locator('.cell-head').evaluateAll((els) =>
    els.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        name: el.querySelector('.name')?.textContent,
        x: Math.round(r.x),
        y: Math.round(r.y),
      };
    })
  );
  const under = placed.find((p) => p.x === Math.round(firstBox.x) && p.y > firstBox.y + 100);
  expect(under).toBeDefined();
  expect(placed.some((p) => p.x > secondBox.x - 5 && p.y === 0)).toBe(true);
});

test('dragging the grip of a header moves the cell', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect.poll(() => headNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1']);

  const grip = await gripOf(sidebar, 1);
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number; width: number };
  const height = await windowHeight(sidebar);
  await dragTo(sidebar, { x: grip.x, y: grip.y }, { x: first.x + 12, y: height / 2 });

  await expect.poll(() => headNames(sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
});

test('Escape cancels a drag', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  const grip = await gripOf(sidebar, 1);
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number };
  await sidebar.mouse.move(grip.x, grip.y);
  await sidebar.mouse.down();
  await sidebar.mouse.move(first.x + 12, 300, { steps: 8 });
  await expect(sidebar.locator('.cell-body')).toHaveCount(2);
  await sidebar.keyboard.press('Escape');
  await sidebar.mouse.up();
  await expect(sidebar.locator('.cell-body')).toHaveCount(0);
  expect(await headNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1']);
});

test('a resize handle between two cells moves their border', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(sidebar.locator('.divider')).toHaveCount(1);
  const width = async () => (await heads(sidebar).nth(0).boundingBox())?.width ?? 0;
  const before = await width();
  const handle = await centerOf(sidebar.locator('.divider'));

  await dragTo(sidebar, { x: handle.x, y: handle.y }, { x: handle.x + 50, y: handle.y });
  await expect.poll(width).toBeGreaterThan(before + 30);

  // and it cannot be pushed past the minimum size
  const handle2 = await centerOf(sidebar.locator('.divider'));
  await dragTo(sidebar, { x: handle2.x, y: handle2.y }, { x: handle2.x + 5000, y: handle2.y });
  const second = (await heads(sidebar).nth(1).boundingBox())?.width ?? 0;
  expect(second).toBeGreaterThanOrEqual(MIN_CELL_WIDTH);
});

test('the layout and the sizes survive a restart', async ({ launch }) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  const handle = await centerOf(sidebar.locator('.divider'));
  await dragTo(sidebar, { x: handle.x, y: handle.y }, { x: handle.x + 100, y: handle.y });
  const grip = await gripOf(sidebar, 1);
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number };
  await dragTo(sidebar, { x: grip.x, y: grip.y }, { x: first.x + 12, y: 300 });
  await expect.poll(() => headNames(sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
  const widths = await cellWidths(sidebar);
  await app.close();

  const again = await launch();
  await expect.poll(() => headNames(again.sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
  const after = await heads(again.sidebar).evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().width))
  );
  expect(after).toEqual(widths);
});

test('a new account joins the end of the grid', async ({ launch }) => {
  const { sidebar } = await launch();
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await addAccount(sidebar, 'Gemini');
  await expect.poll(() => headNames(sidebar)).toEqual(['Claude 1', 'Gemini 1']);
});

// Native side: the service pages are separate views placed by the main process.
const nativeViews = (app: ElectronApplication) =>
  app.evaluate(({ BrowserWindow }) =>
    (BrowserWindow.getAllWindows()[0]?.contentView.children ?? []).map((v) => ({
      ...(v as unknown as { getBounds(): Electron.Rectangle }).getBounds(),
      visible: (v as unknown as { getVisible(): boolean }).getVisible(),
    }))
  );

test('each service page sits right under its header, and pages are hidden while dragging', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  // a stacked layout too: the second account goes under the first one
  const grip = await gripOf(sidebar, 1);
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number; width: number };
  const height = await windowHeight(sidebar);
  await dragTo(sidebar, { x: grip.x, y: grip.y }, { x: first.x + first.width / 2, y: height - 80 });
  await expect(sidebar.locator('.cell-body')).toHaveCount(0);

  await expect
    .poll(async () => {
      const boxes = await heads(sidebar).evaluateAll((els) =>
        els.map((e) => {
          const r = e.getBoundingClientRect();
          return { x: Math.round(r.x), y: Math.round(r.bottom), width: Math.round(r.width) };
        })
      );
      const views = await nativeViews(app);
      return boxes.every((b) =>
        views.some((v) => v.visible && v.x === b.x && v.y === b.y && v.width === b.width)
      );
    })
    .toBe(true);

  // while a drag is going on, no page is shown (they would swallow the mouse)
  const stacked = await gripOf(sidebar, 1);
  await sidebar.mouse.move(stacked.x, stacked.y);
  await sidebar.mouse.down();
  await sidebar.mouse.move(stacked.x + 40, stacked.y - 40, { steps: 5 });
  await expect.poll(async () => (await nativeViews(app)).some((v) => v.visible)).toBe(false);
  await sidebar.mouse.up();
  await expect.poll(async () => (await nativeViews(app)).filter((v) => v.visible).length).toBe(2);
});

test('the pages come back when the system cancels the pointer', async ({ launch }) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  const grip = await gripOf(sidebar, 1);
  await sidebar.mouse.move(grip.x, grip.y);
  await sidebar.mouse.down();
  await sidebar.mouse.move(grip.x - 80, grip.y + 80, { steps: 5 });
  await expect(sidebar.locator('.cell-body')).toHaveCount(2);
  await sidebar.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await expect(sidebar.locator('.cell-body')).toHaveCount(0);
  await expect.poll(async () => (await nativeViews(app)).filter((v) => v.visible).length).toBe(2);
  await sidebar.mouse.up();
});

test('a resize handle works with the arrow keys', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  const width = async () => (await heads(sidebar).nth(0).boundingBox())?.width ?? 0;
  const before = await width();
  await sidebar.locator('.divider').focus();
  await sidebar.keyboard.press('ArrowRight');
  await sidebar.keyboard.press('ArrowRight');
  await expect.poll(width).toBeGreaterThan(before + 40);
  await sidebar.keyboard.press('ArrowLeft');
  await sidebar.keyboard.press('ArrowLeft');
  await sidebar.keyboard.press('ArrowLeft');
  await expect.poll(width).toBeLessThan(before - 20);
});

test('the whole header moves a cell, except in the title bar on macOS', async ({ launch }) => {
  test.skip(process.platform === 'darwin', 'the top row of headers is the title bar on macOS');
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  const name = await centerOf(heads(sidebar).nth(1).locator('.name'));
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number };
  const height = await windowHeight(sidebar);
  await dragTo(sidebar, { x: name.x, y: name.y }, { x: first.x + 12, y: height / 2 });
  await expect.poll(() => headNames(sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
});

test('"Reset the grid" brings every account back side by side', async ({ launch }) => {
  const { app, sidebar } = await launch();
  const reset = () =>
    app.evaluate(({ Menu }) => {
      const view = Menu.getApplicationMenu()?.items.find((i) => i.label === 'View');
      const item = view?.submenu?.items.find((i) => i.label === 'Reset the grid');
      if (item?.enabled) item.click();
      return item?.enabled ?? null;
    });
  await addAccount(sidebar, 'ChatGPT');
  await addAccount(sidebar, 'Gemini');
  expect(await reset()).toBe(false); // nothing to reset in single mode
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await heads(sidebar).nth(2).getByRole('button', { name: 'Remove from the grid' }).click();
  await heads(sidebar).nth(1).getByRole('button', { name: 'Remove from the grid' }).click();
  await expect(heads(sidebar)).toHaveCount(1);
  expect(await reset()).toBe(true);
  await expect.poll(() => headNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1', 'Gemini 1']);
});

test('dropping on an edge of the whole grid spans the full width, and shows the preview', async ({
  launch,
}) => {
  const sidebar = await gridOfThree(launch);
  await heads(sidebar).nth(2).getByRole('button', { name: 'Remove from the grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  const outside = await centerOf(sidebar.locator('#accounts .account.outside'));
  const height = await windowHeight(sidebar);
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number };
  const grid = await sidebar.evaluate(
    () => document.querySelector('.cell-head')?.parentElement?.getBoundingClientRect().width
  );

  await dragTo(
    sidebar,
    { x: outside.x, y: outside.y },
    { x: first.x + 200, y: height - 6 },
    async () => {
      const preview = sidebar.locator('.drop-preview');
      await expect(preview).toHaveAttribute('data-zone', 'root-bottom');
      const box = (await preview.boundingBox()) as { width: number };
      // as wide as the whole grid area (the window minus the sidebar)
      expect(box.width).toBeGreaterThan((grid ?? 0) - 400);
    }
  );
  await expect(heads(sidebar)).toHaveCount(3);
  const widths = await cellWidths(sidebar);
  // two cells side by side above, one as wide as both below
  expect(Math.max(...widths)).toBeGreaterThan(2 * Math.min(...widths));
});

test('a drop that would make a cell too small is shown as refused and does nothing', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  // 900 - 220 = 680 px for the grid: two 320 px columns fit, three do not
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700)
  );
  await addAccount(sidebar, 'ChatGPT');
  await addAccount(sidebar, 'Gemini');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(3);
  await heads(sidebar).nth(2).getByRole('button', { name: 'Remove from the grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);

  const outside = await centerOf(sidebar.locator('#accounts .account.outside'));
  const second = (await heads(sidebar).nth(1).boundingBox()) as { x: number; width: number };
  await dragTo(
    sidebar,
    { x: outside.x, y: outside.y },
    { x: second.x + second.width - 30, y: 400 },
    async () => {
      const preview = sidebar.locator('.drop-preview');
      await expect(preview).toHaveAttribute('data-allowed', 'false');
      await expect(preview.locator('.verdict')).toHaveText('Not enough room');
    }
  );
  await expect(heads(sidebar)).toHaveCount(2);
});

test('a cell never gets narrower than the minimum, and the preview says when a drop is refused', async ({
  launch,
}) => {
  const { app, sidebar } = await launch();
  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]?.setContentSize(900, 700)
  );
  await addAccount(sidebar, 'ChatGPT');
  await addAccount(sidebar, 'Gemini');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  // 900 - 220 = 680 px: only two 320 px columns fit, so three accounts are arranged in two rows
  await expect(heads(sidebar)).toHaveCount(3);
  for (const w of await cellWidths(sidebar)) expect(w).toBeGreaterThanOrEqual(MIN_CELL_WIDTH);
});

test('the Equalize button and a double click on a handle give equal sizes', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(sidebar.getByRole('button', { name: 'Equalize sizes' })).toBeVisible();
  const gap = async () => {
    const [a = 0, b = 0] = await cellWidths(sidebar);
    return Math.abs(a - b);
  };
  const handle = await centerOf(sidebar.locator('.divider'));
  await dragTo(sidebar, { x: handle.x, y: handle.y }, { x: handle.x + 150, y: handle.y });
  await expect.poll(gap).toBeGreaterThan(15);

  await sidebar.getByRole('button', { name: 'Equalize sizes' }).click();
  await expect.poll(gap).toBeLessThan(3);

  const again = await centerOf(sidebar.locator('.divider'));
  await dragTo(sidebar, { x: again.x, y: again.y }, { x: again.x - 150, y: again.y });
  await expect.poll(gap).toBeGreaterThan(15);
  await sidebar.locator('.divider').dblclick();
  await expect.poll(gap).toBeLessThan(3);
});

test('swapping two cells shows a swap pictogram; the button is hidden with a single cell', async ({
  launch,
}) => {
  const { sidebar } = await launch();
  await expect(sidebar.getByRole('button', { name: 'Equalize sizes' })).toHaveCount(0);
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  const grip = await gripOf(sidebar, 1);
  const target = await centerOf(heads(sidebar).nth(0));
  const height = await windowHeight(sidebar);
  await dragTo(sidebar, { x: grip.x, y: grip.y }, { x: target.x, y: height / 2 }, async () => {
    await expect(sidebar.locator('.drop-preview')).toHaveAttribute('data-zone', 'center');
    await expect(sidebar.locator('.drop-preview .verdict')).toHaveText('Swap');
  });
  await expect.poll(() => headNames(sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
});
