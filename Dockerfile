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
RUN pnpm prune --prod

# ─────────────── Stage 2 – Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner

# No build toolchain (alpine-sdk / gcc / make) — native modules are copied pre-compiled from builder
# openssl is required by the Prisma schema engine at runtime
# yt-dlp standalone binary embeds its own Python — avoids pip/PEP-668 issues on Alpine 3.21+
RUN apk update && apk upgrade --no-cache && \
    apk add --no-cache ffmpeg openssl wget && \
    ARCH="$(uname -m)" && \
    if [ "$ARCH" = "aarch64" ]; then YTBIN="yt-dlp_linux_aarch64"; \
    elif [ "$ARCH" = "armv7l" ]; then YTBIN="yt-dlp_linux_armv7l"; \
    else YTBIN="yt-dlp_linux"; fi && \
    wget -qO /usr/local/bin/yt-dlp \
      "https://github.com/yt-dlp/yt-dlp/releases/latest/download/${YTBIN}" && \
    chmod a+rx /usr/local/bin/yt-dlp && \
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