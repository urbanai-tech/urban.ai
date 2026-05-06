# Changelog

Todas as mudanças relevantes ficam aqui. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versionamento
do produto inteiro (não por serviço). Ordem cronológica reversa — mais novo
primeiro.

---

## [2.16] — 2026-05-06

### Adicionado

- **`AdminService.eventsListing(filters)`** + endpoint `GET /admin/events/list` —
  listagem paginada de eventos com filtro `scope=in/out/all`, `source`, `search`,
  `upcoming`. Default `scope=in` (esconde out-of-scope).
- **`AdminService.collectorsHealth()`** + endpoint `GET /admin/events/collectors-health` —
  stats agregadas por source: total, last24h, last7d, outOfScope%, pendingGeocode,
  pendingEnrichment, enriched, errorRate, lastSeen.
- **Página `/admin/events` ganha:** KPI "Dentro da cobertura", atalhos pra
  `/admin/coverage` e `/admin/collectors-health`, seção "Listagem detalhada"
  com tabs in/out/all + busca + filtro source + tabela compacta com flags
  Geo/Scope/Enrich e paginação.
- **Página `/admin/collectors-health` nova** — 5 KPIs agregados, tabela por source
  com 10 colunas, badge "STALE" para coletor >48h sem dados, color coding
  (red `last24h=0`, amber `outOfScope%>30`, etc.), guia "como ler" no rodapé.
- **`UspEventosCollector`** — scraping leve do `eventos.usp.br` (sem JS),
  rejeita eventos em campi fora SP capital (Ribeirão, Bauru, Lorena, etc.),
  parsing de data PT-BR + ISO 8601. 8 testes.
- **`MarchaParaJesusCollector`** — evento anual fixo (~3M pessoas), tenta
  scraping leve do site oficial; fallback heurístico (primeira quinta de junho,
  Corpus Christi). venueCapacity=3M, venueType=outdoor. 6 testes.
- **`run_all_collectors.sh`** atualizado com USP + Marcha pra Jesus no cron 24h.
- **Documentos:** `docs/base-socios.md` v2.0 com estado atual, `docs/roadmap-pos-sprint.md`
  v2.16 com changelog completo.

### Métricas
- 196 testes verdes (141 backend + 55 Python).

---

## [2.15] — 2026-05-06

### Adicionado

