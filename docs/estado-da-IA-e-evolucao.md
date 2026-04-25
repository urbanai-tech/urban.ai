# Urban AI — Estado da IA, Captura de Dataset e Caminho do Moat
**Versão 1.0 · 24/04/2026 · Documento de referência consolidado**
**Autores:** Gustavo Macedo + Claude (revisão técnica)

> Este é o documento principal que consolida o estado real da IA da Urban AI hoje, o que foi entregue em sprints recentes, os gaps identificados e o caminho realista para chegar ao **modelo neural híbrido como moat de longo prazo**. Leitura recomendada antes de relatórios, reuniões com sócios ou pitches comerciais.

---

## Sumário executivo

A Urban AI tem **um motor de pricing funcional em produção** (regras + multiplicadores rodando todo dia, gerando análises por imóvel × evento próximo). É honesto descrever isso como **engine de regras sofisticada**, não como "IA aprendendo".

Em 24/04/2026, em duas sprints técnicas seguidas (50+ commits, 84 testes verdes), implementamos toda a fundação para a IA evoluir até o **moat de modelo neural híbrido**:

- **Strategy pattern** plugável que troca de algoritmo automaticamente conforme dataset cresce
- **Captura passiva diária** do dataset proprietário em 3 frentes
- **Backtesting** + métrica de qualidade (MAPE) com gate de 15%
- **Painel admin** mostrando estado da IA, dataset e operação
- **5 ADRs** de algoritmo (KNN→XGBoost→Híbrido)
- **Roadmap de 18–24 meses** até o Tier 4 (moat)

A diferença entre "produto que entrega valor hoje" e "moat real do amanhã" virou **questão de tempo + dataset crescer**, não de re-arquitetura.

---

## Parte 1 — Como a IA, precificação e sugestão funcionam hoje

### 1.1 Fluxo ponta-a-ponta

Quando um anfitrião está cadastrado no Urban AI, o que acontece **automaticamente** todos os dias:

```
              CRON 03:00 UTC
                    │
                    ▼
          ┌─────────────────┐
          │ Pipeline Prefect│  Dispara 8 spiders Scrapy
          │ trigger_spiders │  (Eventim, Sympla, Ingresse, etc.)
          └────────┬────────┘
                   ▼
          Eventos ingeridos em S3 (Parquet)
                   │
              CRON 04:00 UTC
                   │
                   ▼
          ┌─────────────────┐
          │ Pipeline Prefect│  Lê Parquet, normaliza, persiste
          │ raw_to_mysql    │  na tabela `event` do MySQL
          └────────┬────────┘
                   │
              CRON HOURLY (Gemini)
                   │
                   ▼
          ┌─────────────────────┐
          │ Eventos enriquecidos│  Cada evento ganha relevância 0-100,
          │ via Gemini API      │  categoria, normalização textual
          └─────────┬───────────┘
                    │
              CRON 08:00 BRT (análise)
                    │
                    ▼
          ┌─────────────────────────────────┐
          │  Para cada (imóvel × evento     │
          │  próximo nos próximos N dias):  │
          │                                 │
          │  1. Calcula travel time         │
          │  2. Calcula atratividade        │
          │  3. Coleta `comps` na vizinhança│
          │  4. Treina KNN ad-hoc com comps │
          │  5. Aplica multiplicadores      │
          │  6. Salva AnalisePreco          │
          │  7. PERSIST snapshots dos comps │  ← novo (24/04)
          │     no PriceSnapshot            │
          └────────────────┬────────────────┘
                           │
                           ▼
          ┌─────────────────────────────────┐
          │  Notificação ao anfitrião       │
          │  (e-mail Mailersend + dashboard)│
          └────────────────┬────────────────┘
                           │
                           ▼
          ┌─────────────────────────────────┐
          │  Anfitrião decide:              │
          │   - aceitar (modo recomendação) │
          │   - aplicar manual no Airbnb    │
          │   - deixar Stays aplicar (auto) │
          └─────────────────────────────────┘
```

### 1.2 Componentes técnicos da IA

**`UrbanAIPricingEngine`** ([src/knn-engine/pricing-engine.ts](../urban-ai-backend-main/src/knn-engine/pricing-engine.ts)) — motor de regras:

