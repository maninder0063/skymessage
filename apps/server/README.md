# @skymessage/server

Hono-based HTTP API for SkyMessage. Node 20+.

## Routes

| Method | Path                              | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------ |
| GET    | `/api/health`                     | Liveness probe                             |
| POST   | `/api/messages`                   | Send a message (validated + anti-spam)     |
| GET    | `/api/messages/pending`           | Desktop polls on unlock                    |
| POST   | `/api/messages/:id/delivered`     | Desktop marks plane animation complete     |
| POST   | `/api/messages/:id/read`          | Desktop marks queue fully drained          |
| GET    | `/api/messages/history`           | Replay last N messages                     |
| GET    | `/api/users/:handle`              | Public profile + acceptance flags          |
| POST   | `/api/users/:handle/block`        | Block a sender (recipient initiates)       |
| POST   | `/api/devices/heartbeat`          | Desktop keep-alive every ~5min             |

## Run locally

```powershell
pnpm install
pnpm --filter @skymessage/server dev
```

Reads `.env` from the repo root (via `dotenv`). Required vars:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Optional:

- `SERVER_PORT` (default 8787)
- `SERVER_HOST` (default 0.0.0.0)
- `ALLOWED_ORIGINS` (CSV)

## Deploy

Any Node 20+ host: Fly.io, Railway, Render, Hetzner.

```powershell
pnpm build
node dist/index.js
```
