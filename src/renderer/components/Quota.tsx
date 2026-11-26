import type { Translate } from '../../shared/i18n';
import {
  formatRemaining,
  formatTime,
  type QuotaInfo,
  type QuotaTone,
  quotaTone,
  remainingRatio,
} from '../../shared/quota';

// One color family per tone (see --color-quota-* in styles.css). Full class names, so that
// Tailwind can see them.
const TONE: Record<QuotaTone, { text: string; pill: string; bar: string; tint: string }> = {
  warning: {
    text: 'text-quota-warn',
    pill: 'bg-quota-warn/18 text-quota-warn',
    bar: 'bg-quota-warn',
    tint: 'bg-quota-warn/10',
  },
  full: {
    text: 'text-quota-full',
    pill: 'bg-quota-full/18 text-quota-full',
    bar: 'bg-quota-full',
    tint: 'bg-quota-full/10',
  },
  ok: {
    text: 'text-quota-ok',
    pill: 'bg-quota-ok/18 text-quota-ok',
    bar: 'bg-quota-ok',
    tint: 'bg-quota-ok/10',
  },
};

export const toneClasses = (info: QuotaInfo, now: number) => TONE[quotaTone(info, now)];

/** Hover text: what happened, how long is left, when it resets. */
export function quotaTooltip(
  t: Translate,
  locale: string,
  name: string,
  info: QuotaInfo,
  now: number
): string {
  const head = t(info.level === 'reached' ? 'quota.tooltipFull' : 'quota.tooltipWarning', { name });
  const detail = t('quota.tooltipDetail', {
    left: formatRemaining(info.resetsAt - now),
    time: formatTime(info.resetsAt, locale),
  });
  return `${head}\n${detail}`;
}

/** "Full" / "90%+" pill, with the reset time in column headers. */
export function QuotaPill({
  info,
  now,
  t,
  locale,
  withTime = false,
}: {
  info: QuotaInfo;
  now: number;
  t: Translate;
  locale: string;
  withTime?: boolean;
}) {
  const label = t(info.level === 'reached' ? 'quota.pillFull' : 'quota.pillWarning');
  const time = withTime ? ` · ${t('quota.back', { time: formatTime(info.resetsAt, locale) })}` : '';
  return (
    <span
      class={`quota-pill flex-none whitespace-nowrap rounded-full px-1.5 py-px text-[11px] font-medium ${toneClasses(info, now).pill}`}
    >
      {label}
      {time}
    </span>
  );
}

/** Hourglass bar: full when the window opens, empty at the reset. */
export function QuotaBar({
  info,
  now,
  class: className = '',
}: {
  info: QuotaInfo;
  now: number;
  class?: string;
}) {
  const percent = Math.round(remainingRatio(info, now) * 100);
  return (
    <div
      class={`quota-bar overflow-hidden rounded-full bg-ink/10 ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
    >
      <div
        class={`h-full rounded-full transition-[width] duration-1000 ease-linear ${toneClasses(info, now).bar}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
