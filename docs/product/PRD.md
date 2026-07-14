# PRD — Urban AI

**Versão:** 2.0 (consolidada do código + pacote V2 em 2026-06-21)
**Status do produto:** beta operacional avançado, pré-go-live. Base técnica forte; falta dado real, outcomes e cases.
**Marca:** "Urban AI" (sujeita a rebrand — ver `REBRAND-MAP.md`).

> Esta versão corrige o enquadramento da v1 (que tratava o produto só como pricing de Airbnb) e incorpora o pacote `docs/v2-2026-05-24/`. **Escopo deste doc = produto core (hospedagem).** A expansão para outros setores é um **produto separado (spinoff)** e está em `../spinoff-plataforma-demanda/PRODUTO-MULTIVERTICAL.md` — não a misture aqui. Jornadas em `USER-JOURNEYS.md`.

---

## 1. O que é o Urban AI

**Radar de eventos/demanda + precificação dinâmica explicável para hospedagem de curta temporada** (Airbnb/temporada). O sistema mapeia o que acontece na cidade, identifica quais eventos afetam cada imóvel, recomenda a diária que o mercado provavelmente absorve e — quando autorizado — aplica via channel manager (Stays).

A frase da visão (do PRD v2):
> A Urban AI mapeia a cidade, identifica oportunidades de demanda e transforma isso em **decisões de preço explicáveis** para cada imóvel.

> **O radar de demanda é core.** O motor de eventos/demanda que alimenta o pricing dos imóveis faz parte do produto principal (já existe no código). O que é spinoff é **generalizar esse motor para outros setores** (mídia, staffing, food, estética) — produto à parte.

### Evolução do core (não confundir com spinoff)
| Estágio | O que é |
|---------|---------|
| **Hoje** | Pricing + radar de eventos para anfitriões |
| **V2 (em curso)** | Revenue intelligence para administradoras e hosts profissionais (decisão auditável, ROI por driver) |

O ativo defensável (moat) é o **dataset proprietário**: `evento → região → preço recomendado → decisão → reserva/receita real`. Quanto mais outcomes capturados, melhor o sistema fica.

### O que NÃO é
- Não é channel manager (integra com Stays, não substitui).
- Não é OTA nem intermedia reservas.
- Não promete % fixo de ganho antes de cases auditados (não-objetivo explícito do PRD v2).
- Não libera auto-apply amplo sem allowlist, consentimento, dry-run e rollback.
- **Não é a plataforma multi-vertical** — isso é spinoff (doc à parte).

---

## 2. Personas e papéis

3 roles no código (`User.role`): `host`, `admin`, `support`. Personas do PRD v2:

