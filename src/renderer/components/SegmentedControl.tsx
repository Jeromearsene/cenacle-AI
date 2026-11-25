import { useRef } from 'preact/hooks';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

// A single-choice button group: the WAI-ARIA "radiogroup" pattern (selection follows focus, only
// the selected option sits in the Tab order, arrow keys move the selection). Shared by
// LayoutToggle and Settings so both behave and look the same.
export function SegmentedControl<T extends string>({ label, value, options, onChange }: Props<T>) {
  const wrap = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: KeyboardEvent) => {
    let dir = 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1;
    else return;
    e.preventDefault();
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + dir + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    wrap.current?.querySelectorAll<HTMLElement>('[role=radio]')[options.indexOf(next)]?.focus();
  };

  return (
    <div>
      <div class="mb-1 px-0.5 text-[11px] text-muted">{label}</div>
      <div
        ref={wrap}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
        class="flex flex-wrap gap-0.5 rounded-lg bg-hover p-0.5"
      >
        {options.map((o) => (
          // biome-ignore lint/a11y/useSemanticElements: a plain button keeps the click handler and pill styling that an <input type="radio"> would need extra wrapper markup for
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            tabIndex={value === o.value ? 0 : -1}
            class="h-[26px] flex-1 cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent px-2 text-muted aria-checked:bg-bg aria-checked:text-ink aria-checked:shadow-sm focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
