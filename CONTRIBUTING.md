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

## Reporting a bug

Use the "Bug report" form. Say which system you use (macOS, Windows or Linux and its version),
the app version, and the service and account type if it matters. Do not paste cookies, tokens
or conversation content.

For a security problem, do **not** open a public issue: see [SECURITY.md](SECURITY.md).

## Adding a service

Services are plain data in `src/main/providers.ts`; see [Adding a service](docs/services.md#adding-a-service).
Please include in the pull request what you tested (sign-in, a conversation, notifications).
