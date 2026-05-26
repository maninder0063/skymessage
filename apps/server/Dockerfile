# =====================================================================
# SkyMessage API server — multi-stage Dockerfile
# Built from the repo root so it can pull in workspace packages.
#
#   docker build -f apps/server/Dockerfile -t skymessage-server .
#
# Fly.io's `fly launch` / `fly deploy` use this file automatically when
# placed alongside fly.toml.
# =====================================================================

# ---------- 1. Install dependencies (with dev deps for build) -----------
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY pnpm-workspace.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/types/package.json     packages/types/package.json
COPY packages/shared/package.json    packages/shared/package.json
COPY packages/ui/package.json        packages/ui/package.json
COPY apps/server/package.json        apps/server/package.json
COPY apps/web/package.json           apps/web/package.json
COPY apps/desktop/package.json       apps/desktop/package.json

RUN pnpm install --frozen-lockfile=false --ignore-scripts

# ---------- 2. Build the server ----------------------------------------
FROM deps AS build
WORKDIR /repo
COPY packages packages
COPY apps/server apps/server

RUN pnpm --filter @skymessage/server build

# ---------- 3. Runtime image (slim) ------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV SERVER_PORT=8080
ENV SERVER_HOST=0.0.0.0

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

COPY --from=build /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=build /repo/packages packages
COPY --from=build /repo/apps/server apps/server

RUN pnpm install --prod --ignore-scripts

EXPOSE 8080
WORKDIR /app/apps/server
CMD ["node", "dist/index.js"]
