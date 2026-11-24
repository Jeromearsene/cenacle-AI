# Changesets

Every change that users can notice (feature, fix, behavior change) comes with a changeset: a
small Markdown file in this folder that says what changed and how big it is (patch, minor or
major).

```bash
yarn changeset
```

The command asks the bump type and a one-line summary, then writes the file. Commit it with
your pull request. When pull requests are merged, a bot opens a "Version packages" pull
request that collects the changesets into `CHANGELOG.md` and bumps the version. Merging that
pull request tags the release and builds the installers.

Pure refactors, tests, docs and CI changes do not need a changeset.
