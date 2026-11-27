import { parseState } from '../src/main/state';
import { activeFilter, providersInUse, visibleAccounts } from '../src/shared/provider-view';
import type { Account, ProviderInfo } from '../src/shared/types';
import { accountNames, addAccount, expect, test } from './fixtures';

const providers: ProviderInfo[] = [
  { id: 'claude', label: 'Claude' },
  { id: 'chatgpt', label: 'ChatGPT' },
  { id: 'gemini', label: 'Gemini' },
];
const account = (name: string, provider: string): Account => ({
  id: name,
  name,
  color: '#000',
  provider,
});
const accounts = [
  account('Claude 1', 'claude'),
  account('ChatGPT 1', 'chatgpt'),
  account('Claude 2', 'claude'),
  account('Mystery', 'unknown'),
];
const names = (list: Account[]) => list.map((a) => a.name);

// These checks do not launch the app.
test.describe('provider view', () => {
  test('counts the services in use, in the order of the service list', () => {
    expect(providersInUse(accounts, providers).map((p) => [p.id, p.count])).toEqual([
      ['claude', 2],
      ['chatgpt', 1],
    ]);
  });

  test('keeps the order of the accounts by default', () => {
    expect(names(visibleAccounts(accounts, providers, { filter: null, sort: 'manual' }))).toEqual(
      names(accounts)
    );
  });

  test('filters by service', () => {
    expect(
      names(visibleAccounts(accounts, providers, { filter: 'claude', sort: 'manual' }))
    ).toEqual(['Claude 1', 'Claude 2']);
  });

  test('ignores a filter on a service that has no account', () => {
    expect(
      names(visibleAccounts(accounts, providers, { filter: 'gemini', sort: 'manual' }))
    ).toEqual(names(accounts));
  });

  test('groups by service, keeping the order inside a group and unknown services last', () => {
    expect(names(visibleAccounts(accounts, providers, { filter: null, sort: 'provider' }))).toEqual(
      ['Claude 1', 'Claude 2', 'ChatGPT 1', 'Mystery']
    );
  });

  test('does not modify the list it is given', () => {
    const before = names(accounts);
    visibleAccounts(accounts, providers, { filter: null, sort: 'provider' });
    expect(names(accounts)).toEqual(before);
  });

  test('a saved filter applies only while it still tells services apart', () => {
    expect(activeFilter(accounts, null)).toBeNull();
    expect(activeFilter(accounts, 'chatgpt')).toBe('chatgpt');
    // no account uses this service any more
    expect(activeFilter(accounts, 'gemini')).toBeNull();
    // a single service left: nothing to filter
    expect(activeFilter([account('Claude 1', 'claude')], 'claude')).toBeNull();
  });
});

test.describe('saved view (without launching the app)', () => {
  const base = {
    accounts: [
      { id: 'aaaaaaaa', name: 'Claude 1', color: '#d97757', provider: 'claude' },
      { id: 'bbbbbbbb', name: 'ChatGPT 1', color: '#6a9bcc', provider: 'chatgpt' },
    ],
  };

  test('is restored from the saved state', () => {
    const view = parseState({
      ...base,
      accountView: { filter: 'chatgpt', sort: 'provider' },
    }).accountView;
    expect(view).toEqual({ filter: 'chatgpt', sort: 'provider' });
  });

  test('a state saved before the filter existed lists everything, in order', () => {
    expect(parseState(base).accountView).toEqual({ filter: null, sort: 'manual' });
  });

  test('a filter on a service without account, or an unusable value, is dropped', () => {
    const view = (accountView: unknown) => parseState({ ...base, accountView }).accountView;
    expect(view({ filter: 'gemini', sort: 'manual' }).filter).toBeNull();
    expect(view({ filter: 'nope', sort: 'manual' }).filter).toBeNull();
    expect(view({ filter: 42, sort: 'sideways' })).toEqual({ filter: null, sort: 'manual' });
    expect(view('provider')).toEqual({ filter: null, sort: 'manual' });
  });
});

test('no filter is offered while there is a single service', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'Claude');
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'Claude 2']);
  await expect(sidebar.locator('.provider-filter')).toHaveCount(0);
});

test('filters and groups the sidebar by service', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await addAccount(sidebar, 'Claude');
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1', 'Claude 2']);

  const filter = sidebar.getByRole('group', { name: 'Filter accounts by service' });
  await expect(filter.getByRole('button', { name: 'All 3' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // group by service
  await filter.getByRole('button', { name: 'Group' }).click();
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'Claude 2', 'ChatGPT 1']);

  // filter on one service
  await filter.getByRole('button', { name: 'ChatGPT 1' }).click();
  await expect.poll(() => accountNames(sidebar)).toEqual(['ChatGPT 1']);

  // a second click on the same chip, or "All", shows everything again
  await filter.getByRole('button', { name: 'ChatGPT 1' }).click();
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'Claude 2', 'ChatGPT 1']);

  // back to the original order
  await filter.getByRole('button', { name: 'Group' }).click();
  await expect.poll(() => accountNames(sidebar)).toEqual(['Claude 1', 'ChatGPT 1', 'Claude 2']);
});

test('the filter and the grouping survive a restart', async ({ launch }) => {
  const { app, sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await addAccount(sidebar, 'Claude');
  const filter = sidebar.getByRole('group', { name: 'Filter accounts by service' });
  await filter.getByRole('button', { name: 'Group' }).click();
  await filter.getByRole('button', { name: 'ChatGPT 1' }).click();
  await expect.poll(() => accountNames(sidebar)).toEqual(['ChatGPT 1']);
  await app.close();

  const again = await launch();
  const back = again.sidebar.getByRole('group', { name: 'Filter accounts by service' });
  await expect.poll(() => accountNames(again.sidebar)).toEqual(['ChatGPT 1']);
  await expect(back.getByRole('button', { name: 'ChatGPT 1' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(back.getByRole('button', { name: 'Group' })).toHaveAttribute('aria-pressed', 'true');

  // "All" is saved too
  await back.getByRole('button', { name: 'All 3' }).click();
  await expect
    .poll(() => accountNames(again.sidebar))
    .toEqual(['Claude 1', 'Claude 2', 'ChatGPT 1']);
  await again.app.close();

  const last = await launch();
  await expect
    .poll(() => accountNames(last.sidebar))
    .toEqual(['Claude 1', 'Claude 2', 'ChatGPT 1']);
});

test('the filter only changes the list: the grid keeps every account', async ({ launch }) => {
  const { sidebar } = await launch();
  await addAccount(sidebar, 'ChatGPT');
  await sidebar.getByRole('radio', { name: 'Grid' }).click();
  await expect(sidebar.locator('.cell-head')).toHaveCount(2);

  await sidebar.locator('.provider-filter .chip', { hasText: 'ChatGPT' }).click();
  await expect.poll(() => accountNames(sidebar)).toEqual(['ChatGPT 1']);
  await expect(sidebar.locator('.cell-head')).toHaveCount(2);
});

test('the filter is translated', async ({ launch }) => {
  const { sidebar } = await launch({ lang: 'fr' });
  await sidebar.getByRole('button', { name: '+ Ajouter un compte' }).click();
  await sidebar.getByRole('menuitem', { name: 'ChatGPT' }).click();
  await sidebar.locator('input.rename').press('Enter');

  const filter = sidebar.getByRole('group', { name: 'Filtrer les comptes par service' });
  await expect(filter.getByRole('button', { name: 'Tous 2' })).toBeVisible();
  await expect(filter.getByRole('button', { name: 'Grouper' })).toBeVisible();
});
