# ─────────────── Stage 1 – Builder ────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache python3 py3-pip py3-setuptools alpine-sdk ffmpeg

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

ENV HUSKY=0

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm prune --prod

# ─────────────── Stage 2 – Runtime ────────────────────────────────────────────
FROM node:22-alpine AS runner

# No build toolchain (alpine-sdk / gcc / make) — native modules are copied pre-compiled from builder
# openssl is required by the Prisma schema engine at runtime
# yt-dlp + yt-dlp-ejs via pip (PyPI) — yt-dlp-ejs provides the n-challenge JS solver scripts
# Node.js 22+ is required by yt-dlp's NodeJCP challenge solver (MIN_SUPPORTED_VERSION = 22)
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache ffmpeg openssl py3-pip && \
    pip3 install --break-system-packages yt-dlp yt-dlp-ejs && \
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