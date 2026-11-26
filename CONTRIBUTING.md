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

> Temporary: this section goes away with the "Test notifications…" menu entry
> (`src/main/notification-test.ts`) once we know what macOS needs.

Since Electron 42, macOS only displays notifications for a **code-signed** app; an unsigned one
gets a `failed` event and no banner. `yarn dev` runs the unsigned `Electron.app` of
`node_modules`, so notifications do not appear there by default. The menu entry **Accounts →
Test notifications…** raises one system notification and one web notification (from the active
account's page) and tells what happened to each.

Run the test in each situation below, in this order, and note the result of each (the text of
the dialog, and whether a banner really appeared). Wait for the 5 s timeout; do not click away.

1. **Before anything**: `yarn install && yarn dev`, then the menu entry. This is the baseline:
   expect `refused by the system`.
2. **Ad hoc signature** (free, what electron-builder already does on Apple Silicon):

   ```bash
   codesign --force --deep --sign - node_modules/electron/dist/Electron.app
   ```

   Quit the app, `yarn dev`, run the test again.
3. **Self-signed certificate** (free, stable identity). In _Keychain Access → Certificate
   Assistant → Create a Certificate…_: name `Cenacle Dev`, identity type _Self-Signed Root_,
   certificate type _Code Signing_. Then:

   ```bash
   codesign --force --deep --sign "Cenacle Dev" node_modules/electron/dist/Electron.app
   codesign -dv --verbose=4 node_modules/electron/dist/Electron.app 2>&1 | grep -i authority
   ```

   Quit the app, `yarn dev`, run the test again. The first launch may ask for access to
   "Electron Safe Storage" in the keychain: choose _Always Allow_.
4. **A packaged build** (what users run): `yarn dist:dir`, then open
   `release/mac-arm64/*.app` (or `release/mac/*.app` on Intel) and run the test. Do it as built
   (ad hoc), then again after re-signing the built app with `Cenacle Dev`:

   ```bash
   codesign --force --deep --sign "Cenacle Dev" release/mac-arm64/*.app
   ```

   An app you built yourself is not quarantined by macOS, unlike one downloaded from the
   releases: that last case is not covered here, and the first launch of a download needs a
   right-click → Open.

If no banner appears even though the dialog says `shown ✓`, check **System Settings →
Notifications** (the app must be listed, with banners allowed) and that no Focus mode is on.

To go back to a pristine Electron after the tests: `rm -rf node_modules/electron && yarn install`.

What to send back, per case: dev or packaged, signature (none / ad hoc / `Cenacle Dev`), the two
lines of the dialog, and banner yes/no.

## Reporting a bug

Use the "Bug report" form. Say which system you use (macOS, Windows or Linux and its version),
the app version, and the service and account type if it matters. Do not paste cookies, tokens
or conversation content.

For a security problem, do **not** open a public issue: see [SECURITY.md](SECURITY.md).

## Adding a service

Services are plain data in `src/main/providers.ts`; see [Adding a service](docs/services.md#adding-a-service).
Please include in the pull request what you tested (sign-in, a conversation, notifications).