- **F6.2 Plus — Cobertura geográfica híbrida** (resolve poluição "eventos do
  Brasil todo" no DB + permite expansão Rio/BH/Brasil sem deploy):
  - Entity `CoverageRegion` + migration `AddCoverageAndEnrichmentFields1746500000000`
    idempotente
  - `CoverageService.isWithinCoverage(lat, lng)` com cache 5min, haversine,
    suporta 2 modos de geometria (centro+raio OU bounding box)
  - Modelo Híbrido: data-driven (raio 80km de cada Address) + admin override
    (regions com status active/bootstrap/inactive)
  - `CoverageController` CRUD admin completo + endpoint `/check` (testar ponto)
  - `CoverageSeederService` cria automaticamente "Grande São Paulo" no boot
- **EventsIngest e Geocoder** agora aplicam check de cobertura — marcam
  `outOfScope=true` (preservado no DB, mas ignorado pelo motor e Gemini)
- **Bug fix crítico:** `EventsEnrichmentService` reescrito. Antigo travava em
  `relevancia=0` permanente em qualquer falha do Gemini (limbo). Agora usa
  `enrichmentAttempts` (max 3) com retry após 24h. Endpoint
  `/admin/coverage/reset-stale-enrichment` corrige eventos antigos.
- **LLM extractor** ganha `is_in_scope: bool` no schema Pydantic. Coletores
  LLM (Firecrawl/SerpAPI/Tavily) refatorados com 3-4 queries focadas SP capital
  + dedup por title/url. SerpAPI usa `location` param.
- **Página `/admin/coverage`** — CRUD visual completo com stats, tabela com
  dropdown de status, formulário circle/bbox, ferramenta de teste de ponto.

### Mudado

- Entity `Event` ganha 4 colunas: `outOfScope` (indexed), `enrichmentAttempts`,
  `enrichmentLastAttemptAt` (indexed), `enrichmentLastError`.

---

## [2.14] — 2026-05-05 (outro dev)

### Adicionado

- **Camada 2 do motor de eventos** — coletores REST por outro dev:
  - `ApiFootballCollector` (jogos Allianz/Morumbi/Itaquerão, filtra cidade SP)
  - `FirecrawlExtractor` (busca + scraping + Gemini LLM extraction)
  - `SerpApiEventsCollector` (Google Events box)
  - `TavilySearchCollector` (busca web semântica)
  - `utils/llm_extractor.py` com schema Pydantic
- **Cron 24h em `auth_proxy.py`** thread roda `run_all_collectors.sh` com
  os 4 coletores REST + 7 spiders Scrapyd via curl.
- **`EventsEnrichmentService`** agora chama Gemini Flash de verdade (era stub) —
  prompt específico de hospitalidade, gera relevancia 1-100 + raioImpactoKm +
  capacidadeEstimada.
- **`pyproject.toml`** ganha deps: `bcrypt`, `google-genai`, `pydantic`, `pymysql`.
- **User `collector@urban.ai`** criado em prod com role admin.

### Auditado por Claude (06/05)
- Identificado bug do enrichment (limbo perpétuo) → fix em v2.15
- Identificado gap de cobertura geográfica → resolvido em v2.15
- `sp_cultura` ainda fora do cron → adicionado em v2.15

---

## [2.13] — 2026-04-25

### Adicionado

- **F6.2 Plus Camada 3 — curadoria humana e import CSV**
  - `EventsCsvImportService` com parser CSV próprio (sem dep externa, suporta
    aspas/escape ""/CRLF/LF, max 1000 linhas, 5MB)
  - `POST /events/import-csv` (multer admin-only, throttled 10/min)
  - Página `/admin/events/new` form completo com defaults sensatos
  - Página `/admin/events/import` upload com preview, stats por source,
    botão "Baixar template CSV"
  - 14 testes novos

---

## [2.12] — 2026-04-25

### Adicionado

- **F6.2 Plus base — schema + endpoint universal de ingestão de eventos:**
  - Entity Event ganha colunas de procedência: `source`, `sourceId`,
    `dedupHash` (UNIQUE), `venueCapacity`, `venueType`, `expectedAttendance`,
    `crawledUrl`, `pendingGeocode`. Migration `AddEventCoverageFields1746000000000`
    idempotente.
  - `EventsIngestService` com `ingestBatch` (max 500), dedup por hash
    sha256(nome|date|geo~3), UPSERT conservador (preserva enriquecimento da IA).
  - `POST /events/ingest` admin-only throttled 60/min.
  - `EventsGeocoderService` com cron 30min — pega eventos `pendingGeocode=true`
    e geocodifica via Maps. Endpoint admin `POST /events/geocoder/run` para
    disparar manual.
- **Fase A — atualização dos 7 spiders Scrapy legados:**
  - `UrbanIngestPipeline` em `pipelines.py` — postam pro `/events/ingest`
    em paralelo às pipelines S3
  - `utils/venue_map.py` com 25+ venues SP catalogados (Allianz, Morumbi,
    Itaquerão, Pacaembu, Interlagos, SP Expo, Anhembi, etc.)
  - `utils/urban_backend_client.py` cliente HTTP Python com login JWT cache,
    buffer batch 100, retry exponencial, fail-soft
- **`SpCulturaCollector`** — coletor da Prefeitura SP (sem auth, gratuito).
  Paginação até 5 páginas × 100 items, suporte a 4 formatos de geo.
- **`BaseCollector`** abstrato — esqueleto reusável: subclasses só implementam
  `fetch_raw()` e `normalize(raw)`, resto vem de graça (auth, batch, dedup,
  enrich via venue_map, retry, métricas).
- **36 testes novos** (jest + pytest).

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
