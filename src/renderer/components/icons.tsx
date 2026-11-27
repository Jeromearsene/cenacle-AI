// Small inline icons (the page cannot rely on a font having the right glyphs). They are
// decorative: the text next to them says the same thing.
import type { ComponentChildren } from 'preact';

function Icon({ children, size = 20 }: { children: ComponentChildren; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
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

/** The app mark: a ring of six rounded arcs, one color each (the same as the app icon). */
export const CenacleMark = ({ size = 22 }: { size?: number }) => (
  <svg
    class="brand-logo flex-none"
    width={size}
    height={size}
    viewBox="170 170 684 684"
    fill="none"
    stroke-width="112"
    stroke-linecap="round"
    aria-hidden="true"
    role="presentation"
  >
    <path stroke="#d97757" d="M702.9 321.1A270 270 0 0 0 530.8 242.7" />
    <path stroke="#d4a72c" d="M512 242A270 270 0 0 0 334.9 308.2" />
    <path stroke="#788c5d" d="M321.1 321.1A270 270 0 0 0 242.7 493.2" />
    <path stroke="#4aa3a2" d="M242 512A270 270 0 0 0 308.2 689.1" />
    <path stroke="#6a9bcc" d="M321.1 702.9A270 270 0 0 0 493.2 781.3" />
    <path stroke="#b58bd1" d="M512 782A270 270 0 0 0 702.9 702.9" />
  </svg>
);

/** Three full lines: the accounts in their own order. */
export const ListIcon = () => (
  <Icon size={14}>
    <path d="M3 5h14M3 10h14M3 15h14" />
  </Icon>
);

/** Lines in two blocks: the accounts gathered by service. */
export const GroupedIcon = () => (
  <Icon size={14}>
    <path d="M3 4h14M3 8h8M3 13h14M3 17h8" />
  </Icon>
);

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
