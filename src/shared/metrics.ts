// Resource usage of each account. Pure maths on the process list that Electron reports, so it can
// be tested without launching the app. Shared file: it must not import anything from Node or
// Electron.

/** One process, as reported by `app.getAppMetrics()` (memory in kilobytes). */
export interface ProcessSample {
  pid: number;
  /** Share of one CPU core since the previous sample (can go above 100 on several cores). */
  cpu: number;
  memoryKb: number;
}

export interface Usage {
  cpu: number;
  memoryKb: number;
}

export interface AccountUsage {
  id: string;
  /** Null while the account's page is not loaded: it has no process of its own yet. */
  usage: Usage | null;
}

export interface ResourceUsage {
  /** In the order of the accounts. */
  accounts: AccountUsage[];
  /** Every process that belongs to no account: interface, GPU, network, frames of other sites. */
  shared: Usage;
  total: Usage;
}

const ZERO: Usage = { cpu: 0, memoryKb: 0 };

const add = (a: Usage, b: Usage): Usage => ({
  cpu: a.cpu + b.cpu,
  memoryKb: a.memoryKb + b.memoryKb,
});

/**
 * Attributes the processes to the accounts. `accountPids` maps each account to the process of its
 * page (null when the page is not loaded). A process is counted once in `shared` and `total`,
 * even if two accounts were to end up in the same one.
 */
export function computeUsage(
  samples: readonly ProcessSample[],
  accountPids: ReadonlyMap<string, number | null>
): ResourceUsage {
  const byPid = new Map(samples.map((s) => [s.pid, s]));
  const claimed = new Set<number>();
  const accounts: AccountUsage[] = [];
  for (const [id, pid] of accountPids) {
    const sample = pid ? byPid.get(pid) : undefined;
    if (sample) claimed.add(sample.pid);
    accounts.push({
      id,
      usage: sample ? { cpu: sample.cpu, memoryKb: sample.memoryKb } : null,
    });
  }
  let shared = ZERO;
  let total = ZERO;
  for (const s of byPid.values()) {
    const usage = { cpu: s.cpu, memoryKb: s.memoryKb };
    total = add(total, usage);
    if (!claimed.has(s.pid)) shared = add(shared, usage);
  }
  return { accounts, shared, total };
}

/** "512 MB", "1.2 GB" (or "512 Mo", "1,2 Go"): rounded, in the language of the interface. */
export function formatMemory(memoryKb: number, locale: string): string {
  const mb = memoryKb / 1024;
  const gb = mb / 1024;
  const useGb = gb >= 1;
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: useGb ? 'gigabyte' : 'megabyte',
    unitDisplay: 'short',
    maximumFractionDigits: useGb ? 1 : 0,
  }).format(useGb ? gb : mb);
}

/** "12 %" (or "12%"): whole percent of one core. */
export function formatCpu(cpu: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(cpu / 100);
}
