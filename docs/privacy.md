# Privacy, permissions and sign-in

**English** · [Français](fr/privacy.md)

← [Back to the README](../README.md)

## Isolation

Each account lives in its own browser partition: cookies, local storage, cache and service workers are never shared, not even between two accounts of the same service. Deleting an account clears its partition. The application uses no API and no key, and has no server of its own: the pages you see are the services' own websites, and your sessions stay on your computer.

## Permissions

Service pages are websites, so the app grants them only what a chat needs: notifications, copy and paste, full screen and the **microphone** (voice mode). The camera, screen capture, location and every other permission are refused. Only the page itself, not an embedded third-party frame, can use notifications or the microphone. The policy is in `src/main/permissions.ts`.

## Passwords and passkeys

What does **not** work today, and why:

- **Password autofill from the system (macOS: Apple Passwords / iCloud Keychain)** is not offered in Electron apps. Electron has an open feature request for macOS system password providers on HTML fields ([electron/electron#54142](https://github.com/electron/electron/issues/54142)). For third-party browser engines, Apple's iCloud Passwords integration additionally requires a restricted entitlement (`com.apple.developer.browser`) that Apple grants on request, as another Chromium-based browser documented ([ego-lite#362](https://github.com/citrolabs/ego-lite/issues/362)).
- **Touch ID and passkeys**: Electron only offers them after `app.configureWebAuthn`, and they require a code-signed app with Apple entitlements. Passkeys already stored in your iCloud Keychain would not appear. On the Google sign-in screen, choose "Try another way" and use your password with two-step verification.

What you can do:

- Copy the password from your password manager, then paste with ⌘V or right-click → Paste (the context menu is there for this).
- Third-party password managers: 1Password's Universal Autofill (⌘\) is reported to work in some signed Electron apps (same issue #54142); it has **not** been tested with this app.

## Where the data lives

- Sessions: `Partitions/` folder inside the app's data folder. One partition per account.
  - macOS: `~/Library/Application Support/Cénacle/`
  - Windows: `%APPDATA%\Cénacle\`
  - Linux: `~/.config/Cénacle/`
- Account list, layout, window size, and the address of the last conversation of each account: `state.json` in the same folder.
- Session data is never stored in the project folder.
