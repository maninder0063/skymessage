import { app } from 'electron';

/**
 * Configure auto-launch on OS login. Windows-first (uses the registry via
 * Electron's setLoginItemSettings), but the same call works on macOS.
 *
 * `--hidden` tells our `main/index.ts` to skip the optional first-run
 * welcome window and just stay in the tray.
 */
export function setAutoLaunch(enabled: boolean): void {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: enabled,
    args: enabled ? ['--hidden'] : [],
  });
}

export function isAutoLaunchEnabled(): boolean {
  return app.getLoginItemSettings().openAtLogin;
}
