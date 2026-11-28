import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dmgNames, findDigests, parseVersion, run, updateCask } from './update-cask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const caskPath = path.join(root, 'Casks/cenacle.rb');

const ARM64 = 'dbe4b2af2924188d2138065fa3b949321fba71e60bb20e79b2874869384a4d07';
const X64 = 'ec0c77920d5f9e6b23d58c3aa598a428c7f2aab5af2f109c8d1156e68ea24d32';
const NEW_ARM64 = 'a'.repeat(64);
const NEW_X64 = 'b'.repeat(64);

/** The assets of the v0.8.0 release, as the GitHub API returns them (shortened). */
function release(version = '0.8.0', overrides = {}) {
  const base = `https://github.com/Jeromearsene/cenacle-AI/releases/download/v${version}`;
  const asset = (name, digest) => ({
    name,
    browser_download_url: `${base}/${name}`,
    ...(digest == null ? {} : { digest }),
  });
  // `null` means "no digest on this asset", which GitHub does for assets it has not hashed.
  const pick = (key, fallback) => (Object.hasOwn(overrides, key) ? overrides[key] : fallback);
  return {
    tag_name: `v${version}`,
    assets: [
      asset(`Cenacle-${version}-linux-x86_64.AppImage`, `sha256:${'1'.repeat(64)}`),
      asset(`Cenacle-${version}-mac-arm64.dmg`, pick('arm64', `sha256:${ARM64}`)),
      asset(`Cenacle-${version}-mac-arm64.zip`, `sha256:${'2'.repeat(64)}`),
      asset(`Cenacle-${version}-mac-x64.dmg`, pick('x64', `sha256:${X64}`)),
      asset(`Cenacle-${version}-win-x64.exe`, `sha256:${'3'.repeat(64)}`),
      asset('latest-mac.yml', `sha256:${'4'.repeat(64)}`),
    ],
  };
}

function fakeFetch(body, status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return { impl, calls };
}

async function tempCask(text) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cenacle-cask-'));
  const file = path.join(dir, 'cenacle.rb');
  await writeFile(file, text);
  return file;
}

test('parseVersion accepts release tags and nothing else', () => {
  assert.equal(parseVersion('v0.8.0'), '0.8.0');
  assert.equal(parseVersion('1.20.3'), '1.20.3');
  for (const bad of ['latest', 'v1.2', 'v1.2.3-beta.1', 'v1.2.3"; rm -rf /', '', undefined]) {
    assert.throws(() => parseVersion(bad), /Not a release tag/, String(bad));
  }
});

test('findDigests reads the SHA-256 of both disk images', () => {
  assert.deepEqual(findDigests(release(), '0.8.0'), { arm64: ARM64, x64: X64 });
});

test('findDigests refuses a release that is incomplete', () => {
  const noIntel = release();
  noIntel.assets = noIntel.assets.filter((asset) => !asset.name.endsWith('mac-x64.dmg'));
  assert.throws(() => findDigests(noIntel, '0.8.0'), /no asset named Cenacle-0.8.0-mac-x64.dmg/);
  assert.throws(() => findDigests({}, '0.8.0'), /no asset named/);
  assert.throws(() => findDigests(release('0.7.0'), '0.8.0'), /no asset named/);
});

test('findDigests refuses a missing or malformed digest', () => {
  assert.throws(() => findDigests(release('0.8.0', { arm64: null }), '0.8.0'), /usable SHA-256/);
  assert.throws(
    () => findDigests(release('0.8.0', { x64: 'md5:abcdef' }), '0.8.0'),
    /usable SHA-256/
  );
  assert.throws(
    () => findDigests(release('0.8.0', { x64: `sha256:${'A'.repeat(64)}` }), '0.8.0'),
    /usable SHA-256/
  );
});

test('updateCask changes the version and both checksums, and nothing else', async () => {
  const before = await readFile(caskPath, 'utf8');
  const after = updateCask(before, { version: '0.9.0', arm64: NEW_ARM64, x64: NEW_X64 });

  const changed = before
    .split('\n')
    .map((line, index) => [line, after.split('\n')[index]])
    .filter(([a, b]) => a !== b);
  assert.equal(changed.length, 3);
  assert.match(after, /^ {2}version "0\.9\.0"$/m);
  assert.match(after, new RegExp(`^ {2}sha256 arm: {3}"${NEW_ARM64}",$`, 'm'));
  assert.match(after, new RegExp(`^ {9}intel: "${NEW_X64}"$`, 'm'));
  assert.equal(after.split('\n').length, before.split('\n').length);
});

test('updateCask is idempotent', async () => {
  const before = await readFile(caskPath, 'utf8');
  const once = updateCask(before, { version: '0.9.0', arm64: NEW_ARM64, x64: NEW_X64 });
  const twice = updateCask(once, { version: '0.9.0', arm64: NEW_ARM64, x64: NEW_X64 });
  assert.equal(twice, once);
});

