FROM node:20-alpine AS base
WORKDIR /app

# Etapa builder - instala dependências e builda
FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa final para produção
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

# Railway injeta PORT automaticamente - não hardcodar
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
