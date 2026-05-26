# SkyMessage

Cinematic airplane-banner messages that fly across your desktop the moment you
unlock your PC. Not a chat app — a *pleasant surprise*.

> See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

---

## Quick start

### 0. Prerequisites

- Node.js **20.18+** (`nvm use` honors `.nvmrc`)
- pnpm **9+** (`npm i -g pnpm`)
- Supabase CLI (`npm i -g supabase`) for local DB
- Windows 10/11 for the desktop client (other OSes build but unlock detection
  is Windows-first)

### 1. Install

```powershell
pnpm install
```

### 2. Configure environment

```powershell
copy .env.example .env
# edit .env with your Supabase project ref + keys
```

For local development against Supabase locally:

```powershell
pnpm db:start          # boots local postgres + supabase services
pnpm db:reset          # applies migrations + seed
pnpm db:types          # regenerates packages/types/src/database.generated.ts
```

The `db:start` command prints the local `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY` — paste them into `.env`.

### 3. Run everything in dev

```powershell
pnpm dev               # runs web (3000), server (8787), desktop (electron) in parallel
```

Or run individually:

```powershell
pnpm dev:server        # Hono API on http://localhost:8787
pnpm dev:web           # Next.js on http://localhost:3000
pnpm dev:desktop       # Electron overlay + tray
```

### 4. Try the flow

1. Open `http://localhost:3000/send/demo` and send a message.
2. Lock your PC (Win+L) and unlock — a plane flies across with your message.
3. Or: click the SkyMessage tray icon and pick **Replay last** to preview
   without locking.

---

## Workspace scripts

| Command              | What it does                                          |
| -------------------- | ----------------------------------------------------- |
| `pnpm dev`           | Run web + server + desktop in parallel                |
| `pnpm build`         | Build every package and app                           |
| `pnpm lint`          | ESLint across the monorepo                            |
| `pnpm typecheck`     | `tsc --noEmit` per workspace                          |
| `pnpm format`        | Prettier write across `.ts/.tsx/.json/.md`            |
| `pnpm db:start`      | Start local Supabase                                  |
| `pnpm db:reset`      | Apply migrations + seed locally                       |
| `pnpm db:push`       | Push migrations to remote project                     |
| `pnpm db:types`      | Regenerate Postgres-typed `Database` types            |

---

## Deployment

### Web — Vercel

```powershell
cd apps/web
vercel
```

Set env vars in Vercel dashboard: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_BASE_URL`.

### API server — anywhere Node 20 runs

`apps/server` is a plain Node Hono app. Deploy to Fly.io, Railway, Render,
or a tiny VPS. See `apps/server/README.md`.

### Database — Supabase Cloud

```powershell
supabase link --project-ref YOUR-PROJECT-REF
pnpm db:push
```

### Desktop — Windows installer

```powershell
cd apps/desktop
pnpm build
pnpm package           # produces release/SkyMessage-Setup-x.y.z.exe
```

The installer ships an NSIS auto-launch entry so SkyMessage starts on Windows
login.

---

## License

Internal / unreleased.
