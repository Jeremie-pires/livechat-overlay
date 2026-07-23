# ─────────────── Stage 1 – Builder ────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache python3 py3-pip py3-setuptools alpine-sdk ffmpeg

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

ENV HUSKY=0

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# ─────────────── Stage 2 – Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner

# No build toolchain (alpine-sdk / gcc / make) — native modules are copied pre-compiled from builder
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache ffmpeg python3 py3-pip py3-setuptools && \
    corepack enable && corepack prepare pnpm@8.15.9 --activate

ENV HUSKY=0
ENV PORT=3000
ENV DATABASE_URL="file:/app/sqlite.db"
LABEL maintainer="Quentin Laffont <contact@qlaffont.com>"

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY --from=builder /app/node_modules ./node_modules

COPY --from=builder /app/prisma ./prisma
RUN pnpm generate

COPY --from=builder /app/src ./src

EXPOSE $PORT
CMD ["pnpm", "run", "docker:start"]