| Persona | Role | Job-to-be-done | Telas-chave |
|---------|------|----------------|-------------|
| **Anfitrião casual (1–3)** | host | "Não perder oportunidade óbvia perto do imóvel" | dashboard, events, price, my-plan |
| **Anfitrião profissional (5–20)** | host | "Gerir vários imóveis e datas de alta demanda" | portfolio (cockpit), pricing-rules, my-roi |
| **Administradora (20–150)** | host | "Operar muitos imóveis com consistência + relatório ao dono" | portfolio bulk-action, settings/integrations (Stays) |
| **Fundador/operação** | admin | "Saber onde o motor falha e onde há dinheiro na mesa" | /admin/* (29 telas) |
| **Suporte** | support | "Atender contatos e pendências (LGPD, billing)" | /admin/contacts, /admin/communications |
| **Investidor** | — | "Entender defensabilidade e execução" | material executivo (ver spinoff doc) |

Permissões no código (`auth/enuns/PermissionsEnum.ts`): `create.events`, `events.read`, `admin.access`, `superuser.access`. Role reavaliado contra o banco a cada request.

---

## 3. Tamanho real do sistema (números verificados)

- **Backend:** 32 módulos, **34 controllers, 220 endpoints HTTP, 43 entidades, 41 migrations**, 52 specs Jest.
- **Frontend:** **77 telas (`page.tsx`) + 2 API routes**, 22 componentes de host + 16 de admin, 3 idiomas (pt/en/es), E2E Playwright + axe-core.
- **Dados:** 7 spiders Scrapy (Blue Ticket, Even3, Eventim, Ingresse, Sympla, Ticket 360, Ticketmaster) + coletores REST (API-Football, Sympla, Firecrawl, SerpAPI, Tavily); pipeline Prefect; AWS S3.

> Números verificados por varredura exaustiva (21/06): 220 endpoints (não "~150"/"215"), 43 entidades (faltavam `EmailConfirmation` e `ProcessStatus`), 77 telas (não "104 rotas").

---

## 4. Funcionalidades (com a profundidade real)

### 4.1 Aquisição e conta
Landing + 7 páginas SEO; **waitlist** com posição/referral/convite; signup/login (e **login Google** via `POST /auth/google`, verificação de idToken); confirmação de e-mail; reset de senha.

### 4.2 Onboarding (time-to-first-value)
Importa imóveis do **Airbnb por URL** (resolve `quick-info`: foto, tipo, bairro, rating, reviews, amenidades) → registra (`/connect/register`) → configura o motor (estratégia `balanced`, `operationMode=notifications`, guardrails padrão −10%/+20%) → checkout.

### 4.3 Inteligência de eventos (core)
- Catálogo multi-fonte com **deduplicação** (dedupHash + candidatos + merge), geocoding, enrichment e escopo geográfico (`CoverageRegion`).
- **Host Event Radar:** catálogo, radar por imóvel, **heatmap** (grid ~2 km, células com demand score/percentil), detalhe com interpretação, **simulação de pricing por evento**.
- **Admin:** intelligence, heatmap, **blind-spots** (eventos sem coordenada, sem URL oficial, fonte velha >72h, sem snapshot, alta demanda sem impacto computado), recompute em lote.
- **Demand Score (0–100)** derivado de relevância, attendance/capacidade, tipo de venue, frescor da fonte, raio de impacto e sobreposição de eventos — com nível de confiança.

### 4.4 Motor de precificação (com estratégias e aprendizagem)
- Preço = base × multiplicador (categoria KNN + atratividade/proximidade + relevância). Detalhe em `ARCHITECTURE.md §7`.
- **Estratégias plugáveis** (`PRICING_STRATEGY`): `rules`, `xgboost`, `shadow`, **`adaptive`** (auto-tier: escolhe rules ou XGBoost conforme o dataset cresce; Tier 0 < 500 listings → rules; tiers maiores → XGBoost; com fallback resiliente).
- **Backtesting** com gate de qualidade **MAPE ≤ 15%**; classifier com fallback "Standard" quando sem treino/coordenadas.
- **Regras por imóvel** (`PricingRuleConfig`): weekend uplift, weekday discount, gap-night, last-minute, length-of-stay, min-stay dinâmico, piso de ocupação, event uplift.
- **Estratégia de portfólio**: conservative/balanced/aggressive/ai.

### 4.5 Pricing Decision Snapshot (objeto central da V2)
Cada decisão vira um objeto **auditável e idempotente** (`PricingDecisionSnapshot`): drivers (evento/pace/comp set/sazonalidade/regras/guardrail), **cenários** (conservador/recomendado/agressivo/extremo), confiança, guardrails aplicados, explicação, versões de métrica/modelo, e outcome. Idempotência por hash de sinais (evento+imóvel+data+modelVersion+preços). Consumido por host, admin, ROI e Stays.

### 4.6 Portfólio (cockpit + ações em lote)
`/portfolio/calendar`, `/opportunities`, `/simulate-action`, **`/bulk-action`** (set-base-price, apply-strategy, set-date-price) com auditoria (`PortfolioActionRun`/`Item`) e guardrails de ownership/validação.

### 4.7 Pace e Market Intel
- **Pace:** ritmo de reservas (ocupação real vs. esperada por dia da semana) — hoje diagnóstico, candidato a virar input de pricing.
- **Market Intel por imóvel:** percentil de ADR, mediana de ADR/ocupação, **comp set** (raio 3 km via haversine, até 10 comparáveis anonimizados), reatividade a eventos, série diária.

### 4.8 Aplicação via Stays
Connect (consentimento versionado + token AES-256) → preview com guardrails (`maxIncreasePercent` 25 / `maxDecreasePercent` 20) → push idempotente → rollback. Modos por anúncio: `inherit`/`notifications`/`auto` (auto só dentro do guardrail e atrás de allowlist/kill-switch).

### 4.9 ROI
Receita incremental confirmada/projetada/perdida, taxa de aceitação/aplicação, confiança. Meta V2: **ROI por driver** (evento, regras, market intel, guardrails, Stays/manual, portfolio).

### 4.10 AskUrban (assistente)
Endpoints `/ask/usage|question|feedback`. **Entitlement por plano** (`ASK_URBAN_ALLOWED_PLANS` = profissional/escala/alpha) com **quota diária** (`ASK_URBAN_DAILY_QUOTA` ~100 / hard cap ~200). Respostas usam **dados reais da conta** (imóveis, análises, receita, lift potencial) com citações para telas internas.
> ⚠️ Achado honesto: na implementação atual, as respostas são **templates determinísticos sobre métricas calculadas** — não foi encontrada chamada a LLM externo no caminho de resposta, apesar de existir `GEMINI_API_KEY`. Tratar "IA conversacional plena" como roadmap, não como entregue.

### 4.11 Comunicações + PWA
E-mail transacional (MailerSend/Brevo), **web push (PWA)**, digest de recomendações, preferências por canal, notificações in-app. PWA: manifest standalone, service worker network-first com `/offline.html`, shortcuts (Dashboard, Calendário), instalável.

### 4.12 Admin (cockpit)
29 telas. Direção V2: separar em **Exec / Ops / Support**, com cada alerta mostrando **impacto financeiro + dono + próxima ação**, e todo relatório ligado a `generatedAt/sampleSize/confidence/metricVersion/jobRunId`.

---

## 5. Regras de negócio (inegociáveis)

Mantidas e ampliadas (citações em `ARCHITECTURE.md`):
1. **Decisão é auditável:** nada aplicável sem `PricingDecisionSnapshot` com guardrails, cenários e explicação.
2. **Guardrail é lei:** nenhum preço fora do teto de aumento/queda da conta; preview bloqueia antes do push; push é idempotente.
3. **Evento só vira sinal** se canônico (dedup), geocodificado e in-scope.
4. **Auto-apply é opt-in restrito:** default off, allowlist, consentimento versionado, dry-run, rollback exercitado.
5. **Cobrança por imóvel;** quota server-side (`ativos < contratados`).
6. **Não misturar receita real com estimativa** no ROI.
7. **Segurança/LGPD:** bcrypt, tokens como hash, token Stays criptografado, deleção de usuário cascateia (base LGPD).

---

## 6. Métricas de sucesso (padrão V2 — 4 leituras de prontidão)

O PRD v2 exige separar sempre: **(a) código local, (b) release controlado, (c) operação real, (d) valor comprovado**. Não confundir "funciona local" com "validado com dado real".

| Categoria | Métricas |
|-----------|----------|
| Produto | time-to-first-value; imóveis com recomendação futura; recomendações aceitas/aplicadas; feedback +/− |
| Dados/pricing | eventos futuros cobertos; fontes ativas + frescor; % geocodificado; decision snapshots gerados; **outcome capture rate**; MAPE quando houver amostra |
| Negócio | leads waitlist; conversão p/ beta; clientes pagos; MRR; margem por listing |
| Operação | incidentes por severidade; jobs falhando; tempo de restore; release gate pass rate; SLA suporte/LGPD |

**Bloqueador de prova de valor:** Geocoding 403 trava o backfill → sem coordenadas boas, MAPE/cases ficam fracos. É pré-requisito para vender.

---

## 7. Maior risco de produto (das jornadas)

O ponto de morte silenciosa do onboarding é o **empty state da primeira semana**: se não há evento futuro próximo, o host vê "Sem sugestões" e acha que não funciona. A métrica que mais importa é **recomendações aparecerem em < 48h após o onboarding**. Detalhe e demais fricções em `USER-JOURNEYS.md`.

---

## 8. Roadmap do core

Cadeia recomendada pelo PRD v2: `staging real → recompute real → pricing_decision_snapshot → explicabilidade host → outcome capture → beta assistido`.
Fases: F0 governança docs → F1 ambiente real/release seguro → F2 decision snapshot/explicabilidade → F3 beta fechado (5–10 hosts) → F4 beta pago → F5 público controlado (calibração + auto-apply seguro).

> A expansão para outros setores (spinoff) tem roadmap próprio em `../spinoff-plataforma-demanda/PRODUTO-MULTIVERTICAL.md`.

## 9. Pontos de marca neste produto
Nome em 88+ arquivos, e-mails, domínios, feature "AskUrban", classes `urban-*`, copy SEO. Mapa e estratégia mecânica em `REBRAND-MAP.md`.
