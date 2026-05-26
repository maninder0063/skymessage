import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

export interface CreateLoginOptions {
  preloadPath: string;
  rendererUrl?: string;
  rendererHtml?: string;
  onClosed?: () => void;
}

export function createLoginWindow(opts: CreateLoginOptions): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const width = 440;
  const height = 580;
  const x = Math.round(display.bounds.x + (display.bounds.width - width) / 2);
  const y = Math.round(display.bounds.y + (display.bounds.height - height) / 2);

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    minWidth: 380,
    minHeight: 520,
    title: 'Sign in to SkyMessage',
    frame: true,
    resizable: true,
    minimizable: true,
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#F6F7FB',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: opts.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => opts.onClosed?.());

  // The renderer picks UI by URL hash. `#login` mounts the auth view.
  if (opts.rendererUrl) {
    void win.loadURL(`${opts.rendererUrl}#login`);
  } else if (opts.rendererHtml) {
    void win.loadFile(opts.rendererHtml, { hash: 'login' });
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'login' });
  }

  return win;
}
