# Urban AI — Backend (NestJS)

API REST do produto. 21 módulos, motor KNN embedado, integração Stripe + Stays + Mailersend + Sentry.

## Stack

| Tecnologia | Uso |
|---|---|
| NestJS 10 | framework HTTP + DI |
| TypeORM 0.3 + mysql2 | persistência relacional |
| MySQL gerenciado pelo Railway | DB primário |
| BullMQ + Upstash Redis | filas (futuro: jobs assíncronos pesados) |
| Stripe SDK 18 | pagamentos + webhook assinado |
| Mailersend | e-mail transacional |
| Sentry NestJS | observabilidade |
| Passport JWT | auth |
| bcrypt(12) | hash de senhas |
| `@nestjs/throttler` + `helmet` | rate limit + CSP |
| `ml-knn` + `@turf/turf` | motor de precificação |

## Porta

`process.env.PORT` (default 10000 em dev).

## Setup local

```bash
yarn install
cp .env.example .env
# preencha JWT_SECRET, DATABASE_URL ou DB_*, STRIPE_SECRET_KEY, etc.
yarn start:dev
```

Para gerar um `JWT_SECRET` seguro:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Banco de dados

Por default (`DB_SYNCHRONIZE=true`) o TypeORM cria o schema sozinho a partir das entities — útil em dev, **não use em prod**. Em prod (futuro):

```bash
DB_SYNCHRONIZE=false MIGRATIONS_RUN=true yarn start:prod
```

Ver `../docs/runbooks/migrations-cutover.md` para o cutover seguro.

## Comandos úteis

```bash
yarn start:dev          # watch mode
yarn build              # nest build → dist/
yarn start:prod         # roda dist/main.js
yarn test               # jest unit (67 testes)
yarn test --coverage    # com coverage report
yarn lint               # eslint --fix

# migrations (após cutover)
yarn migration:generate --name=AddCampoXNaTabelaY
yarn migration:run
yarn migration:revert
yarn migration:show
```

## Estrutura

```
src/
├── auth/               # JWT + Google OAuth + refresh rotation
├── user/               # perfil, configurações
├── propriedades/       # imóveis + análise de preço (módulo grande)
├── evento/             # eventos scraped + enrichment Gemini
├── payments/           # Stripe checkout + webhook
├── plans/              # tiers (a expandir em F6.5)
├── notifications/      # in-app + email
├── connect/            # onboarding Airbnb
├── airbnb/             # client RapidAPI
├── stays/              # integração Stays (F6.4)
├── maps/               # Google Maps (geocoding, isochrones)
├── knn-engine/         # motor de precificação
├── cron/               # jobs agendados (08:00 BRT, hourly enrichment)
├── email/ + mailer/    # SendGrid (legado) + Mailersend
├── entities/           # 14 entities TypeORM
├── migrations/         # baseline + futuras migrations
├── data-source.ts      # CLI TypeORM
├── instrument.ts       # bootstrap Sentry (deve ser o primeiro import)
├── main.ts             # bootstrap + cookie-parser + helmet + CORS
└── app.module.ts       # módulo raiz
```

## API e Swagger

Swagger documentation em `/api`. Autenticação Bearer obrigatória nas rotas protegidas (também aceita cookie `urbanai_access_token` desde F5C.2 item #10).

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
| `MAILERSEND_API_KEY` | para email transacional |
| `RAPIDAPI_KEY` | para o módulo airbnb (até F6.4 substituir por Stays) |
| `GOOGLE_MAPS_API_KEY` | geocoding + isochrones |
| `GEMINI_API_KEY` | enrichment de eventos (cron hourly) |
| `STAYS_API_BASE_URL` | base URL Stays Open API |
| `CORS_ALLOWED_ORIGINS` | whitelist (sem fallback `*`) |
| `APP_ENV` | `production` ou `staging` ou `development` |

## Testes

67 testes unitários hoje. Stack: Jest + ts-jest. Cobertura ~10.6% global mas **fluxos críticos** (auth, payments, KNN, plans, stays) bem cobertos.

```bash
yarn test                                                       # todos
yarn test --testPathPatterns="auth.service|stays.service"      # filtro
yarn test --coverage                                            # com relatório
```

Plano de expansão em `../docs/runbooks/testing-strategy.md`.

## Deploy

Watch automático do Railway na branch `main`. Mudanças sobem em ~2min após push.

Health check: `GET /health` (a criar/verificar — usado pelo UptimeRobot).

## Troubleshooting

- **Backend não sobe + erro JWT_SECRET**: setar a env var no Railway / .env. Antes do F5C.2 item #10 caía no fallback `mysecretkey`; agora é fail-fast por segurança.
- **CORS bloqueia chamadas do front**: setar `CORS_ALLOWED_ORIGINS=https://app.myurbanai.com,https://urbanai.com.br` (separado por vírgula).
- **Stripe webhook 401**: o `STRIPE_WEBHOOK_SECRET` precisa ser exatamente o do endpoint configurado no Dashboard, não outro.
- **`@turf/turf` quebra teste com `Unexpected token 'export'`**: precisa `jest.mock('@turf/turf', () => ({ ... }))` no topo do spec — ver `pricing-engine.spec.ts` como referência.

## Documentação relacionada

- `../docs/runbooks/migrations-cutover.md`
- `../docs/runbooks/jwt-cookie-migration.md`
- `../docs/runbooks/stays-integration-setup.md`
- `../docs/adr/` — ADRs sobre as decisões arquiteturais
- `../docs/slo.md` — alvos operacionais
