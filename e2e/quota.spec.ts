import { formatRemaining, parseBanner, quotaTone, remainingRatio } from '../src/shared/quota';
import { evalIn, expect, test, waitForServices } from './fixtures';

// Reading the banner: a pure function, no app needed.
test.describe('usage banner parsing', () => {
  const now = new Date(2026, 10, 26, 2, 18).getTime();
  const hoursOf = (ms: number) => new Date(ms).getHours();

  test('limit reached, in French and in English', () => {
    const fr = parseBanner('Vous n’avez plus de messages gratuits jusqu’à 06:00.', now);
    expect(fr?.level).toBe('reached');
    expect(hoursOf(fr?.resetsAt ?? 0)).toBe(6);
    const en = parseBanner('You are out of free messages until 6:00 PM', now);
    expect(en?.level).toBe('reached');
    expect(hoursOf(en?.resetsAt ?? 0)).toBe(18);
  });

  test('more than 90 % used is a warning', () => {
    const info = parseBanner(
      'Vous avez utilisé plus de 90 % de votre limite de 5 heures · Réinitialisation à 06:00',
      now
    );
    expect(info?.level).toBe('warning');
  });

  test('a reset time already past today means tomorrow', () => {
    const info = parseBanner('reset at 02:00', now);
    expect(info && info.resetsAt - now).toBe(23 * 3600e3 + 42 * 60e3);
  });

  test('a banner without a time is ignored', () => {
    expect(parseBanner('Claude can make mistakes', now)).toBeNull();
  });

  test('hourglass ratio, tone and remaining time', () => {
    const info = parseBanner('until 06:00', now);
    if (!info) throw new Error('banner not parsed');
    expect(remainingRatio(info, now)).toBeCloseTo((3 * 60 + 42) / 300, 3);
    expect(remainingRatio(info, info.resetsAt)).toBe(0);
    expect(quotaTone(info, now)).toBe('full');
    expect(quotaTone(info, info.resetsAt - 5 * 60e3)).toBe('ok');
    expect(formatRemaining(3 * 3600e3 + 40 * 60e3)).toBe('3 h 40');
    expect(formatRemaining(45 * 60e3)).toBe('45 min');
  });
});

// A banner shown by the (fake) service page appears in the interface.
const clockIn = (hours: number): string => {
  const d = new Date(Date.now() + hours * 3600e3);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const showBanner = (text: string) =>
  `(() => { document.querySelector('[data-testid="message-warning"]')?.remove();
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'message-warning');
    el.textContent = ${JSON.stringify(text)};
    document.body.append(el); })()`;

test('limit reached: pill, countdown and hourglass bar in the sidebar', async ({
  launch,
  service,
}) => {
  const { app, sidebar } = await launch();
  const [id] = await waitForServices(app, service.url, 1);
  await expect(sidebar.locator('.quota-pill')).toHaveCount(0);

  await evalIn(app, id as number, showBanner(`You are out of free messages until ${clockIn(2)}.`));
  await expect(sidebar.locator('.account .quota-pill')).toHaveText('Full');
  await expect(sidebar.locator('.account .quota-bar')).toBeVisible();
  const now = Number(await sidebar.locator('.account .quota-bar').getAttribute('aria-valuenow'));
  expect(now).toBeGreaterThan(30);
  expect(now).toBeLessThan(50);
});

test('more than 90 % used: warning pill', async ({ launch, service }) => {
  const { app, sidebar } = await launch();
  const [id] = await waitForServices(app, service.url, 1);
  await evalIn(
    app,
    id as number,
    showBanner(`You have used over 90% of your 5-hour limit · Resets at ${clockIn(3)}`)
  );
  await expect(sidebar.locator('.account .quota-pill')).toHaveText('90%+');
});

test('the limit stays when the banner disappears, and the column header shows it', async ({
  launch,
  service,
}) => {
  const { app, sidebar } = await launch();
  const [id] = await waitForServices(app, service.url, 1);
  await evalIn(app, id as number, showBanner(`You are out of free messages until ${clockIn(2)}.`));
  await expect(sidebar.locator('.account .quota-pill')).toBeVisible();
  await evalIn(
    app,
    id as number,
    `document.querySelector('[data-testid="message-warning"]')?.remove()`
  );
  await sidebar.waitForTimeout(1000);
  await expect(sidebar.locator('.account .quota-pill')).toBeVisible();

  await sidebar.getByRole('button', { name: 'Grid' }).click();
  await expect(sidebar.locator('.cell-head .quota-pill')).toContainText('back');
});

test('the French interface says "Plein"', async ({ launch, service }) => {
  const { app, sidebar } = await launch({ lang: 'fr' });
  const [id] = await waitForServices(app, service.url, 1);
  await evalIn(
    app,
    id as number,
    showBanner(`Vous n’avez plus de messages jusqu’à ${clockIn(1)}.`)
  );
  await expect(sidebar.locator('.account .quota-pill')).toHaveText('Plein');
});
