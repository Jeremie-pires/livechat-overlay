# ─────────────── Stage 1 – Builder ────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 py3-pip py3-setuptools alpine-sdk ffmpeg

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

ENV HUSKY=0

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# ─────────────── Stage 2 – Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache ffmpeg python3 py3-pip py3-setuptools alpine-sdk

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

ENV HUSKY=0
ENV PORT=3000
ENV DATABASE_URL="file:/app/sqlite.db"
LABEL maintainer="Quentin Laffont <contact@qlaffont.com>"

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY --from=builder /app/prisma ./prisma
RUN pnpm generate

COPY --from=builder /app/src ./src

EXPOSE $PORT
CMD ["pnpm", "run", "docker:start"]
