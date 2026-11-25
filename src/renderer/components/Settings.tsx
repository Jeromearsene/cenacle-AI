import { useEffect, useRef, useState } from 'preact/hooks';
import { LOCALE_LABELS, LOCALES, type MessageKey } from '../../shared/i18n';
import type { PublicState, Theme } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';

const THEMES: { value: Theme; label: MessageKey }[] = [
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' },
  { value: 'system', label: 'settings.system' },
];

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <div class="mb-1 px-0.5 text-[11px] text-muted">{label}</div>
      {/* flex-wrap (not a fixed grid): the language group grows past 3 options once another
          language is added, and a language's own name must never be truncated. */}
      {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> imposes its default styling; role="group" is equivalent for screen readers */}
      <div role="group" aria-label={label} class="flex flex-wrap gap-0.5 rounded-lg bg-hover p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            class="h-[26px] flex-1 cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent px-2 text-muted aria-pressed:bg-bg aria-pressed:text-ink aria-pressed:shadow-sm"
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Settings({ state }: { state: PublicState }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    wrap.current?.querySelector<HTMLElement>('[role=group] button')?.focus();
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
    <div ref={wrap} id="settings" class="relative mt-2">
      <button
        ref={button}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t('settings.title')}
        class="h-8 w-full cursor-pointer rounded-[7px] border-0 bg-transparent text-muted hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⚙</span> {t('settings.title')}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('settings.title')}
          class="absolute inset-x-0 bottom-[calc(100%+4px)] z-10 flex flex-col gap-2.5 rounded-lg border border-line bg-bg p-2.5 shadow-lg"
        >
          <OptionGroup
            label={t('settings.language')}
            value={state.localeOverride ?? 'system'}
            options={[
              { value: 'system', label: t('settings.system') },
              ...LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] })),
            ]}
            onChange={(pref) => void api.setLocale(pref)}
          />
          <OptionGroup
            label={t('settings.theme')}
            value={state.theme}
            options={THEMES.map(({ value, label }) => ({ value, label: t(label) }))}
            onChange={(pref) => void api.setTheme(pref)}
          />
        </div>
      )}
    </div>
  );
}
