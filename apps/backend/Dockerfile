# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

WORKDIR /app

# Copy workspace manifests first (for better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json ./

# Copy all package manifests so pnpm can resolve the workspace graph
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/jest-config/package.json    ./packages/jest-config/

COPY apps/backend/package.json ./apps/backend/

# Install ALL dependencies (including devDeps needed for the build)
RUN pnpm install --frozen-lockfile

# Copy shared packages source
COPY packages/ ./packages/

# Copy backend source
COPY apps/backend/ ./apps/backend/

# Build the backend
WORKDIR /app/apps/backend
RUN pnpm run build

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@11.5.0 --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/jest-config/package.json    ./packages/jest-config/
COPY apps/backend/package.json ./apps/backend/

# Install production-only dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Copy migration source (TypeORM needs the data-source at runtime)
COPY --from=builder /app/apps/backend/src ./apps/backend/src
COPY tsconfig.base.json ./
COPY apps/backend/tsconfig.json ./apps/backend/
COPY apps/backend/tsconfig.build.json ./apps/backend/
COPY apps/backend/nest-cli.json ./apps/backend/

WORKDIR /app/apps/backend

EXPOSE 3000

CMD ["node", "dist/main"]
