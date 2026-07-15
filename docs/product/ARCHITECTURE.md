# Arquitetura do Sistema — Urban AI

**Versão:** 1.0 (mapeada do código em 2026-06-21)
**Fontes:** `urban-ai-backend-main/` (NestJS), `Urban-front-main/` (Next.js 15), `urban-pipeline-main/` (Prefect/Python), `urban-webscraping-main/` (Scrapy/Python).

> Este documento é o contrato de integração. Antes de implementar qualquer feature que cruze módulos, leia a seção 4 (grafo de integração) e a seção 6 (fluxos críticos). Quebrar essas regras quebra a confiança do produto.

---

## 1. Visão de alto nível

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  FONTES DE DADO │     │   BACKEND (NestJS)    │     │  FRONTEND (Next) │
│                 │     │                       │     │                  │
│ Scrapy spiders  │──┐  │  ~32 módulos          │◀───▶│ myurbanai.com    │
│ (7 bilheterias) │  │  │  223 endpoints        │     │ (público dark)   │
│ APIs (football, │  ├─▶│  MySQL + TypeORM      │     │                  │
│  sympla, fire-  │  │  │  Redis + Bull (jobs)  │     │ app.myurbanai.com│
│  crawl, serp...)│  │  │  21 jobs agendados    │     │ (host + admin)   │
└─────────────────┘  │  └──────────┬───────────┘     └─────────────────┘
         ▲           │             │
         │           │             ▼ (preview→push→rollback)
┌─────────────────┐  │     ┌──────────────────┐
│ Pipeline Prefect│──┘     │  Stays (channel  │
│ S3→MySQL ETL    │        │  manager externo)│
└─────────────────┘        └──────────────────┘
         │
         ▼
   AWS S3 (bronze layer parquet)
