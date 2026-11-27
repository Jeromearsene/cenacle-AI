import { CountPill } from './CountPill';
import { ProviderLogo } from './ProviderLogo';

/** The line that opens a service's accounts when the list is grouped by service. */
export function ProviderGroupHead({
  label,
  icon,
  count,
}: {
  label: string;
  icon?: string;
  count: number;
}) {
  return (
    <div class="group-head flex items-center gap-2 px-2 pt-2.5 pb-1">
      <ProviderLogo label={label} icon={icon} />
      <span class="text-[12px] font-semibold">{label}</span>
      <CountPill>{count}</CountPill>
      <span class="h-px flex-1 bg-line" aria-hidden="true" />
    </div>
  );
}
