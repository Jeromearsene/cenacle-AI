import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Checks GitHub Releases for a newer version and downloads it in the background; the update is
 * applied the next time the app quits. Only in a packaged app: from source (`yarn dev`) there is
 * nothing to update.
 *
 * Notes:
 * - macOS only installs updates for a signed app. Until the app is signed, the check fails and
 *   the failure is only logged: macOS users download the new version by hand.
 * - Linux updates work for the AppImage, not for the .deb.
 */
export function checkForUpdates(): void {
  if (!app.isPackaged || process.env.CENACLE_DISABLE_UPDATES) return;
  autoUpdater.logger = console;
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error('Update check failed:', err);
  });
}
