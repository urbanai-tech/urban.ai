# Estado real dos gaps — atualizado 06/07/2026

> **SUPERSEDED — snapshot histórico.**
> Este documento foi preservado para rastreabilidade. Consulte a [auditoria 360 atual](../../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md) e o [plano mestre 10/10](../../plano-mestre-scorecard-10-10-2026-07-15.md).

> Consolidação após a sessão de remediação + validação com o app **rodando de verdade**
> (backend + MySQL + front produção + login real, medição de DOM/estilos).
>
> **Achado transversal:** as auditorias de 02/07 (leitura estática de subagentes)
> **superestimaram sistematicamente os gaps.** Vários itens marcados como "não feito / 0%"
> estavam já implementados. Este documento é a fonte de verdade atual.
>
> Legenda: ✅ feito e verificado · 🟡 parcial (falta pouco, é código) · 🔴 gap real de código ·
> 📊 precisa de dados/produto rodando · 🔒 owner (não é código).

---

## Execução 13/07/2026 — fila de gaps de código fechada

Todos os gaps de código que dá para fazer e verificar sozinho (sem chaves/prod)
foram implementados, testados (tsc + jest + build) e commitados nesta branch:

| Gap | O que foi feito | Verificação |
|---|---|---|
| 1. metroDistance no classifier | `minhaPropParaIA` lê `address.metroDistance`/`list.amenitiesCount` com fallback | tsc |
| 2. GTFS metrô | 101 estações reais Metrô+CPTM via OSM/Overpass (era seed de 31) | jest (bbox/Paulista<0.5km) |
| 3d. Baseline sazonal | módulo puro de feriados/alta temporada soma 0..10 ao demand score | jest (13 testes) |
| 4. Ponte tempo-até-valor | `/painel` surfaça card "preparando" reusando setupStatus | tsc (runtime data-cond.) |
| 5. A11y autenticada/admin | axe estendido + login helper, gated em creds e2e | `playwright --list` (11 testes) |
| 6a. Multi-dia | leituras casam evento por overlap (dataFim), não só dataInicio | tsc back+front |
| 6b. Staleness alert | cron diário alerta no Sentry coletor parado >24h | tsc + boot |
| 6d. FOUT | fontes via next/font (self-host), removido @import do Google | next build + inspect runtime |

**Gap 3 — motor de demanda (fechado em código, 13/07):** substituímos "chute do
Gemini" por triangulação de fontes:
- **3c teto de venue** — `sp-venues.ts` (~20 venues curados, cruzados c/ Wikidata
  P1083) + `VenueCapacityService` (match por nome/geo, backfill, cron+trigger).
  `resolveAttendance` usa como teto com sell-through 0.7.
- **3b âncora histórica** — entity `EventHistoricalMultiplier` + migração; importer
  Wikidata (P1110); **seed curado dos festivais** (CCXP/Lolla/The Town) com público
  real extraído da Wikipedia via Firecrawl; refresh Firecrawl key-guarded; feedback
  loop idempotente (ocupação/multiplicador reais dominam com o tempo). Flui no score
  via `events.historicalAttendance`.
- **3d baseline sazonal** — feriados/alta temporada somam ao score.
- Triggers: `/admin/jobs/venue-capacity/run` e `/admin/jobs/event-historical/run`
  rodam sobre TODA a base; crons diários/semanais pegam eventos novos.
- Falta só ligar `FIRECRAWL_API_KEY` no Railway p/ o refresh (o seed já funciona sem).

Itens 🔒 owner (SEC-1, KYC Stripe, drill de restore, UptimeRobot 6c) seguem seus.

---

## 1. Segurança

| Item | Status real |
|---|---|
| 7 P0 de auth (rotas sem guard, reset por userId, delete sem ownership) | ✅ Corrigidos em maio (verificado no código) |
| Token Stays em repouso | ✅ AES-256-GCM |
| Webhook Stripe assinado | ✅ `constructEvent` + raw body |
| Captura do webhook Stripe no Sentry | ✅ Feito nesta sessão |
| SEC-2 — coletor Python com senha | 🟡 Código já prefere API key (`x-urban-events-ingest-key`); **falta só setar a env var** `URBAN_EVENTS_INGEST_API_KEY` nos coletores (ops) e opcionalmente remover o fallback |
| SEC-3 — token em localStorage (XSS) | ✅ Já era 100% cookie httpOnly; sem `setItem`/`getItem` de token. Risco não existia mais |
| Interceptor 401 deslogava por 401 de aplicação | ✅ Corrigido e verificado nesta sessão (não desloga mais em 401 não-auth) |
| 🔒 **Vazamento do dump de prod no git** (P0) | 🔴🔒 Contenção de código feita (untrack + gitignore + postmortem). **Núcleo é seu:** repo privado, reset de senhas dos ~80 users, rotação da chave Stripe, reescrita do histórico, ANPD |
| Rotação de secrets (SLA/owner por secret) | 🔒 Definir |

