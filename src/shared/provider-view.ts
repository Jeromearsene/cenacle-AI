// How the sidebar lists accounts: filtered by service and/or grouped by service.
// Pure functions, so they can be tested without launching the app.
// Shared file: it must not import anything from Node or Electron.
import type { Account, ProviderInfo } from './types';

/** `manual`: the order of the accounts as they are (shortcuts follow it). `provider`: grouped by service. */
export type AccountSort = 'manual' | 'provider';

/** A service that has at least one account, with how many. */
export interface ProviderCount extends ProviderInfo {
  count: number;
}

/** The services that have accounts, in the order of the service list, with their account count. */
export function providersInUse(accounts: Account[], providers: ProviderInfo[]): ProviderCount[] {
  return providers
    .map((p) => ({ ...p, count: accounts.filter((a) => a.provider === p.id).length }))
    .filter((p) => p.count > 0);
}

/**
 * The accounts to list in the sidebar. `filter` is a service id (null for all services); one that
 * no account uses any more is ignored. Grouping keeps the order of the accounts inside a group,
 * and puts accounts of an unknown service last.
 */
export function visibleAccounts(
  accounts: Account[],
  providers: ProviderInfo[],
  { filter, sort }: { filter: string | null; sort: AccountSort }
): Account[] {
  const filtered =
    filter !== null && accounts.some((a) => a.provider === filter)
      ? accounts.filter((a) => a.provider === filter)
      : accounts;
  if (sort === 'manual') return filtered;
  const rank = (a: Account): number => {
    const i = providers.findIndex((p) => p.id === a.provider);
    return i === -1 ? providers.length : i;
  };
  // Array.prototype.sort is stable: accounts of one service keep their order.
  return [...filtered].sort((a, b) => rank(a) - rank(b));
}