```ts
multiplier = 1.0
+ 0.10  se categoria = Standard (KNN classificou)
+ 0.20  se categoria = Premium
+ 0.50  se atratividade ao evento > 80
+ 0.20  se atratividade entre 51-80
+ 0.30  se travel time <= 15 min
+ (event.relevancia / 200)  baseado na pontuação Gemini

precoSugerido = precoBase × multiplier
```

**`PropertyClassifier`** (KNN com `ml-knn`) — classifica em Econômico (0) / Standard (1) / Premium (2). Usa features: lat, lng, metroDistance, amenitiesCount.

**`DisplacementCostMatrix`** — calcula atratividade combinando travel time + categoria do evento + custo simulado de transporte.

**`TravelTimeEngine`** (com Turf.js) — heurística de tempo de viagem; substituível por Google Directions API quando justificar.

### 1.3 Sugestões para imóveis cadastrados — sim, estão acontecendo

**Resposta direta:** sim, hoje todo imóvel cadastrado que tem evento próximo em janela de 30 dias recebe `AnalisePreco` gerada pelo cron diário.

Limitações reais:
- ❌ Imóveis **sem evento próximo** não recebem análise — ficam sem sugestão
- ❌ Imóveis sem `latitude/longitude` populados (campo nulo) são pulados
- ❌ Imóveis cuja chamada Airbnb GraphQL falha (RapidAPI fora ou listing privado) são pulados
- ❌ A "categoria KNN" é tipicamente o fallback Standard porque o classifier é treinado ad-hoc com 5-30 comps por análise (suficiente para o cálculo daquela análise mas não para aprender padrões SP-amplo)

A consequência prática: **a sugestão de hoje é uma combinação útil de regras + dados de comparáveis recentes, não um modelo aprendido com histórico longo**. Funciona bem para ancorar o anfitrião em um número defensável, mas não captura sazonalidade complexa, eventos não mapeados, padrões de demanda histórica.

### 1.4 O que o anfitrião vê e o que faz

- **Dashboard `/dashboard`** — estatísticas, lista de eventos acompanhados, recomendações pendentes
- **`/painel`** — sugestões aceitas com filtro por imóvel
- **`/properties`** — gestão dos imóveis cadastrados
- **`/event-log`** — log de eventos detectados na região do imóvel
- **`/settings/integrations`** — conectar Stays (modo automático)
- **`/plans`** + **`/plans/v2`** — assinatura (a v2 tem matriz F6.5 com cobrança por imóvel × 4 ciclos)

### 1.5 Modos de operação

| Modo | Como funciona | Ativação |
|---|---|---|
| **Recomendação** (default) | IA gera sugestão; anfitrião aplica manualmente no Airbnb | `user.operationMode='notifications'` |
| **Automático** (Stays) | IA aplica preço direto via Stays Open API com guardrails (±25% por default) | `user.operationMode='auto'` + conta Stays conectada |

Modo automático aplica via `StaysAutoApplyService` (cron hora-em-hora), com idempotência por chave (listingId × date × priceCents) e log auditável em `PriceUpdate`.

---

## Parte 2 — Captura do dataset proprietário (resolvido nesta sprint)

### 2.1 O que estava errado antes

Investigando o código, descobri 5 gaps críticos:

| Gap | Impacto |
|---|---|
| ❌ Sem snapshot diário do preço base | Imóvel sem evento próximo = buraco no histórico |
| ❌ Comps descartados após cada análise | Centenas de pontos de dataset/dia perdidos |
| ❌ Não capturávamos preço REAL aplicado | Sem MAPE real, promessa "+30%" indefensável |
| ❌ Ocupação hardcoded como 0 | Sem demanda real, modelo cego para sazonalidade |
| ❌ Sem features de eventos persistidas no tempo | Histórico de "como o pipeline evoluiu" perdido |

### 2.2 Resolução implementada

**3 novas entities + 1 service + 1 endpoint novo:**

#### `PriceSnapshot` ([src/entities/price-snapshot.entity.ts](../urban-ai-backend-main/src/entities/price-snapshot.entity.ts))

Tabela do dataset proprietário. 1 linha = 1 dia × 1 imóvel.

Fontes capturadas (campo `origin`):
- `self_cron` — cron diário 03:30 BRT varre TODOS os imóveis cadastrados
- `comp_extraction` — comps coletados em cada análise persistidos automaticamente (resolve gap 2)
- `manual_import` — import via script (AirROI, Base dos Dados)
- `stays_sync` — quando integração Stays ativar

