# Installation

**English** · [Français](fr/install.md)

← [Back to the README](../README.md)

## Platforms

| Platform | Status                                                                               |
| -------- | ------------------------------------------------------------------------------------ |
| macOS    | primary platform, used and tested daily by the author                                |
| Linux    | supported; the end-to-end tests run on Linux in CI                                   |
| Windows  | supported; the end-to-end tests run on Windows in CI, but the author does not use it |

Installers (macOS `.dmg`, Windows `.exe`, Linux AppImage and `.deb`) are attached to each [release](https://github.com/Jeromearsene/cenacle-AI/releases); on a Mac you can also [install it with Homebrew](#homebrew-macos), and you can [run the app from source](development.md#run-from-source). The installers are **not code-signed yet**: macOS blocks the first launch of a downloaded `.dmg` (see "First launch on macOS" below), Windows shows a SmartScreen warning, and macOS cannot update itself until the app is signed. Platform-specific remarks are marked "macOS", "Windows" or "Linux" in this document.

## Homebrew (macOS)

[Homebrew](https://brew.sh) installs the app from the same `.dmg` as the releases page, picks Apple Silicon or Intel for you, and updates it. This repository is its own _tap_, so you give Homebrew its address once:

```bash
brew tap Jeromearsene/cenacle https://github.com/Jeromearsene/cenacle-AI
brew install --cask cenacle
```

- **No warning at the first launch**: the app is signed ad hoc, not with an Apple Developer ID, so macOS would block a downloaded copy. The cask removes the quarantine flag after the install, which is why you can skip "First launch on macOS" below.
- **Updates**: macOS cannot update the app by itself yet, so run `brew update && brew upgrade --cask cenacle`. A new version reaches Homebrew a little after the release: a pull request opened by the release workflow points the cask at it, and it is merged by hand.
- **Uninstall**: `brew uninstall --cask cenacle` removes the app and keeps your accounts and settings. Add `--zap` to delete them too (the `Cénacle` folder in `~/Library/Application Support`, see [Privacy](privacy.md)).
- Needs macOS 13 (Ventura) or later.

Homebrew is for macOS only for now; on Linux and Windows, use the installers above.

## First launch on macOS

If you installed the `.dmg` by hand (the app is not signed or notarized yet):

1. Open the `.dmg`, drag Cénacle to Applications and launch it. macOS refuses to open it.
2. Open System Settings → Privacy & Security, scroll to the message about Cénacle, click "Open Anyway" and confirm. On macOS 15 (Sequoia) and later, the right-click → Open shortcut no longer works.
3. If macOS says the app is "damaged", remove the quarantine flag and launch it again: `xattr -dr com.apple.quarantine /Applications/Cenacle.app`.

Until the app is signed, macOS cannot update it: download each new version from the releases page, or install it with [Homebrew](#homebrew-macos) and run `brew upgrade --cask cenacle`.

## Updates

An installed app (not one run from source) checks GitHub Releases at startup and downloads new versions in the background; the update is applied the next time the app quits. On Linux this works for the AppImage, not for the `.deb`. To turn the check off, set the environment variable `CENACLE_DISABLE_UPDATES` to any non-empty value before launching the app.
