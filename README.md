# Urban AI

Plataforma de IA para otimização de receita de anfitriões Airbnb.
Promessa quantificável: **+30% de receita** via recomendação de preços guiada por eventos da cidade, classificação KNN e proximidade geoespacial.

> Foco inicial: São Paulo. Visão: liderança de revenue optimization para hospedagem na América Latina.

## Modos de operação

- **Recomendação** — IA sugere preço, anfitrião aplica manualmente.
- **Automático** — IA aplica direto via integração Stays (Preferred+ Partner Airbnb LATAM). Requer conta Stays conectada e guardrails configurados.

Ver `docs/runbooks/stays-integration-setup.md` para detalhes.

## Estrutura do monorepo

| Serviço | Tech | Função |
|---|---|---|
| [`urban-ai-backend-main/`](urban-ai-backend-main/) | NestJS 10 + TypeORM/MySQL + BullMQ + Stripe + Sentry | API REST, auth, pagamentos, motor KNN, integração Stays |
| [`Urban-front-main/`](Urban-front-main/) | Next.js 15 (App Router) + Chakra/Tailwind + NextAuth | UI completa: home, onboarding, dashboard, planos, integrações |
| [`urban-pipeline-main/`](urban-pipeline-main/) | Prefect 3.x (Python) | Orquestra scraping diário e ingestão para MySQL |
| [`urban-webscraping-main/`](urban-webscraping-main/) | Scrapy + Scrapyd + Playwright | 8 spiders de eventos (Eventim, Sympla, Ingresse, Ticketmaster, etc.) |
| [`urban-ai-knn-main/`](urban-ai-knn-main/) | — | **Aposentado** (ADR 0007). Lógica embedada no backend. |
| [`_opensquad/`](_opensquad/), [`squads/`](squads/) | Claude/Opensquad | Ferramenta operacional interna (auditoria, marketing, roadmap-manager). Não é parte do produto. |

## Getting started

Cada serviço tem seu próprio README com setup detalhado:

- [Backend — NestJS](urban-ai-backend-main/README.md)
- [Frontend — Next.js](Urban-front-main/README.md)
- [Pipeline — Prefect](urban-pipeline-main/README.md)
- [Webscraping — Scrapy](urban-webscraping-main/README.md)

### Setup mínimo para rodar tudo localmente

```bash
# 1) Backend
cd urban-ai-backend-main
yarn install
cp .env.example .env  # preencher com seus valores (ver doc backend)
yarn start:dev        # :10000

# 2) Frontend (em outro terminal)
cd Urban-front-main
yarn install
cp .env.example .env.local
yarn dev              # :3000

# 3) (opcional) Pipeline + Scraping para popular eventos
cd urban-pipeline-main
uv sync
uv run python serve.py
```

Banco de dados: o backend pode rodar contra um MySQL local ou contra o Railway de prod (não recomendado para desenvolvimento — usar staging quando estiver de pé).

## Documentação

| Onde | O que tem |
|---|---|
| `docs/roadmap-pos-sprint.md` | **Fonte de verdade** do roadmap em curso (v2.10) |
| `docs/go-live-manual-checklist.md` | Lista do que ainda é manual humano vs. automatizável (P0/P1/P2) |
| `CHANGELOG.md` | Histórico de releases em formato semver |
| `docs/avaliacao-projeto-2026-04-16.md` | Auditoria técnica completa que motivou F5C |
| `docs/adr/` | Architecture Decision Records — por que escolhemos NestJS, MySQL, Railway, etc. |
| `docs/runbooks/` | Procedimentos operacionais — staging, migrations, restore, incidentes |
| `docs/lgpd/` | Política interna + checklist de DPAs |
| `docs/slo.md` | SLO/SLA, error budget, postmortem |
| `docs/outreach/` | One-pager + roteiro de contato Stays |
| `load-tests/` | Cenários k6 (smoke, login flow, pricing recommendation) |

## CI/CD

GitHub Actions roda em todo push/PR para `main` e `staging`:

- `backend-test` — `tsc --noEmit` + `jest` (95 testes hoje)
- `backend-build` — `nest build` com verificação de `dist/main.js`
- `backend-migrations` — roda migrations contra MySQL service container fresh (valida que aplicam limpas em DB zerado)
- `frontend-test` — `tsc --noEmit` + `next build` com env mocks
- `frontend-smoke` — Playwright contra staging (gated em `vars.E2E_BASE_URL` no GitHub)

**Backup automatizado:** workflow `.github/workflows/backup-db.yml` faz dump diário do MySQL às 03:00 UTC e sobe para S3 ou Backblaze B2. Ver `docs/runbooks/backup-offsite.md`.

Deploy é automático via Railway watch da branch `main` (prod) e da branch `staging` quando criada.

## Observabilidade — endpoints públicos

- `GET /health` — DB ping + uptime + version (UptimeRobot bate aqui, < 100ms)
- `GET /health/live` — apenas confirma que o processo NestJS está vivo (Railway liveness probe)
- `GET /admin/overview` — KPIs do produto (autenticado, role admin)
- `GET /admin/finance/overview` — MRR, custos, margem por imóvel
- `GET /admin/stripe/sync-check` — valida que os 8 Stripe Price IDs (matriz F6.5) batem com a conta Stripe

## Contato

- **Owner técnico/operacional:** Gustavo Macedo · `gustavog.macedo16@gmail.com`
- **Sócios:** Fabrício, Rogério (decisões comerciais e produto)
- **DPO (LGPD):** Gustavo Macedo · `privacidade@myurbanai.com` (a configurar)

---

## Sobre o Opensquad neste repo

A pasta `_opensquad/` e os agentes em `squads/` são uma **ferramenta operacional interna** que o Gustavo usa para automatizar parte do trabalho de marketing, auditoria de QA e atualização do roadmap. **Não fazem parte do produto entregue ao cliente.** Para entender o framework Opensquad, ver `_opensquad/README.md` e digitar `/opensquad` no Claude Code.

---

*Urban AI © 2026*
