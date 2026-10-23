# Urban AI

Plataforma para anfitriões Airbnb identificarem eventos próximos e receberem recomendações de preço em beta controlado.
Promessas quantitativas de ROI ficam bloqueadas até existirem ground truth, preço aplicado e cases auditados.

> Foco inicial: São Paulo. Visão: liderança de revenue optimization para hospedagem na América Latina.

## Comece aqui

1. Este README (visão geral e setup local).
2. [`docs/ARQUITETURA-ATUAL.md`](docs/ARQUITETURA-ATUAL.md): topologia, ambientes, deploy, integrações, repositório canônico e pendências conhecidas.
3. [`docs/ACESSOS-E-FERRAMENTAS.md`](docs/ACESSOS-E-FERRAMENTAS.md): que acesso pedir em cada provedor e por qual canal (MCP/CLI/API).
4. [`docs/runbooks/matriz-env-operacional.md`](docs/runbooks/matriz-env-operacional.md): variáveis de ambiente por serviço (somente nomes).
5. [`docs/runbooks/README.md`](docs/runbooks/README.md): procedimentos operacionais.

Índice completo da documentação: [`docs/README.md`](docs/README.md).

## Modos de operação

- **Recomendação** — IA sugere preço, anfitrião aplica manualmente.
- **Automático** — beta privado via integração Stays. Requer conta Stays conectada, consentimento, preview, guardrails e rollback validados. Ver [`docs/runbooks/stays-integration-setup.md`](docs/runbooks/stays-integration-setup.md).

## Estrutura do monorepo

| Pasta | Tech | Função |
|---|---|---|
| [`urban-ai-backend-main/`](urban-ai-backend-main/) | NestJS 11 + TypeORM/MySQL + Bull v3 (`@nestjs/bull`, Redis Upstash) + Stripe + Sentry | API REST, auth, pagamentos, motor de pricing (KNN embarcado), inteligência de eventos, integração Stays |
| [`Urban-front-main/`](Urban-front-main/) | Next.js 15 (App Router) + React 19 + Tailwind 4 + NextAuth | Site de marketing (`myurbanai.com`) e app (`app.myurbanai.com`) |
| [`urban-webscraping-main/`](urban-webscraping-main/) | Scrapy + Scrapyd + Playwright + coletores HTTP | 7 spiders e coletores de eventos; envia para `POST /events/ingest`; cron interno a cada 6 h |
| [`urban-pipeline-main/`](urban-pipeline-main/) | Prefect 3 (Python) | Dispara os spiders às 03:00 UTC; flow S3 → MySQL legado (inativo) |
| [`urban-ai-knn-main/`](urban-ai-knn-main/) | Python | **Aposentado** ([ADR 0007](docs/adr/0007-aposentar-knn-microservice.md)); ainda compila, sem tráfego |
| [`load-tests/`](load-tests/) | k6 | Cenários de carga |

## Setup local

Cada serviço tem README próprio: [backend](urban-ai-backend-main/README.md), [frontend](Urban-front-main/README.md), [pipeline](urban-pipeline-main/README.md), [webscraping](urban-webscraping-main/README.md). Os serviços Node usam **npm** (`package-lock.json`, igual ao CI).

```bash
# 1) Backend
cd urban-ai-backend-main
npm ci
cp .env.example .env   # preencher; o exemplo usa PORT=10000 (sem PORT o padrão é 8080)
npm run start:dev

# 2) Frontend (outro terminal)
cd Urban-front-main
npm ci --legacy-peer-deps
cp .env.example .env.local   # apontar NEXT_PUBLIC_API_URL para http://localhost:10000
npm run dev                  # :3000

# 3) (opcional) Webscraping / pipeline: ver os READMEs Python (uv)
```

Banco: use MySQL local ou o ambiente de **staging** do Railway. Não desenvolva contra produção.

## Repositório canônico

`urbanai-tech/urban.ai` é o repositório **canônico**: CI, CodeQL, backup e restore drill rodam lá. Mudanças entram por Pull Request.

Antes de abrir PR: `npm run gate:repository` + gitleaks. Procedimento completo em [`docs/ARQUITETURA-ATUAL.md`](docs/ARQUITETURA-ATUAL.md#8-repositório-canônico).

## CI/CD

GitHub Actions (repo canônico) em push/PR para `main` e `staging`:

- `repository-gates` — secrets no HEAD, links de docs, contratos de DR, uso do KNN legado, gitleaks.
- `backend-test` / `backend-build` / `backend-migrations` — lint, typecheck, Jest, auditorias (LGPD, autorização, cron, observabilidade), `nest build`, migrations em MySQL limpo.
- `frontend-test` — typecheck, testes unitários e `next build`.
- `webscraping-test`, `pipeline-test` — testes Python.
- `frontend-smoke` / `product-audit` — Playwright contra o ambiente configurado em `vars.E2E_BASE_URL`.
- `release-gate.yml`, `codeql.yml`; `backup-db.yml` (diário 03:00 UTC) e `restore-drill.yml` (manual). Ver [`docs/runbooks/backup-offsite.md`](docs/runbooks/backup-offsite.md) — o backup off-site tem pendência operacional aberta.

Deploy: Railway faz build por Dockerfile a partir da `main` (produção) e da branch de staging. Vercel **não** publica o produto (`vercel.json` desliga deploys por Git).

## Observabilidade — endpoints

- `GET /health/live` — liveness (público).
- `GET /health` — detalhado; fora de dev exige `HEALTH_READINESS_TOKEN`.
- `GET /admin/overview`, `GET /admin/finance/overview`, `GET /admin/stripe/sync-check` — autenticados (admin). Ver [`docs/runbooks/stripe-billing-smoke.md`](docs/runbooks/stripe-billing-smoke.md).

## Contato

- **Responsável técnico/operacional e encarregado (DPO, LGPD):** Gustavo Macedo.
- Caixas `privacidade@` e `suporte@myurbanai.com` ainda **não recebem e-mail** (domínio sem MX) — pendência em [`docs/ARQUITETURA-ATUAL.md`](docs/ARQUITETURA-ATUAL.md#9-pendências-conhecidas-genéricas).

---

*Urban AI © 2026*