Plugado em [`propriedade.service.ts:1427`](../urban-ai-backend-main/src/propriedades/propriedade.service.ts:1427) via `DatasetCollectorService.recordCompsFromAnalysis(...)` — fire-and-forget, falha não derruba análise principal.

#### `OccupancyHistory` ([src/entities/occupancy-history.entity.ts](../urban-ai-backend-main/src/entities/occupancy-history.entity.ts))

Resolve gap 4 (ocupação hardcoded). 1 linha = 1 dia × 1 imóvel × status (booked / available / blocked / unknown). Origens:
- `manual` — anfitrião marca via UI (até Stays)
- `stays_sync` — importado via Stays Reservations API (Tier 4)
- `airbnb_calendar` — scraping cuidadoso (cinza)
- `inferred` — estimado a partir do histórico

#### `EventProximityFeature` ([src/entities/event-proximity-feature.entity.ts](../urban-ai-backend-main/src/entities/event-proximity-feature.entity.ts))

Resolve gap 5. Snapshot diário das features de proximidade que o motor usa: `eventsNext7d`, `eventsNext14d`, `eventsNext30d`, `megaEventsNext30d`, `closestEventDistanceKm`, `avgRelevanceScore`, `competitiveSupplyCount`, `medianCompPriceCents`. Vira insumo direto do XGBoost (lag features) e do LSTM no Tier 4.

#### `AnalisePreco.precoAplicado` (resolve gap 3)

Coluna nova na entity. Anfitrião confirma o valor real aplicado via `PATCH /sugestoes-preco/:id/aplicado` com:
```json
{
  "precoAplicado": 247.50,
  "origem": "manual_dashboard"
}
```

Esse é o **ground truth do MAPE**. Sem isso, F6.1 Tier 3 não fecha — não dá pra validar a promessa "+30%".

#### `DatasetCollectorService` ([src/knn-engine/dataset-collector.service.ts](../urban-ai-backend-main/src/knn-engine/dataset-collector.service.ts))

3 métodos públicos:
- `handleDailySnapshot()` — cron 03:30 BRT, varre todos os imóveis e tira snapshot
- `recordCompsFromAnalysis(comps)` — chamado de dentro de cada análise (fire-and-forget)
- `recordAppliedPrice(...)` — grava ground truth quando preço é aplicado

E `datasetSize()` retorna `{ total, distinctListings, distinctDays, trainingReady }` que alimenta o painel admin e a `AdaptivePricingStrategy`.

---

## Parte 3 — Caminho do moat: Tiers de IA + auto-switch

### 3.1 Tese do moat

A maioria das startups de pricing dinâmico (PriceLabs, Beyond, Wheelhouse) parou no XGBoost. Por quê? Dataset disponível na época não justificava ir além. **Hoje é diferente:** com captura passiva crescente + parceria oficial (Stays), modelo neural híbrido vence em 3 dimensões:

1. **Geo não-linear** — descontinuidades de 200m que XGBoost só pega com features manuais; CNN aprende sozinha
2. **Padrões temporais longos** — F1 SP causa efeito 6 semanas antes; LSTM aprende a estrutura
3. **Cold start de imóvel novo** — embedding de bairro transfere conhecimento; XGBoost cai na média

E o moat real: **dataset proprietário é o ativo, código é replicável**. Concorrente que entrar precisa reconstruir do zero.

### 3.2 Arquitetura dos Tiers

| Tier | Algoritmo | Threshold do dataset | Status |
|---|---|---|---|
| **Tier 0** | Regras + multiplicadores | Funciona com 0 dados | ✅ ativo hoje |
| **Tier 1** | Regras + KNN treinado em dados próprios | ≥ 100 listings × 7 dias | 🔄 scaffold pronto, falta dataset cobrindo 7 dias completos |
| **Tier 2** | XGBoost primário | ≥ 500 × 30 dias + XGBoost ready | 🔄 strategy plugável pronta, falta treino do modelo (Python microservice) |
| **Tier 3** | XGBoost validado por MAPE ≤ 15% | ≥ 5000 × 90 dias | ⏳ 4–6 meses |
| **Tier 4 (moat)** | Modelo neural híbrido CNN+LSTM+MLP | ≥ 10k × 365 dias | ⏳ 18–24 meses |

