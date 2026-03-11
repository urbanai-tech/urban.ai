FROM node:24-alpine AS base
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

# A linha abaixo já estava correta, mas a explicação é importante:
# Ela copia todos os node_modules, incluindo os binários necessários.
COPY --from=builder /app/node_modules ./node_modules 

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Altere a linha CMD para usar "node server.js" que é o ponto de entrada 
# gerado pelo Next.js no modo standalone, ou garantir que o PATH seja configurado.
# Opção 1: Usar node server.js (Recomendado para standalone)
CMD ["node", "server.js"]

# Opção 2: Se não estiver usando standalone, garantir que npm esteja no PATH do usuário
# CMD ["npm", "start"] 
# Para esta opção, você pode precisar adicionar algo como:
# ENV PATH="/app/node_modules/.bin:$PATH" 
# ou garantir que o npm esteja instalado globalmente para o usuário nextjs (menos ideal)
