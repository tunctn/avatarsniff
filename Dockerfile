# Monorepo build for the avatarsniff demo site (site/).
# Build context MUST be the repo root so the workspace `lib/` is available.
# In Coolify: Build Pack = Dockerfile, Base Directory = /, Dockerfile = /Dockerfile.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# --- install: cached on the lockfile + manifests ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY lib/package.json ./lib/package.json
COPY site/package.json ./site/package.json
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- build: compile the lib, then the Next site (standalone output) ---
FROM deps AS build
COPY . .
RUN pnpm --filter avatarsniff build
RUN pnpm --filter avatarsniff-site build

# --- runtime: minimal standalone server ---
FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
# Standalone bundle is traced from the monorepo root, so inside it the app lives
# under site/. The bundle itself is emitted to site/.next/standalone.
COPY --from=build /app/site/.next/standalone ./
COPY --from=build /app/site/.next/static ./site/.next/static
EXPOSE 3000
CMD ["node", "site/server.js"]