### 3.3 AdaptivePricingStrategy — switch automático

Implementado em [src/knn-engine/strategies/adaptive-pricing.strategy.ts](../urban-ai-backend-main/src/knn-engine/strategies/adaptive-pricing.strategy.ts).

A cada predição (cache 5 min), consulta `DatasetCollectorService.datasetSize()` e decide qual estratégia usar. **Sem deploy entre tiers.** Quando dataset bate threshold, próxima predição já usa o algoritmo superior.

Vantagens:
- **Zero deploy** entre tiers — o produto evolui sozinho
- **Degradação resiliente** — se modelo quebrar, volta automaticamente para fallback
- **Slot opcional `hybrid`** no constructor — quando criarmos `HybridNeuralPricingStrategy`, basta plugar
- **Auditoria completa** — `PriceSuggestion.details.strategy` mostra qual algoritmo decidiu

### 3.4 Arquitetura do modelo Tier 4

Detalhada em [`docs/adr/0009-modelo-neural-hibrido-moat.md`](adr/0009-modelo-neural-hibrido-moat.md):

```
Geo input ──→ CNN (raster 256×256 SP)        ──→ embedding 64
                ↑ camadas: eventos, transporte, comércio, hotéis

Temporal ───→ LSTM (eventos 30d, calendar)   ──→ embedding 32
                ↑ janela móvel + sazonalidade + dia da semana

Tabular ────→ MLP (bedrooms, amenities, comps)──→ embedding 32
                ↑ features estáticas + agregados de comps

                       ↓ Concat
                Dense MLP 3 layers
                       ↓
        Saída: preço sugerido + intervalo de confiança
```

A confiança permite ao cron `stays-auto-apply` recusar pushes em situações arriscadas — quem realmente fecha o ciclo de receita real.

### 3.5 Cronograma realista até o moat

```
Hoje (S5)        ─▶  AdaptiveStrategy default; captura passiva ativa
S6               ─▶  AirROI + GCP/BigQuery + InsideAirbnb data request
                     Backend agora coleta ~50-200 pontos novos/dia
S7-8             ─▶  XGBoost shadow mode (Python microservice)
                     Tier 1 atinge mínimo (100×7d)
S9               ─▶  XGBoost vira Tier 2 (auto via AdaptiveStrategy)
S10-11           ─▶  Beta fechado + 3 cases ROI
S15-17           ─▶  Go-live oficial
S18-22           ─▶  Crescimento orgânico do dataset
~S22+            ─▶  Tier 3 — XGBoost validado MAPE ≤15%
~12-18 meses     ─▶  Dataset bate 10k×12m
~18-24 meses     ─▶  Tier 4 (modelo híbrido) entra como
                     HybridNeuralPricingStrategy carregada
```

---

## Parte 4 — Motor de eventos (gap mais importante para qualidade da sugestão)

### 4.1 Diagnóstico

Hoje a Urban AI cobre **shows e ingressos venda no varejo** (8 spiders Scrapy) — o que é importante mas insuficiente. Falta:

- Conferências e congressos (PMI, RD Summit, Web Summit Rio, Bett)
- Cursos profissionais multi-dia (CSPO, MBA, Sebrae executivo)
- Jogos em estádios (Allianz, Morumbi, Itaquera)
- Centros de eventos (Anhembi, Expo Center Norte, Transamerica Expo, São Paulo Expo)
- Eventos pequenos com impacto local (buffets, salões de eventos)

Um anfitrião perto do Allianz Parque tem demanda altíssima em dia de jogo e isso **hoje não é detectado** pela IA.

### 4.2 Estratégia em 3 camadas (proposta detalhada em `docs/runbooks/event-engine-evolution.md`)

**Camada 1 — APIs oficiais** (substituir scraping cinza):
- Sympla API (já fazemos scraping; trocar por API legítima)
- Eventbrite API (conferências e cursos B2B)
- Prefeitura SP Open Data (eventos culturais)
- api-football.com (jogos do Allianz/Morumbi/Itaquera/Pacaembu)

