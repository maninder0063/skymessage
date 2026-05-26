# SkyMessage — Architecture

## What it is

SkyMessage delivers short airplane-banner messages between coworkers — but only
at moments the recipient is *receptive*: on unlock, on resume from sleep, or on
return from idle. Never during focused work.

The product feels like a screensaver, not a chat client.

---

## High-level diagram

```
                +----------------------+
                |   Web (Next.js)      |
                |   - landing          |
                |   - /[handle]        |
                |   - /send/[handle]   |
                |   - MUI v7 theme     |
                +----------+-----------+
                           |
                           |  HTTPS (fetch / Server Action)
                           v
                +----------------------+        +-----------------------+
                |  API server (Hono)   | <----> |  Supabase / Postgres  |
                |  - anti-spam         |        |  - users              |
                |  - rate-limit        |        |  - messages           |
                |  - profanity         |        |  - blocked_users      |
                |  - delivery filter   |        |  - settings           |
                +----------+-----------+        |  - devices            |
                           ^                    |  - rate_limits        |
                           |                    +-----------------------+
                           |  HTTPS poll-on-unlock
                           |
              +------------+-------------+
              |   Desktop (Electron)     |
              |  Main process:           |
              |   - tray                 |
              |   - powerMonitor:        |
              |       unlock-screen      |
              |       resume             |
              |       user-did-resume    |
              |   - auto-launch          |
              |   - secure IPC           |
              |  Renderer (overlay):     |
              |   - transparent, frame-  |
              |     less, always-on-top  |
              |   - PixiJS plane sprite  |
              |   - banner cloth sim     |
              |   - AnimationQueue       |
              +--------------------------+
```

---

## Repository layout (pnpm workspaces)

```
skymessage/
  apps/
    desktop/          Electron + PixiJS overlay
    web/              Next.js 15 + MUI v7
    server/           Hono API (Node 20+)
  packages/
    types/            DB and API TypeScript types (also re-exports generated)
    shared/           Pure logic: validation, profanity, anti-spam, timezone
    ui/               Shared MUI atoms used by web (and any future surfaces)
  supabase/
    config.toml
    migrations/       SQL migrations
    seed.sql
  package.json        Root workspace
  pnpm-workspace.yaml
  tsconfig.base.json  Base TS config extended by every workspace
  eslint.config.js    Flat ESLint config
  .env.example        Copy to .env
  README.md
  ARCHITECTURE.md
```

---

## Runtime behavior

### Sender (web)