## 2. IA / motor de pricing

| Item | Status real |
|---|---|
| Feature engineering (geocode/metro/amenities/category) | ✅ Implementado + 15 testes (nesta sessão). Migração de colunas testada |
| Ground truth — `recordAppliedPrice` no aceite | ✅ **Já era chamado** (`sugestion.service:454`) — auditoria estava errada |
| Import manual de ocupação (bootstrap) | ✅ Já existe (`POST /admin/occupancy/manual`) |
| MAPE / backtest | ✅ Já existe (`admin.service.pricingQuality`) + cron de feedback agendado (nesta sessão) |
| 🔴 Ligar `metroDistance` no objeto que o KNN classifier lê | 🔴 Gap real (o classifier lê `property.metroDistance`; falta o builder passar) |
| 🔴 Coordenadas reais das estações de metrô (GTFS) | 🔴 Hoje é seed aproximado; trocar pelo dataset oficial antes de confiar na feature |
| Validação com Gemini/Maps reais | 📊 Precisa de chaves (usei mocks) |
| **Sair do Tier 0 (regras) → IA treinada** | 📊 **O gap nº 1.** Scaffolding pronto, mas precisa de **dataset real acumulando** (semanas rodando) + cases de ROI auditados. Não é código — é dado + tempo |

## 3. Motor de eventos / qualidade de demanda

| Item | Status real |
|---|---|
| Coleta (spiders + REST + LLM + curadoria) | ✅ Existe; SpCultura ativo, outros aguardam chaves |
| Dedup, geocode, cobertura, enrichment Gemini | ✅ Existe |
| 🔴 **Qualidade da "definição de demanda"** | 🔴📊 ~55% do score é chute do Gemini. Faltam: público real (só ~15% dos eventos têm), histórico de eventos recorrentes (âncora CCXP/Lolla), baseline de ocupação (evento+Carnaval ≠ semana morta) |
| Spiders frágeis a layout, sem alerta ativo | 🟡 Badge STALE passivo; migrar para APIs oficiais/Firecrawl |
| Multi-dia (festival vira N linhas) | 🔴 Gap real menor |

## 4. UI / UX / Design

| Item | Status real |
|---|---|
| Mobile responsivo / app-shell (bottom nav) | ✅ **Verificado ao vivo** — bottom nav (Painel/Calendário/Portfólio/Radar/Mais) + top bar; sidebar no desktop |
| Overflow horizontal | ✅ **Zero em todas as rotas** (mobile + desktop) — verificado |
| Contraste de cores | ✅ **~700+ elementos, 0 abaixo de 3:1** (público + autenticado + admin, light + dark) — verificado |
| "Texto fantasma/sobreposto" | ✅ Era **FOUT** (troca de fonte capturada no screenshot), não bug de DOM |
| "Cara de site, não app" (títulos gigantes) | ✅ Corrigido — título interno 45px → 26px no mobile (verificado) |
| Design system unificado (Chakra removido) | ✅ `design:audit` limpo + agora gate no CI |
| Navegação do admin (sidebar/breadcrumb/categorias) | ✅ **Já existe** — 30 links categorizados (auditoria estava errada) |
| `/painel` vs `/dashboard` "duplicados" | ✅ **Não são** — painel de controle vs calendário (telas distintas) |
| Inputs de propriedades "só com placeholder" | ✅ **Já têm label** (auditoria errada) |
| Diálogo nativo (`window.prompt` no dedup) | ✅ Trocado por `AdminConfirmDialog` |
| Componentes de layout (`AppStack`/`AppGrid`) | ✅ Criados (nesta sessão) — falta migrar telas para usá-los (incremental) |
| 🔴 **Ponte tempo-até-valor** (host novo vê painel de zeros) | 🔴📊 Empty states já são específicos, mas falta um estado "preparando suas recomendações, leva ~X". É conteúdo/UX + depende de dados |
| 🔴 A11y (axe) só nas rotas públicas | 🔴 Expandir para autenticadas/admin — precisa de E2E com login |
| Storybook / tokens.json (docs vivas do DS) | 🔴 Não existe (baixa prioridade) |
| FOUT (flash de fonte no load) | 🟡 Artefato; preload do Bebas elimina (polimento menor) |
| Cookie banner cobre conteúdo no 1º acesso | 🟡 Padrão (dispensável em 1 clique); opcional dar mais padding inferior |
| Touch targets (botões 32/40px) | 🟡 AA-ok (>24px), abaixo só do AAA (44px). Não é bug |

