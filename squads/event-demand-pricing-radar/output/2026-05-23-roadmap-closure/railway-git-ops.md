# Handoff Railway/Git Ops - 2026-05-23

Agente: Feynman Railway/Git Ops
Modo: read-only. Nao alterei variaveis, nao gerei dominio, nao deployei e nao rodei migrations.

## Railway observado

Consulta segura via Railway MCP:

```text
environment_status
Environment: production
Environment ID: 69584e74-331b-4789-bcad-c6e95b12e5d1
Service: urban.ai
Service ID: 52a796bc-8400-40f6-8d36-d1a8adc1d991
Status: SUCCESS
Active deployments: 1
Latest deploy: 2026-05-22 18:59:20.030 UTC
```

Config do servico:

```text
Source repo: urbanai-tech/urban.ai
Root directory: /urban-ai-backend-main
Builder: DOCKERFILE
Variables defined: 72
```

Deploys recentes do servico `urban.ai` em `production`:

```text
beb419eb-0513-4ab0-85d3-e44317e7ff37 | SUCCESS | 2026-05-22 18:59:20 UTC | 9b853f5d9df79da1a9a9052d79a0f907707f7e68
c2f928d4-8d17-4b84-a4f9-d170f1ac1799 | REMOVED | 2026-05-22 09:57:30 UTC | 67dcaac985f4e76b6f04bd947d04f91614498d77
fa72f3a9-abc4-4cbf-a51e-0086111359fd | REMOVED | 2026-05-22 09:54:29 UTC | 4a512e56f359f4b74d31efbbbe117025b4194915
c2e7c05a-5f1e-4bfe-aa24-5e62eb82daa9 | REMOVED | 2026-05-21 20:11:03 UTC | d15ff640d96f550aa7930dc0296b01d2071082ec
87f4f18e-8f31-4759-a665-f49e3c6b42c0 | REMOVED | 2026-05-21 19:19:50 UTC | d80d1bc4fafa48e699d2680bfc5a57f0455aa147
```

O commit ativo no Railway (`9b853f5`) e o HEAD local atual sao o mesmo commit. Isso significa que producao esta alinhada com o ultimo commit publicado, mas nao inclui as mudancas nao commitadas do worktree local.

## Lacunas Railway

O projeto/ambiente vinculado ao MCP lista apenas o servico `urban.ai`. Consultas read-only por nomes provaveis como `urban-front-main`, `Urban-front-main`, `frontend`, `urban-ai-backend-main`, `urban-webscraping` e `urban-pipeline` retornaram "not found"; a propria resposta informou que o unico servico disponivel nesse contexto e `urban.ai`.

Isso nao prova que front, pipeline e webscraping nao existam em outro projeto/workspace Railway; prova apenas que nao estao visiveis no link MCP atual. Para liberar a ultima milha, confirmar no painel Railway ou com link correto se existem projetos/servicos adicionais para:

- frontend Next.js;
- webscraping/Scrapyd;
- pipeline/Prefect;
- KNN legado, se ainda operacional;
- MySQL/Redis managed services.

## Build/start/root directory

Servico Railway observado:

- `urban.ai`: root `/urban-ai-backend-main`, builder `DOCKERFILE`.
- Dockerfile backend: `node:20-alpine`, `npm ci`, `npm run build`, runtime `node dist/main`, `EXPOSE 8080`.
- Scripts backend relevantes: `build`, `start`, `start:prod`, `migration:run`, `migration:show`, `audit:migrations:strict`, `backup:mysql:dry`, `smoke:event-intelligence`, `cleanup:legacy-user`.

Arquivos locais encontrados para outros servicos, mas sem servico Railway confirmado pelo MCP:

- `Urban-front-main/Dockerfile`: Next standalone, `npm ci --legacy-peer-deps`, `npm run build`, `CMD node server.js`.
- `urban-webscraping-main/Dockerfile`
- `urban-pipeline-main/Dockerfile`
- `urban-ai-knn-main/Dockerfile`

## URLs/domains provaveis

Do `.env.example`, runbooks e evidencias locais:

- API prod atual: `https://urbanai-production-85fd.up.railway.app`
- App prod: `https://app.myurbanai.com`
- Site publico: `https://myurbanai.com`
- Alias publico citado: `https://www.myurbanai.com`
- Futuro/planejado backend custom domain: `https://api.myurbanai.com`
- Staging planejado: `https://staging.myurbanai.com` e `https://staging-api.myurbanai.com`
- Backend staging fallback em workflow: `https://urban-ai-back-staging.up.railway.app`

Nao usei `generate_domain`, porque mesmo sem dominio customizado a ferramenta pode criar dominio Railway e isso seria mutacao.

## Variaveis importantes, sem expor valores

A leitura completa de variaveis de producao foi bloqueada por risco de expor segredos. Inventario abaixo vem de `.env.example`, workflows e codigo:

Backend criticas:

- Banco/migrations: `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SYNCHRONIZE`, `MIGRATIONS_RUN`
- Auth/cookies/CORS: `JWT_SECRET`, `JWT_EXPIRES_IN`, `API_URL`, `FRONT_BASE_URL`, `INTERNAL_HTTP_BASE_URL`, `MARKETING_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `COOKIE_DOMAIN`, `APP_ENV`, `ENABLE_SWAGGER`
- Observabilidade: `SENTRY_DSN`
- Redis/Bull: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS`
- Eventos/pricing/IA: `RAPIDAPI_KEY`, `AIRBNB_PRICE_STRATEGY`, `AIRBNB_HEADLESS_*`, `AIRBNB_GRAPHQL_HASH`, `GOOGLE_MAPS_API_KEY`, `MAPBOX_TOKEN`, `GEMINI_API_KEY`, `ASK_URBAN_DAILY_QUOTA`, `ASK_URBAN_DAILY_HARD_CAP`, `PRICING_STRATEGY`, `PRICING_BOOTSTRAP_ON_BOOT`
- Stays/auto-apply: `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, `STAYS_AUTO_APPLY_ENABLED`, `STAYS_AUTO_APPLY_DRY_RUN`, `STAYS_AUTO_APPLY_ALLOWED_USER_IDS`, `STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS`, `STAYS_AUTO_APPLY_*`
- Email/LGPD: `BREVO_API_KEY`, `EMAIL_SENDER`, `EMAIL_SENDER_NAME`, `RESET_PASS_URL`, `SUPPORT_EMAIL`, `PRIVACY_EMAIL`, `SUPPORT_OWNER_EMAIL`, `PRIVACY_OWNER_EMAIL`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLIC_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs, `SUCCESS_URL`, `CANCEL_URL`
- Lancamento: `LAUNCH_MODE`, `PRELAUNCH_MODE`

Frontend criticas:

- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_MARKETING_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- `NEXT_PUBLIC_CHAINLIT_URL`
- `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`
- `NEXT_PUBLIC_WAITLIST_ENDPOINT`, `NEXT_PUBLIC_PRELAUNCH_MODE`
- SEO server-side: `SEO_*`
- E2E/CI: `E2E_BASE_URL`, `E2E_API_URL`, `E2E_AUTH_EMAIL`, `E2E_AUTH_PASSWORD`

## Git local

Comandos usados:

```text
git status --short --branch
git remote -v
git branch --show-current
git rev-parse --short HEAD
git log --oneline --decorate -n 12 --all
git diff --stat
git diff --name-only
git ls-files --others --exclude-standard
```

Estado:

- Branch local: `main`
- HEAD local: `9b853f5`
- `main`, `origin/main` e `urbanai-tech/main` apontam para `9b853f5`.
- Remotes:
  - `origin`: `https://github.com/Gustavogm9/urban.ai.git`
  - `urbanai-tech`: `https://github.com/urbanai-tech/urban.ai`
- Worktree esta sujo: 68 arquivos modificados rastreados, 6879 insercoes e 397 delecoes no diff rastreado.
- Ha muitos arquivos nao rastreados, incluindo novas telas/event-radar, specs E2E, docs, scripts, migrations e arquivos do squad.
- `Urban-front-main/tsconfig.tsbuildinfo` esta modificado e deve ser avaliado antes de qualquer commit; normalmente artefato de build nao deveria entrar na ultima milha.
- Git emitiu warning de permissao ao acessar `C:\Users\gusta/.config/git/ignore`, mas os comandos principais funcionaram.