**Camada 2 — Firecrawl + LLM extraction:**
- Sites alvo: anhembi.com.br, expocenternorte.com.br, allianzparque.com.br, rdsummit.com.br, websummit.com/rio, sebrae.com.br/sites/sp/eventos, fgv.br/cursos-executivos, etc.
- Custo: ~US$ 16/mês para ~30 sites monitorados diariamente
- Mais resistente a mudanças de layout que Scrapy puro

**Camada 3 — Curadoria humana:**
- Form admin para evento de cauda longa
- Import semestral (PMI, ABRH calendários)
- Parceria com SPTuris (feed oficial)

### 4.3 Modificações necessárias

```sql
ALTER TABLE event ADD COLUMN source VARCHAR(64);
ALTER TABLE event ADD COLUMN dedup_hash VARCHAR(64);
ALTER TABLE event ADD COLUMN venue_capacity INT;
ALTER TABLE event ADD COLUMN venue_type VARCHAR(64);  -- stadium, convention_center, theater, bar...
ALTER TABLE event ADD UNIQUE INDEX uk_event_dedup (dedup_hash);
```

`venue_type` permite o motor de pricing ponderar diferente: show no Allianz (90k pessoas) vs noite de pagode num bar (200 pessoas) vs RD Summit em São Paulo Expo (15k pessoas profissionais).

### 4.4 Cronograma e custo

| Semana | Entrega | Custo adicional |
|---|---|---|
| S6 | Migration + dedup_hash + venue_type | — |
| S6-7 | Sympla + Eventbrite + Prefeitura SP integrados | — |
| S7-8 | Football API (ESPN/SofaScore alternativa) | US$ 0-19/mês |
| S8-9 | Firecrawl PoC com 5 sites | US$ 16/mês |
| S9-10 | Firecrawl ampliado para 30 sites | (incluso) |
| S10-11 | Form admin + import CSV | — |

**Cobertura alvo S10:** ≥80% dos eventos relevantes em SP detectados em ≤24h após anúncio público.

### 4.5 Métricas de qualidade

- **Cobertura** = % eventos relevantes detectados (verificar por amostragem manual semanal)
- **Latência** = anúncio público → linha em `event` (alvo: < 24h)
- **Falsos positivos** = eventos cadastrados que não aconteceram (alvo: < 5%)
- **Diversidade** = mín 5 `venue_types` ativos por dia

---

## Parte 5 — Painel administrativo (entregue nesta sprint)

### 5.1 Antes vs depois

**Antes:** não havia painel admin. O `/painel` existente é do **anfitrião** (mostra sugestões aceitas para um imóvel selecionado), não do operador Urban AI. Não havia como ver: quantos usuários ativos, qual modelo de IA está rodando, quão grande está o dataset, etc.

**Agora:** painel admin completo em `/admin` com:

- **Visão geral (KPIs):** usuários totais/ativos/admins, imóveis cadastrados, eventos no DB, eventos últimos 7d, análises geradas, sugestões aceitas, taxa de aceite, assinaturas ativas
- **Estado da IA:** tier ativo, estratégia, razão da decisão, tamanho do dataset (totalSnapshots, distinctListings, distinctDays, trainingReady)
- **Dataset:** breakdown por origem, top listings por volume, dias cobertos
- **Gestão de usuários:** `/admin/users` — paginação, mudança de role, ativar/desativar

### 5.2 Segurança

Acesso restrito por dupla camada:
- `JwtAuthGuard` (autenticação)
- `RolesGuard` + `@Roles('admin')` (autorização)

`User.role` ∈ {`host`, `admin`, `support`}. Default `host`. Mudança via SQL ou via endpoint `/admin/users/:id/role` (após primeiro admin existir).

### 5.3 Como criar o primeiro admin

```sql
UPDATE user SET role = 'admin' WHERE email = 'gustavog.macedo16@gmail.com';
```

Após esse seed, o painel passa a funcionar e admins novos podem ser criados via UI.

### 5.4 Não substitui observabilidade técnica

O painel admin é de **negócio**: KPIs de produto, estado da IA, dataset, usuários.

Para observabilidade técnica (uptime, latência, exceções, alertas) continuamos usando:
- **Sentry** (`urbanai-ff` org) para exceções e performance
- **UptimeRobot** para uptime
- **Railway logs** para troubleshooting
- **Painel Prefect Cloud** para pipeline de dados

---

## Parte 6 — Próximos passos imediatos (sua ação)

