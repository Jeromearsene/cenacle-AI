// Small inline icons (the page cannot rely on a font having the right glyphs). They are
// decorative: the text next to them says the same thing.
import type { ComponentChildren } from 'preact';

function Icon({ children }: { children: ComponentChildren }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.6"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      role="presentation"
    >
      {children}
    </svg>
  );
}

/** Two opposite arrows: the two cells trade places. */
export const SwapIcon = () => (
  <Icon>
    <path d="M3 7h12M12 4l3 3-3 3" />
    <path d="M17 13H5M8 10l-3 3 3 3" />
  </Icon>
);

/** An arrow into a box: the dropped account takes the place of the cell. */
export const ReplaceIcon = () => (
  <Icon>
    <rect x="9" y="3" width="8" height="8" rx="1.5" />
    <path d="M3 13l4 4M3 17v-4h4M5 15l8-5" />
  </Icon>
);

/** A circle with a bar: not allowed. */
export const NoRoomIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="7" />
    <path d="M5 15L15 5" />
  </Icon>
);

/** Columns of equal width. */
export const EqualizeIcon = () => (
  <Icon>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <path d="M8 4v12M12 4v12" />
  </Icon>
);

/** Six dots: something that can be grabbed. */
export const GripIcon = () => (
  <Icon>
    {[7, 13].flatMap((x) =>
      [5, 10, 15].map((y) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" fill="currentColor" stroke="none" />
      ))
    )}
  </Icon>
);
