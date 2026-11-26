// TEMPORARY diagnostic: "Test notifications" in the Accounts menu. It checks whether macOS
// displays notifications for this build (Electron 42+ needs a code-signed app, see
// CONTRIBUTING.md). Remove it once the question is settled: this file, its menu entry in
// index.ts, the `notifTest.*` messages in i18n.ts, e2e/notification-test.spec.ts and the
// "Testing notifications on macOS" section of CONTRIBUTING.md.
//
// No dependency on Electron: the logic can be tested without launching the app.

import type { Translate } from '../shared/i18n';

/** Time to wait for a `show` or `failed` event before giving up (ms). */
export const TIMEOUT_MS = 5000;

// ------------------------------------------------------------------ native (Electron Notification)

/** The part of Electron's `Notification` that the test uses. */
export interface NativeNotification {
  on(event: 'show' | 'failed', listener: (...args: unknown[]) => void): unknown;
  show(): void;
}

export interface NativeOutcome {
  event: 'show' | 'failed' | 'timeout' | 'unsupported';
  /** What Electron reported with `failed` (e.g. `UNErrorDomain error 1`). */
  error: string | null;
}

/** Shows a notification from the main process and reports the first event it emits. */
export function testNative(
  create: () => NativeNotification,
  supported: boolean,
  timeoutMs = TIMEOUT_MS
): Promise<NativeOutcome> {
  if (!supported) return Promise.resolve({ event: 'unsupported', error: null });
  return new Promise((resolve) => {
    const finish = (outcome: NativeOutcome) => {
      clearTimeout(timer);
      resolve(outcome);
    };
    const timer = setTimeout(() => finish({ event: 'timeout', error: null }), timeoutMs);
    const notification = create();
    notification.on('show', () => finish({ event: 'show', error: null }));
    notification.on('failed', (_event, error) => finish({ event: 'failed', error: String(error) }));
    notification.show();
  });
}

// ------------------------------------------------------------------ web (page of the account)

export interface WebOutcome {
  /** `Notification.permission` in the page: anything but `granted` shows nothing. */
  permission: string;
  event: 'show' | 'error' | 'timeout' | 'throw' | 'unavailable';
  error: string | null;
}

/**
 * Script run in the active account's page: it raises a real web notification, through the same
 * path as the service (so the account name and color dot are applied too).
 */
export function webProbeScript(title: string, body: string, timeoutMs = TIMEOUT_MS): string {
  return `new Promise((resolve) => {
    const permission = typeof Notification === 'undefined' ? 'unavailable' : Notification.permission;
    let done = false;
    const finish = (event, error) => {
      if (done) return;
      done = true;
      resolve({ permission, event, error: error ?? null });
    };
    if (permission === 'unavailable') return finish('unavailable');
    try {
      const n = new Notification(${JSON.stringify(title)}, { body: ${JSON.stringify(body)} });
      n.addEventListener('show', () => finish('show'));
      n.addEventListener('error', () => finish('error'));
      setTimeout(() => finish('timeout'), ${Math.max(0, Math.floor(timeoutMs))});
    } catch (e) {
      finish('throw', String(e));
    }
  })`;
}

const WEB_EVENTS: readonly WebOutcome['event'][] = [
  'show',
  'error',
  'timeout',
  'throw',
  'unavailable',
];

/** Reads what the page sent back, whatever it is. */
export function parseWebOutcome(raw: unknown): WebOutcome {
  const value = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const event = WEB_EVENTS.find((e) => e === value.event) ?? 'unavailable';
  return {
    permission: typeof value.permission === 'string' ? value.permission : 'unknown',
    event,
    error: typeof value.error === 'string' ? value.error : null,
  };
}

// ------------------------------------------------------------------ report

/** The text of the result dialog. `web` is null when no account page was available. */
export function formatReport(native: NativeOutcome, web: WebOutcome | null, t: Translate): string {
  const nativeLine =
    native.event === 'failed'
      ? t('notifTest.nativeFailed', { error: native.error ?? '?' })
      : t(`notifTest.native.${native.event}`);
  const webLine = web
    ? `${t(`notifTest.web.${web.event}`, { error: web.error ?? '' })} (${t('notifTest.permission', {
        permission: web.permission,
      })})`
    : t('notifTest.webNone');
  return [`${t('notifTest.nativeLabel')} ${nativeLine}`, `${t('notifTest.webLabel')} ${webLine}`]
    .concat(
      native.event === 'failed' || web?.event === 'error' ? ['', t('notifTest.hintSigning')] : []
    )
    .join('\n');
}
