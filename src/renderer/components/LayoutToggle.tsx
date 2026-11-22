import type { Layout } from '../../shared/types';
import { api } from '../use-multi';

const OPTIONS: { mode: Layout; label: string }[] = [
  { mode: 'single', label: 'Un seul' },
  { mode: 'columns', label: 'Colonnes' },
];

export function LayoutToggle({ layout }: { layout: Layout }) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: un <fieldset> impose sa mise en forme par défaut ; role="group" est équivalent pour les lecteurs d'écran
    <div role="group" aria-label="Mise en page" class="grid grid-cols-2 rounded-lg bg-hover p-0.5">
      {OPTIONS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={layout === mode}
          class="h-[26px] cursor-pointer rounded-md border-0 bg-transparent text-muted aria-pressed:bg-bg aria-pressed:text-ink aria-pressed:shadow-sm"
          onClick={() => void api.setLayout(mode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