## CI/release gate

Workflows locais relevantes:

- `.github/workflows/ci.yml`: roda em `push`/`pull_request` para `main` e `staging`; inclui backend typecheck/jest/build/migration dry-run, frontend typecheck/build, pytest de webscraping/pipeline, evidence dry-run e Playwright mocked/local.
- `.github/workflows/release-gate.yml`: roda em PR/push para `main` e manual; inclui build frontend, smoke publico local usando API prod/staging fallback, smoke autenticado em push/manual se secrets existirem, e enterprise live gate manual.

Risco: `ci.yml` parece usar `yarn install --frozen-lockfile`, mas os diretorios lidos exibem `package-lock.json` e nao confirmei `yarn.lock`. Validar antes de confiar no CI como gate final.

## Estrategia segura sugerida

1. Nao commitar direto em `main`. Criar branch de release, por exemplo `codex/event-demand-pricing-radar-closure`.
2. Separar commits por fronteira operacional:
   - backend/migrations/event intelligence;
   - frontend/event radar;
   - docs/runbooks/evidence;
   - CI/release gate.
3. Antes de qualquer merge, revisar e excluir artefatos locais de build/cache (`tsconfig.tsbuildinfo`, `.playwright-mcp/`, imagens `_build/` se nao forem evidencias intencionais).
4. Rodar gates locais/CI sem producao mutavel:
   - backend: typecheck, jest, `audit:migrations:strict`, `backup:mysql:dry`;
   - frontend: typecheck, build, Playwright mock/local;
   - migration: apenas dry-run/fresh DB, nao Railway prod.
5. Confirmar Railway antes do merge:
   - servico `urban.ai` esta watching repo `urbanai-tech/urban.ai`, root `/urban-ai-backend-main`;
   - confirmar se branch observada e `main`;
   - confirmar se front esta em outro projeto/servico e qual branch/root ele observa;
   - confirmar se staging existe ou se deploy sera direto em production.
6. Se Railway faz auto-deploy em `main`, merge so depois dos gates e de janela humana de observacao. O deploy ativo hoje sugere que push/merge em `main` pode disparar deploy automatico.
7. Pos-merge: observar Railway `environment_status`, deploy IDs, health da API e smokes publicos. Nao rodar migrations manualmente se `MIGRATIONS_RUN=true` estiver intencionalmente configurado para boot.

## Riscos principais

- Producao esta alinhada com `9b853f5`, mas o trabalho local ainda nao esta commitado; qualquer deploy agora nao levara a ultima milha.
- O Railway MCP atual ve apenas backend; front/pipeline/webscraping podem estar em outro projeto ou sem link, entao a visibilidade operacional esta incompleta.
- Mudancas locais incluem migrations novas e campos novos. Risco de deploy backend com frontend/DB fora de ordem.
- Variaveis `NEXT_PUBLIC_*` do frontend sao build-time; qualquer ajuste de URL/modo exige rebuild/redeploy do front.
- `STAYS_AUTO_APPLY_ENABLED` deve continuar fail-closed ate validacao humana, allowlists e rollback.
- `MIGRATIONS_RUN=true` em producao faz migration no boot; exige que migrations sejam aditivas, idempotentes no fluxo esperado e validadas em dry-run antes do merge.
- CI pode estar desalinhado entre npm/yarn; validar lockfiles antes de depender de checks.
- Worktree grande aumenta risco de commit acidental de artefatos, evidencias temporarias ou arquivos sensiveis. Fazer staging seletivo.

## Comandos Railway seguros para proxima pessoa

Somente leitura:

```text
environment_status(environment_id="production")
get_service_config(service_id="urban.ai", environment_id="production")
list_deployments(service_id="urban.ai", environment_id="production", limit=20)
```

Evitar sem aprovacao explicita:

```text
list_variables      # pode expor segredos
generate_domain     # pode criar dominio
set_variables       # altera env e pode redeployar
create_environment  # mutacao
```
