# ─────────────── Stage 1 – Builder ────────────────────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 py3-pip py3-setuptools alpine-sdk ffmpeg

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm generate

# ─────────────── Stage 2 – Runtime ────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache ffmpeg python3 py3-pip py3-setuptools alpine-sdk

RUN corepack enable && corepack prepare pnpm@8.15.9 --activate

ENV PORT=3000
ENV DATABASE_URL="file:/app/sqlite.db"
LABEL maintainer="Quentin Laffont <contact@qlaffont.com>"

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

EXPOSE $PORT
CMD ["pnpm", "run", "docker:start"]
