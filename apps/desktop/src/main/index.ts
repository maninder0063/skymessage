import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { desktopEnv } from './env.js';
import { loadConfig, type InstallConfig } from './config.js';
import { DesktopApiClient } from './api-client.js';
import { createOverlayWindow } from './overlay-window.js';
import { createLoginWindow } from './login-window.js';
import { ReceptiveDetector, type ReceptiveEventInfo } from './power-monitor.js';
import { buildTray, updateTrayMenu } from './tray.js';
import { isAutoLaunchEnabled, setAutoLaunch } from './auto-launch.js';
import {
  getAuthSnapshot,
  getSupabaseClient,
  getValidAccessToken,
  loadPersistedSession,
  signIn,
  signOut,
  signUp,
} from './auth.js';
import {
  ANIMATION_OVERLAY_HIDE_DELAY_MS,
  ANIMATION_OVERLAY_SHOW_DELAY_MS,
  MIN_POLL_INTERVAL_SECONDS,
} from '@skymessage/shared/constants';
import {
  IPC,
  type PlayMessagesPayload,
  type LoginPayload,
  type SignupPayload,
  type AuthSnapshotPayload,
} from '../shared/ipc-channels.js';

let overlay: BrowserWindow | null = null;
let loginWin: BrowserWindow | null = null;
let detector: ReceptiveDetector | null = null;
let api: DesktopApiClient | null = null;
let config: InstallConfig | null = null;
let lastEventLabel = 'Waiting for unlock...';
let lastReceptiveAt = 0;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!getAuthSnapshot().signedIn) openLoginWindow();
    else detector?.triggerManually();
  });
}

app.whenReady().then(bootstrap).catch((err) => {
  console.error('[main] bootstrap failed', err);
  app.exit(1);
});

async function bootstrap(): Promise<void> {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();

  if (!desktopEnv.SUPABASE_URL || !desktopEnv.SUPABASE_ANON_KEY) {
    console.error(
      '[main] DESKTOP_SUPABASE_URL and DESKTOP_SUPABASE_ANON_KEY must be set at build time.',
    );
  }
  getSupabaseClient(desktopEnv.SUPABASE_URL, desktopEnv.SUPABASE_ANON_KEY);

  config = await loadConfig(desktopEnv.API_BASE_URL);
  api = new DesktopApiClient(config.apiBaseUrl, getValidAccessToken);

  if (desktopEnv.AUTO_LAUNCH && !isAutoLaunchEnabled()) {
    setAutoLaunch(true);
  }

  overlay = createOverlayWindow({
    preloadPath: join(__dirname, '../preload/index.js'),
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    rendererHtml: join(__dirname, '../renderer/index.html'),
  });

  detector = new ReceptiveDetector();
  detector.on('receptive', onReceptive);
  detector.start();

  registerIpc();
  registerTray();

  const snap = await loadPersistedSession();
  if (!snap.signedIn) {
    openLoginWindow();
  } else {
    await onSignedIn();
  }
}

async function onSignedIn(): Promise<void> {
  const snap = getAuthSnapshot();
  if (!api || !config || !snap.meta) return;

  await api
    .heartbeat({
      deviceId: config.deviceId,
      platform: 'windows',
      appVersion: app.getVersion(),
    })
    .catch((err) => console.error('[main] initial heartbeat failed', err));

  setInterval(() => {
    if (!api || !config) return;
    api
      .heartbeat({
        deviceId: config.deviceId,
        platform: 'windows',
        appVersion: app.getVersion(),
      })
      .catch(() => undefined);
  }, 5 * 60_000);
}

