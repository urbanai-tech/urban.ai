# Matriz Operacional de Variaveis - Urban AI

Data: 2026-05-13

Esta matriz consolida as variaveis encontradas no codigo e nos `.env.example`. Valores reais devem ficar apenas no provedor de deploy/CI. API keys podem ser configuradas depois, mas as variaveis marcadas como obrigatorias precisam existir antes de operar usuarios reais.

## Backend (`urban-ai-backend-main`)

| Grupo | Variaveis | Obrigatoriedade |
| --- | --- | --- |
| Runtime | `APP_ENV`, `NODE_ENV`, `PORT` | `APP_ENV=production|staging|development` recomendado em todos os ambientes. |
| Banco | `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Obrigatorio. |
| Migrations | `DB_SYNCHRONIZE`, `MIGRATIONS_RUN` | Em prod: `DB_SYNCHRONIZE=false`; `MIGRATIONS_RUN=true` somente quando o deploy deve aplicar migrations no boot. |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `COOKIE_DOMAIN`, `CORS_ALLOWED_ORIGINS`, `FRONT_BASE_URL` | Obrigatorio. `JWT_SECRET` nao tem fallback seguro. |
| Redis/filas | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` | Obrigatorio quando Bull/processos estiver ativo. |
| Observabilidade | `SENTRY_DSN` | Opcional em dev; recomendado/obrigatorio em staging/prod para operacao. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUCCESS_URL`, `CANCEL_URL`, price IDs `*_PLAN` e `*_PRICE_*` | Obrigatorio antes de checkout/assinaturas. Validar com `npm run preflight:track3:strict` e `/admin/pricing-config`. |
| Email | `MAILERSEND_API_KEY`, `EMAIL_SENDER`, `RESET_PASS_URL`, `MAILERSEND_DOMAIN_ID`; recomendado: `FRONT_URL`; legado: `SENDGRID_API_KEY`, `EMAIL_*` | Obrigatorio para reset, confirmacao e notificacoes transacionais. `FRONT_URL` tem fallback, mas precisa ser validado no smoke real de links. |
| Suporte/LGPD | `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `SUPPORT_OWNER_EMAIL`, `PRIVACY_OWNER_EMAIL` | Canais publicos tem fallback no app; owners operacionais precisam estar definidos antes de beta pago. Aparece em `/admin/dashboard` no Go-live Track 3. |
| Maps/eventos | `GOOGLE_MAPS_API_KEY`, `RAPIDAPI_KEY`, `GEMINI_API_KEY`, `AIRBNB_GRAPHQL_HASH`, `MAPBOX_TOKEN` | Obrigatorio conforme rota/integracao ativada. |
| Pricing | `PRICING_STRATEGY`, `PRICING_BOOTSTRAP_ON_BOOT` | Recomendado. Default atual cobre dev, mas prod deve ser explicito. |
| Stays | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY` | `STAYS_TOKEN_ENCRYPTION_KEY` obrigatoria em staging/prod para criptografia em repouso. |
| Waitlist | `PRELAUNCH_MODE`, `MARKETING_BASE_URL` | Conforme modo de lancamento. |

## Frontend (`Urban-front-main`)

| Grupo | Variaveis | Obrigatoriedade |
| --- | --- | --- |
| Runtime publico | `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL` | Obrigatorio por ambiente. |
| Auth social | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Obrigatorio se Google/NextAuth estiver ativo. |
| Stripe | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Obrigatorio para checkout/paywall. Nunca usar `sk_*` no front. |
| Observabilidade | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` | DSN recomendado em prod; token apenas em CI/build para sourcemaps. |
| Analytics | `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Opcional; ativar apenas em prod. |
| Copilot | `NEXT_PUBLIC_CHAINLIT_URL` | Obrigatorio se Chainlit estiver habilitado. |
| Waitlist | `NEXT_PUBLIC_WAITLIST_ENDPOINT`, `NEXT_PUBLIC_PRELAUNCH_MODE` | Conforme pre-lancamento. |
| E2E | `E2E_BASE_URL`, `CI` | CI/testes. |

## Webscraping (`urban-webscraping-main`)

| Grupo | Variaveis | Obrigatoriedade |
| --- | --- | --- |
| Auth proxy | `PORT`, `SCRAPYD_API_KEY` | Obrigatorio para endpoint publico de crawl. |
| AWS/S3 | `ASSUME_ROLE_ARN`, `ASSUME_ROLE_EXTERNAL_ID` ou `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `S3_BUCKET` | Obrigatorio para persistencia bronze. Preferir assume-role. |
| Coletores | `TICKETMASTER_API_KEY`, `API_FOOTBALL_KEY`, `SERPAPI_KEY`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`, `GEMINI_API_KEY`, `SP_CULTURA_API_BASE`, `SP_CULTURA_LOOKAHEAD_DAYS` | Obrigatorio apenas para os coletores correspondentes. |
| Ingest backend | `URBAN_API_BASE`, `URBAN_COLLECTOR_EMAIL`, `URBAN_COLLECTOR_PASSWORD` | Obrigatorio se a pipeline enviar eventos para o backend. |
| Diagnostico | `LOG_LEVEL`, `DRY_RUN`, `SCRAPE_URL` | Opcional. |

## Pipeline (`urban-pipeline-main`)

| Grupo | Variaveis | Obrigatoriedade |
| --- | --- | --- |
| Orquestracao | `PREFECT_SERVER_URL`, secrets Prefect `mysql-bronze-url`, `aws-access-key-id`, `aws-secret-access-key`, `aws-assume-role-arn`, `aws-assume-role-external-id` | Obrigatorio para deploy Prefect. |
| Banco bronze | `DATABASE_URL` | Obrigatorio em execucao real; testes usam SQLite. |
| Scrapyd | `WEBSCRAPPING_API_URL`, `SCRAPYD_URL` | Obrigatorio para disparar crawls. |
| AWS/S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_REGION`, `S3_BUCKET_NAME`, `ASSUME_ROLE_ARN`, `ASSUME_ROLE_EXTERNAL_ID` | Obrigatorio para leitura/escrita do data lake. |

## Regras de Operacao

- Nunca promover ambiente com `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `MAILERSEND_API_KEY` ou `STAYS_TOKEN_ENCRYPTION_KEY` vazios.
- Em producao, `DB_SYNCHRONIZE` deve permanecer `false`.
- `SENTRY_DSN` deve ser diferente por ambiente para nao misturar erros de staging e prod.
- Tokens Stays existentes em texto puro devem ser regravados apos configurar `STAYS_TOKEN_ENCRYPTION_KEY`; o transformer ainda le legado para permitir migracao gradual.
- API keys externas podem ficar pendentes em dev/staging, desde que os fluxos dependentes nao sejam anunciados como prontos.
- Para Track 3, rodar `npm run preflight:track3` em `urban-ai-backend-main` antes de smoke manual.
