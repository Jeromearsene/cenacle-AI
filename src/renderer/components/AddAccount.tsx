import { useEffect, useRef, useState } from 'preact/hooks';
import type { ProviderInfo } from '../../shared/types';
import { api } from '../use-multi';

export function AddAccount({ providers }: { providers: ProviderInfo[] }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const onClick = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} class="relative mt-2">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        class="h-8 w-full cursor-pointer rounded-[7px] border border-dashed border-line bg-transparent text-muted hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        onClick={() => setOpen((v) => !v)}
      >
        + Ajouter un compte
      </button>
      {open && (
        <div
          role="menu"
          class="absolute inset-x-0 top-[calc(100%+4px)] z-10 flex flex-col rounded-lg border border-line bg-bg p-1 shadow-lg"
        >
          {providers.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              class="h-[30px] cursor-pointer rounded-md border-0 bg-transparent px-2.5 text-left hover:bg-hover focus-visible:bg-hover"
              onClick={() => {
                setOpen(false);
                void api.addAccount(p.id);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
