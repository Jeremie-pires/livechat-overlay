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
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/prisma ./prisma
RUN pnpm generate

COPY --from=builder /app/src ./src

EXPOSE $PORT

HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "const http=require('http');const req=http.request({host:'127.0.0.1',port:process.env.PORT||3000,path:'/health',timeout:2000},r=>{process.exit(r.statusCode===200?0:1)});req.on('error',()=>process.exit(1));req.end()"

CMD ["pnpm", "run", "docker:start"]
