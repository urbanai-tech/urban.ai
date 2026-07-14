FROM node:20-alpine AS builder
WORKDIR /usr/src/app
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/scripts/repair-staging-schema.js ./scripts/repair-staging-schema.js
COPY --from=builder /usr/src/app/scripts/provision-staging-smoke-users.js ./scripts/provision-staging-smoke-users.js
COPY --from=builder /usr/src/app/scripts/staging-auth-fixtures.js ./scripts/staging-auth-fixtures.js
EXPOSE 8080
CMD ["sh", "-c", "node scripts/repair-staging-schema.js && node scripts/provision-staging-smoke-users.js && node dist/main"]
