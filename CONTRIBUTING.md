# Contributing to Cénacle

Thanks for wanting to help. This page tells you how to propose a change.

## License of your contribution

Cénacle is released under [CC BY-NC-SA 4.0](LICENSE). By opening a pull request you agree that:

- your contribution is released under the same license;
- the author may also offer the project, your contribution included, under a separate
  commercial license (this is how commercial use is allowed against payment).

If you cannot agree to this, please open an issue to discuss it first.

## Getting started

```bash
yarn install
yarn dev          # run the app with hot reload
yarn check        # lint + type check
yarn test:e2e     # end-to-end tests (on Linux without a display: xvfb-run -a yarn test:e2e)
```

The [development guide](docs/development.md) explains the project layout, the tests and the releases.

## Rules for a pull request

- **One change per pull request**, small enough to review. Open an issue first for anything big.
- **Code in English**: names, comments, test names, commit messages and logs.
- **User-facing texts** (buttons, menus, dialogs, labels) go in `src/shared/i18n.ts`, in both
  English and French, never hard-coded in a component. English is the reference.
- **Tests**: a bug fix comes with a test that fails without the fix; a feature comes with tests
  of what it does. The suite must pass on macOS, Linux and Windows (CI runs all three).
- **Lint and types**: `yarn check` must pass. Biome formats the code (`yarn lint:fix`).
- **Changeset**: if users can notice the change (feature, fix, behavior), run `yarn changeset`,
  choose the bump (patch for a fix, minor for a feature, major for a breaking change) and write
  one line for the changelog. Commit the generated file. Refactors, tests, docs and CI changes
  do not need one.
- **Commit messages** start with a type: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`,
  `refactor:`.
- **No secrets, no personal data** in code, tests or screenshots.

## Testing notifications on macOS

On macOS the system only displays an app's notifications when the app is **code-signed**; an
ad-hoc signature (free, no Apple account) is enough. Packaged builds are signed that way by
electron-builder (`mac.identity` in `electron-builder.yml`). `yarn dev` runs the `Electron.app`
of `node_modules`, which is not signed, so no notification appears there until you sign it once:

```bash
codesign --force --deep --sign - node_modules/electron/dist/Electron.app
```

Quit the app and run `yarn dev` again. Do it again after reinstalling Electron
(`rm -rf node_modules/electron && yarn install` also puts back the unsigned one).

**View → Development → Test notifications…** raises one system notification and one web
notification (from the active account's page) and tells what happened to each: shown,
refused (with the system's error), or no answer after 5 s. Wait for the result; do not click
away.

To try a packaged build: `yarn dist:dir -c.productName=Cenacle`, then open
`release/mac-arm64/Cenacle.app` (`release/mac/` on Intel). The release workflow builds the macOS
app under that name: with the accent of "Cénacle.app", the packaged app crashed at launch on
macOS 26. An app you built yourself is not quarantined by macOS, unlike one downloaded from the
releases (first launch: right-click → Open).

If no banner appears even though the dialog says `shown ✓`, check **System Settings →
Notifications** (the app must be listed, with banners allowed) and that no Focus mode is on.

## Reporting a bug

Use the "Bug report" form. Say which system you use (macOS, Windows or Linux and its version),
the app version, and the service and account type if it matters. Do not paste cookies, tokens
or conversation content.

For a security problem, do **not** open a public issue: see [SECURITY.md](SECURITY.md).

## Adding a service

Services are plain data in `src/main/providers.ts`; see [Adding a service](docs/services.md#adding-a-service).
Please include in the pull request what you tested (sign-in, a conversation, notifications).
