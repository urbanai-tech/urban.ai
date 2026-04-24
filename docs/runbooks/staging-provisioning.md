# Runbook — Provisionamento de Staging no Railway

**Objetivo:** ter uma cópia funcional da produção para testar mudanças arriscadas (migrations, hardening F5C, integração F6.4 Stays, repricing F6.5) antes de tocar prod. Sem staging, qualquer deploy é um experimento em cliente real.

**Escopo:** 5 serviços do monorepo — backend, frontend, KNN (se for manter), pipeline Prefect, webscraping Scrapyd. Mais banco MySQL separado e Redis Upstash separado.

**Subdomínio alvo:** `staging.myurbanai.com` (frontend), `staging-api.myurbanai.com` (backend) — ou `staging-` prefix nos serviços Railway.

**Pré-requisitos no código (já aplicados):**
- Backend: `APP_ENV` (env var) diferencia prod/staging no Sentry. Ver `src/instrument.ts`.
- Frontend: `NEXT_PUBLIC_APP_ENV="staging"` ativa banner amarelo no topo. Ver `src/app/componentes/StagingBanner.tsx`. Também propaga para `environment` do Sentry em `instrumentation-client.ts` e `src/instrumentation.ts`.

---

## Passo 1 — Criar o projeto Railway de staging

1. Abrir o projeto atual no Railway (aquele que hospeda produção).
2. Criar um **novo projeto** chamado `urban-ai-staging` (não duplicar no mesmo projeto; separar evita acidentes de acoplamento de env vars).
3. No novo projeto, adicionar um **plano Pro** — backup automático do MySQL é incluído.

> Alternativa mais barata: usar **Railway Environments** dentro do mesmo projeto. Cada environment tem env vars próprias mas compartilha a infraestrutura subjacente. Mais enxuto, mas se o projeto prod for derrubado, staging cai junto. Recomendo projeto separado.

---

## Passo 2 — Provisionar os 5 serviços + 2 dependências

Na ordem abaixo. Tudo vai puxar de `github.com/Gustavogm9/urban.ai` (branch a escolher — ver Passo 7).

### 2.1 MySQL staging

- No projeto staging, **New → Database → MySQL**. Plan: Pro.
- Anotar a `DATABASE_URL` gerada.
- Opcional: carregar schema a partir do dump de `docs/dump-ai_urban-202603131344.sql` (legado, banco antigo) OU iniciar vazio e deixar o backend criar via `DB_SYNCHRONIZE=true` no primeiro boot em staging.
- Preferência: iniciar vazio + `DB_SYNCHRONIZE=true` em staging (aceitamos a regressão só em staging porque é descartável) OU aplicar migrations versionadas (`MIGRATIONS_RUN=true` + baseline) depois que o CRIT #3 estiver testado.

### 2.2 Redis staging

- Criar **novo Upstash Redis** em https://upstash.com, nome `urbanai-staging`, região US-east para latência igual à prod.
- Anotar `REDIS_URL` (ou host/port/password — o backend aceita ambos).

### 2.3 Backend staging

