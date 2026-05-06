# Urban AI — Roadmap Pós-Sprint
**Versão 2.9 · Atualizado: 25/04/2026 (madrugada) · Base: Sprint de migração encerrado em D14 (20/03/2026)**

> 📘 **Para sócios / pitch:** [`docs/base-socios.md`](base-socios.md) — base centralizada de status, em linguagem direta.
> 📕 **Para tecnologia / IA:** [`docs/estado-da-IA-e-evolucao.md`](estado-da-IA-e-evolucao.md) — referência consolidada.

> 🆕 **v2.9 (25/04/2026 · madrugada) — F6.5 100% configurada + painel financeiro + configuração de preços.**
> 1. **F6.5 fechada de verdade.** Auditoria revelou que estava ~50%: `/plans` antigo (toggle binário) ainda em uso, `/onboarding` chamava checkout sem `quantity`, `GlobalPaywallModal` redirecionava para v1, `ListingsQuotaGuard` criado mas nunca usado em lugar nenhum. **Corrigido tudo:**
>    - `/plans` agora serve a matriz F6.5 oficial (PricingCalculatorV2). `/plans/v2` virou alias com redirect.
>    - `/onboarding` step de checkout passa `quantity = selectedCount` (imóveis selecionados).
>    - `GlobalPaywallModal` passa `quantity = propertyCount`.
>    - **Bloqueio server-side no `POST /connect/addresses`**: anfitrião com plano de N imóveis não consegue cadastrar mais que N (ForbiddenException 403 com payload `LISTINGS_QUOTA_EXCEEDED`). Proteção real, não só UX.
> 2. **Página `/admin/finance`** com MRR estimado, custos cadastrados (CRUD completo), margem absoluta + percentual, e **por imóvel ativo:** receita, custo, margem (verde/amarelo/vermelho conforme threshold).
> 3. **Entity `PlatformCost`** + endpoints `/admin/finance/{overview,costs}` (CRUD).
> 4. **Página `/admin/pricing-config`** para editar preços F6.5 sem mexer em código (4 preços × ciclo, 3 % desconto, propertyLimit, badges). Stripe Price IDs read-only.
> 5. **Endpoints `GET/PATCH /admin/plans-config/*`** para CRUD de preços.
>
> Resposta às perguntas: **Página de custos com custo por imóvel?** SIM — `/admin/finance`. **Rota para configurar preços?** SIM — `/admin/pricing-config`. **F6.5 está 100%?** AGORA SIM. **Bloqueios necessários?** SIM — quota server-side.

> 🆕 **v2.16 (06/05/2026) — F6.2 Plus completa: 3 camadas + cobertura híbrida + admin de saúde.** Sprint massivo desde v2.11:
> 1. **Camada 1 — APIs oficiais e fontes públicas (parcial):** ApiFootballCollector (jogos do Allianz/Morumbi/Itaquerão), SpCulturaCollector (Prefeitura SP), UspEventosCollector (defesas/seminários/cursos), MarchaParaJesusCollector (anual fixo, 3M pessoas). Sympla API e Eventbrite ficaram pra depois.
> 2. **Camada 2 — Web search + LLM extraction:** FirecrawlExtractor (busca + scraping + Gemini), SerpApiEventsCollector (Google Events box), TavilySearchCollector (busca web semântica), todos com queries focadas SP capital + dedup. `utils/llm_extractor.py` com schema Pydantic + filtro `is_in_scope=true` (descarta antes de bater no backend).
> 3. **Camada 3 — Curadoria humana:** `/admin/events/new` (form 1 a 1) + `/admin/events/import` (upload CSV em lote, max 1000 linhas, dedup automático).
> 4. **Cobertura geográfica híbrida:** entity `CoverageRegion` + admin CRUD `/admin/coverage` + service com cache 5min. Modelo "data-driven (raio 80km de imóveis cadastrados) + override admin (status active/bootstrap/inactive)". **Quando primeiro anfitrião do Rio cadastrar imóvel, motor automaticamente cobre Rio** sem deploy. Eventos fora viram `outOfScope=true` (preservados, mas ignorados pelo motor + Gemini). Seed automático "Grande SP" no boot.
> 5. **Bug fix crítico do enrichment:** `EventsEnrichmentService` antigo travava em `relevancia=0` permanente em qualquer falha do Gemini (limbo). Reescrito com `enrichmentAttempts` + retry após 24h até 3x.
> 6. **Admin de eventos completo:** `/admin/events` ganha tab in/out/all + busca + filtro por source + tabela detalhada com flags Geo/Scope/Enrich. Página nova `/admin/collectors-health` com badge "STALE" para coletor sem dados >48h, color coding por outOfScope%/errorRate. KPI "Dentro da cobertura" com counter inScope+outOfScope.
> 7. **Cron orquestrado:** `auth_proxy.py` thread chama `run_all_collectors.sh` a cada 24h: 4 coletores REST + 7 spiders Scrapyd. Tudo bate em `POST /events/ingest` com dedup automático.
> 8. **Migrations idempotentes** novas: `AddEventCoverageFields`, `AddCoverageAndEnrichmentFields`. Backend agora tem 141 testes verdes (era 84 na v2.4).
>
> Resposta às perguntas: **eventos do Brasil todo poluindo DB?** Resolvido via cobertura híbrida. **Como expandir Rio/BH/Curitiba?** Zero código — admin marca região no painel. **Pra ver o que cada coletor está trazendo?** `/admin/collectors-health` agrupa por source.

> 🆕 **v2.8 (24/04/2026 · deep night) — Painel admin expandido + F6.2 Plus autorizada + doc executivo.**
> 1. **Painel admin expandido** com 5 endpoints novos + 4 páginas novas:
>    - `/admin/events` — analytics do motor de eventos (cobertura geo, % enriquecimento Gemini, próximos 7/30/90d, mega-eventos, top 10 por relevância, distribuição por categoria/cidade)
>    - `/admin/stays` — saúde da integração (contas por status, listings, push history últimos 30d)
>    - `/admin/funnel` — funil signup → análise → aceito → aplicado → assinatura
>    - `/admin/quality` — MAPE real (preço aplicado vs sugerido), gate de qualidade, cobertura de ocupação
>    - Navegação consolidada no `/admin` raiz
> 2. **Fase F6.2 Plus** — cobertura total de eventos em SP (3 camadas: APIs oficiais → Firecrawl → curadoria) AUTORIZADA pelo Gustavo. Custo ~US$ 40/mês. Entrega 6 semanas. Doc dedicado: `docs/fase-eventos-cobertura-total.md`.
> 3. **`docs/base-socios.md`** — documento executivo para conversar com Fabrício/Rogério, organizado em 7 partes (status, IA, eventos, cronograma, decisões pendentes, custos, como acompanhar).
> 4. **`docs/runbooks/admin-evolution.md`** — análise honesta dos gaps remanescentes do painel (~60% completo) + plano de evolução por sprint (financeiro, saúde técnica, marketing, suporte, drill-down, auditoria).
>
> Resposta às perguntas do Gustavo:
> - **Eventos no painel admin?** SIM — `/admin/events` completo com KPIs.
> - **Painel mostra 100% da gestão?** Honesto: ~60%. Plano detalhado em runbooks/admin-evolution.md.
> - **Roadmap dos eventos autorizado?** SIM — F6.2 Plus ativada, KPIs no admin já visíveis.
> - **Doc consolidado para sócios?** [`docs/base-socios.md`](base-socios.md) entregue.

