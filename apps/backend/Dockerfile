# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/jest-config/package.json    ./packages/jest-config/
COPY apps/backend/package.json ./apps/backend/

# Install ALL dependencies (devDeps needed to compile TypeScript)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Compile
WORKDIR /app/apps/backend
RUN pnpm run build && \
    test -f dist/main.js || (echo "ERROR: dist/main.js was not produced by the build!" && exit 1)

# Prune devDependencies in-place for a lean runner image
WORKDIR /app
RUN CI=true pnpm prune --prod

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Copy pruned node_modules — no install needed, no lifecycle scripts
COPY --from=builder /app/node_modules            ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy compiled output
COPY --from=builder /app/apps/backend/dist       ./apps/backend/dist

# Package manifests needed by Node module resolution at runtime
COPY package.json pnpm-workspace.yaml ./
COPY apps/backend/package.json        ./apps/backend/

WORKDIR /app/apps/backend

EXPOSE 3000

CMD ["node", "dist/main"]