- **New → Deploy from GitHub repo → Gustavogm9/urban.ai**.
- **Root directory:** `urban-ai-backend-main/`
- **Build command:** deixar o default (Nixpacks detecta `nest build`).
- **Start command:** `node dist/main`
- **Porta:** 10000 (ou deixar Railway escolher — o backend lê `process.env.PORT`).
- **Env vars** (copiar de produção e ajustar):
  - `APP_ENV=staging`
  - `NODE_ENV=production` (SIM, mesmo em staging — para o Node rodar otimizado; APP_ENV é o diferenciador)
  - `DATABASE_URL=<url do MySQL staging>`
  - `DB_SYNCHRONIZE=true` (por enquanto, até o CRIT #3 cutover ser testado)
  - `MIGRATIONS_RUN=false` (idem)
  - `JWT_SECRET=<novo valor, diferente da prod — gerar com crypto.randomBytes(64)>`
  - `RAPIDAPI_KEY=<mesma da prod — não precisa rotacionar entre envs>`
  - `GOOGLE_MAPS_API_KEY=<mesma da prod>`
  - `GEMINI_API_KEY=<mesma da prod OU key separada se quiser isolar custos>`
  - `STRIPE_SECRET_KEY=<sk_test_* obrigatório — staging NUNCA usa live>`
  - `STRIPE_PUBLIC_KEY=<pk_test_*>`
  - `STRIPE_WEBHOOK_SECRET=<novo, do endpoint staging do Stripe>`
  - `MENSAL_PLAN`, `ANUAL_PLAN`, `STARTER_*`, `PROFISSIONAL_*` — criar **Prices de teste separados** no Stripe Dashboard (ambiente test) para staging, não reutilizar os de prod
  - `TRIAL_PERIOD_DAYS=10`
  - `FRONT_BASE_URL=https://staging.myurbanai.com`
  - `SUCCESS_URL=https://staging.myurbanai.com/my-plan`
  - `CANCEL_URL=https://staging.myurbanai.com/plans`
  - `API_URL=https://staging-api.myurbanai.com` (a URL pública que você vai dar ao backend staging)
  - `MAILERSEND_API_KEY=<pode ser a mesma; mas configurar um sender diferente>`
  - `EMAIL_SENDER=staging-noreply@notify.myurbanai.com` (cadastrar esse subdomínio no Mailersend)
  - `SENTRY_DSN=<mesma da prod ou criar projeto Sentry separado>`
  - `REDIS_URL=<url do Upstash staging>`
- **Custom domain:** adicionar `staging-api.myurbanai.com` e criar CNAME no Hostinger apontando para o proxy do Railway.

### 2.4 Frontend staging

- **New → Deploy from GitHub repo → Gustavogm9/urban.ai**.
- **Root directory:** `Urban-front-main/`
- **Build command:** `npm run build`
- **Start command:** `node server.js` (output standalone do Next.js)
- **Env vars:**
  - `NEXT_PUBLIC_APP_ENV=staging`
  - `NODE_ENV=production`
  - `NEXT_PUBLIC_API_URL=https://staging-api.myurbanai.com`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<pk_test_* — mesma do backend staging>`
  - `NEXTAUTH_URL=https://staging.myurbanai.com`
  - `NEXTAUTH_SECRET=<novo valor, openssl rand -base64 32>`
  - `GOOGLE_CLIENT_ID=<criar novo no Google Cloud Console — OAuth client novo com redirect uri https://staging.myurbanai.com/api/auth/callback/google>`
  - `GOOGLE_CLIENT_SECRET=<o novo gerado>`
  - `NEXT_PUBLIC_SENTRY_DSN=<mesma da prod>`
  - `NEXT_PUBLIC_CHAINLIT_URL=<deixar vazio se não tiver chainlit em staging, ou URL do staging>`
- **Custom domain:** `staging.myurbanai.com` → CNAME no Hostinger.

### 2.5 KNN standalone staging (só se decidirem manter)

Ver F5C.3: decisão pendente sobre aposentar ou reativar `urban-ai-knn-main/`. Se aposentar: **não provisionar em staging**. Se reativar: mesmo fluxo do backend, env vars `API_KEY` (nova, gerar com `crypto`) e `MAPBOX_TOKEN`.

### 2.6 Pipeline Prefect staging

Mais complexo — Prefect Cloud tem workspaces separados.
- Criar workspace `urbanai-staging` em https://app.prefect.cloud.
- Novo projeto Railway para hospedar `urban-pipeline-main/` em staging, com env vars apontando para o workspace staging.
- Secrets (via Prefect Blocks): duplicar blocks do workspace de prod para o de staging, mas com credenciais de S3 de staging.

### 2.7 Webscraping Scrapyd staging

- Novo serviço Railway a partir de `urban-webscraping-main/`.
- Env vars:
  - `SCRAPYD_API_KEY=<nova chave — staging separado da prod>`
  - `ASSUME_ROLE_ARN=<role separado no AWS apontando para bucket staging>`
  - `ASSUME_ROLE_EXTERNAL_ID=<nova external id>`
  - `TICKETMASTER_API_KEY=<mesma da prod, ok>`
- **Bucket S3 separado:** criar `urbanai-staging-data-lake` na região `sa-east-1` + IAM user `urbanai-staging-scrapy` com permissão restrita a esse bucket.

---

## Passo 3 — Stripe: endpoint webhook staging

- No Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
- URL: `https://staging-api.myurbanai.com/payments/webhook`.
- Eventos a escutar (espelhar a configuração de prod):
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Copiar o `Signing secret` gerado (começa com `whsec_`) para a env var `STRIPE_WEBHOOK_SECRET` do backend staging.

---

## Passo 4 — DNS (Hostinger)

Criar 2 CNAMEs na zona de `myurbanai.com`:

| Host | Tipo | Valor | TTL |
|---|---|---|---|
| `staging` | CNAME | `<railway-frontend-domain>.up.railway.app` | 300 |
| `staging-api` | CNAME | `<railway-backend-domain>.up.railway.app` | 300 |

Aguardar propagação (5–15 min). Railway vai emitir SSL automaticamente assim que detectar o CNAME apontado.

---

## Passo 5 — Popular com dados sintéticos

Staging não deve ter dados reais de clientes. Antes do primeiro teste, gerar:
- 3–5 usuários fake (emails `teste+<num>@urbanai.com.br`) via tela de signup.
- 1–2 imóveis por usuário via onboarding.
- Não rodar crons pesados (Gemini enrichment, scraping) até confirmar que os custos estão controlados (APIs grátis/baratas OK).

---

## Passo 6 — Smoke test de aceitação

Antes de declarar staging "operacional", executar manualmente:

- [ ] Login com usuário novo (email + senha) funciona
- [ ] Login com Google OAuth funciona (redirect URI tem que bater)
- [ ] Cadastro de imóvel no onboarding funciona
- [ ] Dashboard carrega sem erro no console
- [ ] Assinatura Stripe com cartão teste `4242 4242 4242 4242` completa checkout
- [ ] Webhook Stripe chega no backend (logs do Railway + tela `/my-plan` reflete plano ativo)
- [ ] Cancelamento de assinatura via `/my-plan` funciona
- [ ] Banner amarelo "STAGING" aparece no topo em todas as rotas
- [ ] Sentry recebe um evento de teste com tag `environment=staging`

Se tudo passar, staging está pronto para receber os testes do CRIT #3 (cutover de migrations) e da F6.4 (integração Stays).

---

## Passo 7 — Workflow de deploy em staging

Duas opções:

**A) Deploy automático da branch main (mesma da prod).** Toda alteração em main já vai para staging E prod. Problema: se prod quebrar, staging também quebra. Útil no curto prazo.

