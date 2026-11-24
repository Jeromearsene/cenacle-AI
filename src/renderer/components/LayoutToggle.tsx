import type { MessageKey } from '../../shared/i18n';
import type { Layout } from '../../shared/types';
import { useT } from '../i18n';
import { api } from '../use-multi';

const OPTIONS: { mode: Layout; label: MessageKey }[] = [
  { mode: 'single', label: 'layout.single' },
  { mode: 'grid', label: 'layout.grid' },
];

export function LayoutToggle({ layout }: { layout: Layout }) {
  const t = useT();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> imposes its default styling; role="group" is equivalent for screen readers
    <div
      role="group"
      aria-label={t('layout.label')}
      class="grid grid-cols-2 rounded-lg bg-hover p-0.5"
    >
      {OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={layout === mode}
          class="h-[26px] cursor-pointer rounded-md border-0 bg-transparent text-muted aria-pressed:bg-bg aria-pressed:text-ink aria-pressed:shadow-sm"
          onClick={() => void api.setLayout(mode)}
        >
          {t(label)}
        </button>
      ))}
    </div>
  );
}