test('updateCask refuses a cask whose layout has drifted', () => {
  const values = { version: '0.9.0', arm64: NEW_ARM64, x64: NEW_X64 };
  assert.throws(() => updateCask('cask "x" do\nend\n', values), /version/);
  assert.throws(() => updateCask('cask "x" do\n  version "1.0.0"\nend\n', values), /sha256/);
  assert.throws(
    () => updateCask(`cask "x" do\n  version "1.0.0"\n  sha256 "${ARM64}"\nend\n`, values),
    /sha256/
  );
});

test('the cask in the repository is consistent with the installers of a release', async () => {
  const text = await readFile(caskPath, 'utf8');
  const version = /^\s*version "(\d+\.\d+\.\d+)"$/m.exec(text)?.[1];
  assert.ok(version, 'the cask has a version');

  // The URL template of the cask must name exactly the files the release publishes.
  const url = /^\s*url "([^"]+)"/m.exec(text)?.[1];
  assert.ok(url, 'the cask has a url');
  const assets = release(version).assets.map((asset) => asset.browser_download_url);
  for (const [cask, arch] of [
    ['arm64', 'arm64'],
    ['x64', 'x64'],
  ]) {
    const expected = url.replaceAll('#{version}', version).replaceAll('#{arch}', arch);
    assert.ok(assets.includes(expected), `${expected} is a release asset (${cask})`);
  }
  assert.match(text, /arch arm: "arm64", intel: "x64"/);
  assert.deepEqual(Object.values(dmgNames(version)), [
    `Cenacle-${version}-mac-arm64.dmg`,
    `Cenacle-${version}-mac-x64.dmg`,
  ]);

  // The installed bundle is named like the one electron-builder.yml and release.yml produce.
  assert.match(text, /^\s*app "Cenacle\.app"$/m);
  const builder = await readFile(path.join(root, 'electron-builder.yml'), 'utf8');
  assert.match(builder, /^artifactName: Cenacle-\$\{version\}-\$\{os\}-\$\{arch\}\.\$\{ext\}$/m);
  const workflow = await readFile(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(workflow, /-c\.productName=Cenacle/);
});

test('the cask is valid Ruby', (t) => {
  const result = spawnSync('ruby', ['-c', caskPath], { encoding: 'utf8' });
  if (result.error) return t.skip('ruby is not installed');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Syntax OK/);
});

test('run writes the new version and checksums into the cask', async () => {
  const file = await tempCask(await readFile(caskPath, 'utf8'));
  const { impl, calls } = fakeFetch(release('0.9.0', { arm64: `sha256:${NEW_ARM64}` }));

  const changed = await run(['--tag', 'v0.9.0', '--cask', file], { GITHUB_TOKEN: 't0k3n' }, impl);

  assert.equal(changed, true);
  const text = await readFile(file, 'utf8');
  assert.match(text, /^ {2}version "0\.9\.0"$/m);
  assert.ok(text.includes(NEW_ARM64));
  assert.ok(text.includes(X64));
  assert.equal(
    calls[0].url,
    'https://api.github.com/repos/Jeromearsene/cenacle-AI/releases/tags/v0.9.0'
  );
  assert.equal(calls[0].init.headers.authorization, 'Bearer t0k3n');
});

test('run leaves the cask alone when it is already up to date', async () => {
  const original = await readFile(caskPath, 'utf8');
  const file = await tempCask(original);
  const changed = await run(['--tag', 'v0.8.0', '--cask', file], {}, fakeFetch(release()).impl);
  assert.equal(changed, false);
  assert.equal(await readFile(file, 'utf8'), original);
});

test('run uses the repository of the workflow and sends no token when there is none', async () => {
  const file = await tempCask(await readFile(caskPath, 'utf8'));
  const { impl, calls } = fakeFetch(release());
  await run(['--tag', '0.8.0', '--cask', file], { GITHUB_REPOSITORY: 'someone/fork' }, impl);
  assert.match(calls[0].url, /\/repos\/someone\/fork\/releases\/tags\/v0\.8\.0$/);
  assert.equal(calls[0].init.headers.authorization, undefined);
});

test('run fails clearly and keeps the cask when something is wrong', async () => {
  const original = await readFile(caskPath, 'utf8');
  const file = await tempCask(original);

  await assert.rejects(run(['--cask', file], {}, fakeFetch(release()).impl), /Missing --tag/);
  await assert.rejects(
    run(['--tag', 'main', '--cask', file], {}, fakeFetch(release()).impl),
    /Not a release tag/
  );
  await assert.rejects(
    run(['--tag', 'v0.8.0', '--repo', 'not a repo', '--cask', file], {}, fakeFetch(release()).impl),
    /Invalid --repo/
  );
  await assert.rejects(
    run(['--tag', 'v9.9.9', '--cask', file], {}, fakeFetch({}, 404).impl),
    /answered 404/
  );
  await assert.rejects(
    run(['--tag', 'v0.8.0', '--cask', file], {}, fakeFetch({ assets: [] }).impl),
    /no asset named/
  );
  assert.equal(await readFile(file, 'utf8'), original);
});