async function onReceptive(info: ReceptiveEventInfo): Promise<void> {
  if (!api || !config || !overlay) return;
  if (!getAuthSnapshot().signedIn) return;

  const now = Date.now();
  if (now - lastReceptiveAt < MIN_POLL_INTERVAL_SECONDS * 1000) return;
  lastReceptiveAt = now;

  if (!config.animationsEnabled) return;

  try {
    const pending = await api.pending();
    if (pending.messages.length === 0) {
      lastEventLabel = `${info.kind}: nothing to show`;
      return;
    }

    const payload: PlayMessagesPayload = {
      messages: pending.messages,
      recipient: pending.recipient,
      trigger: info.kind === 'manual' ? 'manual' : info.kind,
    };

    overlay.show();
    overlay.setIgnoreMouseEvents(true, { forward: true });

    setTimeout(() => overlay?.webContents.send(IPC.PlayMessages, payload), ANIMATION_OVERLAY_SHOW_DELAY_MS);

    lastEventLabel = `${info.kind}: ${pending.messages.length} message(s) flying`;
  } catch (err) {
    console.error('[main] receptive handler failed', err);
    lastEventLabel = `error: ${(err as Error).message}`;
  }
}

function openLoginWindow(): void {
  if (loginWin && !loginWin.isDestroyed()) { loginWin.focus(); return; }

  loginWin = createLoginWindow({
    preloadPath: join(__dirname, '../preload/index.js'),
    rendererUrl: process.env.ELECTRON_RENDERER_URL,
    rendererHtml: join(__dirname, '../renderer/index.html'),
    onClosed: () => {
      loginWin = null;
      if (getAuthSnapshot().signedIn) void onSignedIn();
    },
  });
}

function registerIpc(): void {
  ipcMain.on(IPC.MessageDelivered, (_, { messageId }: { messageId: string }) => {
    api?.markDelivered(messageId).catch((err) => console.error('[main] markDelivered', err));
  });

  ipcMain.on(IPC.QueueComplete, () => {
    setTimeout(() => overlay?.hide(), ANIMATION_OVERLAY_HIDE_DELAY_MS);
  });

  ipcMain.handle(IPC.RequestPending, async () => {
    if (!api) return { messages: [] };
    return api.pending();
  });

  ipcMain.handle(IPC.AuthLogin, async (_, payload: LoginPayload) => {
    if (!config) return { ok: false, error: 'Not ready' };
    return signIn(payload, config.apiBaseUrl);
  });

  ipcMain.handle(IPC.AuthSignup, async (_, payload: SignupPayload) => {
    if (!config) return { ok: false, error: 'Not ready' };
    return signUp(payload, config.apiBaseUrl);
  });

  ipcMain.handle(IPC.AuthSignOut, async () => {
    await signOut();
  });

  ipcMain.handle(IPC.AuthSnapshot, (): AuthSnapshotPayload => {
    const snap = getAuthSnapshot();
    return {
      signedIn: snap.signedIn,
      meta: snap.meta
        ? {
            userId: snap.meta.userId,
            handle: snap.meta.handle,
            displayName: snap.meta.displayName,
            email: snap.meta.email,
            timezone: snap.meta.timezone,
          }
        : null,
    };
  });

  ipcMain.on(IPC.AuthCloseWindow, () => {
    loginWin?.close();
  });
}

function registerTray(): void {
  const tray = buildTray(trayActions(), trayState());
  setInterval(() => updateTrayMenu(tray, trayActions(), trayState()), 30_000);

  function trayActions() {
    return {
      onTriggerNow: () => detector?.triggerManually(),
      onReplayLast: () => detector?.triggerManually(),
      onToggleAutoLaunch: () => setAutoLaunch(!isAutoLaunchEnabled()),
      onOpenLogs: () => { void shell.openPath(app.getPath('userData')); },
      onOpenLogin: () => openLoginWindow(),
      onSignOut: async () => {
        await signOut();
        openLoginWindow();
      },
      onQuit: () => {
        (app as { isQuitting?: boolean }).isQuitting = true;
        app.quit();
      },
    };
  }

  function trayState() {
    const snap = getAuthSnapshot();
    return {
      handle: snap.meta?.handle ?? '(not signed in)',
      signedIn: snap.signedIn,
      autoLaunchEnabled: isAutoLaunchEnabled(),
      lastEventLabel: snap.signedIn ? lastEventLabel : 'Sign in to receive banners',
    };
  }
}

app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (e) => e.preventDefault());
});
