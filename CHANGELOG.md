# Changelog

Todas as mudanças relevantes ficam aqui. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versionamento
do produto inteiro (não por serviço). Ordem cronológica reversa — mais novo
primeiro.

---

## [2.11] — 2026-04-25

### Adicionado

- **Migration `CatchupFeatureEntities1745800000000`** — cria tabelas das 5
  entities pós-baseline (`stays_accounts`, `stays_listings`, `price_snapshots`,
  `occupancy_history`, `event_proximity_features`). Idempotente: roda seguro
  em ambientes onde `synchronize:true` já criou as tabelas. Destrava o cutover
  para `DB_SYNCHRONIZE=false` em produção.
- **CI workflow expandido** (`.github/workflows/ci.yml`) — `backend-test` +
  `backend-build` + `backend-migrations` (contra MySQL service container) +
  `frontend-test` + `frontend-smoke` (Playwright em staging quando
  `vars.E2E_BASE_URL` setado).
- **Backup off-site MySQL** (`.github/workflows/backup-db.yml`) — cron diário
  03:00 UTC, suporta S3 ou Backblaze B2, comprimido gzip, com sanity checks
  e notificação Slack opcional. Runbook em `docs/runbooks/backup-offsite.md`.
- **Página `/privacidade` LGPD-completa** (12 seções) + **`/termos`** novo
  (14 seções) — drafts em revisão por advogado.
- **`<CookieConsent />` + hook `useConsent`** — banner LGPD não-bloqueante
  com 3 categorias (essenciais sempre, analytics, marketing). GA4 e Meta
  Pixel agora fazem gating por consent (não carregam scripts antes do
  usuário aceitar).
- **`StripeSyncCheckService`** + endpoint `GET /admin/stripe/sync-check` —
  valida que os 8 Stripe Price IDs (matriz F6.5: 2 planos × 4 ciclos)
  existem na conta Stripe e batem com `interval × interval_count` esperados.
  Card visual em `/admin/pricing-config` mostra status por plano × ciclo.
- **`/health` consolidado** — DB ping + uptime + version. `/health/live`
  como liveness probe leve do Railway. Tolerante a falha parcial (retorna
  `degraded` em vez de 500 quando DB lento).
- **7 templates de e-mail Mailersend novos** — welcome, subscription-active
  (com recibo F6.5), subscription-cancelled, payment-failed, quota-warning
  (80%), quota-exceeded (>100%), stays-connected.
- **Doc `go-live-manual-checklist.md`** — separa o que é responsabilidade
  humana (Stripe Price IDs, CNPJ, LGPD com advogado, DNS, etc.) do que
  Claude consegue fazer sem bloquear.

### Mudado

- Banner consent é montado dentro de `<Providers>` para ter acesso ao Chakra UI.
- `Analytics.tsx` aguarda `loaded === true` do localStorage antes de tomar
  decisão de carregar telemetria — evita carregar GA4/Pixel num flash inicial
  antes do usuário consentir.

---

## [2.10] — 2026-04-25

### Adicionado

- **Migration TypeORM `platform_costs`** (idempotente, índices
  `(category,active)` e `(recurrence)`).
- **`AdminFinanceService.seedDefaultCosts()`** + endpoint
  `POST /admin/finance/costs/seed` — popula 13 custos reais conhecidos
  da Urban AI (Railway, Sentry, Gemini, Maps, Mailersend, Stripe 4.99%,
  LGPD amortizado etc.). Idempotente por `name`. Botão "Popular default"
  no `/admin/finance`.
- **11 testes unitários** em `finance.service.spec.ts` cobrindo
  `estimatedMrrCents` (matriz F6.5 × 4 ciclos), `totalMonthlyCostsCents`
  (fixos + percentual), `overview` (margem + por-imóvel), `seedDefaultCosts`
  (idempotência).

---

## [2.9] — 2026-04-25

### Adicionado

- **Painéis admin financeiros** — `/admin/finance` (MRR, custos, margem,
  custo por imóvel) e `/admin/pricing-config` (editar matriz F6.5).
- **`PlatformCost` entity** — categorias `infra/apis/comms/payments/people/
  marketing/legal/data/other`, recorrências `monthly/usage_based/one_time/
  percentual`, `scalesWithListings`, `percentOfRevenue`.
- **`AdminFinanceService`** — cálculo de MRR a partir dos `Payment` ativos
  × `billingCycle` × `listingsContratados` × matriz F6.5.

### Corrigido (auditoria F6.5 100%)

- `/plans` agora usa `PricingCalculatorV2` (era toggle binário antigo).
- `/plans/v2` virou redirect para `/plans` (compat).
- `/onboarding` passa `quantity = selectedCount` no checkout.
- `GlobalPaywallModal` passa `quantity = propertyCount` no checkout.
- **Bloqueio server-side** em `POST /connect/addresses` — retorna 403
  `LISTINGS_QUOTA_EXCEEDED` quando anfitrião tenta exceder a quota.

---

## [2.8] — 2026-04-22

### Adicionado

- **Painel admin completo** com 8 seções (`/admin`, `/admin/finance`,
  `/admin/pricing-config`, `/admin/users`, `/admin/events`, `/admin/stays`,
  `/admin/funnel`, `/admin/quality`).
- **F6.2 Plus** — motor de eventos com cobertura total (Sympla, Eventbrite,
  prefeituras, mega-eventos), persistência de relevância, top-N por bairro.
- **Doc `relatorio-status-semanas3-4.md`** + base de apresentação para sócios.

---

## [2.7] — 2026-04-22

### Adicionado

- **Captura passiva de dataset proprietário** (`PriceSnapshot`,
  `OccupancyHistory`, `EventProximityFeature`).
- **`AdaptivePricingStrategy`** — switch automático entre RuleBased / KNN /
  XGBoost / Hybrid quando dataset cresce e MAPE bate gates.
- **ADR 0009** — captura passiva como base do moat de longo prazo.

---

## [2.6] — 2026-04-21

### Adicionado

- **Tier 1 ML scaffolding** — `XGBoostPricingStrategy` (KNN como fallback)
  + dataset registry + featurizer + ADR 0008 sobre transição KNN → XGBoost.

---

## [2.5] — 2026-04-21

### Adicionado

- **F6.5 — cobrança por imóvel + 4 ciclos** (mensal, trimestral, semestral,
  anual) com desconto progressivo. Backend, entity Plan estendido, página
  `/plans/v2` com calculadora, webhook persistindo `billingCycle` e
  `listingsContratados`.

### Mudado

- F5C.3 (operação) e F5C.4 (LGPD/SLO/backup drill/k6/WCAG) concluídas.

---

## [2.4] — 2026-04-20

### Adicionado

- **F6 — Stays bimodal** (recomendação + automático com guardrails).
- **F5C.2 P1 hardening completo**: bcrypt, Helmet+CSP, CORS whitelist,
  Throttler, JWT em cookie httpOnly, ESLint reativado, etc.

---

## [2.3] — 2026-04-18

### Adicionado

- **F5C.1 CRIT** — RapidAPI removida, console.log/passwords saneados,
  migrations TypeORM (Baseline), `.env.example` por serviço, `.gitignore`
  ampliado, repo privado.

---

*Mantenedor: Gustavo Macedo · Versionamento: produto inteiro (não por
serviço). Ver `docs/roadmap-pos-sprint.md` para fonte da verdade do
roadmap.*
