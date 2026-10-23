# Urban AI — Backend (NestJS)

API REST do produto: módulos de domínio NestJS, motor de pricing (KNN embarcado), inteligência de eventos, integração Stripe + Stays + Brevo + Sentry.

> Estado de infra, ambientes e integrações: [`../docs/ARQUITETURA-ATUAL.md`](../docs/ARQUITETURA-ATUAL.md). Variáveis: [`../docs/runbooks/matriz-env-operacional.md`](../docs/runbooks/matriz-env-operacional.md). Revisado em 2026-10-23.

## Stack

| Tecnologia | Uso |
|---|---|
| NestJS 11 | framework HTTP + DI |
| TypeORM 0.3 + mysql2 | persistência relacional |
| MySQL gerenciado pelo Railway | DB primário |
| Bull v3 (`@nestjs/bull` + `bull`) + Upstash Redis | fila `processos` |
| Stripe SDK 18 | pagamentos + webhook assinado |
| Brevo | e-mail transacional |
| Sentry NestJS | observabilidade |
| Passport JWT | auth |
| bcrypt(12) | hash de senhas |
| `@nestjs/throttler` + `helmet` | rate limit + CSP |
| `ml-knn` + `@turf/turf` | motor de precificação |

## Porta

`process.env.PORT` (sem valor, o padrão é 8080; o `.env.example` usa `PORT=10000` para dev local).

## Setup local

```bash
npm ci
cp .env.example .env
# preencha JWT_SECRET, DATABASE_URL ou DB_*, REDIS_*, STRIPE_SECRET_KEY, etc.
npm run start:dev
```

O projeto usa **npm** (`package-lock.json`, igual ao CI e ao Dockerfile).

Para gerar um `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Banco de dados

`DB_SYNCHRONIZE` e `MIGRATIONS_RUN` são `false` por padrão (só ativam com o valor `true`). O schema é versionado por migrations em `src/migrations/`. `DB_SYNCHRONIZE=true` só em dev descartável, **nunca em prod**.

```bash
MIGRATIONS_RUN=true npm run start:prod   # aplica migrations no boot
npm run migration:run                    # ou aplica pela CLI
```

Ver `../docs/runbooks/migrations-cutover.md` para o cutover seguro.

## Comandos úteis

```bash
npm run start:dev          # watch mode
npm run build              # nest build → dist/
npm run start:prod         # roda dist/main.js
npm test                   # jest
npm run test:cov           # com coverage report
npm run lint               # eslint

# migrations
npm run migration:generate -- --name=AddCampoXNaTabelaY
npm run migration:run
npm run migration:revert
npm run migration:show
```

## Estrutura

```
src/
├── auth/               # JWT + Google OAuth + refresh rotation
├── user/               # perfil, configurações
├── propriedades/       # imóveis + análise de preço (módulo grande)
├── evento/             # eventos scraped + enrichment Gemini
├── payments/           # Stripe checkout + webhook
├── plans/              # tiers + matriz F6.5 de cobrança por imóvel
├── notifications/      # in-app + email
├── connect/            # onboarding Airbnb
├── airbnb/             # client RapidAPI
├── stays/              # integração Stays (F6.4)
├── maps/               # Google Maps (geocoding, isochrones)
├── knn-engine/         # motor de precificação
├── cron/               # jobs agendados (08:00 BRT, hourly enrichment)
├── email/ + mailer/    # Brevo transacional
├── entities/           # entities TypeORM
├── migrations/         # baseline + futuras migrations
├── data-source.ts      # CLI TypeORM
├── instrument.ts       # bootstrap Sentry (deve ser o primeiro import)
├── main.ts             # bootstrap + cookie-parser + helmet + CORS
└── app.module.ts       # módulo raiz
```

## API e Swagger

Swagger em `/api` (desligado quando `APP_ENV=production`, salvo `ENABLE_SWAGGER=true`). Autenticação Bearer obrigatória nas rotas protegidas (também aceita cookie `urbanai_access_token` desde F5C.2 item #10).

Endpoints novos relevantes:

- `POST /auth/refresh` — rotaciona refresh token (cookie httpOnly)
- `POST /auth/logout` — revoga refresh + limpa cookies
- `POST /stays/connect` — conecta conta Stays
- `POST /stays/listings/sync` — sincroniza listings da Stays
- `POST /stays/price/push` — push manual de preço
- `POST /stays/price/:id/rollback` — reverte um push

## Variáveis de ambiente críticas

Ver `.env.example` para a lista completa. As essenciais:

| Var | Quando |
|---|---|
| `JWT_SECRET` | sempre — backend não sobe sem |
| `DATABASE_URL` ou `DB_HOST/PORT/USER/PASSWORD/NAME` | sempre |
| `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | para o módulo payments |
| `BREVO_API_KEY` | para email transacional |
| `RAPIDAPI_KEY` | para o módulo airbnb (até F6.4 substituir por Stays) |
| `GOOGLE_MAPS_API_KEY` | geocoding + isochrones |
| `GEMINI_API_KEY` | enrichment de eventos (cron hourly) |
| `STAYS_API_BASE_URL` | base URL Stays Open API |
| `CORS_ALLOWED_ORIGINS` | whitelist (sem fallback `*`) |
| `APP_ENV` | `production` ou `staging` ou `development` |

## Testes

Stack: Jest + ts-jest, specs ao lado do código (`*.spec.ts`). O CI exige 90% de cobertura nos módulos críticos certificados (`npm run test:coverage:certified`). Não fixe contagem de testes em docs; ela muda a cada PR.

```bash
npm test                                                        # todos
npm test -- --testPathPatterns="auth.service|stays.service"     # filtro
npm run test:cov                                                # com relatório
```

Plano de expansão em `../docs/runbooks/testing-strategy.md`.

## Deploy

Railway faz build pelo `Dockerfile` (Node 20) a partir da `main` (produção) e da branch de staging. Produção responde no domínio de serviço Railway; ainda não existe `api.myurbanai.com` (ver pendências em `../docs/ARQUITETURA-ATUAL.md`).

Health: `GET /health/live` (liveness público) e `GET /health` (detalhado, exige `HEALTH_READINESS_TOKEN` fora de dev).

## Troubleshooting

- **Backend não sobe + erro JWT_SECRET**: setar a env var no Railway / .env. Antes do F5C.2 item #10 caía no fallback `mysecretkey`; agora é fail-fast por segurança.
- **CORS bloqueia chamadas do front**: setar `CORS_ALLOWED_ORIGINS=https://app.myurbanai.com,https://myurbanai.com` (separado por vírgula; incluir os hosts de staging no ambiente de staging).
- **Stripe webhook 401**: o `STRIPE_WEBHOOK_SECRET` precisa ser exatamente o do endpoint configurado no Dashboard, não outro.
- **`@turf/turf` quebra teste com `Unexpected token 'export'`**: precisa `jest.mock('@turf/turf', () => ({ ... }))` no topo do spec — ver `pricing-engine.spec.ts` como referência.

## Documentação relacionada

- `../docs/runbooks/migrations-cutover.md`
- `../docs/runbooks/jwt-cookie-migration.md`
- `../docs/runbooks/f65-pricing-100pc.md`
- `../docs/runbooks/stripe-billing-smoke.md`
- `../docs/runbooks/stays-integration-setup.md`
- `../docs/adr/` — ADRs sobre as decisões arquiteturais
- `../docs/ops/slo.md` — alvos operacionais
