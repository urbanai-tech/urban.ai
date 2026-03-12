FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --production

COPY . .

# Railway injeta PORT automaticamente
ENV NODE_ENV=production

CMD ["node", "server.js"]