## 5. Infra / Disaster Recovery / Observabilidade

| Item | Status real |
|---|---|
| Banco reconstruível do zero | ✅ **DR-1 feito e testado** (`CatchupCoreEntities`: 11 tabelas core + FKs; fresh → generate vazio) |
| Índices de performance | ✅ PERF-3 (compostos em `events`) testado |
| Import de host serial (timeout) | ✅ PERF-1 (concorrência 5) |
| Integridade de backup no workflow | ✅ DR-2 (gzip -t, tamanho, contagem de CREATE TABLE) + runbook de DR |
| Redis no `/health` + version + frescura de crons | ✅ Feito (version era "unknown"; agora resolve) |
| correlationId (x-request-id) | ✅ Feito + verificado |
| 🔒 **Primeiro drill de restore** | 🔴🔒 Nunca executado. Precisa: credencial S3 read-only, `RESTORE_DATABASE_URL`, versioning/lifecycle do bucket |
| 🔴 Alertas restantes (staleness de coletor) | 🔴 Dados de frescura já expostos no `/health`; falta a regra de alerta externa |
| UptimeRobot aponta para `app.myurbanai.com/health` (404) | 🔴🔒 Corrigir o alvo (o health vive no domínio Railway) |
| Boot depende de `STRIPE_SECRET_KEY` (não sobe sem) | 🟡 Acoplamento; não é bug (prod tem a chave) |

## 6. Higiene / dívida técnica

| Item | Status real |
|---|---|
| CI de TypeScript vermelho no main | ✅ Corrigido (2 specs pré-existentes) |
| Dumps SQL / artefatos / lockfile duplicado | ✅ HIG-1 (untrack) |
| Rota morta `/maps-bkp` | ✅ Removida |
| Módulos "duplicados" (email/mailer, process/processos, notifications/communications) | ✅ **Falso positivo** — são camadas complementares, não duplicação |
| 🔴 Renomear pastas `-main` | 🔴🔒 Risco de quebrar CI/Railway; precisa de deploy coordenado (adiado) |
| `propriedade.service.ts` (2.771 linhas) / `api.ts` (4.924 linhas) | 🔴 Refactor de dívida (não urgente; não quebra nada) |

## 7. Owner / negócio (não é código)

| Item | Status |
|---|---|
| 🔒 SEC-1 núcleo (repo privado, reset senhas, rotação Stripe, histórico, ANPD) | **P0 — o mais urgente** |
| 🔒 KYC Stripe + 8 Price IDs F6.5 | Bloqueia cobrança real |
| 🔒 Parceria Stays + credenciais | Bloqueia modo automático |
| 🔒 Dataset externo (AirROI/BigQuery) plugado | Destrava Tier 1 da IA |
| 🔒 Orçamento marketing / contractor / 6 DPAs | Decisões pendentes |
| 🔒 Copy: afirmações VERMELHAS restantes ("5K eventos/dia", "aprende a cada análise") | Suavizar (decisão de tom) |

---

## O resumo em uma frase

**Código e UI estão substancialmente prontos** (muito mais do que os relatórios diziam). Os gaps 🔴 de código que sobram são poucos e pontuais (ligar metroDistance no classifier, qualidade de demanda de eventos, ponte tempo-até-valor, a11y autenticada, drill de restore). **O que realmente falta não é código: é (a) o produto rodando com dados reais** para tirar a IA do Tier 0 e provar ROI, **e (b) as ações de owner** — sendo o P0 do vazamento no git o mais urgente.