```

**Hospedagem:** Railway (backend, frontend, pipeline, webscraping como serviços separados). Timezone dos crons: `America/Sao_Paulo`.

---

## 2. Backend (NestJS) — configuração global

- **Sem global prefix.** Cada `@Controller('x')` define seu próprio path (`/auth`, `/payments`, `/admin`, etc.). *Atenção ao adicionar módulos: o path é o do controller.*
- **Tamanho real (revalidado em 15/07):** **36 controllers, 223 endpoints HTTP, 45 entidades cobertas e 48 migrations** (contagens e auditor estrutural conferidos no repositório).
- **Swagger** em `/api`.
- **Auth:** e-mail/senha + **Google** (`POST /auth/google`, verifica idToken via `tokeninfo`, valida `aud` contra `GOOGLE_CLIENT_IDS`; cria usuário com marcador `google_…` se novo). Cookies httpOnly compartilhados em `.myurbanai.com` (subdomínios).
- **ThrottlerGuard global:** 10 req/s e 100 req/min; rotas sensíveis de auth com `@Throttle` mais restrito (5/min). ⚠️ `/admin/*` ainda sem throttle dedicado.
- **Segurança:** Helmet + CSP, CORS por whitelist (fail-closed), Sentry. `ValidationPipe` global com `whitelist: true` (mas `forbidNonWhitelisted: false` — endurecer).
- **Banco:** MySQL via `DATABASE_URL` (Railway) ou vars individuais. `synchronize` controlado por `DB_SYNCHRONIZE` (default false) + 48 migrations versionadas.
- **Jobs:** Bull + Redis (fila `processos`).
- **Webhook único:** `POST /payments/webhook` (Stripe, verificação HMAC SHA-256, raw body — body-parser sobrescrito para essa rota).
- **Estáticos:** `/uploads` (ServeStaticModule).

---

## 3. Inventário de módulos do backend

> ~32 módulos de domínio. Responsabilidade + principais dependências (quem ele usa).

| Módulo | Responsabilidade | Usa (depende de) |
|--------|------------------|------------------|
| **auth** | Login, JWT, refresh, reset senha, roles/guards | user, email |
| **user** | Perfil, preferências, estado da conta | — (folha) |
| **propriedades** | Imóveis, scraping Airbnb, endereços, preço diário | user, maps, airbnb, pricing |
| **airbnb** | Cliente de scraping de anúncios/preços do Airbnb | (usado por propriedades) |
| **maps** | Geocoding, distâncias, isócronas (Google Maps) | — |
| **evento** | Catálogo de eventos, análise por endereço, cobertura | maps, event-intelligence |
| **event-intelligence** | Scoring de demanda, impacto por imóvel, snapshots | — (consumido por pricing/evento) |
| **pricing** | Motor de recomendação, regras, decisão | knn-engine, event-intelligence, propriedades |
| **knn-engine** | Classificação de imóvel, atratividade, multiplicador | — (folha) |
| **roi** | Receita incremental, taxas, confiança | propriedades, pricing |
| **plans** | Catálogo de planos e features | — (folha) |
| **payments** | Stripe: checkout, webhook, portal, quota | plans, user, email |
| **stays** | Connect/preview/push/rollback de preço | connect, propriedades, pricing |
| **connect** | Camada de integração externa (token, ping) | (usado por stays) |
| **host-panels** | Agregação de dados para telas do anfitrião | propriedades, evento, pricing, roi |
| **dashboard** | Resumo do dashboard do host | host-panels |
| **admin / admin-audit / admin-job-runs / admin-properties** | Operação, auditoria, jobs, gestão de imóveis | quase todos |
| **email / mailer** | E-mail transacional (Brevo) | — |
| **notifications / push** | Notificações in-app e web-push (PWA) | user |
| **communications / communication-preferences** | Eventos de comunicação e preferências por canal | user |
| **contact-submissions** | Formulário público de contato (CRM básico) | — |
| **sugestao** | Sugestões/recomendações ao host | pricing |
| **process / processos** | Controle de processos/jobs legados | — |
| **cron** | Agendador (21 jobs) | dataset/pricing/event/stays services |
| **health** | Healthcheck | — |
| **common** | Utilitários, guards, decorators compartilhados | — |
| **entities** | Definições TypeORM (45 entidades auditadas) | — |

### 3.1 Jobs agendados (21) — timezone São Paulo
Coleta de dataset, bootstrap de pricing, processamento de event-intelligence, auto-apply Stays, digests de recomendação, health de coletores, entre outros. Cada execução registra `AdminJobRun` (status, duração, resultado). **Regra:** todo job novo deve registrar `AdminJobRun` e ser idempotente.

---

## 4. Grafo de integração entre módulos (o que importa de verdade)

**Módulos "hub" (muitas dependências — mexer aqui tem alto blast radius):**
- `admin` (usa ~8 módulos), `connect`, `email`, `propriedades` (~6 cada).

**Módulos "folha" (sem dependências de outros domínios — seguros de evoluir isolado):**
- `knn-engine`, `event-intelligence`, `plans`, `roi`, `user`, `health`, `communications`, `admin-audit`.

**Arestas que NÃO podem ser invertidas (sentido da dependência é regra de negócio):**
- `pricing → knn-engine` e `pricing → event-intelligence` (o motor consome sinais; sinais não conhecem o motor).
- `stays → pricing` (a aplicação consome a decisão; a decisão não conhece o canal de aplicação).
- `roi → pricing` (ROI mede o resultado de uma decisão; é downstream).

> Princípio: **dados e sinais não dependem de decisão; decisão não depende de aplicação; aplicação e ROI são downstream.** Manter essa direção evita acoplamento circular e mantém cada camada auditável.

---

## 5. Modelo de dados (45 entidades)

> Agrupadas por domínio. PK = uuid em todas. Relações e cascatas verificadas nas entidades (`src/entities/*.entity.ts`).

### 5.1 Auth & usuários
`User` (email unique, password select:false, role host/admin/support, pricingStrategy, operationMode, distanceKm) · `RefreshToken` · `PasswordResetToken` · `Notification` · `UserCommunicationPreferences`.

### 5.2 Propriedades & integração
`List` (imóvel; id_do_anuncio Airbnb, dailyPrice, manualDailyPrice, rating, amenitiesCount) · `Address` (cep, lat/long, cidade indexada) · `ExternalListing` (referência externa normalizada) · `StaysAccount` (accessToken AES-256, consentimento versionado, maxIncreasePercent 25 / maxDecreasePercent 20) · `StaysListing` (operationMode inherit/notifications/auto) · `CoverageRegion` (escopo geográfico, raio).

### 5.3 Eventos (8 entidades)
`Event` (dedupHash unique, relevancia, raioImpactoKm, venueCapacity, dedupStatus, outOfScope, pendingGeocode) · `EventSource` (proveniência por fonte) · `EventDedupCandidate` (par canônico↔duplicado, score, banda de confiança) · `EventIntelligenceSnapshot` (eventDemandScore, drivers, riskFlags, versão de métrica/modelo) · `EventPropertyImpact` (impacto por imóvel: distância, captura, preço recomendado, cenários) · `EventHistoricalMultiplier` (multiplicador histórico versionado) · `AnaliseEnderecoEvento` (distância endereço↔evento) · `EventProximityFeature` (features agregadas por imóvel: eventos em 7/14/30d).

### 5.4 Pricing & planos (11 entidades)
`Plan` (preços por ciclo, stripePriceIds, propertyLimit, min/maxProperties, selfServiceEnabled) · `Payment` (status, customerId/subscriptionId Stripe, billingCycle, listingsContratados, planName) · `AnalisePreco` (precoSugerido, status suggested→accepted/rejected/applied/expired, verificação, resultado real) · `PriceUpdate` (origin ai_auto/user_accepted/user_manual/rollback, idempotencyKey unique, rollbackOf self-ref) · `PriceSnapshot` (histórico de preço/observação, trainingReady) · `OccupancyHistory` (ocupação/receita por data, trainingReady) · `PricingInputHistory` · `PricingRuleConfig` (regras por imóvel: weekend_uplift, gap_night_filler, event_uplift...) · `PortfolioPropertySetting` (estratégia conservative/balanced/aggressive/ai) · `PricingDecisionSnapshot` (decisão completa auditável) · `PricingRecommendationDigest`.

### 5.5 Portfólio
`PortfolioActionRun` · `PortfolioActionItem` · `PortfolioDailyPriceOverride`.

### 5.6 Comunicações
`PushSubscription` · `PushDelivery` · `CommunicationEvent` (channel email/push/in_app, correlationId) · `AskUrbanMessage` (role, citations, feedback) · `ContactSubmission` (category/severity P0-P3) · `Waitlist` (position, referral).

### 5.7 Admin & integrações
`AdminAuditLog` (imutável, sem FK) · `AdminJobRun` · `ProcessStatus` (tabela `process_status`) · `AirbnbPricingAttemptLog` · `PlatformCost`.

### 5.7b Auth (complemento)
`EmailConfirmation` (tabela `email_confirmations`, FK→User) — confirmação de e-mail pós-signup. A contagem atual de 45 também incorpora `ExternalListing` e `EventHistoricalMultiplier`, adicionadas após a revisão anterior.

### 5.8 Hubs do grafo de dados
- **User** é o centro: 1:N para quase tudo; deleção cascateia (base para LGPD).
- **List ↔ Address** ancoram imóvel e localização; alimentam snapshots, ocupação e features de evento.
- **Event** cascateia para sources, snapshots, impactos, dedup e análises.
- **AnalisePreco / PricingDecisionSnapshot** conectam sinal → decisão → aplicação (`PriceUpdate`) → resultado (ROI).

### 5.9 Observações de integridade (dívidas a corrigir)
- Sem soft-delete em lugar nenhum — considerar para `Event` (trilha) e `AnalisePreco` (retenção LGPD).
- Faltam índices em consultas frequentes: `PriceUpdate.user` (+createdAt), `EventPropertyImpact.user` (+generatedAt).
- Versão de métrica/modelo (`metricVersion`/`modelVersion`) presente nos snapshots — **manter esse padrão** em qualquer sinal/decisão novo (rastreabilidade de ML).

---

## 6. Fluxos críticos (passo a passo + contrato)

### 6.1 Coleta → Evento canônico
1. Spiders Scrapy (7 bilheterias) e coletores REST (API-Football, Sympla, Firecrawl, SerpAPI, Tavily) gravam bruto no S3 e/ou postam em `POST /events/ingest` (com `URBAN_EVENTS_INGEST_API_KEY`).
2. Pipeline Prefect faz ETL S3 → MySQL.
3. Backend deduplica (`dedupHash` + `EventDedupCandidate`), geocodifica (`pendingGeocode`), aplica escopo (`outOfScope` via `CoverageRegion`) e enriquece.
4. **Contrato:** nada vira sinal de preço sem estar `dedupStatus=canonical`, geocodificado e in-scope.

### 6.2 Imóvel → sinais de proximidade
1. Onboarding faz scraping dos anúncios do host (Airbnb) → `List`.
2. Endereço verificado (CEP+número) → geocoding → `Address` (lat/long).
3. Job calcula `EventProximityFeature` por imóvel (eventos em 7/14/30d, distância do mais próximo, relevância média).

### 6.3 Recomendação de preço
1. `pricing` consome: classificação KNN do imóvel + atratividade/proximidade do evento + regras (`PricingRuleConfig`) + estratégia (`PortfolioPropertySetting`).
2. Calcula multiplicador (ver regras na seção 7) → preço sugerido.
3. Persiste `PricingDecisionSnapshot` / `AnalisePreco` com drivers, guardrails, cenários, explicação e versões de modelo.
4. **Contrato:** toda recomendação aplicável precisa de snapshot com guardrails e explicação.

### 6.4 Aplicação via Stays
1. `preview` valida guardrails da conta (`maxIncreasePercent`/`maxDecreasePercent`) → retorna `withinGuardrails`, `readyForPush`, blockers/warnings.
2. `push` (idempotente, Idempotency-Key) → `POST /listings/{id}/prices` no Stays, retry exponencial só em 5xx/rede → grava `PriceUpdate`.
3. `rollback` referencia o `PriceUpdate` anterior (self-ref).
4. **Contrato:** nunca pular o preview; nunca aplicar fora do guardrail; modo `auto` só dentro do guardrail.

### 6.5 Resultado → ROI
1. Observa reserva/receita real (`AnalisePreco.reservaStatus`, `OccupancyHistory`).
2. ROI classifica em confirmado/projetado/perdido e calcula roiPercent/roiMultiple.

### 6.6 Pagamento → quota
1. Checkout Stripe (`price × quantity`) → webhook `checkout.session.completed` → `Payment` ativo.
2. Quota = `listingsContratados` do Payment ativo; paywall server-side compara com imóveis ativos.

---

## 7. Regras do motor de preço (referência rápida com origem)

| Regra | Valor | Origem |
|-------|-------|--------|
| Preço sugerido | `basePrice × multiplier` | `knn-engine/pricing-engine.ts` |
| Multiplicador base | 1.0 | idem |
| Boost categoria | Premium +20%, Standard +10% | `pricing-engine.ts` |
| Boost atratividade | score>80 +50%, score>50 +20% | `cost-matrix` |
| Boost proximidade | isócrona <15 min +30% | `isochrone` |
| Elasticidade evento | +relevância/200 | `pricing-engine.ts` |
| Guardrails Stays | +25% / −20% (default por conta) | `StaysAccount` |
| Features KNN | lat, long, distância metrô, amenidades | `knn-classifier` |
| Categorias | Econômico(0)/Standard(1)/Premium(2) | `knn-classifier` |

> ⚠️ A engine **ativa** está em `urban-ai-backend-main/src/knn-engine/`. O microserviço `urban-ai-knn-main/` está **DEPRECADO** (arquivar e remover) — não é fonte da verdade.

---

## 8. Frontend (Next.js 15) — arquitetura de rotas

- **App Router**, output standalone, TS strict, Chakra UI 2 (legado) + Tailwind 4 (novo), NextAuth 4, Stripe Elements, Sentry, Leaflet, i18next (pt/en/es).
- **Roteamento por subdomínio** (`src/middleware.ts`):
  - `myurbanai.com` → site público (rewrite de `/` → `/landing`); `www` e `.com.br` → 301 para apex.
  - `app.myurbanai.com` → app autenticado (login na raiz, dashboard, admin).
  - Pedir rota de app no domínio público (ou vice-versa) → 301 cruzado.
- **API base:** `NEXT_PUBLIC_API_URL` (sem IP hardcoded); interceptor injeta Bearer e trata 401/403.

### 8.1 Rotas (77 telas `page.tsx` + 2 API routes) por área
- **Público (14):** `/` (landing), `/sobre`, `/contato`, `/termos`, `/privacidade`, `/precos`, `/lancamento` + 7 páginas SEO (precificação dinâmica, eventos, SP, integração Stays, vs planilha, segurança LGPD).
- **Auth (5):** `/create`, `/login`, `/request-reset-password`, `/reset-password/[id]`, `/confirm-email/[id]`.
- **Onboarding (5):** `/post-login`, `/onboarding`, `/onboarding/payment/price`, `/address-verification`, `/waitlist/aceitar`.
- **Host app (~40):** `/dashboard`, `/portfolio` (+history), `/properties` (+[id], pricing-rules, market), `/events` (+[eventId]), `/near-events` (+[id]), `/event-log`, `/event-radar`, `/maps`, `/my-roi`, `/plans`, `/price`, `/my-plan`, `/settings/pricing|integrations|communications`, `/profile`, `/notificacao`, `/forbidden`.
- **Admin (29):** ver lista no PRD §3.9.
- **API routes (2):** `/api/auth/[...nextauth]`, `/api/admin/seo/connectors`.
- **Órfãs (limpar):** `/maps-bkp`, `/painel` (duplica `/dashboard`), `/plans/v2` (redireciona a `/plans`).

### 8.2 Três superfícies visuais
`.urban-manifesto` (público dark), `.urban-app` (host, light premium), `.urban-admin` (admin dark). Detalhe em `DESIGN-SYSTEM.md`.

---

## 9. Pipeline & Webscraping (Python)

- **Webscraping (Scrapy 2.11 + Playwright):** 7 spiders (eventim, ticketmaster, sympla, ingresse, even3, blue_ticket, ticket_360); `ROBOTSTXT_OBEY=True`, AutoThrottle, retry exponencial; cliente de ingest com buffer fail-soft e refresh de JWT; 11 arquivos de teste; deploy via Scrapyd.
- **Pipeline (Prefect 3.4 + Pandas + SQLAlchemy + boto3):** ETL S3→MySQL e trigger de spiders; credenciais escapadas; 12+ testes E2E (moto/testcontainers); ruff + mypy strict.
- **Agendamento:** Prefect flows (`spider-triggers`, `raw-data-pipeline`), com health-check do Scrapyd antes de disparar.

---

## 10. Integrações externas

| Serviço | Uso | Variáveis-chave |
|---------|-----|-----------------|
| Stripe | Cobrança, webhook, portal | `STRIPE_*`, `*_PRICE_*` |
| Stays | Aplicação de preço | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY` |
| Airbnb | Scraping de anúncios/preços | (chave pública do cliente web — mover para env) |
| Google Maps | Geocoding/distâncias | `GOOGLE_*` (⚠️ Geocoding 403 — billing) |
| Brevo | E-mail | `BREVO_API_KEY` |
| Gemini | Ask Urban / enrichment | `GEMINI_API_KEY` |
| Firecrawl/SerpAPI/Tavily/API-Football | Coleta de eventos | chaves por coletor |
| Sentry | Observabilidade | `SENTRY_DSN` (criar) |

---

## 11. Riscos arquiteturais conhecidos (resumo)

1. KNN legado duplicado (`urban-ai-knn-main`) — arquivar.
2. `forbidNonWhitelisted: false` e `/admin/*` sem throttle dedicado.
3. Cobertura de testes fina no caminho crítico (`propriedades/`, engine KNN ativa).
4. Cores e nome hardcoded fora dos tokens (ver `REBRAND-MAP.md`).
5. Dependências externas no caminho crítico (Geocoding/Stays) — degradar com elegância (fail-soft já existe no ingest; replicar no pricing).

> Para próximos passos priorizados e estado de go-live, ver `../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md` e `../plano-mestre-scorecard-10-10-2026-07-15.md`.

---

## 12. Anexo — features recentes em profundidade (code dive verificado)

> Estas seções detalham o que a v1 tratou de forma rasa. Citações de arquivo no backend `urban-ai-backend-main/src`.

### 12.1 AskUrban (`host-panels/`)
- Endpoints: `GET /ask/usage` (`{used, quota, hardCap, canUse, plan, reason}`), `POST /ask/question` (`{question, conversationId}` → `{messageId, content, citations, usage}`), `POST /ask/feedback`.
- **Entitlement** (`host-panels.service.ts` ~180–350): `resolveAskEntitlement` checa subscription ativa/trial/alpha e plano permitido (`ASK_URBAN_ALLOWED_PLANS`, default `profissional,escala,alpha`); razões de negação: `no_active_subscription`, `subscription_expired`, `plan_not_allowed`.
- **Quota diária**: `ASK_URBAN_DAILY_QUOTA` (~100) e hard cap (~200); entre quota e hard cap → 429 soft; acima → nega. Contagem = `AskUrbanMessage` do dia com `role='user'`.
- **Contexto/resposta** (`buildAskAnswer` ~530–620): carrega imóveis + `AnalisePreco` (até 500, só eventos canônicos), agrega receita real, lift potencial, contagens; responde por **templates baseados em keywords** com citações para telas (`/painel` etc.).
- ⚠️ **Não há chamada a LLM externo no caminho de resposta** (apesar de `GEMINI_API_KEY` existir). É determinístico hoje — LLM real é roadmap.

### 12.2 Pace (`/pace/portfolio`)
Ritmo de reservas: ocupação real vs. esperada por dia da semana (histórico 90d → expectativa por weekday → % por data no range, default 60d, até 180d). Hoje é **diagnóstico**; candidato a input de `propertyCapture` no pricing.

### 12.3 Market Intel (`/properties/:id/market-intel`)
Retorna percentil de ADR, mediana de ADR/ocupação, **comp set** (raio 3 km via haversine; fallback cidade+estado; até 10 comparáveis anonimizados Comp-01…), reatividade a eventos, série diária. Freshness: build no momento da query (sem cache explícito), lookback 30–90d sobre `OccupancyHistory`/`PriceSnapshot`.

### 12.4 Host Event Radar + Admin Intelligence
- Host (`host-events.controller.ts`): `/host/events/catalog|radar|heatmap|:eventId|:eventId/intelligence|:eventId/property-impact|:eventId/simulate-pricing`.
- Admin: `/admin/events/intelligence|heatmap|blind-spots|:eventId/recompute-intelligence|intelligence/recompute`.
- **Heatmap** (`event-intelligence.service.ts` ~1565–1650): grid arredondando lat/lng a 0.02° (~2 km), por célula agrega demand scores (média/max/p90), contagem de impactos, receita potencial, distribuição de categorias; métrica configurável (default `eventDemandScore`).
- **Demand Score** (`knn-engine/event-pricing-intelligence.service.ts`): pesos ~ relevância 30%, attendance/capacidade 25%, venue 15%, frescor 10%, raio 10%, sobreposição 10%; confiança low/medium/high por completude+frescor.
- **Blind-spots** (`adminBlindSpots` ~434–475): `missingCoordinates`, `missingOfficialUrl`, `staleSource` (>72h), `missingIntelligenceSnapshot`, `highDemandWithoutPropertyImpact` (score≥70 sem impacto). Até 25 itens por categoria.

### 12.5 Portfolio cockpit + bulk actions
`portfolio.controller.ts`: `/portfolio/calendar|opportunities|action-runs|simulate-action|bulk-action`. Bulk actions (`host-panels.service.ts` ~920–1100): `set-base-price`, `apply-strategy` (cria/atualiza `PortfolioPropertySetting`), `set-date-price` (cria `PortfolioDailyPriceOverride` por data). Auditoria: `PortfolioActionRun` (running→completed/failed) + `PortfolioActionItem` (planned/applied/failed/skipped). Validações de ownership e payload antes de aplicar.

### 12.6 KNN engine — estratégias, auto-tier, backtesting
- `pricing-strategy.factory.ts` (`PRICING_STRATEGY`, default `adaptive`): `rules`, `xgboost`, `shadow` (roda XGBoost em sombra, loga, usa rules), `adaptive`.
- **Adaptive auto-tier** (`strategies/adaptive-pricing.strategy.ts`): Tier 0 (<500 listings×30d ou XGBoost sem modelo) → rules; tiers 1–3 conforme dataset cresce → XGBoost (validado por MAPE); tier 4 hybrid-neural aspiracional. Decisão cacheada ~5 min; fallback resiliente para rules + Sentry.
- **Backtesting** (`backtesting.ts`): `calculateBacktest` → `{mapePercent, rmse, sampleSize, medianAbsoluteError}`; gate **MAPE ≤ 15%** (F6.1). Classifier fallback → `{categoryId:1, "Standard"}` quando sem treino/coordenadas.

### 12.7 PricingDecisionSnapshot — geração e idempotência
Gerado (`event-intelligence.service.ts`, via `PricingCalculateService`) a partir de `AnalisePreco` + `EventPropertyImpact`; monta `inputSignals` (relações, preços, drivers, cenário selecionado, outcome). **Idempotência a nível de aplicação** (`PRICING_DECISION_IDEMPOTENCY_VERSION = 'pricing-decision-v0'`): em recompute, busca snapshot equivalente e o reutiliza (`reused: true`, ver linhas ~742/844) em vez de duplicar. ⚠️ **Não há constraint UNIQUE no banco** garantindo a unicidade — a idempotência é lógica, não imposta pelo schema (melhoria sugerida: índice único). Consumido por host, admin, ROI, finance/ML.

### 12.8 PWA / mobile (verificado nos E2E)
Manifest standalone (`name` Urban AI, theme `#E8500A`, bg `#080A0F`, `start_url=/dashboard`, shortcuts Dashboard/Calendário, ícones 192/512/maskable). Service worker `sw.js`: network-first navigation + navigation preload, fallback `/offline.html`, bloqueia POST/`/api` offline. Web push existe no backend (módulo `push`) mas o E2E não cobre push. Rotas testadas sem overflow em 390×844.
