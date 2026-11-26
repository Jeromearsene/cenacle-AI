// How the sidebar lists accounts: filtered by service and/or grouped by service.
// Pure functions, so they can be tested without launching the app.
// Shared file: it must not import anything from Node or Electron.
import type { Account, AccountView, ProviderInfo } from './types';

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
 * The filter that really applies: one that no account uses any more, or that is set while only one
 * service is left, applies to nothing (null). The filter is kept between launches, so it can
 * outlive the accounts it was set for.
 */
export function activeFilter(accounts: Account[], filter: string | null): string | null {
  if (filter === null) return null;
  const services = new Set(accounts.map((a) => a.provider));
  return services.size > 1 && services.has(filter) ? filter : null;
}

/**
 * The accounts to list in the sidebar. Grouping keeps the order of the accounts inside a group,
 * and puts accounts of an unknown service last.
 */
export function visibleAccounts(
  accounts: Account[],
  providers: ProviderInfo[],
  view: AccountView
): Account[] {
  const filter = activeFilter(accounts, view.filter);
  const filtered = filter === null ? accounts : accounts.filter((a) => a.provider === filter);
  if (view.sort === 'manual') return filtered;
  const rank = (a: Account): number => {
    const i = providers.findIndex((p) => p.id === a.provider);
    return i === -1 ? providers.length : i;
  };
  // Array.prototype.sort is stable: accounts of one service keep their order.
  return [...filtered].sort((a, b) => rank(a) - rank(b));
}
