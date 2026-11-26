import { useCallback, useEffect, useState } from 'preact/hooks';
import type { Locale } from '../../shared/i18n';
import { formatCpu, formatMemory, type Usage } from '../../shared/metrics';
import type { Account } from '../../shared/types';
import { useT } from '../i18n';
import { useResourceUsage, useResourceUsageToggle } from '../use-multi';
import { IconButton } from './IconButton';

interface Props {
  accounts: Account[];
  locale: Locale;
}

const CELL = 'py-0.5 text-right whitespace-nowrap';

/**
 * Memory and CPU of each account, opened from View → Resource usage. Drawn inside the sidebar:
 * the service pages cover everything to its right.
 */
export function ResourceUsagePanel({ accounts, locale }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  useResourceUsageToggle(useCallback(() => setOpen((v) => !v), []));
  const usage = useResourceUsage(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const figures = (u: Usage | null | undefined) =>
    u ? (
      <>
        <td class={CELL}>{formatMemory(u.memoryKb, locale)}</td>
        <td class={`${CELL} pl-2`}>{formatCpu(u.cpu, locale)}</td>
      </>
    ) : (
      <td class={`${CELL} text-muted`} colSpan={2} title={t('usage.notLoaded')}>
        –
      </td>
    );

  return (
    <section
      aria-label={t('usage.title')}
      class="resource-usage absolute inset-x-1.5 bottom-[52px] z-20 rounded-lg border border-line bg-bg p-2 shadow-lg"
    >
      <div class="mb-1.5 flex items-center justify-between">
        <h2 class="m-0 text-[12px] font-semibold">{t('usage.title')}</h2>
        <IconButton label={t('usage.close')} glyph="✕" onClick={() => setOpen(false)} />
      </div>
      <table class="w-full border-collapse text-[12px] tabular-nums">
        <thead class="text-muted">
          <tr>
            <th scope="col" class="py-0.5 text-left font-normal">
              {t('usage.account')}
            </th>
            <th scope="col" class={`${CELL} w-[58px] font-normal`}>
              {t('usage.memory')}
            </th>
            <th scope="col" class={`${CELL} w-[40px] pl-2 font-normal`}>
              {t('usage.cpu')}
            </th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((acc) => (
            <tr key={acc.id} data-account={acc.id}>
              <th scope="row" class="max-w-0 py-0.5 text-left font-normal">
                <span class="flex items-center gap-1.5">
                  <span
                    class="size-[9px] flex-none rounded-full"
                    style={{ backgroundColor: acc.color }}
                  />
                  <span class="min-w-0 truncate">{acc.name}</span>
                </span>
              </th>
              {figures(usage?.accounts.find((a) => a.id === acc.id)?.usage)}
            </tr>
          ))}
        </tbody>
        {usage && (
          <tfoot>
            <tr class="text-muted" data-row="shared">
              <th scope="row" class="py-0.5 pt-1 text-left font-normal">
                {t('usage.shared')}
              </th>
              {figures(usage.shared)}
            </tr>
            <tr class="border-t border-line font-semibold" data-row="total">
              <th scope="row" class="py-0.5 text-left font-semibold">
                {t('usage.total')}
              </th>
              {figures(usage.total)}
            </tr>
          </tfoot>
        )}
      </table>
      <p class="mt-2 mb-0 text-[11px] leading-snug text-muted">{t('usage.note')}</p>
    </section>
  );
}
