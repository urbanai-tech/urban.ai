FROM node:20-alpine AS base
WORKDIR /app

# Etapa builder - instala dependências e builda
FROM base AS builder
RUN apk add --no-cache libc6-compat

# Variáveis NEXT_PUBLIC_* precisam estar disponíveis no build
# Railway injeta automaticamente os ARGs das env vars configuradas
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_CHAINLIT_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_CHAINLIT_URL=$NEXT_PUBLIC_CHAINLIT_URL

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
