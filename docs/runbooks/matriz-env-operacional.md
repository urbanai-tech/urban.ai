# Matriz Operacional de Variaveis - Urban AI

Data: 2026-05-22

Esta matriz consolida as variaveis encontradas no codigo e nos `.env.example`. Valores reais devem ficar apenas no provedor de deploy/CI. API keys podem ser configuradas depois, mas as variaveis marcadas como obrigatorias precisam existir antes de operar usuarios reais.

Adendo 2026-07-01: para handoff de novo dev, usar tambem `docs/handoff/ACCESS-SECRETS.md`. Nenhum valor real de secret deve ser copiado para docs, issues, PRs ou chats. Se alguma chave apareceu em chat antigo, tratar como exposta, rotacionar no provedor e compartilhar acesso pelo provedor ou cofre de senhas.

Status 2026-05-22: auto-apply Stays opera em fail-closed. O backend aceita os nomes operacionais `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`/`STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS` e os aliases canonicos `STAYS_AUTO_APPLY_USER_ALLOWLIST`/`STAYS_AUTO_APPLY_LISTING_ALLOWLIST`. Antes de preco real, registrar smoke em `docs/evidence/`.

Adendo 2026-05-26: para subir o roadmap total para 92-95%, tratar staging como ambiente separado e preencher somente chaves sandbox/test. O pacote minimo desta etapa e: `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `BREVO_API_KEY`, Stripe test keys/Price IDs, `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, usuarios/JWTs de gate autenticado e evidencia de outcomes/calibracao. Ver `docs/runbooks/integracoes-outcomes-calibracao-2026-05-26.md`.

## Backend (`urban-ai-backend-main`)

| Grupo | Variaveis | Obrigatoriedade |
| --- | --- | --- |
| Runtime | `APP_ENV`, `NODE_ENV`, `PORT` | `APP_ENV=production|staging|development` recomendado em todos os ambientes. |
| Banco | `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Obrigatorio. |
| Migrations | `DB_SYNCHRONIZE`, `MIGRATIONS_RUN` | Em prod: `DB_SYNCHRONIZE=false`; `MIGRATIONS_RUN=true` somente quando o deploy deve aplicar migrations no boot. |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `GOOGLE_CLIENT_ID`, `COOKIE_DOMAIN`, `CORS_ALLOWED_ORIGINS`, `FRONT_BASE_URL` | Obrigatorio. `JWT_SECRET` nao tem fallback seguro. `GOOGLE_CLIENT_ID` e obrigatorio se `/auth/google` estiver ativo. |
| Health/readiness | `HEALTH_READINESS_TOKEN`, opcional `HEALTH_READINESS_PUBLIC=false` | Obrigatorio em staging/prod para consultar `/health` detalhado. `/health/live` permanece publico. |
| Redis/filas | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` | Obrigatorio quando Bull/processos estiver ativo. |
| Observabilidade | `SENTRY_DSN` | Opcional em dev; recomendado/obrigatorio em staging/prod para operacao. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUCCESS_URL`, `CANCEL_URL`, price IDs `*_PLAN` e `*_PRICE_*` | Obrigatorio antes de checkout/assinaturas. Validar com `npm run preflight:track3:strict` e `/admin/pricing-config`. |
| Email | `BREVO_API_KEY`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL`; recomendado: `FRONT_URL`; opcional: `BREVO_API_BASE_URL` | Obrigatorio para reset, confirmacao e notificacoes transacionais. `FRONT_URL` tem fallback, mas precisa ser validado no smoke real de links. |
| Suporte/LGPD | `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `SUPPORT_OWNER_EMAIL`, `PRIVACY_OWNER_EMAIL` | Canais publicos tem fallback no app; owners operacionais precisam estar definidos antes de beta pago. Aparece em `/admin/dashboard` no Go-live Track 3. |
| Maps/eventos | `GOOGLE_MAPS_API_KEY`, `RAPIDAPI_KEY`, `GEMINI_API_KEY`, `AIRBNB_GRAPHQL_HASH`, `MAPBOX_TOKEN` | Obrigatorio conforme rota/integracao ativada. |
| Pricing | `PRICING_STRATEGY`, `PRICING_BOOTSTRAP_ON_BOOT` | Recomendado. Default atual cobre dev, mas prod deve ser explicito. |
| Stays | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, `STAYS_AUTO_APPLY_ENABLED`, `STAYS_AUTO_APPLY_DRY_RUN`, `STAYS_AUTO_APPLY_USER_ALLOWLIST`, `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` | `STAYS_TOKEN_ENCRYPTION_KEY` obrigatoria em staging/prod para criptografia em repouso. Auto-apply deve ficar desligado por default e so pode aplicar preco real depois de smoke documentado. |
| AskUrban | `ASK_URBAN_DAILY_QUOTA`, `ASK_URBAN_DAILY_HARD_CAP` | Recomendado para controlar uso diario. Entitlement de plano deve vir do backend, nao de env publica nem `localStorage`. |
| Waitlist | `PRELAUNCH_MODE`, `MARKETING_BASE_URL` | Conforme modo de lancamento. |

### Integracoes/outcomes - checklist staging 2026-05-26

| Bloco | Variaveis obrigatorias em staging | Evidencia esperada |
|---|---|---|
| Google Maps/Geocoding | `GOOGLE_MAPS_API_KEY` | `backfill:geocoder:dry` e execucao `LIMIT=5` sem `REQUEST_DENIED`. |
| Gemini | `GEMINI_API_KEY` | Recompute/enrichment controlado em evento fixture ou staging. |
| Brevo | `BREVO_API_KEY`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL`; recomendado `FRONT_URL` | E-mail de reset entregue em caixa de teste, sem segredo em log. |
| Stripe test | `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, `STARTER_PRICE_*`, `PROFISSIONAL_PRICE_*`, `SUCCESS_URL`, `CANCEL_URL` | `preflight:track3:strict` + checkout/webhook/quota/cancelamento em test mode. |
| Stays sandbox | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, `STAYS_AUTO_APPLY_DRY_RUN=true`, allowlists quando auto for testado | Connect/sync/push manual/rollback e auto dry-run. |
| Authenticated gates | `ENTERPRISE_GATE_HEALTH_TOKEN` ou `HEALTH_READINESS_TOKEN`; `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `E2E_HOST_EMAIL`, `E2E_HOST_PASSWORD` ou `ENTERPRISE_GATE_ADMIN_JWT`, `ENTERPRISE_GATE_HOST_JWT` | Release gate autenticado e enterprise read-only sem skip. |
| Events ingest staging | `ENTERPRISE_GATE_EVENTS_INGEST_KEY` ou `EVENTS_INGEST_API_KEY` | Ingest controlado apenas com `--allow-mutations` em staging. |
| Outcomes/calibracao | Sem secret novo; exige DB staging, usuarios e dados de `PricingDecisionSnapshot`/`occupancy_history` | Relatorio `pricing-outcome-calibration-report.ts` contra fixture ou DB staging read-only. |

