# @skymessage/desktop

Electron 33 overlay client. Windows-first. Renderer uses React + photographic
PNG sprites (plane + cloth banner) + Web Animations API for the master sweep.
Same visual chrome as `meeting-plane-electron`.

## How the pieces fit

```
src/
  main/                    Node process — tray, windows, OS hooks
    index.ts               app bootstrap
    overlay-window.ts      transparent always-on-top BrowserWindow
    power-monitor.ts       unlock / resume / idle detection
    tray.ts                system tray + context menu
    auto-launch.ts         OS login item
    api-client.ts          HTTPS poll to @skymessage/server
    config.ts              user-data persisted prefs
    env.ts                 env-var loading
  preload/
    index.ts               contextBridge — typed window.skymessage API
    index.d.ts             ambient type for renderer
  shared/
    ipc-channels.ts        channel names + payload types (main <-> renderer)
  renderer/
    main.tsx, App.tsx      React mount, drives the queue
    Overlay.tsx            one plane sweep — WAAPI on the group wrapper
    Plane.tsx              <img src=plane.png> 300x150, nose right
    Banner.tsx             cloth photo + ropes + typography stack
    AnimationQueue.tsx     serializes planes, ~2.5s gap between
    styles.css             bannerAir + clothFlutter CSS keyframes
    assets/
      plane.png            300x150 photorealistic side-view, transparent bg
      banner.png           cream cloth, 520x173, eyelets on right
```

## Why no PixiJS

Earlier scaffold used PixiJS for the plane + banner. We switched to the
PNG/WAAPI approach from `meeting-plane-electron` because:

- Compositor-thread sweep on a single layer — no JS work between frames.
- One photorealistic plane image renders identically on every machine; no
  per-GPU variance from Graphics primitives.
- ~70 KB of dependency removed.

## Run in dev

From repo root:

```powershell
pnpm dev:desktop
```

This starts `electron-vite dev` — HMR for the renderer, hot-reload for main.

Tray icon should appear within ~2 seconds. Right-click it -> "Check for
messages now" to trigger an animation without locking.

## Build a Windows installer

```powershell
pnpm --filter @skymessage/desktop package:win
```

Output: `apps/desktop/release/SkyMessage-Setup-x.y.z.exe`.

The NSIS config enables a Start-menu entry, a desktop shortcut, and (per
`auto-launch.ts`) a Windows registry RunOnce entry so SkyMessage launches on
login as a tray-only process.

## Configuration

First-run defaults are written to `%APPDATA%/skymessage/skymessage.config.json`:

```json
{
  "userId":  "11111111-1111-1111-1111-111111111111",
  "handle":  "demo",
  "deviceId": "<generated>",
  "apiBaseUrl": "http://localhost:8787",
  "animationsEnabled": true
}
```

Edit that file (or use the upcoming Settings panel) to point at your own
SkyMessage account.

## Security notes

- `contextIsolation: true`, `nodeIntegration: false` everywhere.
- Renderer is reachable only via the `skymessage` bridge defined in
  `preload/index.ts`. The renderer never sees Electron, Node, or the API key.
- All HTTPS calls leave the main process; the renderer only receives sanitised
  text payloads.
- `web-contents-created` denies window-open and will-navigate to prevent
  drive-by navigation.