> 🆕 **v2.7 (24/04/2026 · final do dia) — Painel admin + 5 gaps de captura resolvidos + motor de eventos planejado + doc consolidado.**
> 1. **5 gaps de captura resolvidos:** `OccupancyHistory` entity (resolve `ocupacaoReferencia: 0` hardcoded), `EventProximityFeature` entity (features no tempo), `AnalisePreco.precoAplicado` + endpoint (ground truth MAPE), snapshot diário + comps persistidos (já v2.6).
> 2. **Painel admin Urban AI completo:** backend (`User.role`, `RolesGuard`, `AdminService`, 6 endpoints) + frontend (`/admin` overview + `/admin/users` gestão). Resposta à pergunta "como gerir a Urban?".
> 3. **Motor de eventos — runbook em 3 camadas:** APIs oficiais (Sympla, Eventbrite, Prefeitura, Football) → Firecrawl + LLM (Anhembi, RD Summit, estádios, FGV) → curadoria humana. ~US$ 20-40/mês para cobertura ampla. `docs/runbooks/event-engine-evolution.md`.
> 4. **`docs/estado-da-IA-e-evolucao.md`** — documento principal consolidado para apresentações.
>
> Resposta às 3 perguntas: **dataset próprio sendo capturado** (3 frentes), **switch automático de modelo conforme dataset cresce** (AdaptivePricingStrategy), **painel admin existe** (`/admin`).

> 🆕 **v2.6 (24/04/2026 · madrugada) — Captura passiva de dataset + auto-tier + caminho do moat.** Após a v2.5, descoberta importante na investigação do código: o sistema **já capturava `comps`** (imóveis parecidos da vizinhança via Airbnb GraphQL) durante cada análise mas os **descartava** depois. Virou ouro:
> 1. **`PriceSnapshot` entity** — tabela do dataset proprietário Urban AI com índice composto p/ idempotência diária + features espaciais + flag `trainingReady`.
> 2. **`DatasetCollectorService`** com 3 frentes:
>    - **Cron diário 03:30 BRT** tirando snapshot de TODOS os imóveis cadastrados (não depende de evento próximo)
>    - **Persistência automática dos comps a cada análise** — dataset cresce passivamente, ~10–30 pontos novos por análise rodada
>    - **`recordAppliedPrice`** grava ground truth quando Stays aplica preço (Tier 4)
> 3. **`AdaptivePricingStrategy`** — auto-tier que escolhe modelo automaticamente conforme volume cresce (Tier 0 regras → Tier 2 XGBoost → Tier 4 híbrido). **Sem deploy entre tiers.** Default mudou para 'adaptive' (cai em rules quando dataset insuficiente — comportamento atual idêntico).
> 4. **ADR 0009** documenta o caminho ao moat: modelo neural híbrido (CNN+LSTM+MLP) com cronograma realista 18–24 meses.
> 5. **`docs/next-actions.md`** consolidando 18 ações operacionais que dependem de você.
>
> Resposta direta à pergunta do Gustavo: **agora sim estamos mapeando e salvando dados de preço dos imóveis cadastrados** para construir dataset próprio — antes não estávamos, era tudo gerado e descartado.

> 🆕 **v2.5 (24/04/2026 · noite) — Arquitetura ML pronta + dataset mapeado.** Após a v2.4, mais 4 entregas técnicas pesadas:
> 1. **ADR 0008** que substitui parcialmente o ADR 0002: KNN é só baseline; **XGBoost é o caminho do moat**, com modelo neural híbrido como Tier 4 aspiracional. Caminho de evolução em 4 estágios do algoritmo, alinhado com os 4 Tiers de maturidade da IA.
> 2. **Strategy pattern plugável no motor** (`PricingStrategy` interface + `RuleBasedPricingStrategy` + `XGBoostPricingStrategy` skeleton + `ShadowPricingStrategy` para dual-run + `PricingStrategyFactory`). Trocar algoritmo via env var `PRICING_STRATEGY`. **Backend pronto para receber XGBoost** sem mexer em produto.
> 3. **`PricingBootstrapService`** chama `initialize()` no boot + cron domingo 04h BRT. **`FeatureEngineeringService`** skeleton para os 3 enriquecimentos (lat/lng, metroDistance, amenitiesCount). **Backtesting** com `calculateMAPE` + `meetsQualityGate(15%)` + 9 testes. Tier 0 → Tier 1 virou questão de plug-in do dataset + completar 3 stubs claros.
> 4. **Pesquisa de fontes de dataset feita** (`docs/runbooks/dataset-acquisition.md`). Achado: **InsideAirbnb NÃO cobre SP** no portal direto, só Rio. SP vive via Base dos Dados (BigQuery, espelho CC BY 4.0). Top 3 viáveis hoje: AirROI free tier (28k listings SP, API), Base dos Dados (free), InsideAirbnb data request (lead time variável). Backend agora com **84 testes verdes**.
>
> 🆕 **v2.4 (24/04/2026) — Sprint técnico de hardening + fundação Stays + repricing.** 29 commits: F5C inteira, F6.4 fundação Stays, F6.5 repricing, F5C.4 docs (5 ADRs, LGPD, SLO, runbooks). Backend de 0 → 75 testes.
>
> 🆕 **v2.3 (22/04/2026) — Norte Estratégico e confirmação do parceiro Airbnb (Stays S.A.).** Mantido.
>
> 🆕 **v2.2 (22/04/2026) — Auditoria técnica completa.** Mantido.
>
> 🔄 **v2.1 (21/04/2026) — F5B Entregas Extras (E1–E7).** Mantido.

---

## Legenda
- ✅ Concluído
- 🔄 Em andamento
- ⬜ Pendente
- 🔴 Bloqueante — impede avanço
- 💰 Há custo envolvido
- 🧠 Tier de maturidade da IA (Tier 0/1/2/3/4)

---

## 📌 Norte Estratégico — 8 Gaps Para Atingir o Objetivo

> **Objetivo Urban AI (brand book):** virar a plataforma líder de otimização de receita para hospedagem na América Latina, começando por anfitriões de Airbnb em SP, com a promessa quantificável de "+30% de receita via IA".

