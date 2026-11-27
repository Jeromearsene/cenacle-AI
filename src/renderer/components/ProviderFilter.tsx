import type { ProviderCount } from '../../shared/provider-view';
import type { AccountSort } from '../../shared/types';
import { useT } from '../i18n';
import { CountPill } from './CountPill';
import { ProviderLogo } from './ProviderLogo';

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
  'group flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-line bg-transparent pr-1 pl-1.5 text-[11px] text-muted hover:bg-hover hover:text-ink focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-accent aria-pressed:border-transparent aria-pressed:bg-active aria-pressed:text-ink';

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
        aria-label={`${t('filter.all')} ${total}`}
        onClick={() => onFilter(null)}
      >
        {t('filter.all')}
        <CountPill>{total}</CountPill>
      </button>
      {providers.map((p) => (
        <button
          key={p.id}
          type="button"
          class={`${CHIP} chip`}
          aria-pressed={filter === p.id}
          aria-label={`${p.label} ${p.count}`}
          onClick={() => onFilter(filter === p.id ? null : p.id)}
        >
          <ProviderLogo label={p.label} icon={p.icon} />
          {p.label}
          <CountPill>{p.count}</CountPill>
        </button>
      ))}
      <button
        type="button"
        class={`${CHIP} group-toggle ml-auto pr-2 pl-2`}
        aria-pressed={sort === 'provider'}
        title={t('filter.groupHint')}
        onClick={() => onSort(sort === 'provider' ? 'manual' : 'provider')}
      >
        {t('filter.group')}
      </button>
    </div>
  );
}
