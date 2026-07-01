# Acessos e Secrets

Data: 2026-07-01
Regra: este arquivo nao contem valores reais de secrets.

## Politica

Nao copiar tokens, senhas, JWTs, private keys ou strings de banco para:

- Git.
- Docs.
- Issues.
- Pull requests.
- Chat.
- Prints.

Se uma chave apareceu em chat antigo, ela deve ser tratada como exposta. O caminho correto e rotacionar no provedor e atualizar Railway/GitHub/ambiente local.

## Como Dar Acesso ao Novo Dev

| Sistema | Como conceder |
|---|---|
| GitHub | Adicionar ao repo/organizacao com permissao adequada. |
| Railway | Adicionar ao projeto Urban AI e ambientes `production`/`staging` conforme necessidade. |
| Cloudflare | Adicionar usuario ou criar API token scoped para DNS de `myurbanai.com`. |
| Stripe | Convidar no Dashboard; usar test mode para desenvolvimento. |
| Google Cloud | Adicionar no projeto que contem Maps/Geocoding, OAuth e possivel BigQuery. |
| Brevo | Convidar ou compartilhar API key via cofre de senhas. |
| Sentry | Convidar ao projeto; DSN pode ir em env, auth token so em CI/build. |
| Email/Dominio | Dar acesso via provedor do dominio ou Cloudflare, nao por chat. |
| Banco staging/prod | Preferir Railway/variaveis de ambiente; nunca colar URL com senha em docs. |

## Fonte de Verdade dos Secrets

| Ambiente | Fonte recomendada |
|---|---|
| Local dev | `.env.local` ou `.env`, ignorado pelo Git. |
| Staging | Railway staging variables + GitHub secrets/vars para CI. |
| Production | Railway production variables + GitHub secrets/vars. |
| Testes E2E | GitHub secrets e usuarios fixture. |
| Handoff humano | Cofre de senhas, 1Password, Bitwarden, ou acesso direto ao provedor. |

## Estado Local Observado

Arquivo `.env.staging` existe localmente e esta ignorado pelo Git. Em 2026-07-01, ele tinha valores preenchidos para:

- `ENTERPRISE_GATE_BACKEND_URL`
- `ENTERPRISE_GATE_FRONTEND_URL`
- `ENTERPRISE_GATE_HEALTH_TOKEN`
- `ENTERPRISE_GATE_EVENTS_INGEST_KEY`
- `EVENTS_INGEST_API_KEY`
- `HEALTH_READINESS_TOKEN`
- `STAYS_TOKEN_ENCRYPTION_KEY`
- `STAYS_AUTO_APPLY_ENABLED`
- `STAYS_AUTO_APPLY_DRY_RUN`
- `ENTERPRISE_GATE_POST_ASK_QUESTION`

E estava vazio para:

- `ENTERPRISE_GATE_ADMIN_JWT`
- `ENTERPRISE_GATE_HOST_JWT`
- `RESTORE_DATABASE_URL`
- `STAYS_API_BASE_URL`
- `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`
- `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS`
- `STAYS_AUTO_APPLY_USER_ALLOWLIST`
- `STAYS_AUTO_APPLY_LISTING_ALLOWLIST`

Nao commitar `.env.staging`.

## Secrets Por Grupo

### Backend

| Grupo | Variaveis |
|---|---|
| Auth | `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `COOKIE_DOMAIN`, `CORS_ALLOWED_ORIGINS`, `FRONT_BASE_URL` |
| Banco | `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` |
| Health | `HEALTH_READINESS_TOKEN`, `HEALTH_READINESS_PUBLIC=false` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, `STARTER_PRICE_*`, `PROFISSIONAL_PRICE_*`, `SUCCESS_URL`, `CANCEL_URL` |
| Email | `BREVO_API_KEY`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL`, `FRONT_URL` |
| Maps/IA | `GOOGLE_MAPS_API_KEY`, `GEMINI_API_KEY`, `MAPBOX_TOKEN`, `AIRROI_API_KEY` |
| Stays | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, `STAYS_AUTO_APPLY_*` |
| Observabilidade | `SENTRY_DSN`, `ADMIN_ALERT_EMAIL` |
| Operacao | `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `SUPPORT_OWNER_EMAIL`, `PRIVACY_OWNER_EMAIL` |

### Frontend

| Grupo | Variaveis |
|---|---|
| Runtime | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_APP_ENV` |
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Stripe | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Analytics | `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` |
| SEO/GEO | `SEO_GSC_SITE_URL`, `SEO_GA4_PROPERTY_ID`, `SEO_GOOGLE_CLIENT_EMAIL`, `SEO_GOOGLE_PRIVATE_KEY`, `SEO_BOT_LOG_*`, `SEO_AI_MONITOR_*` |
| E2E | `E2E_BASE_URL`, `E2E_API_URL`, `E2E_*_EMAIL`, `E2E_*_PASSWORD` |

### Pipeline e Webscraping

| Grupo | Variaveis |
|---|---|
| AWS/S3 | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_DEFAULT_REGION`, `S3_BUCKET_NAME`, `ASSUME_ROLE_ARN`, `ASSUME_ROLE_EXTERNAL_ID` |
| Prefect | `PREFECT_SERVER_URL` e secrets Prefect equivalentes |
| Webscraping APIs | `TICKETMASTER_API_KEY`, `API_FOOTBALL_KEY`, `SERPAPI_KEY`, `FIRECRAWL_API_KEY`, `TAVILY_API_KEY`, `GEMINI_API_KEY` |
| Ingest backend | `URBAN_API_BASE`, `URBAN_COLLECTOR_EMAIL`, `URBAN_COLLECTOR_PASSWORD`, `URBAN_EVENTS_INGEST_API_KEY` |
| Scrapyd | `SCRAPYD_URL`, `SCRAPYD_API_KEY` |

## Cloudflare Staging

DNS pendente:

| Tipo | Nome | Conteudo | Proxy |
|---|---|---|---|
| CNAME | `staging` | `7swvlwmb.up.railway.app` | DNS only ate validar SSL |
| TXT | `_railway-verify.staging` | `railway-verify=railway-verify=974341afdc8db5df7ca62971dc3ac59ffa0b02cd829b89d74f789b3b30da21f8` | N/A |
| CNAME | `staging-api` | `ywnfzddg.up.railway.app` | DNS only ate validar SSL |
| TXT | `_railway-verify.staging-api` | `railway-verify=railway-verify=970f2a3796e95f7a94897232d457ba0c0c01d758703af41c6567456d4927190b` | N/A |

O OAuth Cloudflare local antigo do Codex estava expirado/revogado. Reautenticar plugin ou criar API token scoped `Zone:Read` + `DNS:Edit`.

## Checklist de Transferencia de Secrets

- [ ] Dev recebeu acesso ao GitHub.
- [ ] Dev recebeu acesso ao Railway staging.
- [ ] Dev recebeu acesso ao Railway production se necessario.
- [ ] Dev recebeu acesso ao Cloudflare ou token scoped temporario.
- [ ] Dev recebeu acesso Stripe test mode.
- [ ] Dev recebeu acesso Google Cloud.
- [ ] Dev recebeu acesso Brevo/Sentry.
- [ ] Todas as chaves coladas em chats foram rotacionadas ou invalidadas.
- [ ] `.env.staging` local nao foi commitado.
- [ ] GitHub secrets/vars de E2E foram configurados.