**B) Branch dedicada `staging` (recomendado no médio prazo).** Railway staging watched na branch `staging`. Fluxo:
```
main → prod (automático)
staging → staging (automático)
feature/x → PR para staging → merge → deploya em staging → aprovação → merge em main
```

Para adotar B: no Railway staging, na config do serviço, **Settings → Source → Branch = staging**. Criar a branch com `git checkout -b staging && git push -u origin staging`.

**Recomendação:** começar com A (rápido, zero config extra). Migrar para B quando o volume de mudanças justificar (daqui a 2–4 semanas provavelmente).

---

## Custos estimados

| Item | Valor |
|---|---|
| Railway Pro (projeto staging) | ~US$ 20/mês |
| Upstash Redis staging (Free tier) | US$ 0 |
| AWS S3 staging bucket (baixa escrita) | < US$ 1/mês |
| Prefect Cloud workspace staging (Free tier) | US$ 0 |
| Google OAuth client staging | US$ 0 |
| Google Maps API staging | compartilha crédito grátis com prod |
| Sentry staging (mesma conta) | US$ 0 |
| **Total adicional** | **~US$ 20–25/mês** |

---

## Quando pode derrubar staging

- **Nunca durante F5C–F6.5** (semanas 5–11) — é ativo crítico.
- Após o go-live oficial estável (pós S16), avaliar se virou "prod secundária" (útil para smoke test em PRs) ou pode ser desligada entre sprints.

---

## Troubleshooting rápido

- **Webhook Stripe staging recebe 401/403:** verificar se o `STRIPE_WEBHOOK_SECRET` do backend é o secret do endpoint staging, não o de prod.
- **NextAuth callback falha:** o Google OAuth client staging precisa ter `https://staging.myurbanai.com/api/auth/callback/google` na lista de URIs autorizadas.
- **Sentry misturando eventos prod e staging:** confirmar no dashboard que filtro `environment=staging` mostra só os eventos esperados. Se não, conferir `APP_ENV` e `NEXT_PUBLIC_APP_ENV` no Railway do serviço específico.
- **Frontend pingando backend de prod por engano:** conferir que `NEXT_PUBLIC_API_URL` aponta para `staging-api.myurbanai.com` e não a URL de prod.

---

*Última atualização: 24/04/2026 — runbook criado junto com patch de APP_ENV + StagingBanner. Provisionamento manual pelo Gustavo/Railway pendente.*
