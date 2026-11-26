import { useEffect, useRef, useState } from 'preact/hooks';
import { LOCALE_LABELS, LOCALES, type MessageKey } from '../../shared/i18n';
import type { PublicState, Theme } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';
import { IconButton } from './IconButton';
import { SegmentedControl } from './SegmentedControl';

const THEMES: { value: Theme; label: MessageKey }[] = [
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' },
  { value: 'system', label: 'settings.system' },
];

export function Settings({
  state,
  openRequest,
}: {
  state: PublicState;
  openRequest: number | null;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  // ⌘, / Ctrl, or the "Settings" menu item (main process): openRequest is null until the first
  // one, so this never fires on mount, only on an actual request.
  useEffect(() => {
    if (openRequest != null) setOpen(true);
  }, [openRequest]);

  useEffect(() => {
    if (!open) return;
    // The default selection ('system' for both groups' first render) is also the only tabbable
    // radio in its group (roving tabindex, see SegmentedControl): target that one, not just "the
    // first button", which may no longer be reachable by Tab.
    dialog.current
      ?.querySelector<HTMLElement>('[role=radiogroup] [role=radio][tabindex="0"]')
      ?.focus();
    // "Outside" means outside the panel itself: the backdrop behind it (and, incidentally, the
    // gear button, which already toggles via its own onClick) both count as outside.
    const onClick = (e: MouseEvent) => {
      if (!dialog.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
        return;
      }
      // Keep Tab inside the open panel: nothing behind it should be reachable while it's shown,
      // and the dialog has no backdrop to make that obvious otherwise.
      if (e.key !== 'Tab') return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
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
        class="h-8 w-full cursor-pointer rounded-[7px] border border-line bg-transparent text-muted hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">⚙</span> {t('settings.title')}
      </button>
      {open && (
        // Full-window backdrop: a big, centered dialog (⌘, is a "stop and configure the app"
        // moment, not a quick tweak), closer to VS Code's or Discord's preferences than to the
        // small anchored popover this used to be.
        <div
          data-testid="settings-backdrop"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6"
        >
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-heading"
            class="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl"
          >
            <div class="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="settings-heading" class="text-[15px] font-semibold text-ink">
                {t('settings.title')}
              </h2>
              <IconButton label={t('settings.close')} glyph="✕" onClick={() => setOpen(false)} />
            </div>
            <div class="flex flex-col gap-6 overflow-y-auto p-5">
              <SegmentedControl
                label={t('settings.language')}
                value={state.localeOverride ?? 'system'}
                options={[
                  { value: 'system', label: t('settings.system') },
                  ...LOCALES.map((l) => ({ value: l, label: LOCALE_LABELS[l] })),
                ]}
                onChange={(pref) => void api.setLocale(pref)}
              />
              <SegmentedControl
                label={t('settings.theme')}
                value={state.theme}
                options={THEMES.map(({ value, label }) => ({ value, label: t(label) }))}
                onChange={(pref) => void api.setTheme(pref)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
