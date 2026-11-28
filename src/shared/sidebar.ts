// Width of the sidebar: the user can drag it wider or narrower; the choice is kept between
// launches (see PersistedState.sidebarW). Pure, so the main process, the interface and the tests
// share the same bounds.

/** Width (px) on first launch, and what a double-click on the resize handle restores. */
export const SIDEBAR_DEFAULT_W = 220;
/** Narrower than this and an account name has nowhere to go. */
export const SIDEBAR_MIN_W = 180;
/** Wider than this and the sidebar starts eating into the grid for no good reason. */
export const SIDEBAR_MAX_W = 420;

export const clampSidebarW = (w: number): number =>
  Math.round(Math.min(SIDEBAR_MAX_W, Math.max(SIDEBAR_MIN_W, w)));
