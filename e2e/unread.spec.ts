import type { Page } from '@playwright/test';
import { createUnread } from '../src/main/unread';
import { evalIn, expect, test, waitForServices } from './fixtures';

test.describe('unread accounts (no app launched)', () => {
  function setup() {
    const changes: string[][] = [];
    return { unread: createUnread((ids) => changes.push(ids)), changes };
  }

  test('a notification nobody is looking at marks the account and calls the user back', () => {
    const { unread, changes } = setup();
    expect(unread.notify('a', false)).toBe(true);
    expect(unread.ids()).toEqual(['a']);
    expect(changes).toEqual([['a']]);
  });

  test('a notification on the page being looked at changes nothing', () => {
    const { unread, changes } = setup();
    expect(unread.notify('a', true)).toBe(false);
    expect(unread.ids()).toEqual([]);
    expect(changes).toEqual([]);
  });

  test('a second notification calls the user back again but does not repeat the change', () => {
    const { unread, changes } = setup();
    unread.notify('a', false);
    expect(unread.notify('a', false)).toBe(true);
    expect(changes).toEqual([['a']]);
  });

  test('keeps the order of arrival and clears one account at a time', () => {
    const { unread, changes } = setup();
    unread.notify('b', false);
    unread.notify('a', false);
    unread.clear('b');
    expect(unread.ids()).toEqual(['a']);
    expect(changes).toEqual([['b'], ['b', 'a'], ['a']]);
  });

  test('clearing or forgetting an account that is not marked changes nothing', () => {
    const { unread, changes } = setup();
    unread.clear('a');
    unread.forget('a');
    expect(changes).toEqual([]);
  });

  test('forgetting a deleted account removes it', () => {
    const { unread, changes } = setup();
    unread.notify('a', false);
    unread.forget('a');
    expect(unread.ids()).toEqual([]);
    expect(changes).toEqual([['a'], []]);
  });
});

async function addAccount(sidebar: Page, label: string): Promise<void> {
  await sidebar.getByRole('button', { name: '+ Add account' }).click();
  await sidebar.getByRole('menuitem', { name: label }).click();
  await sidebar.locator('input.rename').press('Enter');
}

test.describe('unread dot in the interface', () => {
  test('a notification from a hidden account shows a dot until it is opened', async ({
    launch,
    service,
  }) => {
    const { app, sidebar } = await launch();
    await addAccount(sidebar, 'ChatGPT'); // now active: the Claude account is hidden
    const [claudeView] = await waitForServices(app, new URL(service.url).origin, 2);
    const claudeRow = sidebar.locator('#accounts .account').first();
    await expect(claudeRow.locator('.unread-dot')).toHaveCount(0);

    await evalIn(app, claudeView as number, "new Notification('Reply ready')");
    await expect(claudeRow.locator('.unread-dot')).toHaveCount(1);
    await expect(sidebar.locator('#accounts .account .unread-dot')).toHaveCount(1);

    await claudeRow.click();
    await expect(sidebar.locator('.account.active .name')).toHaveText('Claude 1');
    await expect(sidebar.locator('.unread-dot')).toHaveCount(0);
  });

  test('a notification created from a service worker registration also counts', async ({
    launch,
    service,
  }) => {
    const { app, sidebar } = await launch();
    await addAccount(sidebar, 'ChatGPT');
    const [claudeView] = await waitForServices(app, new URL(service.url).origin, 2);

    // The page itself reports it, as the wrapped `showNotification` does.
    await evalIn(
      app,
      claudeView as number,
      "window.dispatchEvent(new CustomEvent('cenacle:notification-shown'))"
    );
    const claudeRow = sidebar.locator('#accounts .account').first();
    await expect(claudeRow.locator('.unread-dot')).toHaveCount(1);
  });
});
