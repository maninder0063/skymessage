# SkyMessage — Deployment

Three independent deployment targets: web, server, desktop. The database
lives in Supabase. Pick a region close to your users.

---

## 1. Supabase (database)

### Cloud (recommended)

```powershell
supabase login
supabase link --project-ref YOUR-PROJECT-REF
pnpm db:push                       # applies supabase/migrations
pnpm db:types                      # regenerates typed Database
```

Copy three values from the Supabase dashboard -> Project Settings -> API:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`  (server only, never ship to clients)

### Local (development)

```powershell
pnpm db:start                      # boots local stack
pnpm db:reset                      # apply migrations + seed
```

The CLI prints local URL and keys; paste into `.env`.

---

## 2. API server (`apps/server`)

Plain Node 20 + Hono. Any host that runs Node works.

### Fly.io (example)

```powershell
cd apps/server
fly launch --no-deploy
fly secrets set `
  SUPABASE_URL="..." `
  SUPABASE_SERVICE_ROLE_KEY="..." `
  ALLOWED_ORIGINS="https://skymessage.app,app://skymessage"
fly deploy
```

### Railway / Render / a VPS

Build:

```powershell
pnpm --filter @skymessage/server build
```

Run:

```powershell
node apps/server/dist/index.js
```

Required env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`ALLOWED_ORIGINS` (CSV of allowed web origins).
Optional: `SERVER_PORT` (default 8787), `SERVER_HOST`.

Healthcheck: `GET /api/health` returns 200 with `{ status: "ok" }`.

---

## 3. Web (`apps/web`)

### Vercel (recommended)

```powershell
cd apps/web
vercel
vercel env add NEXT_PUBLIC_API_BASE_URL   # production: https://api.skymessage.app
vercel env add NEXT_PUBLIC_SITE_URL       # production: https://skymessage.app
vercel --prod
```

Vercel detects Next.js automatically. Build command (auto): `next build`.
Output directory (auto): `.next`.

### Self-hosted

```powershell
pnpm --filter @skymessage/web build
pnpm --filter @skymessage/web start
```

Sits behind any reverse proxy (Caddy, nginx, Cloudflare Tunnel).

---

## 4. Desktop (`apps/desktop`)

### Windows installer

```powershell
pnpm --filter @skymessage/desktop package:win
```

Output: `apps/desktop/release/SkyMessage-Setup-x.y.z.exe`.

The installer:

- creates a Start-menu entry and desktop shortcut,
- writes a Windows registry RunOnce entry so SkyMessage launches on next
  login as a tray-only process (`--hidden` flag set by `auto-launch.ts`).

Before shipping a public build, drop real assets into
`apps/desktop/assets/`:

- `tray-icon.png` (16x16 minimum; ideally 32 / 64 too)
- `icon.png`      (512x512)
- `icon.ico`      (combined Windows icon)

Sign the installer with your code-signing cert via electron-builder's
`win.signingHashAlgorithms` and `win.certificateFile` options before public
distribution.

### Auto-update (next milestone)

`electron-updater` is not wired yet. To enable:

1. Add `electron-updater` to `apps/desktop/package.json`.
2. Host `latest.yml` + signed installers on a private S3 / GitHub Releases.
3. In `main/index.ts`, call `autoUpdater.checkForUpdatesAndNotify()` on
   ready, with a feed URL set via `app.setAppUserModelId(...)`.

---

## Production URLs (suggested)

| Surface        | URL                          | Where it lives                   |
| -------------- | ---------------------------- | -------------------------------- |
| Marketing      | `https://skymessage.app`     | Vercel (`apps/web`)              |
| API            | `https://api.skymessage.app` | Fly.io / Render (`apps/server`)  |
| Database       | (private)                    | Supabase Cloud                   |
| Desktop downloads | `https://skymessage.app/download` | Static asset on Vercel        |

Make sure to:

- Set `ALLOWED_ORIGINS=https://skymessage.app,app://skymessage` on the API.
- Set `NEXT_PUBLIC_API_BASE_URL=https://api.skymessage.app` on Vercel.
- Set `DESKTOP_API_BASE_URL=https://api.skymessage.app` at build time (or
  bake into `apps/desktop/src/main/env.ts` defaults before packaging).

---

## Local end-to-end smoke test

```powershell
pnpm db:start
pnpm db:reset
pnpm dev                # web :3000, server :8787, electron tray
```

1. Visit `http://localhost:3000/send/demo` and send "lunch tomorrow".
2. Lock the PC (Win+L) and unlock.
3. A plane crosses the screen with your message.

(Or right-click the tray icon -> "Check for messages now" to skip the
lock/unlock step.)
