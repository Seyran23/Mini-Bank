# ─── Stage 1: deps ────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/types/package.json    ./packages/types/
COPY packages/config/package.json   ./packages/config/
COPY packages/logger/package.json   ./packages/logger/
COPY packages/errors/package.json   ./packages/errors/
COPY apps/gateway/package.json      ./apps/gateway/

RUN pnpm install --frozen-lockfile --filter @minibank/gateway...

# ─── Stage 2: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY --from=deps /app/node_modules              ./node_modules
COPY --from=deps /app/apps/gateway/node_modules ./apps/gateway/node_modules

COPY tsconfig.base.json ./
COPY packages/types     ./packages/types
COPY packages/config    ./packages/config
COPY packages/logger    ./packages/logger
COPY packages/errors    ./packages/errors
COPY apps/gateway       ./apps/gateway

RUN pnpm --filter @minibank/types run build && \
    pnpm --filter @minibank/config run build && \
    pnpm --filter @minibank/logger run build && \
    pnpm --filter @minibank/errors run build && \
    pnpm --filter @minibank/gateway run build

# ─── Stage 3: runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder /app/apps/gateway/dist         ./dist
COPY --from=builder /app/apps/gateway/node_modules ./node_modules
COPY --from=builder /app/node_modules              ./root_node_modules

ENV NODE_ENV=production

USER appuser

EXPOSE 3000

CMD ["node", "dist/main"]
