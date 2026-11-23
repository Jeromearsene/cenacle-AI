import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

/** Rename field: Enter or losing focus confirms, Escape cancels. */
export function RenameInput({ initial, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false); // avoids confirming twice (Enter then blur)

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(value);
    else onCancel();
  };

  return (
    <input
      ref={ref}
      type="text"
      maxLength={40}
      spellcheck={false}
      aria-label="Nom du compte"
      value={value}
      class="rename h-6 min-w-0 flex-1 select-text rounded-[5px] border border-accent bg-bg px-1.5 text-ink [font:inherit]"
      onInput={(e) => setValue(e.currentTarget.value)}
      onClick={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(true);
        } else if (e.key === 'Escape') {
          finish(false);
        }
      }}
    />
  );
}
