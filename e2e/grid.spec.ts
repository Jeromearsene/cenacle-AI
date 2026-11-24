import type { Page } from '@playwright/test';
import { parseState } from '../src/main/state';
import {
  appendLeaf,
  computeGrid,
  dropZone,
  type GridNode,
  gridFromIds,
  leaf,
  leaves,
  MIN_SIZE,
  parseGrid,
  placeLeaf,
  removeLeaf,
  setSplitSize,
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

// ------------------------------------------------------------------ in the app

const heads = (sidebar: Page) => sidebar.locator('.cell-head');
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

async function gridOfThree(launch: () => Promise<{ sidebar: Page }>): Promise<Page> {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(3);
  return sidebar;
}

test('a cell can be taken out of the grid, and comes back when selected', async ({ launch }) => {
  const sidebar = await gridOfThree(launch);
  await heads(sidebar).nth(2).getByRole('button', { name: 'Remove from the grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  // still in the sidebar, marked as outside the grid
  await expect.poll(() => accountNames(sidebar)).toHaveLength(3);
  await expect(sidebar.locator('#accounts .account.outside')).toHaveCount(1);

  await sidebar.locator('#accounts .account.outside').click();
  await expect(heads(sidebar)).toHaveCount(3);
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
  const height = await sidebar.evaluate(() => window.innerHeight);

  await dragTo(
    sidebar,
    { x: outside.x, y: outside.y },
    { x: firstBox.x + firstBox.width / 2, y: height - 10 },
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

  const grip = await centerOf(
    heads(sidebar).nth(1).getByRole('button', { name: 'Drag to rearrange' })
  );
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number; width: number };
  const height = await sidebar.evaluate(() => window.innerHeight);
  await dragTo(sidebar, { x: grip.x, y: grip.y }, { x: first.x + 12, y: height / 2 });

  await expect.poll(() => headNames(sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
});

test('Escape cancels a drag', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(heads(sidebar)).toHaveCount(2);
  const grip = await centerOf(
    heads(sidebar).nth(1).getByRole('button', { name: 'Drag to rearrange' })
  );
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

  await dragTo(sidebar, { x: handle.x, y: handle.y }, { x: handle.x + 120, y: handle.y });
  await expect.poll(width).toBeGreaterThan(before + 100);

  // and it cannot be pushed past the minimum size
  const handle2 = await centerOf(sidebar.locator('.divider'));
  await dragTo(sidebar, { x: handle2.x, y: handle2.y }, { x: handle2.x + 5000, y: handle2.y });
  const second = (await heads(sidebar).nth(1).boundingBox())?.width ?? 0;
  expect(second).toBeGreaterThan(40);
});

test('the layout and the sizes survive a restart', async ({ launch }) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('button', { name: 'Grid' }).click();
  const handle = await centerOf(sidebar.locator('.divider'));
  await dragTo(sidebar, { x: handle.x, y: handle.y }, { x: handle.x + 100, y: handle.y });
  const grip = await centerOf(
    heads(sidebar).nth(1).getByRole('button', { name: 'Drag to rearrange' })
  );
  const first = (await heads(sidebar).nth(0).boundingBox()) as { x: number };
  await dragTo(sidebar, { x: grip.x, y: grip.y }, { x: first.x + 12, y: 300 });
  await expect.poll(() => headNames(sidebar)).toEqual(['ChatGPT 1', 'Claude 1']);
  const widths = await heads(sidebar).evaluateAll((els) =>
    els.map((e) => Math.round(e.getBoundingClientRect().width))
  );
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
