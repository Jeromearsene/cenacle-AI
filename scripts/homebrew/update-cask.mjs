#!/usr/bin/env node
// Points Casks/cenacle.rb at a published release: reads the release from the GitHub API and
// writes its version and the SHA-256 of the two macOS disk images (Apple Silicon and Intel)
// into the cask. Only these three values change; the rest of the cask is edited by hand.
//
//   node scripts/homebrew/update-cask.mjs --tag v0.8.0
//
// GITHUB_TOKEN (or GH_TOKEN) is optional: it only raises the API rate limit.

import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const DEFAULT_REPO = 'Jeromearsene/cenacle-AI';
const DEFAULT_CASK = 'Casks/cenacle.rb';

// `version "0.8.0"`
const VERSION_LINE = /^(\s*version\s+")[^"\n]+(")/m;
// `sha256 arm:   "<64 hex>",` then `intel: "<64 hex>"` on the next line.
const SHA256_LINES = /^(\s*sha256\s+arm:\s*")[0-9a-f]{64}("\s*,\s*intel:\s*")[0-9a-f]{64}(")/m;

/** `v0.8.0` or `0.8.0` -> `0.8.0`. Anything else is refused, so the value is safe to write. */
export function parseVersion(tag) {
  const match = /^v?(\d+\.\d+\.\d+)$/.exec(String(tag).trim());
  if (!match) throw new Error(`Not a release tag (expected v1.2.3): ${JSON.stringify(tag)}`);
  return match[1];
}

/** Installer names are set by `artifactName` in electron-builder.yml. */
export function dmgNames(version) {
  return {
    arm64: `Cenacle-${version}-mac-arm64.dmg`,
    x64: `Cenacle-${version}-mac-x64.dmg`,
  };
}

/** SHA-256 of both disk images, from the `digest` field GitHub adds to each release asset. */
export function findDigests(release, version) {
  const assets = Array.isArray(release?.assets) ? release.assets : [];
  const names = dmgNames(version);
  const digests = {};
  for (const [arch, name] of Object.entries(names)) {
    const asset = assets.find((candidate) => candidate.name === name);
    if (!asset) throw new Error(`The release has no asset named ${name}`);
    const match = /^sha256:([0-9a-f]{64})$/.exec(asset.digest ?? '');
    if (!match) throw new Error(`The asset ${name} has no usable SHA-256 digest: ${asset.digest}`);
    digests[arch] = match[1];
  }
  return digests;
}

/** Returns the cask text with the new version and checksums. Throws if the cask has drifted. */
export function updateCask(text, { version, arm64, x64 }) {
  if (!VERSION_LINE.test(text)) throw new Error('No `version "..."` line found in the cask');
  if (!SHA256_LINES.test(text)) {
    throw new Error('No `sha256 arm: "...", intel: "..."` lines found in the cask');
  }
  return text
    .replace(VERSION_LINE, (_, before, after) => `${before}${version}${after}`)
    .replace(SHA256_LINES, (_, a, b, c) => `${a}${arm64}${b}${x64}${c}`);
}

async function fetchRelease({ repo, tag, token, fetchImpl }) {
  const headers = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
    'user-agent': 'cenacle-update-cask',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetchImpl(`https://api.github.com/repos/${repo}/releases/tags/${tag}`, {
    headers,
  });
  if (!response.ok) throw new Error(`GitHub answered ${response.status} for the release ${tag}`);
  return response.json();
}

/** Runs the script. `fetchImpl` is injectable for the tests. Returns true if the cask changed. */
export async function run(argv, env = process.env, fetchImpl = fetch) {
  const { values } = parseArgs({
    args: argv,
    options: {
      tag: { type: 'string' },
      repo: { type: 'string', default: env.GITHUB_REPOSITORY || DEFAULT_REPO },
      cask: { type: 'string', default: DEFAULT_CASK },
    },
  });
  if (!values.tag) throw new Error('Missing --tag (for example --tag v0.8.0)');
  if (!/^[\w.-]+\/[\w.-]+$/.test(values.repo)) throw new Error(`Invalid --repo: ${values.repo}`);

  const version = parseVersion(values.tag);
  const release = await fetchRelease({
    repo: values.repo,
    tag: `v${version}`,
    token: env.GITHUB_TOKEN || env.GH_TOKEN,
    fetchImpl,
  });
  const digests = findDigests(release, version);

  const before = await readFile(values.cask, 'utf8');
  const after = updateCask(before, { version, ...digests });
  if (after === before) return false;
  await writeFile(values.cask, after);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2))
    .then((changed) => console.log(changed ? 'Cask updated.' : 'Cask already up to date.'))
    .catch((error) => {
      console.error(`update-cask: ${error.message}`);
      process.exit(1);
    });
}