1. Sender visits `/send/john` (or `/john` which renders the same composer).
2. Composes a message (max 80 chars), optionally picks a future delivery time
   (interpreted in the recipient's timezone).
3. Form POSTs to the API; the API validates, runs anti-spam, runs profanity
   filter, stores in `messages` with `scheduled_delivery_at` (now if "send
   now") and `delivered_at = null`, `read_at = null`.

### Recipient (desktop)

1. Electron app auto-launches on Windows login, sits in the system tray.
2. Main process subscribes to `powerMonitor`:
   - `unlock-screen`
   - `resume`
   - `user-did-resume` (some Win32 builds)
   - manual idle polling via `powerMonitor.getSystemIdleTime()` for the
     "return-from-idle" condition (default threshold: 5 minutes idle then
     activity).
3. On any of those triggers, main process fetches:
   ```
   GET /api/messages/pending?user_id=...
   ```
   The server filters: not blocked, scheduled_delivery_at <= now (in user
   timezone), not in quiet hours, queue cap respected.
4. If results: show the overlay window (transparent, always-on-top, frameless,
   click-through), send the list over IPC to the renderer.
5. Renderer (`AnimationQueue`) plays planes one-by-one with 2.5s spacing.
6. After each plane exits the right edge, IPC fires `messages:delivered` for
   that id. After the full queue empties, the overlay window hides.

### Quiet hours / batching

The server is the source of truth. The desktop simply asks "what should I
animate right now?" and the server decides. If a user has quiet hours
22:00-07:00 in their TZ and unlocks at 23:30, no messages return — they wait
until the next eligible window.

---

## Animation pipeline (renderer)

```
window.skymessage.onPlayMessages(batch)
   │
   v
<AnimationQueue items batchId>            React state machine
   │
   v (one at a time, 2.5s gap between)
<Overlay payload onFinish>
   │
   ├── <Banner sender message>            cloth photo + ropes + typography
   │     .banner-air keyframe (CSS)       wind-catch rotation, GPU compositor
   │
   ├── <Plane />                          plane.png 300x150 nose-right
   │
   └── sweepRef.animate([...], { duration, easing })   WAAPI translate3d sweep
                                                       ── single compositor
                                                          layer, fill:forwards
   │
   v on 'finish':
       window.skymessage.notifyDelivered(id)
       wait 2.5s, advance queue, or notifyQueueComplete + hide overlay
```

Same visual chrome as `meeting-plane-electron`: photographic plane, cream
cloth banner with braided manila ropes, 4-row typography (eyebrow / headline
/ sender / divider). Headline auto-sizes by message length (46px..20px) so a
one-word note feels like a billboard and an 80-char note still fits.

Earlier scaffold used PixiJS for the plane; we replaced it with PNG sprites
+ WAAPI because the sweep then runs on the same compositor pipeline CSS
@keyframes use — no JS or React commits during frames.

---

## Security model

| Concern             | Mitigation                                                 |
| ------------------- | ---------------------------------------------------------- |
| XSS in messages     | Server stores raw; renderer uses `PIXI.BitmapText` (no HTML) and web uses React text nodes only. |
| CSRF (web)          | Same-origin Server Actions; explicit `Origin` check on API. |
| API abuse           | Per-IP and per-sender rate limits (in-memory or Redis).    |
| Profanity / slurs   | Wordlist filter in `packages/shared/src/profanity.ts`.     |
| Electron IPC        | `contextIsolation: true`, no `nodeIntegration`, typed channels via preload `contextBridge`. |
| Secret leakage      | `SUPABASE_SERVICE_ROLE_KEY` is server-only; never bundled into web/desktop renderers. |
| Auto-update         | Use signed installers, electron-updater with HTTPS feed. (Scaffold included, feed URL TBD.) |

---

## Data flow summary

```
[sender] --(POST /api/messages)--> [server] --(insert)--> [postgres]
                                       │
                                       └── runs validation + anti-spam

[desktop unlock] --(GET /api/messages/pending)--> [server]
   ^                                                  │
   │                                                  └── filters: scheduled_delivery_at <= now,
   │                                                                quiet hours, blocked, cap
   └---(POST /api/messages/:id/delivered)--- [desktop after each plane exits]
   └---(POST /api/messages/:id/read)--------- [desktop after full queue done]
```

---

## Why these choices

- **Hono over Express**: smaller, faster, native TS, runs on Node/Bun/Workers.
- **electron-vite over plain Vite + tsc**: handles main/preload/renderer
  configurations cleanly, fast HMR for the renderer.
- **PixiJS over Canvas2D / Three.js**: 2D-native, batched WebGL draw calls,
  built-in BitmapText, well-suited for sprite + texture warping.
- **MUI v7 (Material 3)**: matches the user's project-wide UI standard.
- **Supabase**: hosted Postgres + auth + storage in one. RLS keeps direct
  client access safe.
- **pnpm workspaces**: strict, fast, disk-efficient.

---

## Known scope deferred to follow-up work

These exist in the spec but are intentionally stubbed (with TODO markers in
code) on this first pass to keep the build coherent:

- OAuth login (Google / Microsoft) — schema and routes prepared, UI deferred.
- Admin / moderation UI — schema exists, page is a stub.
- Custom plane skins, birthday mode, office groups, replay-previous-messages.
- Auto-update feed URL.
- Docker images.

The architecture supports all of these without restructuring.
