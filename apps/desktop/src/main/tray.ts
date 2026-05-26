import { Menu, Tray, app, nativeImage, shell } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

export interface TrayMenuActions {
  onReplayLast: () => void;
  onTriggerNow: () => void;
  onToggleAutoLaunch: () => void;
  onOpenLogs: () => void;
  onOpenLogin: () => void;
  onSignOut: () => void;
  onQuit: () => void;
}

export interface TrayMenuState {
  handle: string;
  signedIn: boolean;
  autoLaunchEnabled: boolean;
  lastEventLabel: string;
}

export function buildTray(actions: TrayMenuActions, initial: TrayMenuState): Tray {
  const iconPath = resolveTrayIcon();
  const tray = new Tray(iconPath);
  tray.setToolTip('SkyMessage');
  tray.setContextMenu(buildMenu(actions, initial));
  return tray;
}

export function updateTrayMenu(tray: Tray, actions: TrayMenuActions, state: TrayMenuState): void {
  tray.setContextMenu(buildMenu(actions, state));
}

function buildMenu(actions: TrayMenuActions, state: TrayMenuState): Menu {
  const header = state.signedIn
    ? `SkyMessage  -  @${state.handle}`
    : 'SkyMessage  -  not signed in';

  return Menu.buildFromTemplate([
    { label: header, enabled: false },
    { label: state.lastEventLabel, enabled: false },
    { type: 'separator' },
    ...(state.signedIn
      ? [
          { label: 'Check for messages now', click: actions.onTriggerNow },
          { label: 'Replay last batch', click: actions.onReplayLast },
        ]
      : [{ label: 'Sign in...', click: actions.onOpenLogin }]),
    { type: 'separator' },
    {
      label: 'Launch on startup',
      type: 'checkbox' as const,
      checked: state.autoLaunchEnabled,
      click: actions.onToggleAutoLaunch,
    },
    ...(state.signedIn
      ? [
          {
            label: 'Open my profile page',
            click: () => { void shell.openExternal(`https://skymessage.app/${state.handle}`); },
          },
          { label: 'Sign out', click: actions.onSignOut },
        ]
      : []),
    { label: 'Show logs folder', click: actions.onOpenLogs },
    { type: 'separator' },
    { label: 'Quit SkyMessage', click: actions.onQuit },
  ]);
}

function resolveTrayIcon() {
  const candidates = [
    join(process.resourcesPath ?? '.', 'assets', 'tray-icon.png'),
    join(app.getAppPath(), 'assets', 'tray-icon.png'),
    join(__dirname, '../../assets/tray-icon.png'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return nativeImage.createFromPath(p);
  }
  return generatedTrayIcon();
}

function generatedTrayIcon() {
  const base64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAQUlEQVR42mNkYGD4z0AEYBxVSF' +
    '+FjIyMjP9R+f///38GBgYGRkYGRkbqGBgYGRkYGfwZGRkYGRkZ0RUSAwBPwQM2u4qWqAAAAAB' +
    'JRU5ErkJggg==';
  return nativeImage.createFromBuffer(Buffer.from(base64, 'base64'));
}