### Stays auto-apply safety flags

| Variavel | Valor seguro default | Semantica operacional | Status 2026-05-22 |
|---|---|---|---|
| `STAYS_AUTO_APPLY_ENABLED` | `false` | Kill switch global. Qualquer valor diferente de `true` deve impedir aplicacao real. | Implementacao observada; validacao pendente |
| `STAYS_AUTO_APPLY_DRY_RUN` | `true` | Permite calcular candidatos e registrar resumo, mas sem chamar mutacao externa de preco. | Implementacao observada; validacao pendente |
| `STAYS_AUTO_APPLY_USER_ALLOWLIST` | vazio | CSV de `userId` liberados. Alias suportado de `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`. | Implementado; smoke prod pendente |
| `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` | vazio | CSV de `listingId` liberados. Alias suportado de `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS`. | Implementado; smoke prod pendente |

Aliases observados em codigo durante a releitura estatica:

- `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`
- `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS`

Recomendacao: preferir os nomes canonicos `*_ALLOWLIST` pedidos nesta matriz, ou manter aliases somente se estiverem documentados no runbook de Stays e cobertos por testes.

Regras esperadas:

- `STAYS_AUTO_APPLY_ENABLED` ausente ou `false`: registrar run como bloqueado/skipped e nao aplicar nada.
- `STAYS_AUTO_APPLY_DRY_RUN=true`: registrar candidatos e motivos, mas nao chamar `pushPrice`/mutacao Stays.
- Allowlists vazias em staging/prod: bloquear aplicacao real ate o operador preencher explicitamente.
- Mudanca de qualquer flag em producao exige evidencia de smoke anexada em `docs/evidence/`.

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

- Nunca promover ambiente com `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY` ou `STAYS_TOKEN_ENCRYPTION_KEY` vazios.
- Em producao, `DB_SYNCHRONIZE` deve permanecer `false`.
- `SENTRY_DSN` deve ser diferente por ambiente para nao misturar erros de staging e prod.
- Tokens Stays existentes em texto puro devem ser regravados apos configurar `STAYS_TOKEN_ENCRYPTION_KEY`; o transformer ainda le legado para permitir migracao gradual.
- `STAYS_AUTO_APPLY_ENABLED` deve permanecer `false` em producao ate os testes de default-off, dry-run e allowlist estarem aprovados.
- `STAYS_AUTO_APPLY_DRY_RUN` deve permanecer `true` durante o primeiro smoke com conta/listing allowlisted.
- `STAYS_AUTO_APPLY_USER_ALLOWLIST` e `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` devem ser revisados antes de cada ativacao real; nunca usar wildcard em beta privado.
- API keys externas podem ficar pendentes em dev/staging, desde que os fluxos dependentes nao sejam anunciados como prontos.
- `/health` detalhado em staging/prod exige `HEALTH_READINESS_TOKEN`; publicar readiness sem token expõe inventario operacional.
- Em staging Railway sem dominio proprio, usar `COOKIE_DOMAIN=none`; usar `.myurbanai.com` em host `*.railway.app` faz o browser rejeitar cookie e quebra login UI.
- Para Track 3, rodar `npm run preflight:track3` em `urban-ai-backend-main` antes de smoke manual.
