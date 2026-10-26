# Matriz operacional de variáveis — Urban AI

**Data:** 2026-10-23 · **Owner:** Engenharia · **Status:** Canônico
**Última validação:** 2026-10-23, por varredura de `process.env` / `ConfigService.get` (backend), `process.env` (frontend) e `os.environ` / `os.getenv` / `pydantic-settings` (Python). **Próxima revisão:** a cada PR que adicione ou remova variável.
**Relação:** topologia em [`../ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md); acessos em [`../ACESSOS-E-FERRAMENTAS.md`](../ACESSOS-E-FERRAMENTAS.md). Versão anterior (2026-05-22) preservada no histórico do Git.

> **Somente nomes.** Nenhum valor real entra aqui, em issues, PRs ou chats. Um dos remotos é público.

**Legenda:** **Obr.** = obrigatória no ambiente indicado · **Cond.** = obrigatória se a funcionalidade estiver ativa · **Opc.** = opcional/tuning.
**Onde configurar:** **RW-api** = variáveis do serviço backend no Railway · **RW-front** = serviço frontend no Railway (as `NEXT_PUBLIC_*` são lidas **no build**) · **RW-scrap** = serviço de webscraping no Railway · **PF** = Prefect (Secret block ou env do worker) · **GH-sec / GH-var** = GitHub Secrets / Variables do repositório canônico `urbanai-tech/urban.ai`.

---

## 1. Backend (`urban-ai-backend-main`) — onde: RW-api

### Runtime e infraestrutura

| Variáveis | Req. | Notas |
|---|---|---|
| `APP_ENV`, `NODE_ENV`, `PORT`, `APP_VERSION` | `APP_ENV` Obr. em staging/prod | `APP_ENV` define ambiente (Sentry, regras de produção). `PORT` é injetada pelo Railway. |
| `DATABASE_URL` **ou** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Obr. | Fora de dev local, `DB_*` sem valor derruba o boot. |
| `DB_SYNCHRONIZE`, `MIGRATIONS_RUN`, `TYPEORM_SCHEMA_LOGGING` | Opc. | Padrão `false`. Em produção manter `DB_SYNCHRONIZE=false`. |
| `DB_TIMEZONE` | Opc. | Fuso da conexão MySQL (opção `timezone` do driver). Sem valor = default do driver (TZ do processo). Recomendado `Z` depois de confirmar que o processo roda em UTC; ver [datas e fuso horário](./datas-e-fuso-horario.md). |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` | Obr. fora de dev | Upstash. Bull v3 (`@nestjs/bull`), fila `processos`. |
| `INTERNAL_HTTP_BASE_URL` | Opc. | Base do `HttpModule`; cai em `FRONT_BASE_URL`. |
| `ENABLE_SWAGGER` | Opc. | Swagger em `/api` fica desligado em produção salvo `true`. |
| `SENTRY_DSN` | Obr. em staging/prod (operacional) | DSN diferente por ambiente. |

### Auth, sessão, CORS e health

| Variáveis | Req. | Notas |
|---|---|---|
| `JWT_SECRET`, `JWT_EXPIRES_IN` | `JWT_SECRET` Obr. | Sem fallback: o backend não sobe sem ele. |
| `GOOGLE_CLIENT_ID` (aliases aceitos: `GOOGLE_OAUTH_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) | Cond. (login Google) | Usado para validar o `aud` do idToken. |
| `COOKIE_DOMAIN`, `COOKIE_SAME_SITE` | Obr. em prod | Em host `*.railway.app` (staging) usar `COOKIE_DOMAIN=none`. |
| `CORS_ALLOWED_ORIGINS` | Obr. | Whitelist separada por vírgula; sem fallback `*`. |
| `FRONT_BASE_URL`, `FRONT_URL` | Obr. | Links em e-mails e redirects. |
| `HEALTH_READINESS_TOKEN`, `HEALTH_READINESS_PUBLIC`, `ENTERPRISE_GATE_HEALTH_TOKEN` | Obr. em staging/prod | `/health` detalhado exige token; `/health/live` é público. |
| `EMAIL_CONFIRMATION_CODE_SECRET`, `EMAIL_CONFIRMATION_MAX_ATTEMPTS`, `EMAIL_CONFIRMATION_LOCKOUT_MINUTES`, `EMAIL_PUBLIC_RESPONSE_MIN_MS`, `EMAIL_PUBLIC_RESPONSE_JITTER_MS` | Secret Obr. em produção | Demais são tuning. |

### Billing (Stripe)

| Variáveis | Req. | Notas |
|---|---|---|
| `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET` | Obr. para cobrança | Webhook em `POST /payments/webhook`. |
| `SUCCESS_URL`, `CANCEL_URL`, `BILLING_PORTAL_RETURN_URL`, `TRIAL_PERIOD_DAYS` | Obr. / Opc. | URLs obrigatórias com checkout ativo. |
| `SUBSCRIPTION_GRACE_DAYS` (padrão `3`), `ALPHA_USER_QUOTAS` | Opc. | Acesso pago no backend (`SubscriptionGuard`, 402 `SUBSCRIPTION_REQUIRED`): `SUBSCRIPTION_GRACE_DAYS` = carência para `past_due`/webhook atrasado; `ALPHA_USER_QUOTAS` (`email_ou_id:cota,...`) = gratuidade explícita. Política por rota em `src/subscription/subscription-policy.ts`. |
| `STARTER_PRICE_MONTHLY`, `STARTER_PRICE_QUARTERLY`, `STARTER_PRICE_SEMESTRAL`, `STARTER_PRICE_ANNUAL`, `PROFISSIONAL_PRICE_MONTHLY`, `PROFISSIONAL_PRICE_QUARTERLY`, `PROFISSIONAL_PRICE_SEMESTRAL`, `PROFISSIONAL_PRICE_ANNUAL`, `PROFISSIONAL_PLUS_PRICE_MONTHLY` | Obr. para cobrança | Price IDs da matriz por ciclo. Validar com `npm run preflight:track3:strict`. |
| Legados: `MENSAL_PLAN`, `ANUAL_PLAN`, `STARTER_MENSAL_PLAN`, `STARTER_ANUAL_PLAN`, `PROFISSIONAL_MENSAL_PLAN`, `PROFISSIONAL_ANUAL_PLAN` | Opc. | Fallback do resolver de Price IDs. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Opc. | Lida também pelo backend em diagnóstico. |

### E-mail, suporte e LGPD (Brevo)

| Variáveis | Req. | Notas |
|---|---|---|
| `BREVO_API_KEY`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL` | Obr. | Reset de senha, confirmação, notificações. |
| `BREVO_API_BASE_URL`, `WAITLIST_SIGNUP_EMAIL_DISABLED` | Opc. | |
| `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `SUPPORT_OWNER_EMAIL`, `PRIVACY_OWNER_EMAIL`, `ADMIN_ALERT_EMAIL`, `OPS_ALERT_EMAIL` | Obr. antes de beta pago | O domínio não tem MX hoje: caixas `@myurbanai.com` não recebem e-mail (ver pendências na arquitetura). |

### Mapas, IA e dados de mercado

| Variáveis | Req. | Notas |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Cond. | Geocoding e distâncias. |
| `GEMINI_API_KEY` | Cond. | Enrichment de eventos. |
| `RAPIDAPI_KEY` | Cond. | Dados de anúncios Airbnb. |
| `AIRBNB_GRAPHQL_HASH`, `AIRBNB_PRICE_PROVIDER`, `AIRBNB_PRICE_STRATEGY`, `AIRBNB_PRICE_SCRAPER_URL`, `AIRBNB_ROOM_INFO_URL`, `AIRBNB_PRICE_FALLBACK_API_ENABLED`, `AIRBNB_HEADLESS_SCRAPER_ENABLED`, `AIRBNB_HEADLESS_TIMEOUT_MS`, `AIRBNB_HEADLESS_PROFILE_VERIFY_LIMIT`, `AIRBNB_HEADLESS_VERIFY_HOST_LISTINGS`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Opc. | Estratégia de coleta de preços (o Dockerfile já define o caminho do Chromium). |
| `AIRROI_API_KEY` | Opc. | Coleta de dataset de mercado. |
| `SERPAPI_KEY`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`, `API_FOOTBALL_KEY` | Opc. | No backend servem só para o painel de saúde dos coletores (presença); o uso real é no webscraping. |

### Eventos, pricing e jobs

| Variáveis | Req. | Notas |
|---|---|---|
| `EVENTS_INGEST_API_KEY` | Obr. se houver coleta | Valida o header `x-urban-events-ingest-key` em `POST /events/ingest`. Mesmo valor de `URBAN_EVENTS_INGEST_API_KEY` no webscraping. |
| `COLLECTOR_ZERO_YIELD_ENABLED`, `COLLECTOR_ZERO_YIELD_WINDOW_HOURS`, `COLLECTOR_ZERO_YIELD_BASELINE_DAYS`, `COLLECTOR_ZERO_YIELD_MIN_BASELINE_ITEMS`, `COLLECTOR_ZERO_YIELD_IGNORE_SOURCES`, `COLLECTOR_ZERO_YIELD_SOURCE_WINDOWS`, `COLLECTOR_ZERO_YIELD_REALERT_HOURS` | Opc. | Detector de fonte de eventos que caiu a zero (cron `collector-zero-yield`, a cada 6 h). Padrões: ligado, janela 36 h, baseline 14 dias / mín. 5 itens, ignora `admin-*` e `marcha-para-jesus`, re-alerta a cada 24 h. Alerta no painel `/admin/collectors-health`, Sentry e e-mail (`ADMIN_ALERT_EMAIL`/`OPS_ALERT_EMAIL`). Detalhes em [coletores sem dados](./coletores-zero-yield.md). |
| `EVENT_INTELLIGENCE_BACKFILL_CRON_ENABLED`, `EVENT_INTELLIGENCE_BACKFILL_CRON_LIMIT`, `EVENT_INTELLIGENCE_BACKFILL_LOOKAHEAD_DAYS` | Opc. | |
| `WEEKLY_EVENT_REPORT_ENABLED`, `WEEKLY_EVENT_REPORT_EVENTS_PER_PROPERTY`, `WEEKLY_EVENT_REPORT_LOOKAHEAD_DAYS` | Opc. | Resumo semanal por anfitrião (segunda 08:30 BRT): semana passada + eventos + lembrete de resultados. Ver [relatório semanal e resultados do beta](./beta-relatorio-e-resultados.md). |
| `OUTCOMES_COMPARISON_MIN_SAMPLE` | Opc. | Amostra mínima (recomendações com v1, v2 e resultado) para a tela `/admin/outcomes` mostrar conclusões. Padrão `30`; abaixo disso só contagens. |
| `PRICING_STRATEGY`, `PRICING_BOOTSTRAP_ON_BOOT`, `PRICING_ALPHA_REPROCESS_ENABLED`, `PRICING_DIGEST_SWEEP_ENABLED`, `PRICING_DIGEST_SWEEP_LIMIT`, `PRICING_DIGEST_EMAIL_DELAY_MS`, `PRICING_FALLBACK_WARN_INTERVAL_MS`, `PRICING_SHADOW_WARN_INTERVAL_MS` | Recomendado explícito em prod | `PRICING_STRATEGY` padrão `adaptive`. |
| `PRICING_ENGINE_V2`, `PRICING_KNN_K`, `PRICING_V2_MAX_DECREASE_PERCENT`, `PRICING_V2_MAX_INCREASE_PERCENT`, `PRICING_V2_NO_EVENT_ADJUSTMENT_PERCENT`, `PRICING_V2_HIGH_ATTRACTIVITY_UPLIFT_PERCENT`, `PRICING_V2_MEDIUM_ATTRACTIVITY_UPLIFT_PERCENT`, `PRICING_GEMINI_MAX_UPLIFT_PERCENT`, `PRICING_GEMINI_MIN_CONFIDENCE` | Opc. | `PRICING_ENGINE_V2` padrão `shadow` (responde v1, calcula v2 em sombra); `true` liga o v2, que pode reduzir preço. Padrões e riscos em [motor de preço](./motor-de-preco.md). |
| `UNSUBSCRIBE_TOKEN_SECRET` | Opc. (fallback: derivado de `JWT_SECRET`) | Segredo HMAC dos links de descadastro (`List-Unsubscribe`); exige também `API_URL` (URL pública do backend). Sem segredo/URL, e-mails não transacionais saem sem o header. |
| `MARKET_INTEL_MIN_GROUP_SIZE` | Opc. (default 5, piso 3) | Mínimo de anfitriões distintos para o Market Intel devolver agregados; abaixo disso retorna "dados insuficientes". |
| `ASK_URBAN_ALLOWED_PLANS`, `ASK_URBAN_DAILY_QUOTA`, `ASK_URBAN_DAILY_HARD_CAP`, `ASK_URBAN_DAILY_QUOTA_PROFISSIONAL`, `ASK_URBAN_DAILY_HARD_CAP_PROFISSIONAL`, `ALPHA_USER_QUOTAS` | Opc. | Entitlement vem do backend, nunca de env pública. |
| `LAUNCH_MODE`, `PRELAUNCH_MODE` | Opc. | Modo de lançamento/waitlist. |

### Push (PWA)

| Variáveis | Req. | Notas |
|---|---|---|
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY`, `WEB_PUSH_SUBJECT` | Cond. | Sem elas, web push fica desativado. |

### Stays

| Variáveis | Req. | Notas |
|---|---|---|
| `STAYS_API_BASE_URL` | Cond. | Base da Stays Open API. |
| `STAYS_TOKEN_ENCRYPTION_KEY` | Obr. em staging/prod | Sem ela, gravar/ler tokens Stays lança erro. |
| `STAYS_AUTO_APPLY_ENABLED` (padrão seguro `false`), `STAYS_AUTO_APPLY_DRY_RUN` (padrão seguro `true`) | Opc. | Kill switch e dry-run do auto-apply (fail-closed). |
| `STAYS_AUTO_APPLY_USER_ALLOWLIST`, `STAYS_AUTO_APPLY_LISTING_ALLOWLIST` (aliases: `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`, `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS`) | Cond. | CSV; vazias bloqueiam aplicação real. Sem wildcard. |
| `STAYS_AUTO_APPLY_COHORT`, `STAYS_AUTO_APPLY_REQUIRE_LIVE_ALLOWLISTS`, `STAYS_AUTO_APPLY_REQUIRE_PRICING_DECISION`, `STAYS_AUTO_APPLY_MIN_CONFIDENCE`, `STAYS_AUTO_APPLY_MIN_BOOKING_PROBABILITY`, `STAYS_AUTO_APPLY_MIN_RECOMMENDED_MULTIPLIER`, `STAYS_AUTO_APPLY_MAX_RECOMMENDED_MULTIPLIER`, `STAYS_AUTO_APPLY_BLOCKED_RISK_FLAGS` | Opc. | Guardrails adicionais. Mudança em produção exige evidência em `docs/evidence/`. |

Removidas desta matriz por não serem lidas no código do backend: `MAPBOX_TOKEN`, `MARKETING_BASE_URL`.

---

## 2. Frontend (`Urban-front-main`) — onde: RW-front

| Variáveis | Req. | Notas |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Obr. | Hoje aponta para o domínio de serviço Railway do backend. Embutida no build. |
| `NEXT_PUBLIC_APP_ENV` (alias legado lido: `NEXT_PUBLIC_ENV`) | Obr. | `production` / `staging` / `development`; ativa banner de staging e ambiente do Sentry. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_PUBLIC_SITE_URL` | Obr. (APP/MARKETING) | URLs canônicas, SEO e redirects entre hosts. |
| `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Cond. (login Google) | `NEXTAUTH_URL` é lida pela biblioteca NextAuth. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Obr. com checkout | Nunca chave secreta no front. |
| `NEXT_PUBLIC_SENTRY_DSN`; `SENTRY_AUTH_TOKEN` | DSN recomendado; token só no build | Token apenas para upload de sourcemaps. |
| `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` | Opc. | Vazias = scripts não carregam. |
| `NEXT_PUBLIC_WAITLIST_ENDPOINT`, `NEXT_PUBLIC_PRELAUNCH_MODE` | Opc. | Pré-lançamento. |
| `NEXT_PUBLIC_CHAINLIT_URL` | Opc. | Vazia = rewrites do copilot omitidos. |
| `NEXT_PUBLIC_ADMIN_ALPHA_DEFAULT_EMAIL`, `NEXT_PUBLIC_ENABLE_CONTRACT_FALLBACK` | Opc. | Utilidades de admin/contrato. |
| `SEO_GSC_SITE_URL`, `SEO_GA4_PROPERTY_ID`, `SEO_GOOGLE_CLIENT_EMAIL`, `SEO_GOOGLE_PRIVATE_KEY`, `SEO_BOT_LOG_ENDPOINT`, `SEO_BOT_LOG_TOKEN`, `SEO_BOT_LOG_SOURCE`, `SEO_BOT_LOG_LOCAL_PATH`, `SEO_AI_MONITOR_ENDPOINT`, `SEO_AI_MONITOR_API_KEY`, `SEO_AI_MONITOR_SOURCE`, `SEO_AI_MONITOR_DATASET_PATH` | Opc. | Conectores server-side do painel SEO/GEO. |

**E2E / CI do frontend** (GH-sec / GH-var; local em `.env.local`): `E2E_BASE_URL`, `E2E_API_URL`, `E2E_TARGET_ENV`, `E2E_AUDIT_MODE`, `E2E_ALLOW_PRODUCTION_AUDIT`, `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_ALPHA_EMAIL`, `E2E_HEALTH_PATH`, `E2E_HOST`, `E2E_PORT`, `E2E_VIEWPORT`, `E2E_OUTPUT_DIR`, `E2E_KEEP_NEXT_CACHE`, `E2E_*_TIMEOUT_MS`, `DESIGN_DEBT_REASON`, `CI`.

---

## 3. Webscraping (`urban-webscraping-main`) — onde: RW-scrap

| Variáveis | Req. | Notas |
|---|---|---|
| `PORT`, `SCRAPYD_API_KEY` | Obr. | `auth_proxy.py` exige a chave para disparar crawls. |
| `COLLECTOR_CRON_INTERVAL_SECONDS` (padrão 21600 = 6 h), `RUN_COLLECTORS_ON_BOOT` (padrão `true`), `RUN_LEGACY_SPIDERS`, `MIN_SUCCESSFUL_COLLECTORS`, `SCRAPYD_URL`, `SCRAPYD_PROJECT` | Opc. | Cron interno dos coletores e runner agregado. |
| `URBAN_API_BASE` | Obr. | Base do backend (hoje o domínio de serviço Railway). |
| `URBAN_EVENTS_INGEST_API_KEY` | Obr. | Enviada em `x-urban-events-ingest-key`; igual a `EVENTS_INGEST_API_KEY` do backend. É a ÚNICA credencial que habilita a `UrbanIngestPipeline` (spiders) e os coletores. Em produção, sem ela a pipeline loga ERROR e marca a stat `urban_ingest/misconfigured`; `run_all` sai com código 1. |
| `URBAN_INGEST_OUTBOX_PATH` | Obr. em produção | Arquivo SQLite da fila de entrega (WAL). **O Railway precisa de um volume persistente montado neste caminho** (ex.: volume em `/var/lib/scrapyd` e `URBAN_INGEST_OUTBOX_PATH=/var/lib/scrapyd/dbs/ingest-outbox.sqlite3`); sem volume, eventos pendentes se perdem no redeploy. Padrão: `/var/lib/scrapyd/dbs/ingest-outbox.sqlite3` se o diretório existir, senão `.urban-ingest/outbox.sqlite3`. Não compartilhar entre hosts (NFS). |
| `URBAN_INGEST_OUTBOX_MAX_EVENTS` | Opc. | Teto de eventos pendentes (padrão 50000). Ao estourar, os mais antigos vão para a quarentena com motivo `outbox_cap_exceeded` e há log ERROR. |
| `URBAN_COLLECTOR_EMAIL`, `URBAN_COLLECTOR_PASSWORD` | **Removidas** | O login JWT legado foi removido do webscraping em 2026-10-25; podem ser apagadas do serviço. Não têm mais efeito. |
| `URBAN_COLLECTOR_NAME`, `URBAN_COLLECTOR_VERSION`, `URBAN_INGEST_RUN_ID` | Opc. | Metadados de auditoria. |
| `TICKETMASTER_API_KEY`, `API_FOOTBALL_KEY`, `SERPAPI_KEY`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`, `GEMINI_API_KEY` | Cond. | Uma por coletor; Firecrawl/Tavily também precisam de `GEMINI_API_KEY`. |
| `SP_CULTURA_API_BASE`, `SP_CULTURA_LOOKAHEAD_DAYS`, `SERPAPI_QUERY`, `FIRECRAWL_QUERY`, `TAVILY_QUERY` | Opc. | Tuning de coletores. |
| `ASSUME_ROLE_ARN`, `ASSUME_ROLE_EXTERNAL_ID` | Legado | Só usados pelas pipelines S3, hoje **comentadas** em `settings.py`. |
| `LOG_LEVEL`, `DRY_RUN` | Opc. | Diagnóstico. |

---

## 4. Pipeline (`urban-pipeline-main`) — onde: PF (+ env do worker)

| Variáveis | Req. | Notas |
|---|---|---|
| `PREFECT_API_URL`, `PREFECT_API_KEY` | Obr. | Lidas pelo cliente Prefect. **Não** é `PREFECT_SERVER_URL` (nome antigo ainda presente em `.env.example` do pipeline — corrigir no código). |
| `WEBSCRAPPING_API_URL` (vira `SCRAPYD_URL` no `serve.py`), `SCRAPYD_API_KEY` | Obr. | Disparo dos spiders no Scrapyd protegido. |
| Secret blocks `mysql-bronze-url`, `aws-access-key-id`, `aws-secret-access-key`, `aws-assume-role-arn`, `aws-assume-role-external-id` | Legado | Carregados pelo `serve.py` para o flow `raw_data_extraction_and_dump` (S3 → MySQL), hoje sem dados novos porque o bronze está desligado. |
| `DATABASE_URL`, `MYSQL_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`, `ASSUME_ROLE_ARN`, `ASSUME_ROLE_EXTERNAL_ID`, `ROLE_SESSION_NAME` | Legado | Mesmo flow legado. |

---

## 5. GitHub Actions (repositório canônico) — onde: GH-sec / GH-var

| Workflow | Secrets | Variables |
|---|---|---|
| `backup-db.yml` (diário 03:00 UTC) | `DATABASE_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET` (ou `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`), `SLACK_BACKUP_WEBHOOK` | `BACKUP_MIN_BYTES`, `BACKUP_MIN_TABLES` |
| `restore-drill.yml` (manual) | `AWS_*`, `S3_BUCKET` | `RESTORE_MAX_BACKUP_AGE_HOURS` |
| `ci.yml` / `release-gate.yml` (smoke, auditoria, gates enterprise) | `E2E_*` (e-mails/senhas de fixtures), `E2E_BASE_URL`, `E2E_API_URL`, `NEXT_PUBLIC_API_URL_STAGING`, `NEXT_PUBLIC_APP_URL_STAGING`, `HEALTH_READINESS_TOKEN`, `ENTERPRISE_GATE_HEALTH_TOKEN`, `ENTERPRISE_GATE_EVENTS_INGEST_KEY`, `ENTERPRISE_GATE_ADMIN_*`, `ENTERPRISE_GATE_HOST_*` | `E2E_BASE_URL`, `E2E_API_URL`, `E2E_AUTHENTICATED_SMOKE_ENABLED`, `E2E_PRODUCT_AUDIT_ENABLED`, `ENTERPRISE_GATE_ENABLED`, `ENTERPRISE_GATE_BACKEND_URL`, `ENTERPRISE_GATE_FRONTEND_URL`, `ENTERPRISE_GATE_PROD_MUTATION_OK` |

O backup off-site está **falhando** hoje por credenciais inválidas no provedor de armazenamento: renovar o par de chaves do usuário IAM de backup, atualizar os secrets e rodar um restore drill.

---

## 6. Regras de operação

- Nunca promover ambiente com `JWT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY`, `STAYS_TOKEN_ENCRYPTION_KEY` ou `EMAIL_CONFIRMATION_CODE_SECRET` vazios.
- Produção: `DB_SYNCHRONIZE=false`; `STAYS_AUTO_APPLY_ENABLED=false` até smoke documentado; `STAYS_AUTO_APPLY_DRY_RUN=true` no primeiro smoke com allowlist.
- `SENTRY_DSN` diferente por ambiente.
- `NEXT_PUBLIC_*` exigem rebuild do frontend ao mudar.
- `EVENTS_INGEST_API_KEY` (backend) e `URBAN_EVENTS_INGEST_API_KEY` (webscraping) giram juntas.
- Ao adicionar variável no código, atualizar esta matriz e o `.env.example` do serviço no mesmo PR.
- Para Track 3, rodar `npm run preflight:track3` em `urban-ai-backend-main` antes de smoke manual.
- Checklist histórico de integrações em staging: [`integracoes-outcomes-calibracao.md`](./integracoes-outcomes-calibracao.md).