Lista compacta. Versão completa em `docs/next-actions.md`.

### Esta semana (S5 — 24-29/04)

1. **KYC Stripe** (bloqueia cobrança real)
2. **Aprovar orçamento marketing** com Fabrício e Rogério
3. **Validar Stays + iniciar contato comercial** (one-pager pronto)
4. **Decisão de contractor dev** (sem isso F6 trava)

### Próxima semana (S6 — 30/04-06/05)

5. **Criar conta AirROI** (10 min) — fonte de dataset SP
6. **Projeto GCP + BigQuery** (30 min) — Base dos Dados (espelho InsideAirbnb)
7. **Solicitar SP no InsideAirbnb data request** (free hit em paralelo)
8. **Provisionar staging Railway** (3-4h)
9. **Criar 8 Stripe Price IDs F6.5** (Dashboard Stripe)
10. **Setar env vars novas no Railway:** `JWT_SECRET`, `CORS_ALLOWED_ORIGINS`, `AIRROI_API_KEY`, `PRICING_STRATEGY=adaptive`, etc.

### Em 2-3 semanas (S6-7)

11. **Completar 3 stubs de Feature Engineering** (geocoding, metro distance, amenities Gemini)
12. **Migration:** `address.metro_distance_km`, `list.amenities_count`, `list.category`
13. **Backfill features para imóveis existentes**

### Em paralelo (S6+)

14. **Disparar 6 DPAs prioritários** (Stripe, Mailersend, AWS, Railway, Upstash, Sentry)
15. **Criar `/health` endpoint + UptimeRobot apontado**
16. **Recrutar 20-30 voluntários Superhost SP**
17. **Form Formspark + GA4 + Pixel Meta para landing**
18. **Promover Gustavo a admin no banco** (`UPDATE user SET role='admin' WHERE email=...`)

### Tier 1 da IA (S6-8)

19. **Implementar Sympla API + Eventbrite API + Prefeitura SP** (Camada 1 do motor de eventos)
20. **PoC Firecrawl com 5 sites alvo** (Anhembi, Allianz Parque, RD Summit, Sebrae SP, FGV)
21. **Adicionar UI de "registrar preço aplicado"** ao dashboard do anfitrião

---

## Apêndice A — Stats da sprint (24/04/2026)

- **31 commits** em main
- **84 testes verdes** no backend (era 0 no início do mês)
- **9 ADRs** documentados (NestJS, KNN, Prefect, MySQL, Railway, Secrets, KNN aposentar, KNN→XGBoost, Modelo neural híbrido)
- **15+ runbooks operacionais** (staging, migrations, backup, JWT cookie, eslint debt, dataset acquisition, feature engineering, event engine, incident response x5, etc.)
- **Backend modules novos:** `Stays`, `Admin`
- **Frontend pages novas:** `/settings/integrations`, `/plans/v2`, `/admin`, `/admin/users`
- **Infra:** Strategy pattern plugável, AdaptivePricingStrategy, DatasetCollectorService, RolesGuard, PriceSnapshot/OccupancyHistory/EventProximityFeature entities

---

## Apêndice B — Documentos relacionados

| Doc | Cobre |
|---|---|
| `docs/roadmap-pos-sprint.md` v2.7 | Roadmap completo com fases e marcos |
| `docs/avaliacao-projeto-2026-04-16.md` | Auditoria técnica que motivou F5C |
| `docs/next-actions.md` | 18 ações operacionais detalhadas |
| `docs/adr/0008-pricing-algoritmo-evolucao.md` | KNN → XGBoost |
| `docs/adr/0009-modelo-neural-hibrido-moat.md` | Caminho até o moat |
| `docs/runbooks/dataset-acquisition.md` | Top 3 fontes de dataset |
| `docs/runbooks/feature-engineering.md` | Pipeline de feature enrichment |
| `docs/runbooks/event-engine-evolution.md` | Camadas 1/2/3 do motor de eventos |
| `docs/runbooks/staging-provisioning.md` | Provisionamento de staging |
| `docs/lgpd/politica-privacidade-interna.md` | Política LGPD interna |
| `docs/slo.md` | SLO/SLA + error budget |

---

*Urban AI © 2026 · Documento principal de referência · Use como base para apresentações e relatórios aos sócios.*
