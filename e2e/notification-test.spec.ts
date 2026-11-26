import { EventEmitter } from 'node:events';
import {
  formatReport,
  type NativeNotification,
  parseWebOutcome,
  testNative,
  webProbeScript,
} from '../src/main/notification-test';
import { translator } from '../src/shared/i18n';
import { evalIn, expect, test, waitForServices } from './fixtures';

const t = translator('en');

/** A fake Electron notification: the test decides which event it emits. */
function fake(emit?: (n: EventEmitter) => void): NativeNotification {
  const emitter = new EventEmitter();
  return Object.assign(emitter, { show: () => emit && setImmediate(() => emit(emitter)) });
}

test.describe('notification test: system notification', () => {
  test('reports `show`', async () => {
    const outcome = await testNative(() => fake((n) => n.emit('show')), true, 200);
    expect(outcome).toEqual({ event: 'show', error: null });
  });

  test('reports `failed` with the error Electron gives (unsigned macOS app)', async () => {
    const outcome = await testNative(
      () => fake((n) => n.emit('failed', {}, 'UNErrorDomain error 1')),
      true,
      200
    );
    expect(outcome).toEqual({ event: 'failed', error: 'UNErrorDomain error 1' });
  });

  test('gives up after the delay when nothing happens', async () => {
    expect(await testNative(() => fake(), true, 30)).toEqual({ event: 'timeout', error: null });
  });

  test('does not even create the notification when the system does not support them', async () => {
    let created = false;
    const outcome = await testNative(
      () => {
        created = true;
        return fake();
      },
      false,
      30
    );
    expect(outcome.event).toBe('unsupported');
    expect(created).toBe(false);
  });
});

test.describe('notification test: reading and showing the result', () => {
  test('reads what the page sends back, whatever it is', () => {
    expect(parseWebOutcome({ permission: 'granted', event: 'show', error: null })).toEqual({
      permission: 'granted',
      event: 'show',
      error: null,
    });
    expect(parseWebOutcome(null)).toEqual({
      permission: 'unknown',
      event: 'unavailable',
      error: null,
    });
    expect(parseWebOutcome({ event: 'boom', permission: 3 }).event).toBe('unavailable');
  });

  test('a refusal points to code signing', () => {
    const failed = formatReport(
      { event: 'failed', error: 'UNErrorDomain error 1' },
      { permission: 'granted', event: 'error', error: null },
      t,
      true
    );
    expect(failed).toContain('refused by the system (UNErrorDomain error 1)');
    expect(failed).toContain('Testing notifications on macOS');
  });

  test('a success does not mention signing', () => {
    const ok = formatReport(
      { event: 'show', error: null },
      { permission: 'granted', event: 'show', error: null },
      t,
      true
    );
    expect(ok).toContain('System notification (app): shown ✓');
    expect(ok).toContain('Web notification (active account): shown ✓ (permission: granted)');
    expect(ok).not.toContain('signing');
    expect(ok).not.toContain('CONTRIBUTING');
  });

  test('says so when there is no account page to test', () => {
    expect(formatReport({ event: 'show', error: null }, null, t, true)).toContain(
      'no account page to test'
    );
  });

  test('the code-signing hint only concerns macOS', () => {
    const failed = { event: 'failed', error: 'denied' } as const;
    expect(formatReport(failed, null, t, false)).not.toContain('CONTRIBUTING');
    expect(formatReport(failed, null, t, true)).toContain('CONTRIBUTING');
  });
});

test.describe('notification test: the page', () => {
  test('the probe runs in a service page, which may show notifications', async ({
    launch,
    service,
  }) => {
    const { app } = await launch();
    const [id] = await waitForServices(app, new URL(service.url).origin, 1);
    const raw = await evalIn(app, id as number, webProbeScript('Test', 'body', 300));
    const outcome = parseWebOutcome(raw);
    // The permission policy grants notifications; what the system then does with the
    // notification (a banner or not) depends on the machine, so any of these events will do.
    expect(outcome.permission).toBe('granted');
    expect(['show', 'error', 'timeout']).toContain(outcome.event);
  });
});

test.describe('View → Development submenu', () => {
  test('groups the developer tools, the resource usage and the notification test', async ({
    launch,
  }) => {
    const { app } = await launch();
    const entries = await app.evaluate(({ Menu }) => {
      const view = Menu.getApplicationMenu()?.items.find((item) => item.label === 'View');
      const development = view?.submenu?.items.find((item) => item.label === 'Development');
      return development?.submenu?.items
        .filter((item) => item.type !== 'separator')
        .map((item) => ({ id: item.id, label: item.label }));
    });
    expect(entries).toEqual([
      { id: '', label: 'Developer tools (active account)' },
      { id: 'resource-usage', label: 'Resource usage' },
      { id: 'test-notifications', label: 'Test notifications…' },
    ]);
  });
});
