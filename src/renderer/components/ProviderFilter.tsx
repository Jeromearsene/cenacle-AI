import type { ProviderCount } from '../../shared/provider-view';
import type { AccountSort } from '../../shared/types';
import { useT } from '../i18n';
import { CountPill } from './CountPill';
import { GroupedIcon, ListIcon } from './icons';
import { ProviderLogo } from './ProviderLogo';
import { SegmentedControl } from './SegmentedControl';

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

/**
 * Above the account list: filter chips (one per service) to show a single service, and a switch
 * between the plain list and the list grouped by service. The switch is a different shape from
 * the chips on purpose: it changes how the list is shown, it is not one more service.
 */
export function ProviderFilter({ providers, total, filter, onFilter, sort, onSort }: Props) {
  const t = useT();
  return (
    <div class="provider-filter mb-2 flex flex-col gap-2 px-0.5">
      {/* biome-ignore lint/a11y/useSemanticElements: a <fieldset> imposes its default styling; role="group" is equivalent for screen readers */}
      <div role="group" aria-label={t('filter.label')} class="flex flex-wrap gap-1">
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
      </div>
      <SegmentedControl
        label={t('view.label')}
        hideLabel
        value={sort}
        options={[
          { value: 'manual', label: t('view.list'), icon: <ListIcon /> },
          { value: 'provider', label: t('view.grouped'), icon: <GroupedIcon /> },
        ]}
        onChange={onSort}
      />
    </div>
  );
}
