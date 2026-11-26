# The grid

**English** · [Français](fr/grid.md)

← [Back to the README](../README.md)

In **Grid** mode every account is a cell with its own header. At first they sit side by side (in rows when they do not all fit); you then arrange them:

- **Move**: drag an account from the sidebar, or a cell header (the ⠿ grip on the top row on macOS, where that row moves the window), onto the grid. The highlighted area shows where it will land:
  - on an **edge of a cell**: splits that cell (left / right: side by side, top / bottom: stacked);
  - on the **center** of a cell: swaps the two cells (or, for an account that is not in the grid, replaces the cell);
  - along the **outer border of the grid**: a new row or column spanning the whole grid.
- **Readable cells**: a cell is never smaller than 320 × 240 px. A drop that would squeeze a cell is shown as refused ("Not enough room") and does nothing; the same limit stops the resize handles.
- **Resize**: drag the handle between two cells, or focus it (Tab) and use the arrow keys. Double-click a handle, press **Equalize sizes** in the sidebar, or use View → Equalize cell sizes to share the space equally. Sizes are kept between launches, like the arrangement.
- **Remove**: ✕ in a cell header takes the account out of the grid. It stays in the sidebar (hollow dot, dimmed, session kept) and only comes back when you drag it onto the grid: clicking it does nothing. The last cell cannot be removed.
- **Reset**: View → Reset the grid puts every account back as at the start.
- A new account is added to the grid when there is room for it.

Changes of layout glide instead of jumping (unless the system asks for reduced motion).

The service pages are hidden while you drag, so the interface can follow the mouse; they come back when you let go. Escape cancels a drag.
