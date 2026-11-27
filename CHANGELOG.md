# cenacle-ai

## 0.6.0

### Minor Changes

- [#42](https://github.com/Jeromearsene/cenacle-AI/pull/42) [`f93dcc4`](https://github.com/Jeromearsene/cenacle-AI/commit/f93dcc43f9eaf7d4e20049cc27de60711a90291a) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Each account now reopens on the conversation it was on when the app was closed, instead of the service's home page.

- [#22](https://github.com/Jeromearsene/cenacle-AI/pull/22) [`07faff3`](https://github.com/Jeromearsene/cenacle-AI/commit/07faff389098403b79446f5b50c6595f970f4743) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Added a Settings dialog (gear button at the bottom of the sidebar, also reachable with ⌘, / Ctrl+, or from the application menu) to choose the interface language and a light / dark / system theme, independently of the operating system.
  
  The Layout toggle and the new Settings dialog share a fully keyboard-accessible segmented control (arrow keys to pick an option, a visible focus ring, and focus kept inside the open dialog).

- [#30](https://github.com/Jeromearsene/cenacle-AI/pull/30) [`f088f74`](https://github.com/Jeromearsene/cenacle-AI/commit/f088f740f7848819aa19d70c9f126617ad989611) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - An account that raises a notification while you are looking elsewhere now shows a dot in the sidebar and above its column, bounces the Dock icon (macOS) or flashes the taskbar (Windows, Linux), and updates the app badge. The dot goes away when you open the account. On Windows, notifications are now named after the app when it is run from source.

## 0.5.0

### Minor Changes

- [#39](https://github.com/Jeromearsene/cenacle-AI/pull/39) [`957e171`](https://github.com/Jeromearsene/cenacle-AI/commit/957e1713f8b85eba317dbea477eeb04f1df6fb6f) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Filter the sidebar by service and group accounts by service

- [#38](https://github.com/Jeromearsene/cenacle-AI/pull/38) [`4a93684`](https://github.com/Jeromearsene/cenacle-AI/commit/4a93684048ae509d013d890b07d278ef3c29472d) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - The developer tools and the resource usage panel now live in a new View → Development submenu, which also has a "Test notifications…" entry: it raises a system and a web notification and tells whether the system displays them (on macOS, only a signed app gets its notifications shown).

### Patch Changes

- [#40](https://github.com/Jeromearsene/cenacle-AI/pull/40) [`2e65ccd`](https://github.com/Jeromearsene/cenacle-AI/commit/2e65ccd823c99787cbe176f86ec65a6465f09093) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Keep the sidebar service filter and grouping between launches

## 0.4.0

### Minor Changes

- [#36](https://github.com/Jeromearsene/cenacle-AI/pull/36) [`9a48953`](https://github.com/Jeromearsene/cenacle-AI/commit/9a4895311a12376d6d349029cabb8bd7e202a65e) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - Added View → Resource usage: a small panel that shows the memory and CPU taken by each account, what is shared (interface, graphics, network) and the total, to see which account weighs the most.

### Patch Changes

- [#35](https://github.com/Jeromearsene/cenacle-AI/pull/35) [`3180fd5`](https://github.com/Jeromearsene/cenacle-AI/commit/3180fd596dfd84f0409b37937a9f8ae3d6b8367d) Thanks [@Jeromearsene](https://github.com/Jeromearsene)! - macOS: the app is now signed ad hoc, so the system displays its notifications, and is built as `Cenacle.app` (without the accent), which avoids a crash at launch seen on macOS 26. The name shown in the app is still "Cénacle". macOS still warns at the first launch, and the app still does not update itself there.

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
