// Usage-limit ("quota") detection helpers, shared by the main process and the interface.
// Pure functions only (no Node, no Electron): testable without launching the app.

/** Length of the rolling usage window the hourglass bar is drawn against. */
export const WINDOW_MS = 5 * 60 * 60 * 1000;

/** Under this remaining time the bar turns green: the quota is about to come back. */
export const NEARLY_BACK_MS = 15 * 60 * 1000;

export type QuotaLevel = 'warning' | 'reached';
export type QuotaTone = 'warning' | 'full' | 'ok';

export interface QuotaInfo {
  level: QuotaLevel;
  /** When the limit resets (epoch milliseconds). */
  resetsAt: number;
}

interface Clock {
  hours: number;
  minutes: number;
}

// "06:00", "6:00 PM", "6 h 00", "6h00"
const CLOCK_RE = /\b(\d{1,2})\s?[:h]\s?(\d{2})\b\s*(?:([ap])\.?m\b\.?)?/i;
// "6 PM" (no minutes)
const HOUR_ONLY_RE = /\b(\d{1,2})\s*([ap])\.?m\b/i;
const PERCENT_RE = /\b(\d{1,3})\s*%/;

function toClock(
  hoursText: string,
  minutesText: string,
  meridiem: string | undefined
): Clock | null {
  let hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (meridiem.toLowerCase() === 'p' ? 12 : 0);
  } else if (hours > 23) {
    return null;
  }
  return { hours, minutes };
}

/** The time of day written in a banner, or null. */
export function parseClock(text: string): Clock | null {
  const full = CLOCK_RE.exec(text);
  if (full) return toClock(full[1] as string, full[2] as string, full[3]);
  const short = HOUR_ONLY_RE.exec(text);
  if (short) return toClock(short[1] as string, '0', short[2]);
  return null;
}

/** The next time the clock shows `clock`, strictly after `now` (local time). */
export function nextOccurrence(clock: Clock, now: number): number {
  const d = new Date(now);
  d.setHours(clock.hours, clock.minutes, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Reads the text of the service's usage banner.
 *
 * Detection looks at the structure rather than at exact wording, so it survives a rewording or
 * another language: a banner that quotes a percentage ("more than 90 %") is a warning, any other
 * banner that gives a reset time means the limit is reached. A banner without a time is ignored.
 */
export function parseBanner(text: string, now: number): QuotaInfo | null {
  const clock = parseClock(text);
  if (!clock) return null;
  const percent = PERCENT_RE.exec(text);
  const level: QuotaLevel = percent && Number(percent[1]) < 100 ? 'warning' : 'reached';
  return { level, resetsAt: nextOccurrence(clock, now) };
}

/** Share of the window left before the reset: 1 right after it opens, 0 at the reset. */
export function remainingRatio(info: QuotaInfo, now: number): number {
  return Math.min(1, Math.max(0, (info.resetsAt - now) / WINDOW_MS));
}

/** Color family of the indicators. */
export function quotaTone(info: QuotaInfo, now: number): QuotaTone {
  if (info.resetsAt - now <= NEARLY_BACK_MS) return 'ok';
  return info.level === 'warning' ? 'warning' : 'full';
}

/** "3 h 40", "4 h 05", "45 min", "1 min". Never shows less than one minute. */
export function formatRemaining(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** The reset time of day in the user's language ("06:00", "6:00 AM"). */
export function formatTime(ms: number, locale: string): string {
  return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}
