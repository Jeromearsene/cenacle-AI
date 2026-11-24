import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseGrid, pruneTo } from '../shared/grid';
import type { Account, Bounds, PersistedState } from '../shared/types';
import { DEFAULT_PROVIDER, isProviderId, providerOf } from './providers';

export const MAX_NAME = 40;
export const ID_RE = /^[\w-]{1,32}$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const PALETTE = [
  '#d97757',
  '#6a9bcc',
  '#788c5d',
  '#b58bd1',
  '#d4a72c',
  '#4aa3a2',
  '#cc6b8e',
  '#8d8d8d',
];

export const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);

export function makeAccount(existing: Account[], providerId: string = DEFAULT_PROVIDER): Account {
  const provider = providerOf(providerId);
  const sameProvider = existing.filter((a) => a.provider === provider.id).length;
  return {
    id: randomBytes(4).toString('hex'),
    name: `${provider.label} ${sameProvider + 1}`,
    color: PALETTE[existing.length % PALETTE.length] as string,
    provider: provider.id,
  };
}

export function defaultState(): PersistedState {
  const first = makeAccount([]);
  return {
    version: 3,
    accounts: [first],
    activeId: first.id,
    layout: 'single',
    grid: null,
    bounds: null,
    maximized: false,
    fullscreen: false,
  };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseAccount(a: unknown): Account | null {
  if (!isRecord(a)) return null;
  const { id, name, color, provider } = a;
  if (!isId(id) || typeof name !== 'string' || typeof color !== 'string' || !COLOR_RE.test(color)) {
    return null;
  }
  return {
    id,
    name: name.slice(0, MAX_NAME),
    color,
    // state v1 (Claude only): no "provider" field
    provider: isProviderId(provider) ? provider : DEFAULT_PROVIDER,
  };
}

function parseBounds(b: unknown): Bounds | null {
  if (!isRecord(b)) return null;
  const { x, y, width, height } = b;
  const nums = [x, y, width, height];
  if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
  return { x, y, width, height } as Bounds;
}

/** Validates the content of state.json (v1 to v3); falls back to the default state if unusable. */
export function parseState(raw: unknown): PersistedState {
  if (!isRecord(raw) || !Array.isArray(raw.accounts)) return defaultState();
  const accounts = raw.accounts.map(parseAccount).filter((a): a is Account => a !== null);
  const first = accounts[0];
  if (!first) return defaultState();
  // Accounts that no longer exist leave the grid; an empty grid (null) is rebuilt when shown.
  const grid = pruneTo(parseGrid(raw.grid), new Set(accounts.map((a) => a.id)));
  return {
    version: 3,
    accounts,
    activeId: accounts.some((a) => a.id === raw.activeId) ? (raw.activeId as string) : first.id,
    // "columns" is the former name of the grid mode
    layout: raw.layout === 'grid' || raw.layout === 'columns' ? 'grid' : 'single',
    grid,
    bounds: parseBounds(raw.bounds),
    maximized: raw.maximized === true,
    fullscreen: raw.fullscreen === true,
  };
}

export function readState(file: string): PersistedState {
  try {
    return parseState(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return defaultState();
  }
}

export function writeStateFile(file: string, state: PersistedState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file);
}