| # | Gap | Estado em 24/04/2026 |
|---|-----|---|
| 1 | **Prova numérica de ROI** | ⬜ Sem cases auditados ainda |
| 2 | **Dataset real para o KNN** | ⬜ Engine roda com 3 imóveis mock (Tier 0) |
| 3 | **Ação automatizada via canal oficial** | 🔄 Fundação Stays pronta; canal não conectado em prod |
| 4 | **Unit economics que fechem conta** | ✅ Repricing F6.5 implementado (cobrança por imóvel × 4 ciclos) |
| 5 | **Confiança operacional** | ✅ F5C.1 + F5C.2 completas (bcrypt, throttler, helmet, JWT cookie, env hardening, refresh rotation) |
| 6 | **Canal de aquisição validado** | ⬜ Aguarda aprovação de orçamento + start de F5.3 |
| 7 | **Time com capacidade real** | ⬜ Decisão de contractor pendente |
| 8 | **Compliance e LGPD mínimo** | 🔄 Política interna escrita; DPAs pendentes; consentimento Stays já no código |

> 💡 **Resumo da posição em 24/04:** lançamento (#5, #6, #7, #8) está 50% destravado — segurança técnica está sólida, faltam decisões comerciais. Objetivo estratégico de liderança (#1, #2, #3, #4) está 25% — repricing pronto, mas IA ainda no Tier 0 e sem prova de ROI.

---

## PENDÊNCIAS EM ABERTO (carryover do sprint)

| Status | Item | Responsável | Prazo estimado | Observação |
|--------|------|-------------|----------------|------------|
| 🔄 | **KYC Stripe** | Gustavo + Sócios | Semana 6 | Bloqueia cobrança real. Test mode funciona até lá. |
| 🔄 | **Transferência domínio urbanai.com.br** | Gustavo + Lumina | 2–5 dias úteis | Apontamento temporário ativo. |
| 🔄 | **Transferência domínio myurbanai.com** | Lumina Lab | 2–5 dias úteis | `app.myurbanai.com` operacional. |

---

## F5A — Validação de Produto, UX e Fluxos Reais ⚡
**Status:** ~60% (sem mudança nesta sprint).
**Pendências:** mensagens de erro acionáveis, onboarding D1/D3/D7 e-mails, responsividade mobile completa.

### Resumo

Itens de UX e fluxo (5A.1 a 5A.6 da v2.3) seguem **majoritariamente pendentes**. Esta sprint focou em hardening técnico, não em UX. Próxima sprint: priorizar 5A.1 (erros de form) + 5A.6 (mobile) antes de F7 beta.

| Bloco | % | Próximo passo |
|---|---|---|
| 5A.1 Cadastro/Auth UX | 30% (paywall corrigido) | Mensagens acionáveis, estados de botão |
| 5A.2 Onboarding | 40% (rota /profile feita) | E-mails D1/D3/D7 via Mailersend |
| 5A.3 Cadastro de imóveis | 20% | Audit de form, validação, refresh imediato no dashboard |
| 5A.4 Dashboard + recomendação | 30% | Estado de loading, fallback "dados insuficientes" |
| 5A.5 Stripe fluxo real | bloqueado em KYC | — |
| 5A.6 Responsividade mobile | 0% | Audit em iOS/Android |

---

## F5 — Presença Digital
**Status:** Landing 95% pronta (técnico). Aguarda IDs analytics + domínio.

| Item | Status |
|---|---|
| Landing principal Glassmorphism + SEO | ✅ |
| Página de planos com Stripe | ✅ (toggle binário antigo) + ✅ /plans/v2 (4 ciclos F6.5) |
| GA4 + Meta Pixel via `next/script` | ✅ Código pronto, env vars vazias |
| Formulário de pré-cadastro (`WaitlistForm`) | ✅ Componente pronto, endpoint vazio |
| Publicar em `urbanai.com.br` | ⬜ Aguarda DNS |
| Redes sociais (4/12 posts criados) | ⬜ Aguarda 8 posts + cadência |
| Tráfego pago (F5.3 — experimento com pivot) | 🔴 Aguarda aprovação orçamento |

**Sua ação:** criar property GA4 + Pixel Meta + form Formspark/Formspree → setar `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_WAITLIST_ENDPOINT` no Railway.

---

## F5B — Entregas Extras 07–21/04 (✅ todas no código)

E1 toggle billing mensal/anual · E2 captura `airbnbHostId` no onboarding · E3 cron Gemini hourly · E4 cron de análises aceitas · E5 `/my-plan` + cancelamento · E6 landing `/lancamento` · E7 `PaymentCheckGuard`. **Dívidas D1–D6 (testes ausentes) parcialmente atacadas em F5C.4 #2.**

---

## F5C — Hardening Operacional ✅ (4/4 sub-blocos)

### 5C.1 CRIT (5/6 + KYC)

| # | Item | Status |
|---|---|---|
| 1 | RapidAPI key → env var | ✅ Commit `890ae85` |
| 2 | `console.log` de senha/Auth removidos (4 leaks) | ✅ Commit `6d1d9c5` |
| 3 | `synchronize:true` controlado por env | ✅ Commit `cfc1bc4` (cutover manual em runbook) |
| 4 | `.env.example` em 4 serviços | ✅ Commit `f1bdff4` |
| 5 | `.gitignore` + 29 arquivos lixo removidos | ✅ Commit `22434e2` |
| 6 | KYC Stripe | ⬜ Sua ação |

### 5C.2 P1 (10/10) ✅

Todos os 10 itens entregues nesta sprint (commits `9cbf053`, `2430ffb`, `f960825`, `26da4a9`, `b9f5d1f`, `2d6b3a6`, `d1c1bc1`):

- ✅ IP hardcoded → `NEXT_PUBLIC_CHAINLIT_URL`
- ✅ CORS fail-closed
- ✅ `@nestjs/throttler` global + 5/min em /auth/*
- ✅ `helmet` + CSP (Stripe + Sentry + GMaps)
- ✅ SHA-256 → bcrypt(12) com **lazy rehash transparente** no login
- ✅ `Dockerfile copy` removido
- ✅ ESLint reativado no build (rules-of-hooks errors corrigidos)
- ✅ `UrbanAIPricingEngine` via DI
- ✅ Suite de testes expandida (11 → 75 testes)
- ✅ JWT httpOnly cookie + refresh rotation **(Fase 1 backend; Fase 2 frontend pendente)** + bônus crítico: `JWT_SECRET` hardcoded `"mysecretkey"` removido em 2 arquivos

### 5C.3 Operação (5/5) ✅

Commit `b4fd7ea`:

- ✅ `docs/runbooks/access-onboarding.md` — checklist por sistema (10 ferramentas)
- ✅ `docs/adr/0006-secrets-vault-strategy.md` — Railway Secrets escolhido
- ✅ `docs/adr/0007-aposentar-knn-microservice.md` + `DEPRECATED.md`
- ✅ READMEs raiz + backend + frontend reescritos
- ✅ 5 runbooks de incidente (`docs/runbooks/incident-response/`)

### 5C.4 P2 (8/8 — código + docs) ✅

Commits `604141e`, `62357ca`:

- ✅ JWT httpOnly + refresh rotation (entregue junto com #5C.2 #10)
- ✅ Cobertura de testes (75 testes; serviços críticos cobertos; gap global em `propriedades/` documentado)
- ✅ 5 ADRs retroativos (`docs/adr/0001` a `0005`)
- ✅ Política LGPD interna + DPA checklist
- ✅ `docs/slo.md` (uptime 99.5%, RTO 2h, RPO 24h, error budget)
- ✅ `docs/runbooks/backup-restore.md` com drill trimestral
- ✅ `load-tests/` k6 (smoke + login flow + pricing recommendation)
- ✅ `e2e/a11y.spec.ts` axe-core + `docs/runbooks/wcag-audit-checklist.md`

**Pendente sua execução manual:**
- Provisionar staging Railway (runbook em `docs/runbooks/staging-provisioning.md`)
- Submeter KYC Stripe
- Disparar primeiro drill de restore + load test em staging

---

## F6 — Inteligência Artificial e Produto

### 6.1 Motor KNN/XGBoost com Dados Reais — 🧠 **Tier 0 hoje, Tier 1 a um passo**

> **Estado real (24/04/2026 · noite):** após a v2.5, **o scaffolding de Tier 1 está implementado**:
> - `PricingStrategy` interface plugável (commit pós-v2.4)
> - `RuleBasedPricingStrategy` + `XGBoostPricingStrategy` (skeleton) + `ShadowPricingStrategy` + `PricingStrategyFactory`
> - `PricingBootstrapService` chama `initialize()` no boot + cron semanal
> - `FeatureEngineeringService` skeleton para lat/lng + metroDistance + amenitiesCount
> - `calculateMAPE` + `meetsQualityGate(15%)` + 9 testes
> - 4 ADRs de algoritmo: KNN baseline → XGBoost moat → ensemble → neural híbrido
>
> **O que falta para virar Tier 1 de fato:**
> 1. Plug-in do **primeiro dataset** (AirROI free tier — `docs/runbooks/dataset-acquisition.md`)
> 2. Completar os 3 stubs do `FeatureEngineeringService` (Google Geocoding + cálculo metro local + Gemini amenities)
> 3. Migration adicionando `address.metro_distance_km`, `list.amenities_count`, `list.category`
>
> Esforço estimado: 1 sprint (~40h dev). Pode rodar em **paralelo com as regras** via `PRICING_STRATEGY=shadow` — o XGBoost (quando treinado) só loga, regras decidem.

#### Tiers de maturidade da IA

| Tier | Algoritmo | O que muda | Status / Esforço | Quando |
|---|---|---|---|---|
| **🧠 Tier 0** (atual) | Regras + multiplicadores | Engine matemática + 3 imóveis mock | ✅ Em produção | — |
| **🧠 Tier 1** | Regras (primário) + **XGBoost shadow** | Engine treinada ao boot com TODOS os imóveis; cron semanal; lat/lng/metroDistance/amenities resolvidos | 🔄 **Scaffold pronto**, falta dataset + 3 stubs | S6 |
| **🧠 Tier 2** | XGBoost primário | Dataset externo plugado (AirROI + Base dos Dados + opcionalmente Airbtics) ≥200 imóveis × 12 meses | ~3 sprints + parcerias | S7–10 |
| **🧠 Tier 3** | XGBoost validado | Backtesting com hold-out 20% + **MAPE ≤15%** como gate de qualidade | 1 sprint | S9–10 |
| **🧠 Tier 4 (moat)** | Neural híbrido + causal | Loop de receita real (Stays Reservations) + embedding bairro + LSTM de eventos | 2–3 sprints + parceria fechada | S11+ |

#### Fontes de dataset mapeadas (24/04/2026)

| # | Fonte | Custo | Cobertura SP | Status |
|---|---|---|---|---|
| 1 | **AirROI** | Free tier (UI) + API pay-as-you-go | 28k listings SP, ADR, ocupação | Top recomendação imediata |
| 2 | **Base dos Dados** (BigQuery — espelho InsideAirbnb) | Free tier 1 TB/mês | SP histórico parcial | Top recomendação para histórico |
| 3 | **InsideAirbnb data request** | Grátis (CC BY 4.0) | A solicitar | Lead time variável |
| 4 | **Airbtics** | US$ 29/mês | Mundial inclui SP | Acelerador opcional |
| 5 | **IBGE PNAD Turismo** | Grátis | Brasil c/ recorte UF | Features de demanda turística |
| 6 | Comunidade Superhost SP | Trade (acesso antecipado) | A captar | Dataset proprietário longo prazo |
| 7 | Stays Modelo 1 | Trade | A negociar | Conforme `docs/outreach/stays-contato-comercial.md` |

> **Achado importante:** InsideAirbnb NÃO cobre SP no portal direto, só Rio. SP vive via Base dos Dados (espelho). Detalhes em `docs/runbooks/dataset-acquisition.md`.

#### F6.1 — Tarefas concretas (revisadas v2.4)

##### Tier 1 — Treinar o motor com o que temos hoje (S6) — **scaffold pronto**

| Status | Tarefa | Resp. |
|---|---|---|
| ✅ | `PricingBootstrapService.onModuleInit` chama `engine.initialize()` com todos os imóveis com lat/lng | Entregue v2.5 |
| ✅ | Cron `0 4 * * 0` America/Sao_Paulo dispara retreino semanal | Entregue v2.5 |
| ✅ | `FeatureEngineeringService` skeleton (geocodePending, computeMetroDistancePending, estimateAmenitiesPending) | Entregue v2.5 |
| ✅ | Strategy plugável (`PRICING_STRATEGY=rules\|shadow\|xgboost\|auto`) | Entregue v2.5 |
| ⬜ | **Completar `geocodePending()`** — chamar `@googlemaps/google-maps-services-js` por endereço completo, validar bbox SP, persistir | Gustavo / Dev |
| ⬜ | **Completar `computeMetroDistancePending()`** — carregar 76 estações SP, calcular haversine, persistir | Gustavo / Dev |
| ⬜ | **Completar `estimateAmenitiesPending()`** — Gemini sobre `list.titulo` retornando 0–30, persistir | Gustavo / Dev |
| ⬜ | Migration: `address.metro_distance_km` + `list.amenities_count` + `list.category` (seguir `docs/runbooks/migrations-cutover.md`) | Gustavo / Dev |
| ⬜ | Heurística inicial de `category` (Premium se basePrice>350 ∧ amenities≥6, Econ se basePrice<150 ∨ amenities≤2, senão Standard) | Gustavo / Dev |
| ⬜ | Smoke test: boot backend → `/propriedades/:id/analise-preco` retorna recomendação **diferente** do fallback Standard | Gustavo |

##### Tier 2 — Dataset externo (S7–10)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **AirROI API gratuita** — testar cobertura SP, criar conta, integrar como fonte secundária no scraping pipeline. Persistir snapshot diário em S3 + tabela `airroi_listings`. | Gustavo |
| ⬜ | **Stays Modelo 1 (trade)** — após validação parceria, importar dataset agregado anonimizado mensal. Sem PII, formato CSV. | Gustavo + Sócios |
| ⬜ | **Comunidade Superhost SP** — recrutar 20–30 voluntários beta que cedem histórico em troca de acesso antecipado. Form de coleta + import script. | Gustavo |
| ⬜ | **Sympla API + Prefeitura SP** — substituir scraping de eventos por APIs oficiais (mitigação jurídica F9.2). | Gustavo / Dev |
| ⬜ | **Critério mínimo de treinamento documentado:** ≥200 imóveis × 12 meses. Abaixo disso, KNN cai no fallback matemático declarado. | — |

##### Tier 3 — Backtesting + qualidade (S9–10)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **Hold-out 20%** do dataset para teste fora do treino. | Gustavo / Dev |
| ⬜ | **Função `calculateMAPE`** que mede erro % entre `precoSugerido` e o preço real que teve reserva no hold-out. | Gustavo / Dev |
| ⬜ | **Job semanal de qualidade** que recalcula MAPE e abre alerta no Sentry se passar de 15%. | Gustavo / Dev |
| ⬜ | **Gate de release**: MAPE ≤ 15% antes de F7 (beta fechado). Sem isso, beta usa fallback matemático com aviso explícito. | Gustavo |
| ⬜ | **Dashboard interno** mostrando MAPE histórico, distribuição de erro por bairro/categoria. | Gustavo / Dev |

##### Tier 4 — Loop de receita (S11+)

| Status | Tarefa | Resp. |
|---|---|---|
| ⬜ | **Stays Reservations API** — consumir via `StaysConnector.listReservations` (a implementar — método não existe ainda no conector). | Gustavo / Dev |
| ⬜ | **Tabela `revenue_history`** — uma linha por imóvel/data/preço/status (booked/free/blocked). | Gustavo / Dev |
| ⬜ | **Job diário** que cruza `AnalisePreco` aceito × reserva real × revenue por noite e calcula uplift. | Gustavo / Dev |
| ⬜ | **Endpoint `/propriedades/:id/uplift`** que mostra "antes Urban AI vs depois Urban AI" — alimenta dashboard do anfitrião + 3 cases de F7.1. | Gustavo / Dev |
| ⬜ | **Retraining alimentado por feedback real** — modelo aprende quais sugestões resultaram em reserva e ajusta multiplicadores. | Gustavo / Dev (Pós go-live) |

#### Resumo F6.1 com tradução comercial

| Hoje | Após Tier 1 | Após Tier 2 | Após Tier 3 | Após Tier 4 |
|---|---|---|---|---|
| "Engine de regras com mock" | "IA treinada na minha carteira" | "IA treinada com dados de mercado SP" | "IA validada com MAPE conhecido" | "IA que cresce a receita comprovada" |
| **+0% prova** | +baseline interna | +contexto SP | +qualidade quantificada | +ROI comprovado em número |

---

### 6.2 Fontes de Dados e APIs

Mesmas tarefas da v2.3, sem grandes mudanças. AirROI/Stays se sobrepõem com F6.1 Tier 2. PriceLabs reunião segue prevista.

### 6.3 Produto e Painel Administrativo

Sem mudança nesta sprint. Painel admin básico ainda pendente — fila para semana 9.

### 6.4 Integração Oficial Airbnb via Stays — 🔄 **Fundação ✅, ativação pendente**

> **Estado em 24/04/2026:** todo o código do lado Urban AI está pronto e testado (13 specs do `StaysService`). Falta apenas: (1) parceria comercial com Stays + credenciais reais; (2) auto-match listing↔imóvel (UI); (3) OAuth flow se Stays oferecer.

| Status | Tarefa | Quando |
|---|---|---|
| ✅ | Domínio: entities `StaysAccount`, `StaysListing`, `PriceUpdate` (com idempotency, audit trail, rollback) | Commit `c634805` |
| ✅ | `StaysConnector` (REST client com retry exponencial 3x, 4xx não-retry) | ✅ |
| ✅ | `StaysService` (connect, sync, pushPrice com guardrails ±25%/-20%, rollback) | ✅ |
| ✅ | 6 endpoints REST `/stays/*` | ✅ |
| ✅ | Cron `stays-auto-apply` (hora em hora) — modo automático | ✅ |
| ✅ | UI `/settings/integrations` (conectar com checkbox LGPD, sync, listings) | ✅ |
| ✅ | 13 testes unitários | ✅ |
| ✅ | Runbook `docs/runbooks/stays-integration-setup.md` | ✅ |
| 🔴 | **Parceria comercial Stays** (one-pager pronto em `docs/outreach/stays-one-pager.md`) | S5–6 |
| ⬜ | OAuth 2.0 flow (se Stays disponibilizar) | S9 |
| ⬜ | Auto-match listing Stays ↔ imóvel Urban AI por similaridade de título/endereço | S10 |
| ⬜ | UI de histórico de PriceUpdate por imóvel (com botão Reverter) | S10 |
| ⬜ | Confirmar shape real da API Stays + ajustar `StaysConnector` se necessário | Após reunião |
| ⬜ | Tela de configuração de guardrails por anfitrião (max increase/decrease %) | S10 |

### 6.5 Repricing por Imóvel — ✅ **Implementado**

> **Estado em 24/04/2026:** todo o backend + UI da matriz de cobrança está pronta e testada. 8 novos Stripe Price IDs precisam ser criados manualmente no Dashboard.

| Status | Tarefa | Status |
|---|---|---|
| ✅ | Entity `Plan` estendida com 12 campos novos (4 ciclos × preços/IDs/descontos) | Commit `5e60be9` |
| ✅ | Entity `Payment` com `billingCycle`, `listingsContratados`, `planName` | ✅ |
| ✅ | `seedPlans` com matriz F6.5 (Starter R$ 97→58, Profissional R$ 197→118 anual) | ✅ |
| ✅ | `createCheckoutSession` aceita 4 ciclos + quantity | ✅ |
| ✅ | Webhook persiste billingCycle + listingsContratados via metadata | ✅ |
| ✅ | `customer.subscription.updated` trata mudança de quantity (upsell) | ✅ |
| ✅ | Endpoint `GET /payments/listings-quota` | ✅ |
| ✅ | UI `/plans/v2` com `PricingCalculatorV2` (seletor de 4 ciclos + quantidade + calculadora) | ✅ |
| ✅ | `ListingsQuotaGuard` componente | ✅ |
| ✅ | Testes (8 novos, 75 totais) | ✅ |
| 🔴 | **Criar 8 Stripe Price IDs no Dashboard** + setar env vars no Railway | Sua ação |
| ⬜ | Rota `/plans/v2/upsell` para mudança de quantity sem recriar subscription (Stripe Customer Portal ou subscription.update direto) | S8 |
| ⬜ | E-mails transacionais por ciclo (Mailersend templates) | S9 |
| ⬜ | Grandfathering 3 meses para usuários ativos pré-F6.5 | S10 |
| ⬜ | Simulação financeira ARR cenários conservador/base/otimista | S7 |
| ⬜ | Substituir toggle binário em `/plans` antiga ou redirect para `/plans/v2` | S8 |

---

## F7 — Beta Fechado e Go-Live Oficial

**Status:** preparação técnica essencialmente pronta; **execução depende de IA Tier 2/3 + KYC + parceria Stays + dataset**.

### 7.1 Beta com 3 cases auditados de ROI

Sem mudanças vs v2.3. Reforço: **gate explícito** que beta não abre antes de:
- 🧠 IA no Tier 2 mínimo (algum dataset real)
- ✅ Staging rodando smoke test ponta-a-ponta
- ✅ KYC aprovado
- ✅ MAPE medido

### 7.2 Go-Live Oficial

Recalibrado: **S15–17** (mid–late julho/2026).

---

## F8 — Pré-lançamento controlado (waitlist mode) ⚡ PRIORIDADE

**Status:** em construção (v2.12 alvo) · **Janela:** abril–maio/2026

### Por quê

Antes do go-live oficial S15–17 com infraestrutura completa, queremos
**colocar o sistema no ar** com landing pages ativas e captura de demanda
em modo "lista de espera". Objetivo:

1. Validar copy, ofertas e funil de aquisição com tráfego real
2. Construir lista qualificada de anfitriões interessados (vira primeira
   leva de beta convidada na F7)
3. Ter URL para compartilhar com sócios, parceiros, conteúdo de marketing

### 8.1 Modo waitlist gated por feature flag

- **Backend:** env var `PRELAUNCH_MODE=true|false` no Railway. Quando
  `true`:
  - `POST /auth/register` redireciona automaticamente pra criar entrada
    em `Waitlist` (entity nova) em vez de `User`
  - Login segue funcionando para `User` que já existem (founders, admins,
    beta testers convidados manualmente)
- **Frontend:** env `NEXT_PUBLIC_PRELAUNCH_MODE`. Quando `true`:
  - Página `/create` renderiza `WaitlistSignup` em vez do form de signup
    tradicional
  - Após inscrição: tela "Você é o #N na fila" com referral code, share
    pro WhatsApp/X/LinkedIn (incentivo: subir na fila convidando amigos)
  - Banner persistente "Acesso antecipado — aguarde convite"

### 8.2 Entity `Waitlist` + endpoints

- `Waitlist`: id (uuid), email (unique), name?, phone?, source (qual
  landing/canal), referralCode (próprio), referredBy?, position
  (autoincrement), invitedAt?, createdAt
- `POST /waitlist` (público, throttled) — cria entrada, retorna posição
  e referralCode
- `GET /admin/waitlist?page&search` (admin) — lista paginada com filtros
- `POST /admin/waitlist/:id/invite` (admin) — manda email de convite + cria
  pre-User pendente

### 8.3 Landing pages ativas

- `/` (home/login) — segue como tela de login para users existentes
- `/lancamento` — landing pública de pré-lançamento (já existe, refinar copy)
- `(marketing)/...` — outras landings de campanha
- DNS aponta `urban.ai` → frontend; `app.urban.ai` → frontend autenticado
  (decidir se separa ou se mesma URL com routing)

### 8.4 Convite e onboarding pós-waitlist

- Admin clica "Convidar" no `/admin/waitlist`
- Email com magic link único (token expira 7 dias)
- Magic link cria User real + login automático
- Posição na fila vira `inviteOrder` no User pra rastrear LTV por cohort

---

## F8.5 — Pendências de Qualidade (carryover técnico)

Lista do que Claude ainda consegue automatizar mesmo com o produto no ar:

- **k6 load test cenários adicionais** — signup → onboarding → análise
  → checkout (medir P95, throughput, gargalo)
- **Smoke E2E Playwright** completo do happy path F6.5 (anfitrião novo
  → assina → cadastra imóveis → tenta exceder quota → vê bloqueio)
- **Performance audit** — query slow log MySQL, lighthouse, lazy load de
  rotas pesadas, otimização de imagens
- **WCAG 2.1 AA audit** nas páginas novas (`/admin/finance`,
  `/admin/pricing-config`, `/termos`, `/privacidade`)
- **OpenAPI Swagger refinement** — `@ApiResponse` em rotas admin que estão
  sem; gerar SDK automatizado depois
- **Feature flag system** — pequeno service que liga/desliga features
  por user/role/percentual sem deploy (`PRELAUNCH_MODE` é o primeiro caso
  de uso real)
- **i18n scaffolding** — preparar estrutura `pt-BR/en` (mesmo que MVP
  saia só pt-BR)

---

## F9 — Time, Compliance e Observabilidade Transversal

### 9.1 Time

Sem mudança. Decisão de contractor segue pendente — agora ainda mais urgente porque F6.1 Tiers 1–3 são 4–6 sprints de dev e o Gustavo está acumulando tudo.

### 9.2 Compliance e LGPD

| Status | Item |
|---|---|
| ✅ | Política de Privacidade interna (`docs/lgpd/politica-privacidade-interna.md`) |
| ✅ | DPA checklist com cronograma (`docs/lgpd/dpa-checklist.md`) |
| ✅ | Consentimento Stays no código (UI `/settings/integrations`) |
| ⬜ | Persistir log do consentimento em `User.consents` (campo novo) |
| ⬜ | Assinar 6 DPAs prioritários (Stripe, Mailersend, AWS, Railway, Upstash, Sentry) — meta S7 |
| ⬜ | Posicionamento jurídico sobre scraping (`docs/legal-scraping.md`) — após advogado externo |
| ⬜ | Template + processo de resposta a solicitação LGPD em ≤15 dias |
| ⬜ | Página pública `/privacidade` sincronizar com a interna |

### 9.3 Observabilidade Estendida

| Status | Item |
|---|---|
| ✅ | Sentry com `APP_ENV` separando prod/staging |
| ✅ | UptimeRobot apontado para `app.myurbanai.com/health` |
| ⬜ | Eventos custom no Sentry (`user.signed_up`, `pricing.suggestion_accepted`, `stays.price_pushed` etc.) — código pronto para adicionar nos services |
| ⬜ | Alertas Sentry (webhook Stripe falhando, push Stays falhando >5%, Prefect 2 dias seguidos) |
| ⬜ | Dashboard de métricas de produto (NPS, ativação, retenção, MRR, churn) — Grafana ou PostHog free |
| ⬜ | Adicionar `GET /health` ao backend se ainda não existe (referenciado em load-tests + UptimeRobot) |

---

## Resumo de Custos Pós-Sprint (atualizado)

| Fase | Custo estimado | Status |
|------|----------------|--------|
| F5 — Presença Digital | R$ 4.340–8.170/mês | 🔴 Bloqueado em aprovação |
| F5C — Hardening | ✅ Entregue (~120h dev consumidas nesta sprint) | ✅ |
| F6.1 Tier 1 | ~80h dev | S6–7 |
| F6.1 Tier 2 (dataset) | R$ 0 (trade Stays) ou R$ 5–15k (PMC) | S7–10 |
| F6.1 Tier 3 (MAPE) | ~40h dev | S9–10 |
| F6.1 Tier 4 (loop receita) | ~120h dev (depende Stays) | S11+ |
| F6.4 Stays — fundação | ✅ Entregue (~150h dev consumidas) | ✅ |
| F6.4 Stays — ativação | depende parceria | S5–11 |
| F6.5 Repricing | ✅ Entregue | ✅ |
| F7 Beta + Go-Live | R$ 5–10k mídia | S13–16 |
| F9 — Time/Compliance/Obs | contractor R$ 12–20k/mês · advogado R$ 3–8k · ferramentas R$ 200/mês | S5–14 |
| Infra Railway | ~R$ 1.000/mês | recorrente |

> 💡 **Decisão urgente 1:** Aprovar orçamento marketing (semana 5).
> 💡 **Decisão urgente 2:** Validar Stays + iniciar parceria (semana 5–6).
> 💡 **Decisão urgente 3:** Decidir contractor dev (semana 5–6).
> 💡 **Decisão urgente 4:** Submeter KYC Stripe (semana 6).
> 💡 **Decisão urgente 5 (NOVA):** Aceitar publicamente que **a IA está no Tier 0 hoje** e definir até quando subir para Tier 1/2 — isso afeta a narrativa do go-live e o que a landing pode prometer.

---

## Marcos Críticos — Próximas Semanas (revisados v2.4)

| Quando | Marco | Impacto se atrasar |
|--------|-------|--------------------|
| Semana 5 | F5C.1 CRIT 100% (KYC enviado) | Cobrança real bloqueada |
| Semana 5 | Aprovar orçamento marketing | F5.3 não inicia |
| Semana 5 | Validar Stays + contato comercial | F6.4 ativação não inicia |
| Semana 5–6 | Decisão de time (contractor) | F6.1 trava em uma única pessoa |
| Semana 6 | **Tier 1 da IA implementado** (initialize + lat/lng + amenities) | Continua "fallback Standard" para todo mundo |
| Semana 6 | Staging Railway provisionado | F5C.4 testes não rodam |
| Semana 6–7 | Stripe Price IDs F6.5 criados + ativos no Railway | Repricing fica como código sem efeito |
| Semana 7 | DPAs assinados (6 prioritários) | Risco LGPD em incidente |
| Semana 7–8 | **Tier 2 dataset** (AirROI + Stays trade) | IA continua sem base de mercado |
| Semana 9–10 | **Tier 3 MAPE ≤ 15%** | Beta abre sem qualidade quantificada |
| Semana 11 | F6.4 ativação (push Stays em prod) | Fica em modo recomendação manual |
| Semana 11–12 | Beta fechado iniciado | Atraso em F7 |
| Semana 12 | 3 cases auditados de ROI | Landing não converte |
| **Semana 15–17** | **Go-Live oficial** | — |

---

## Estrutura de Relatórios ao Cliente

Mantida da v2.3.

---

*Urban AI © 2026 · Uso interno · v2.16 (06/05/2026)*

---

## Changelog do Roadmap

| Data | Versão | Autor | Mudanças |
|------|--------|-------|----------|
| 20/03/2026 | v1.0 | Gustavo | Criação pós-D14 |
| 13/04/2026 | v2.0 | Gustavo | F5/F5A/F6/F7 |
| 21/04/2026 | v2.1 | Roadmap-Manager Squad | F5B (E1–E7) |
| 22/04/2026 | v2.2 | Gustavo + Claude | F5C, F6.4, F6.5 |
| 22/04/2026 | v2.3 | Gustavo + Claude | Norte Estratégico, F9, sequenciamento |
| 24/04/2026 | **v2.4** | **Gustavo + Claude** | **Sprint técnico de 29 commits.** F5C inteira marcada como ✅ (1/2/3/4). F6.4 fundação ✅. F6.5 ✅. F6.1 reescrita explicitando os 4 Tiers de maturidade da IA — esclarecendo que hoje estamos no **Tier 0**. Marcos recalibrados; go-live S15–17. |
| 24/04/2026 (noite) | **v2.5** | **Gustavo + Claude** | **ML scaffolding completo.** ADR 0008 (KNN→XGBoost). Strategy plugável (`PricingStrategy` + 3 strategies + factory). `PricingBootstrapService` + `FeatureEngineeringService` skeletons. `calculateMAPE` + 9 testes (84 totais). Pesquisa de datasets: Top 3 são AirROI/Base dos Dados/InsideAirbnb. Backend pronto para Tier 1 — falta plug do dataset e completar 3 stubs. |
| 24/04/2026 (madrugada) | **v2.6** | **Gustavo + Claude** | **Captura passiva de dataset + auto-tier + moat documentado.** `PriceSnapshot` entity + `DatasetCollectorService` (3 frentes: cron diário 03:30, comps persistence em cada análise, recordAppliedPrice). `AdaptivePricingStrategy` (auto-tier escolhe modelo conforme dataset cresce, sem deploy entre tiers). ADR 0009 (modelo neural híbrido como moat). `docs/next-actions.md` com 18 ações operacionais. **Resposta direta:** agora sim estamos mapeando dataset próprio. |
| 24/04/2026 (final do dia) | **v2.7** | **Gustavo + Claude** | **Painel admin + 5 gaps + motor de eventos + doc consolidado.** Entities: `OccupancyHistory`, `EventProximityFeature`, `AnalisePreco.precoAplicado`. Backend admin: `User.role`, `RolesGuard`, `AdminService`, 6 endpoints. Frontend: `/admin` + `/admin/users`. Runbook `event-engine-evolution.md`. Doc principal `estado-da-IA-e-evolucao.md`. |
| 24/04/2026 (deep night) | **v2.8** | **Gustavo + Claude** | **Painel admin expandido + F6.2 Plus autorizada + doc para sócios.** 5 endpoints admin novos (events, stays, funnel, quality, occupancy). 4 páginas novas. F6.2 Plus formalizada. Doc `base-socios.md`. Doc `runbooks/admin-evolution.md`. |
| 06/05/2026 | **v2.16** | **Gustavo + Claude** | **Admin de eventos + 2 coletores novos.** GET `/admin/events/list` paginado com filtro `scope=in/out/all` + busca + filtro por source. GET `/admin/events/collectors-health` agrupa stats por source (24h/7d/outOfScope%/errorRate/lastSeen). UI: tab in/out/all em `/admin/events`, KPI "Dentro da cobertura", tabela detalhada com flags Geo/Scope/Enrich. Página nova `/admin/collectors-health` com badge "STALE" para coletor >48h sem dados, color coding por threshold. UspEventosCollector (scraping HTML leve, rejeita campi fora SP via heurística). MarchaParaJesusCollector (anual fixo 3M pessoas, fallback heurístico Corpus Christi). 196 testes verdes (141 backend + 55 Python). |
| 06/05/2026 | **v2.15** | **Gustavo + Claude** | **F6.2 Plus — Cobertura geográfica híbrida + retry enrichment.** Resolve poluição "eventos do Brasil todo" no DB. Modelo Híbrido: data-driven (raio 80km de cada Address) + admin override (tabela `coverage_regions` com status active/bootstrap/inactive). Entity `CoverageRegion` + migration `AddCoverageAndEnrichmentFields` idempotente. CoverageService com cache 5min + haversine. CoverageController CRUD admin completo + endpoint de teste de ponto. EventsIngest e Geocoder agora aplicam check de cobertura → marca `outOfScope=true` (preserva no DB). EventsEnrichmentService re-escrito (BUG FIX: era setar relevancia=0 em qualquer falha, criando limbo perpétuo) — agora usa `enrichmentAttempts` (max 3) com retry após 24h. Seed automático "Grande São Paulo" no boot. Página `/admin/coverage` (CRUD visual). LLM extractor ganha `is_in_scope` no schema; queries dos coletores LLM (Firecrawl/SerpAPI/Tavily) refatoradas com 3-4 queries focadas SP capital + dedup. SerpAPI usa `location` param. 16 testes novos (cobertura + ingest com cobertura). |
| 06/05/2026 | **v2.14** | **Outro dev + Gustavo + Claude** | **Coletores Camada 2 + cron orquestrado + retomada de evolução motor.** Outro dev entregou: ApiFootballCollector (filtra times SP), FirecrawlExtractor + LLM extraction via google-genai, SerpApiEventsCollector (Google Events box), TavilySearchCollector (busca web semântica), `utils/llm_extractor.py` com schema Pydantic. Cron 24h em `auth_proxy.py` thread chama `run_all_collectors.sh`. EventsEnrichmentService agora chama Gemini de verdade (era stub). User collector@urban.ai criado em prod (admin role). Auditoria do Claude: identificou bug do enrichment, gap de cobertura geográfica, sp_cultura ainda fora do cron. |
| 25/04/2026 (manhã) | **v2.13** | **Gustavo + Claude** | **F6.2 Plus Camada 3 — curadoria humana + import CSV.** EventsCsvImportService com parser CSV próprio (suporta aspas/CRLF/escape, max 1000 linhas). POST /events/import-csv (multer admin-only). Página `/admin/events/new` form completo + `/admin/events/import` upload com preview e stats por source. 14 testes novos. |
| 25/04/2026 (manhã) | **v2.12** | **Gustavo + Claude** | **F6.2 Plus base + Fase A spiders + SP Cultura collector.** Schema Event ganha source/sourceId/dedupHash/venueCapacity/venueType/expectedAttendance/crawledUrl/pendingGeocode + migration idempotente. POST /events/ingest universal (admin, throttled, dedup por hash, UPSERT conservador). EventsGeocoderService com cron 30min. UrbanIngestPipeline em pipelines.py do Scrapy (auto-disable se sem URBAN_COLLECTOR_*). venue_map.py com 25+ venues SP catalogados. UrbanBackendClient Python (login JWT cache, batch buffer, retry). BaseCollector abstrato + SpCulturaCollector (Prefeitura SP, sem auth). 36 testes (jest + pytest). |
| 25/04/2026 (manhã) | **v2.11** | **Gustavo + Claude** | **Infra + LGPD + observabilidade.** Catch-up migrations das 5 entities pós-baseline (idempotente — destrava `DB_SYNCHRONIZE=false`). CI expandido (5 jobs: backend test, build, migrations contra MySQL service, frontend test, smoke). Workflow de backup off-site (S3/B2, cron diário 03:00 UTC). `/privacidade` e `/termos` LGPD-completos (drafts em revisão jurídica). `<CookieConsent />` + `useConsent` — GA4/Pixel agora gating por consent. `StripeSyncCheckService` + `GET /admin/stripe/sync-check` valida que os 8 Price IDs F6.5 batem com Stripe. `GET /health` expandido (DB ping, version, degraded-tolerant) + `/health/live`. 7 templates de email Mailersend (welcome, subscription-active, cancelled, payment-failed, quota-warning, quota-exceeded, stays-connected). README v2.11, `CHANGELOG.md` novo. |
| 25/04/2026 (madrugada) | **v2.10** | **Gustavo + Claude** | **Migrations TypeORM `platform_costs` + seed default + 11 testes.** Migration idempotente. `seedDefaultCosts()` popula 13 custos conhecidos (Railway, Sentry, Gemini etc.) — endpoint `POST /admin/finance/costs/seed` + botão UI. 11 specs novos cobrindo MRR matriz F6.5 × 4 ciclos, custos fixos+%, overview, idempotência. 95 testes total (era 84). |
| 25/04/2026 (madrugada) | **v2.9** | **Gustavo + Claude** | **F6.5 100% configurada + painel financeiro + config de preços.** Auditoria revelou F6.5 só ~50% (frontend ainda usava /plans antigo, paywall não tinha quota). Corrigido `/plans`, `/onboarding`, `GlobalPaywallModal`. **Bloqueio server-side** em `POST /connect/addresses` retorna 403 quando excede quota. Entity `PlatformCost` + service `AdminFinanceService` (MRR estimado, custos por categoria, margem por imóvel). 5 endpoints novos: `GET /admin/finance/overview`, `GET/POST/PATCH/DELETE /admin/finance/costs`, `GET /admin/plans-config`, `PATCH /admin/plans-config/:name`. Páginas `/admin/finance` e `/admin/pricing-config` no front. |
