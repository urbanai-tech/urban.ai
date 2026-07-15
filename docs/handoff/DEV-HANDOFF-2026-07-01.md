# Dev Handoff - Urban AI

Data: 2026-07-01
Responsavel pelo handoff: Gustavo + Codex
Objetivo: permitir que outro dev assuma trabalho no projeto sem depender dos chats antigos.

## Veredito Atual

O Urban AI esta maduro em codigo e arquitetura, mas ainda nao esta em 100% operacional/auditavel.

Estado honesto:

- Produto core existe e tem backend, frontend, pipeline, webscraping, pricing, event radar, admin e runbooks.
- Staging basico responde em Railway.
- Frontend typecheck passou.
- Backend build passou depois de instalar dependencias.
- Opensquad readiness passou.
- Dashboard build passou.
- O 100% real depende de ambiente, secrets, gates autenticados, testes verdes, integracoes externas e evidencia de dados reais.

## Arquitetura Rapida

| Parte | Pasta | Funcao |
|---|---|---|
| Backend | `urban-ai-backend-main/` | NestJS, API REST, auth, pagamentos, pricing, Stays, admin, eventos, health. |
| Frontend | `Urban-front-main/` | Next.js App Router, UI publica, app host, admin, onboarding, paywall, event radar. |
| Pipeline | `urban-pipeline-main/` | Prefect/Python para pipeline de dados. |
| Webscraping | `urban-webscraping-main/` | Scrapy/Playwright e coletores de eventos. |
| KNN legado | `urban-ai-knn-main/` | Legado/deprecated; a fonte de verdade e o backend. |
| Opensquad | `_opensquad/`, `squads/` | Ferramenta interna de squads/agentes, auditoria e handoffs. |

## Estado Validado em 2026-07-01

Comandos executados:

```powershell
npm run opensquad:check
npm --prefix Urban-front-main run typecheck
npm --prefix dashboard run build
npm --prefix urban-ai-backend-main ci
npm --prefix urban-ai-backend-main run build
npm --prefix urban-ai-backend-main test -- --runInBand
npm --prefix urban-ai-backend-main audit --audit-level=high
node scripts/enterprise-auditability-live-gate.js --env=staging --strict --skip-events-ingest
npm run gate:enterprise:access
npm --prefix urban-ai-backend-main run preflight:track3
```

Resultados:

| Check | Resultado |
|---|---|
| Opensquad readiness | PASS |
| Frontend typecheck | PASS |
| Dashboard build | PASS, com aviso de chunk grande |
| Backend install | PASS, mas reportou vulnerabilidades |
| Backend build | PASS |
| Backend Jest completo | FAIL |
| Frontend build | BLOCKED por `ENOSPC` |
| Enterprise gate staging read-only | backend live PASS, backend health PASS, frontend root PASS; admin/host SKIP por falta de JWT |
| Track 3 preflight local | 2/6 ready |
| NPM audit backend | 46 vulnerabilidades: 1 critical, 13 high, 31 moderate, 1 low |

## Bloqueio Ambiental Imediato

O disco `C:` estava com aproximadamente 130 MB livres. Isso causou:

- `next build` falhando com `ENOSPC`.
- Jest falhando em algumas suites por cache transform sem espaco.
- Risco de qualquer build/teste local ficar instavel.

Antes de trabalhar serio, liberar pelo menos 5 a 10 GB.

## Falhas de Teste Observadas

Backend Jest:

- `event-intelligence.service.spec.ts`: expectativa de `confidence: high`, retorno atual `low`.
- `dataset-collector.service.spec.ts`: tipo corrompido/renomeado para `latestá` em spec.
- `events-csv-import.service.spec.ts`: datas de fixture agora caem como passado em 2026-07-01.
- `airbnb-pricing-attempt-log.service.spec.ts`: input de teste sem `startedAt`/`finishedAt`.
- Algumas suites tambem falharam por `ENOSPC` no cache do Jest.

Prioridade: corrigir as specs para ficarem deterministicas em qualquer data e limpar o problema `latestá`.

## Staging

URLs Railway validadas:

- Backend: `https://urban-ai-backend-staging-staging.up.railway.app`
- Frontend: `https://urban-ai-frontend-staging-staging.up.railway.app`

Status:

- `/health/live`: PASS.
- `/health`: PASS com token local carregado.
- frontend root: PASS.
- Gate admin/host autenticado: SKIP por falta de JWTs.
- DNS custom `staging.myurbanai.com` e `staging-api.myurbanai.com`: pendente no Cloudflare.

## Repos e Branches

Remotes:

- `origin`: `https://github.com/Gustavogm9/urban.ai.git`
- `urbanai-tech`: `https://github.com/urbanai-tech/urban.ai`

Branches relevantes:

- `main`: `1cca3411 fix: repair copy audit regressions`
- branch atual local: `codex/staging-railway-gates-20260526`

Ha uma worktree temporaria registrada:

```text
C:/tmp/urban-ai-main-merge-20260531 [main]
```

## Working Tree em 2026-07-01

Ha alteracoes locais pendentes. Parte e pacote operacional util, parte e evidencia/output. Nao fazer `git reset --hard`.

Alteracoes rastreadas:

- `package.json`
- `scripts/enterprise-access-readiness.js`
- `scripts/enterprise-auditability-live-gate.js`
- CSVs de squads
- memoria de `event-demand-pricing-radar`
- ajustes do squad `marketing-agency`

Nao rastreados importantes:

- `docs/product/`
- `docs/spinoff-plataforma-demanda/`
- `docs/archive/audits/reavaliacao-360-tecnica-proximos-passos-2026-06-21.md`
- `docs/evidence/*2026-05-27*`
- `docs/runbooks/staging-handoff-2026-05-27.md`
- `scripts/opensquad-readiness-check.js`
- `skills/mcp_railway/`, `skills/read_files/`, `skills/run_command/`
- outputs de squads

Recomendacao: fazer um commit de documentacao/handoff separado de qualquer commit de codigo.

## Trabalho Recomendado Para o Dev

Ordem sugerida:

1. Liberar espaco em disco local.
2. Rodar `npm --prefix Urban-front-main run build` novamente.
3. Corrigir Jest backend.
4. Resolver audit de dependencias do backend por pacote, sem `npm audit fix --force` cego.
5. Configurar JWT admin/host de staging e rodar gate autenticado.
6. Fechar DNS Cloudflare de staging.
7. Configurar Stays sandbox e restore drill.
8. Rodar Stripe smoke completo em test mode.
9. Atualizar evidencias em `docs/evidence/`.
10. Abrir PR com docs e depois PR separado com fixes tecnicos.
