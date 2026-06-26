# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json    ./packages/types/
COPY packages/config/package.json   ./packages/config/
COPY packages/logger/package.json   ./packages/logger/
COPY packages/errors/package.json   ./packages/errors/
COPY apps/notifications/package.json ./apps/notifications/

RUN pnpm install --frozen-lockfile --filter @minibank/notifications...

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY --from=deps /app/node_modules                   ./node_modules
COPY --from=deps /app/apps/notifications/node_modules ./apps/notifications/node_modules

COPY tsconfig.base.json ./
COPY packages/types     ./packages/types
COPY packages/config    ./packages/config
COPY packages/logger    ./packages/logger
COPY packages/errors    ./packages/errors
COPY apps/notifications ./apps/notifications

RUN pnpm --filter @minibank/types run build && \
    pnpm --filter @minibank/config run build && \
    pnpm --filter @minibank/logger run build && \
    pnpm --filter @minibank/errors run build && \
    pnpm --filter @minibank/notifications run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/apps/notifications/dist         ./dist
COPY --from=builder /app/apps/notifications/node_modules ./node_modules
COPY --from=builder /app/node_modules                     ./root_node_modules

ENV NODE_ENV=production

USER appuser

EXPOSE 3004

CMD ["node", "dist/main"]
