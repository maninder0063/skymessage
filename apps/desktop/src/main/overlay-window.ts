import { BrowserWindow, screen } from 'electron';
import { join } from 'node:path';

export interface CreateOverlayOptions {
  preloadPath: string;
  rendererUrl?: string;     // dev server URL
  rendererHtml?: string;    // production html path
}

/**
 * Build a transparent, frameless, always-on-top window sized to span the
 * primary display. On Windows we set `setSkipTaskbar` and rely on
 * `setIgnoreMouseEvents` for click-through.
 */
export function createOverlayWindow(opts: CreateOverlayOptions): BrowserWindow {
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.bounds;

  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    transparent: true,
    frame: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    focusable: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: opts.preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });

  if (opts.rendererUrl) {
    void win.loadURL(opts.rendererUrl);
  } else if (opts.rendererHtml) {
    void win.loadFile(opts.rendererHtml);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  // Best-effort: when display config changes (laptop docked, monitor unplugged)
  // resize to the new primary display so the overlay still spans the screen.
  screen.on('display-metrics-changed', () => {
    const d = screen.getPrimaryDisplay().bounds;
    win.setBounds(d);
  });

  return win;
}
