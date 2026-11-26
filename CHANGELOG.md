# cenacle-ai

## 0.3.0

### Minor Changes

- [#24](https://github.com/Jeromearsene/cenacle-AI/pull/24) [`6c537ff`](https://github.com/Jeromearsene/cenacle-AI/commit/6c537ff42a82cc5975494a55f47c7ce125b15a9b) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Claude accounts now show when their usage limit is close or reached: a pill in the sidebar and in the column header ("90%+" or "Full"), the reset time, an hourglass bar that drains until the reset, and a notification when the limit is back.

## 0.2.0

### Minor Changes

- [#20](https://github.com/Jeromearsene/cenacle-AI/pull/20) [`505aee2`](https://github.com/Jeromearsene/cenacle-AI/commit/505aee23b454bceb6f0a84d11adf5666c850450f) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - The "Columns" mode is now "Grid": drag accounts onto the edges of a cell, onto its center (swap) or along the border of the grid to arrange them in rows and columns, resize cells with the handles between them (or equalize them), and take an account out of the grid with its ✕ button. Cells never get smaller than a readable size, and the arrangement is kept between launches.

### Patch Changes

- [#23](https://github.com/Jeromearsene/cenacle-AI/pull/23) [`047e7ad`](https://github.com/Jeromearsene/cenacle-AI/commit/047e7adf52d147da382d635ec183aeef22fa75c3) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Fixed: pressing Tab while the "Add account" menu is open no longer moves focus out to the rest of the sidebar behind it; it now cycles within the open menu until Escape or an outside click closes it.

- [#21](https://github.com/Jeromearsene/cenacle-AI/pull/21) [`3331b9c`](https://github.com/Jeromearsene/cenacle-AI/commit/3331b9c0595ab1ac58007083d074215dc06a3e02) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Layout changes in the grid (dropping, removing, resetting, equalizing) glide instead of jumping, unless the system asks for reduced motion.

## 0.1.0

### Minor Changes

- [#16](https://github.com/Jeromearsene/cenacle-AI/pull/16) [`8cdaede`](https://github.com/Jeromearsene/cenacle-AI/commit/8cdaedea5176856be8bb4286bf644f7ac6b2248b) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - The interface is available in English and French, following the system language (English for any other language).

- [#11](https://github.com/Jeromearsene/cenacle-AI/pull/11) [`3e0c8c1`](https://github.com/Jeromearsene/cenacle-AI/commit/3e0c8c1c5e3ace313839fa1bb33c8713b0378d5c) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - First installable release: Windows, macOS and Linux packages built from GitHub, a changelog kept with changesets, and automatic update checks.
