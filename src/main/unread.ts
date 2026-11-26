// Which accounts raised a notification the user has not looked at yet. No dependency on Electron:
// the logic can be tested without launching the app.

export interface Unread {
  /**
   * A notification was raised by this account's page. `seen` is true when the user is already
   * looking at that page. Returns true when the user should be called back to the app.
   */
  notify(id: string, seen: boolean): boolean;
  /** The user opened or focused this account. */
  clear(id: string): void;
  /** The account no longer exists. */
  forget(id: string): void;
  /** Accounts with something unseen, in the order their notifications arrived. */
  ids(): string[];
}

/** `onChange` is called with the new list each time it changes, and only then. */
export function createUnread(onChange: (ids: string[]) => void): Unread {
  const pending = new Set<string>();
  const change = (done: boolean) => {
    if (done) onChange([...pending]);
  };

  return {
    notify(id, seen) {
      if (seen) return false;
      const isNew = !pending.has(id);
      pending.add(id);
      change(isNew);
      return true;
    },
    clear(id) {
      change(pending.delete(id));
    },
    forget(id) {
      change(pending.delete(id));
    },
    ids: () => [...pending],
  };
}
