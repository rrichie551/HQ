FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ---------- deps ----------
FROM base AS deps
COPY package.json package-lock.json* ./
# Skip optional deps — node-pty is optional because the bridge runs on the
# HOST (not in this container) and it's a native module needing Python +
# build tools. Installing it here would fail and isn't needed.
RUN npm install --no-audit --no-fund --omit=optional

# ---------- builder ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next.js treats /public as optional but the runner stage copies it
# unconditionally — ensure the directory exists even on fresh clones
# that have no static assets.
RUN mkdir -p /app/public
RUN npx prisma generate
RUN npm run build

# ---------- runner ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/next.config.js ./next.config.js
COPY --from=builder /app/package.json ./package.json

RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node --experimental-specifier-resolution=node -r ts-node/register/transpile-only server.ts"]
