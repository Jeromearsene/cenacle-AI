# Development

[![CI](https://github.com/Jeromearsene/cenacle-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Jeromearsene/cenacle-AI/actions/workflows/ci.yml)
![Electron 45](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Lint: Biome](https://img.shields.io/badge/lint-Biome-60A5FA?logo=biome&logoColor=white)

**English** · [Français](fr/development.md)

← [Back to the README](../README.md)

## Run from source

```bash
yarn install
yarn dev        # development, with hot reload of the interface
yarn build      # build into out/
yarn start      # run the built app
```

The project uses Yarn 4 (4.18.1) with `nodeLinker: node-modules` in `.yarnrc.yml`: Electron does not work with Plug'n'Play.

**Pinned versions**

- With [Volta](https://volta.sh): the `volta` key in `package.json` pins Node (22.23.5) and Yarn (4.18.1).
- Without Volta: `corepack enable` is enough, the `packageManager` field names the Yarn version.
- Volta only clearly documents Yarn 1.x and 3+. If Volta cannot fetch Yarn 4, remove the `"yarn"` line from the `volta` key and use Corepack.

**Yarn quarantine**: by default Yarn 4 refuses versions published less than 24 hours ago (`npmMinimalAgeGate`). Electron is declared as `^45.3.3`; `yarn up electron` updates it once the latest release is old enough.

The Electron binary (about 100 MB) is downloaded by `yarn install` (the `postinstall` script). If that download failed or did not happen, `node node_modules/electron/install.js` runs it again; without it, `yarn dev` and `yarn start` stop with "Electron uninstall".

## Tooling, tests and releases

Stack: Electron, TypeScript (strict), [electron-vite](https://electron-vite.org), Preact, Tailwind CSS 4, [Biome](https://biomejs.dev) (lint and format), Playwright. The interface (sidebar) is about 30 KB of JavaScript; the service pages are real web pages, with no code of ours.

```bash
yarn dist        # build the installers for the current system into release/
yarn dist:dir    # same, unpacked (quick check of the packaging)
yarn changeset   # describe a change for the changelog (see below)
yarn lint        # Biome: lint + format check (yarn lint:fix to fix, yarn format to format)
yarn typecheck   # TypeScript, main process + interface
yarn check       # lint + typecheck
yarn test:e2e    # builds the app, then runs the end-to-end tests
```

The tests drive the Electron app with Playwright against a fake local service (the `MULTI_TEST_URL` variable, ignored in a packaged app): no network access, no real account. They cover adding and renaming an account, the grid layout (dragging, removing, resizing), cookie and storage isolation between accounts, the browser identifier of each service, persistence after a restart, and the right-click context menu. On Linux without a display: `xvfb-run -a yarn test:e2e` (the tests add `--no-sandbox` by themselves when running as root or in CI). On Linux, if Electron stops at startup with a "SUID sandbox helper" error (common on recent Ubuntu), run `yarn dev --no-sandbox`.

**Continuous integration** (`.github/workflows/ci.yml`) runs on every push to `main` and on every pull request: lint and format, type check and build on Linux, then the end-to-end tests on macOS, Linux and Windows. Dependabot proposes weekly dependency updates.

**Releases and changelog** use [Changesets](https://github.com/changesets/changesets). A change that users can notice comes with a changeset (`yarn changeset`, one line describing it). Once merged on `main`, a bot keeps a "Version packages" pull request up to date; merging it bumps the version, updates `CHANGELOG.md`, tags the release and builds the installers for the three systems (`.github/workflows/release.yml`). The app checks for updates on startup when packaged (`src/main/updater.ts`).

```
src/main/index.ts                 main process: window, one view per account, layout, menu
src/main/providers.ts             supported services (URL, browser identifier, sign-in domains)
src/main/permissions.ts            permissions granted to service pages
src/main/state.ts                 reading / validating / writing state.json
src/main/context-menu*.ts         right-click menu (pure template + wiring)
src/main/account-notifications.ts notification title and color dot of an account
src/preload/index.ts              minimal bridge to the interface (contextBridge)
src/preload/service.ts            preload of service pages: exposes nothing; dresses up notifications, reads the usage banner
src/shared/grid.ts                grid layout tree: drops, resizing, geometry (pure, tested)
src/shared/quota.ts               reading the usage-limit banner, hourglass maths (pure, tested)
src/shared/metrics.ts             memory / CPU per account from the process list (pure, tested)
src/main/quota.ts                 usage-limit state per account, reset timers
src/shared/types.ts               types shared by the three
src/renderer/                     Preact + Tailwind interface (sidebar, cell headers, grid overlay)
resources/                        app icon (SVG source, PNG, ICO, ICNS)
e2e/                              Playwright tests
.github/                          CI workflow and Dependabot
docs/                             the documentation (English; French in docs/fr/)
```

## Adding a language

To add a language, add its code to `LOCALES`, its own name to `LOCALE_LABELS`, and a full set of messages in `src/shared/i18n.ts` (TypeScript refuses an incomplete set), then add a test line in `e2e/i18n.spec.ts`. To try a language without changing the system one, start the app unpackaged with `CENACLE_LANG=fr yarn dev`.

## Automation (Playwright / Puppeteer), off by default

```bash
CENACLE_DEBUG_PORT=9222 yarn dev
```

This opens the Chrome debugging protocol on `127.0.0.1:9222` only. Example:

```js
const { chromium } = require('playwright-core');

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
for (const context of browser.contexts()) {
  for (const page of context.pages()) console.log(page.url());
}
```

Careful: any local process that can reach this port controls every signed-in session. Do not leave the variable set permanently. Also check the services' terms of use before automating anything.
