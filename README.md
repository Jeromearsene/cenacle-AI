<p align="center"><img src="resources/icon.png" alt="Cénacle icon" width="128"></p>

# Cénacle

**English** · [Français](README.fr.md)

[![CI](https://github.com/Jeromearsene/cenacle-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/Jeromearsene/cenacle-AI/actions/workflows/ci.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/license-CC%20BY--NC--SA%204.0-lightgrey)](LICENSE)
![Platforms: macOS, Linux, Windows](https://img.shields.io/badge/platforms-macOS%20%7C%20Linux%20%7C%20Windows-lightgrey)
![Electron 45](https://img.shields.io/badge/Electron-45-47848F?logo=electron&logoColor=white)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Preact](https://img.shields.io/badge/Preact-673AB8?logo=preact&logoColor=white)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Lint: Biome](https://img.shields.io/badge/lint-Biome-60A5FA?logo=biome&logoColor=white)

A cross-platform desktop app (Electron) to use several AI assistant accounts in a single window. **Claude**, **ChatGPT** and **Gemini** are supported today, and other services can be added with a single entry (see [Adding a service](#adding-a-service)). Every account gets its own isolated session (cookies, local storage), so different accounts, even on the same service, never mix.

**Unofficial project.** It is not affiliated with Anthropic, OpenAI or Google. The names Claude, ChatGPT, Gemini and any other service name belong to their respective owners. The app uses no API: it displays the public websites, like a browser would. Read each service's terms of use before relying on it.

## Services

| Service | Status       | Notes                                                                                 |
| ------- | ------------ | ------------------------------------------------------------------------------------- |
| Claude  | tested       | Magic-link sign-in recommended (see below).                                           |
| ChatGPT | to be tested | Email sign-in. The "Continue with Google / Apple / Microsoft" buttons may be refused. |
| Gemini  | experimental | Google sign-in: see "Gemini and Google sign-in".                                      |

## Adding a service

Services are plain data in `src/main/providers.ts`. To add one (Grok, Perplexity, a self-hosted chat…), add an entry:

```ts
example: {
  id: 'example',                    // lowercase key, same as the object key
  label: 'Example',                 // name shown in the sidebar and menus
  url: 'https://chat.example.com/', // https only
  ua: 'clean',                      // browser identifier policy, see below
  authHosts: ['login.example.com'], // optional: sign-in domains specific to this service
},
```

- `ua`: start with `'clean'`. If the service refuses to sign in (Google does), try `'native'`.
- `authHosts`: sign-in popups that open on these domains stay inside the app, in the right account's session. Google, Microsoft and Apple sign-in are already handled for every service.
- Run `yarn test:e2e`: a test checks that every entry is well-formed. Then open a pull request.

## Platforms

| Platform | Status                                                                               |
| -------- | ------------------------------------------------------------------------------------ |
| macOS    | primary platform, used and tested daily by the author                                |
| Linux    | supported; the end-to-end tests run on Linux in CI                                   |
| Windows  | supported; the end-to-end tests run on Windows in CI, but the author does not use it |

Installers are not published yet: for now, run the app from source (below). Platform-specific remarks are marked "macOS", "Windows" or "Linux" in this document.

## Getting started

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

## Using the app

- **+ Ajouter un compte** (add an account) asks which service, then creates an empty session. Sign in once; it is kept between launches.
- **Un seul / Colonnes** (single / columns): one account at a time, or all side by side (handy to compare answers).
- Double-click a name (or ✎) to rename, ✕ to delete an account's session.
- **Window**: on first launch it fills the usable area of the screen (below the menu bar and the Dock, or the taskbar). After that the app restores its last size, or its maximized / full-screen state. If the screen it was on has been unplugged, it comes back on the main display.
- Full screen: green button (macOS), ⌃⌘F / F11 or the View menu. Maximize: double-click the top bar (macOS) or the title bar (Windows, Linux).
- Hidden accounts stay loaded, so their conversations keep running in the background.
- **Hold ⌘ (macOS) or Ctrl (Windows, Linux)** for a moment: the shortcut number of each account (⌘1…⌘9 / Ctrl+1…9) appears next to its name, in the sidebar and above the columns.
- **Notifications**: a web notification raised by a service shows the account's name in its title and the account's color dot as its icon, so you know which account it comes from. Clicking it brings the app forward on that account.
- **Right-click** in a service page opens a context menu: cut / copy / paste, spelling suggestions, open or copy a link, copy an image, inspect element.

On macOS ⌘ is the Command key; on Windows and Linux use Ctrl instead.

| Shortcut                  | Action                                |
| ------------------------- | ------------------------------------- |
| ⌘1 … ⌘9 / Ctrl+1 … 9      | Go to account n                       |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous account               |
| ⌘⇧L / Ctrl+Shift+L        | Toggle single / columns               |
| ⌘R / Ctrl+R               | Reload the active account             |
| ⌘+ ⌘- ⌘0 / Ctrl+ + - 0    | Zoom the active account               |
| ⌘⌥I / Ctrl+Alt+I          | Developer tools of the active account |
| ⌃⌘F (macOS) / F11         | Full screen                           |

New account: Comptes → Nouveau compte in the menu, or the sidebar button.

> The interface is currently in French only. Translating it is on the roadmap.

## Gemini and Google sign-in

Google refuses sign-in from an embedded browser ("This browser or app may not be secure"). In this app, the Claude and ChatGPT services send a "cleaned" browser identifier (no `Electron/x`), which gets through anti-bot checks better. For Google it is the opposite: reports from other Electron projects say Google accepts Electron's own identifier and refuses the cleaned one ([example](https://github.com/stablyai/orca/issues/11518)).

The Gemini service therefore uses Electron's native identifier (`ua: 'native'` in `src/main/providers.ts`). This is **experimental**: Google's rule is undocumented and may change. If sign-in still fails:

- open an issue with the message displayed;
- or set `ua` to `'clean'` in `src/main/providers.ts` to compare;
- "Continue with Google" inside Claude or ChatGPT uses that service's cleaned identifier and may be refused: prefer email.

## Passwords and passkeys

What does **not** work today, and why:

- **Password autofill from the system (macOS: Apple Passwords / iCloud Keychain)** is not offered in Electron apps. Electron has an open feature request for macOS system password providers on HTML fields ([electron/electron#54142](https://github.com/electron/electron/issues/54142)). For third-party browser engines, Apple's iCloud Passwords integration additionally requires a restricted entitlement (`com.apple.developer.browser`) that Apple grants on request, as another Chromium-based browser documented ([ego-lite#362](https://github.com/citrolabs/ego-lite/issues/362)).
- **Touch ID and passkeys**: Electron only offers them after `app.configureWebAuthn`, and they require a code-signed app with Apple entitlements. Passkeys already stored in your iCloud Keychain would not appear. On the Google sign-in screen, choose "Try another way" and use your password with two-step verification.

What you can do:

- Copy the password from your password manager, then paste with ⌘V or right-click → Paste (the context menu is there for this).
- Third-party password managers: 1Password's Universal Autofill (⌘\) is reported to work in some signed Electron apps (same issue #54142); it has **not** been tested with this app.

## Permissions

Service pages are websites, so the app grants them only what a chat needs: notifications, copy and paste, full screen and the **microphone** (voice mode). The camera, screen capture, location and every other permission are refused. Only the page itself, not an embedded third-party frame, can use notifications or the microphone. The policy is in `src/main/permissions.ts`.

## Where the data lives

- Sessions: `Partitions/` folder inside the app's data folder. One partition per account.
  - macOS: `~/Library/Application Support/Cénacle/`
  - Windows: `%APPDATA%\Cénacle\`
  - Linux: `~/.config/Cénacle/`
- Account list, layout, window size: `state.json` in the same folder.
- Session data is never stored in the project folder.

## Known limitations

- Sign-in popups (domains listed in `src/main/providers.ts`, paths such as `/oauth`, `/authorize`, `/login`) open inside the app, in the right account's session. Other links open in the default browser. This is a heuristic: if a link opens on the wrong side, adjust `AUTH_HOSTS` (`src/main/providers.ts`) or `OAUTH_PATH` (`src/main/index.ts`).
- Websites change without notice: rendering may evolve, but the tool itself depends on no API.
- Services may require an anti-bot check (Cloudflare, for example) depending on your network.

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

## Development

Stack: Electron, TypeScript (strict), [electron-vite](https://electron-vite.org), Preact, Tailwind CSS 4, [Biome](https://biomejs.dev) (lint and format), Playwright. The interface (sidebar) is about 30 KB of JavaScript; the service pages are real web pages, with no code of ours.

```bash
yarn lint        # Biome: lint + format check (yarn lint:fix to fix, yarn format to format)
yarn typecheck   # TypeScript, main process + interface
yarn check       # lint + typecheck
yarn test:e2e    # builds the app, then runs the end-to-end tests
```

The tests drive the Electron app with Playwright against a fake local service (the `MULTI_TEST_URL` variable, ignored in a packaged app): no network access, no real account. They cover adding and renaming an account, the columns layout, cookie and storage isolation between accounts, the browser identifier of each service, persistence after a restart, and the right-click context menu. On Linux without a display: `xvfb-run -a yarn test:e2e` (the tests add `--no-sandbox` by themselves when running as root or in CI). On Linux, if Electron stops at startup with a "SUID sandbox helper" error (common on recent Ubuntu), run `yarn dev --no-sandbox`.

**Continuous integration** (`.github/workflows/ci.yml`) runs on every push to `main` and on every pull request: lint and format, type check and build on Linux, then the end-to-end tests on macOS, Linux and Windows. Dependabot proposes weekly dependency updates.

```
src/main/index.ts                 main process: window, one view per account, layout, menu
src/main/providers.ts             supported services (URL, browser identifier, sign-in domains)
src/main/permissions.ts            permissions granted to service pages
src/main/state.ts                 reading / validating / writing state.json
src/main/context-menu*.ts         right-click menu (pure template + wiring)
src/main/account-notifications.ts notification title and color dot of an account
src/preload/index.ts              minimal bridge to the interface (contextBridge)
src/preload/service.ts            preload of service pages: exposes nothing, dresses up notifications
src/shared/types.ts               types shared by the three
src/renderer/                     Preact + Tailwind interface (sidebar, column headers)
resources/                        app icon (SVG source, PNG, ICO, ICNS)
e2e/                              Playwright tests
.github/                          CI workflow and Dependabot
```

## Roadmap

- Shared memory between accounts through a common MCP server (depending on each service's and plan's connector support).
- Per-account quota tracking, time left before next use, notification when an account becomes usable again.
- Menu bar icon, manual light / dark switch, customizable shortcuts.
- Interface translation (English / French).
- Installable packages for macOS, Linux and Windows (electron-builder or Electron Forge).
- More services.

## License

[CC BY-NC-SA 4.0](LICENSE) (Creative Commons Attribution-NonCommercial-ShareAlike 4.0).

- **Attribution**: keep the [NOTICE](NOTICE) and credit the original project ([Cénacle](https://github.com/Jeromearsene/cenacle-AI)) and its author in any copy, fork or derivative.
- **NonCommercial**: you may not use it for commercial purposes without a separate agreement and fair payment. To ask for a commercial license, open an issue.
- **ShareAlike**: if you modify it and distribute the result, you must publish your changes under the same license. Pull requests to this repository are welcome but not required.

Because of the NonCommercial clause, this is a _source-available_ license, not an [OSI](https://opensource.org/osd) "open source" one. By contributing, you agree that your contribution is released under the same license and that the author may also offer it under a separate commercial license.
