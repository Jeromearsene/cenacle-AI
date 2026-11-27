import type { ComponentChildren } from 'preact';

/**
 * A number set apart from the words around it: a small round badge. Inside a `group` that can be
 * pressed (a filter chip), the badge darkens along with it.
 */
export function CountPill({ children }: { children: ComponentChildren }) {
  return (
    <span class="count-pill inline-grid h-4 min-w-4 flex-none place-items-center rounded-full bg-ink/10 px-1 text-[10.5px] leading-none font-semibold text-ink tabular-nums group-aria-pressed:bg-ink/15">
      {children}
    </span>
  );
}
