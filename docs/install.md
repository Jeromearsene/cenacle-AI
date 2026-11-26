# Installation

**English** · [Français](fr/install.md)

← [Back to the README](../README.md)

## Platforms

| Platform | Status                                                                               |
| -------- | ------------------------------------------------------------------------------------ |
| macOS    | primary platform, used and tested daily by the author                                |
| Linux    | supported; the end-to-end tests run on Linux in CI                                   |
| Windows  | supported; the end-to-end tests run on Windows in CI, but the author does not use it |

Installers (macOS `.dmg`, Windows `.exe`, Linux AppImage and `.deb`) are attached to each [release](https://github.com/Jeromearsene/cenacle-AI/releases); you can also [run the app from source](development.md#run-from-source). The installers are **not code-signed yet**: macOS blocks the first launch (see "First launch on macOS" below), Windows shows a SmartScreen warning, and macOS cannot update itself until the app is signed. Platform-specific remarks are marked "macOS", "Windows" or "Linux" in this document.

**First launch on macOS** (the app is not signed or notarized yet):

1. Open the `.dmg`, drag Cénacle to Applications and launch it. macOS refuses to open it.
2. Open System Settings → Privacy & Security, scroll to the message about Cénacle, click "Open Anyway" and confirm. On macOS 15 (Sequoia) and later, the right-click → Open shortcut no longer works.
3. If macOS says the app is "damaged", remove the quarantine flag and launch it again: `xattr -dr com.apple.quarantine /Applications/Cenacle.app`.

Until the app is signed, macOS cannot update it: download each new version from the releases page.

**Updates**: an installed app (not one run from source) checks GitHub Releases at startup and downloads new versions in the background; the update is applied the next time the app quits. On Linux this works for the AppImage, not for the `.deb`. To turn the check off, set the environment variable `CENACLE_DISABLE_UPDATES` to any non-empty value before launching the app.
