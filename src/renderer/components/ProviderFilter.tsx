import type { ProviderCount } from '../../shared/provider-view';
import type { AccountSort } from '../../shared/types';
import { useT } from '../i18n';

interface Props {
  /** Services that have accounts. */
  providers: ProviderCount[];
  total: number;
  /** Service shown alone, or null for all of them. */
  filter: string | null;
  onFilter: (id: string | null) => void;
  sort: AccountSort;
  onSort: (sort: AccountSort) => void;
}

const CHIP =
  'h-[22px] cursor-pointer rounded-md border border-line bg-transparent px-2 text-[11px] text-muted hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-transparent aria-pressed:bg-active aria-pressed:text-ink';

/** Filter chips (one per service) and a "group by service" toggle, above the account list. */
export function ProviderFilter({ providers, total, filter, onFilter, sort, onSort }: Props) {
  const t = useT();
  return (
    // biome-ignore lint/a11y/useSemanticElements: a <fieldset> imposes its default styling; role="group" is equivalent for screen readers
    <div
      role="group"
      aria-label={t('filter.label')}
      class="provider-filter mb-1.5 flex flex-wrap gap-1 px-0.5"
    >
      <button
        type="button"
        class={`${CHIP} chip-all`}
        aria-pressed={filter === null}
        onClick={() => onFilter(null)}
      >
        {t('filter.all')} {total}
      </button>
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          class={`${CHIP} chip`}
          aria-pressed={filter === p.id}
          onClick={() => onFilter(filter === p.id ? null : p.id)}
        >
          {p.label} {p.count}
        </button>
      ))}
      <button
        type="button"
        class={`${CHIP} group-toggle ml-auto`}
        aria-pressed={sort === 'provider'}
        title={t('filter.groupHint')}
        onClick={() => onSort(sort === 'provider' ? 'manual' : 'provider')}
      >
        {t('filter.group')}
      </button>
    </div>
  );
}
