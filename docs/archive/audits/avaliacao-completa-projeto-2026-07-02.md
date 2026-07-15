# Avaliação Completa do Projeto — 02/07/2026

> SUPERSEDED: avaliação histórica. Consulte `../../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`.

> Avaliação técnica e de produto executada em 02/07/2026 (Claude + Gustavo), cobrindo:
> avaliação geral do sistema + 8 deep dives temáticos (IA, eventos, mobile, web, import de imóveis,
> design system, arquitetura, higiene de repo).
>
> **Método:** 10 investigações paralelas sobre código, docs, git history e pesquisa externa.
> Números marcados como *(estimativa)* não foram medidos em produção — validar em `/admin/*`.

---

## 0. TL;DR

- **Processo e documentação acima da média** (ADRs, auditorias, runbooks, CI com validação de migrations, backup diário).
- **Backend sólido (~7.5/10)**; frontend estruturalmente frágil, mas melhor que as auditorias de maio indicam (mobile shell corrigido, Chakra 100% removido).
- **IA está no Tier 0**: regras + 7 multiplicadores hardcoded, KNN treinado com 3 mocks, XGBoost skeleton. Os 3 stubs de feature engineering (~10h) são o maior ROI do projeto.
- **Sem ground truth**: `recordAppliedPrice()` nunca é chamado, `OccupancyHistory` nunca populada → "+30% de receita" é incomprovável hoje.
- **Projeto parado desde 31/05/2026** (0 commits em junho; 260 em maio, 88 em abril). Roadmap previa go-live S15–17 (jul/2026) — precisa ser recalibrado.
- **Bloqueios não-técnicos pendentes desde abril**: KYC Stripe, 8 Price IDs, parceria Stays, dataset (AirROI/BigQuery), staging Railway, orçamento marketing, contractor, 6 DPAs.
- **Achado de aquisição**: o host não precisa achar o próprio perfil no Airbnb — o backend já extrai hostId de qualquer link de anúncio; falta só UX + fix de 3 linhas (hostId descartado no fluxo individual).
- **Risco LGPD imediato**: ~35MB de dumps SQL versionados no git (`docs/*.sql`).

---

## 1. Motor de IA — estado real e caminho para o objetivo

### Estado

| Componente | Estado | Referência |
|---|---|---|
| `RuleBasedPricingStrategy` | ✅ Ativa. 7 multiplicadores hardcoded (`pricing-engine.ts:24-74`): +0.2 Premium, +0.1 Standard, +0.5 atratividade>80, +0.2 >50, +0.3 viagem<15min, +relevancia/200 | Tier 0 |
| KNN classifier | ⚠️ Funcional, treinado com **3 imóveis mock**; features fake (metroDistance=0.5, amenities=1) | `knn-classifier.ts` |
| `XGBoostPricingStrategy` | 🔴 Skeleton — `loadModel()` vazio, `suggestPrice()` lança erro | `strategies/xgboost-pricing.strategy.ts:30-69` |
| `ShadowPricingStrategy` | ✅ Pronta para A/B (falta tabela `pricing_shadow_log`) | |
| `AdaptivePricingStrategy` | ✅ Default; auto-tier por volume de dataset (100/500/5k/10k listings), cache 5min, degradação automática | `strategies/adaptive-pricing.strategy.ts:44-234` |
| `FeatureEngineeringService` | 🔴 **3 stubs retornando 0**: geocoding, metro distance, amenities | `feature-engineering.service.ts:43-89` |
| `DatasetCollectorService` | ⚠️ 5 frentes implementadas; snapshot diário 03:30 roda mas grava ~0 (imóveis sem `priceCents` são pulados, linha 556); comps persistidos por análise; observações Airbnb parcial | |
| `recordAppliedPrice()` (ground truth) | 🔴 **Nunca chamado** | `dataset-collector.service.ts:689` |
| `OccupancyHistory` (receita real/noite) | 🔴 **Nunca populada** (depende Stays ou import manual) | |
| Backtesting/MAPE + quality gate 15% | ✅ Código pronto, 🔴 nunca rodado (sem pares predicted/actual) | `backtesting.ts` |
| `PricingOutcomeLearningService` | ✅ Implementado, 🔴 ocioso (sem outcomes) | |

Curva de absorção (`event-pricing-intelligence.service.ts:496-645`): 4 cenários com `bookingProbability` — **fictícia sem calibração**.

### Passo a passo (estimativas do deep dive)

| Fase | Entrega | Esforço | Calendário |
|---|---|---|---|
| **1. Features** | Completar 3 stubs + migration (`metro_distance_km`, `amenities_count`, `category`) + cron 04:00 | ~10h | +4 sem. de coleta |
| **2. Ground truth** | Stays Reservations OU import manual de ocupação via admin (bootstrap alpha) + chamar `recordAppliedPrice` no aceite + popular `OccupancyHistory` | ~32h | 4 sem. |
| **3. XGBoost** | Decisão Node WASM vs Python FastAPI (recomendado: Python) → treino com ≥500 imóveis × 30d → shadow mode | ~54h | 8 sem. |
| **4. Calibração** | Backtesting diário, gate MAPE ≤15%, promoção via auto-tier | ~22h | 4 sem. |

**Total: ~120h / ~16 semanas** (Fases 1–2 em paralelo). Fase 1 é o desbloqueio de tudo.

### 5 maiores riscos Tier 0→2
1. Dataset vazio (`trainingReady=false`) — mitigado pela Fase 1.
2. Sem ground truth — mitigado pela Fase 2 (com plano B manual).
3. KNN com features fake — resolvido junto com Fase 1.
4. Multiplicadores sem calibração — documentar origem + shadow A/B.
5. Pipeline XGBoost inexistente — Fase 3.

---

## 2. Motor de eventos e definição de demanda

### Fontes
- **7 spiders Scrapy**: Sympla, Eventim, Ingresse, Ticketmaster, Ticket360, BlueTicket, Even3 (frágeis a layout/anti-bot; sem alerta automático além do badge STALE).
- **Coletores REST**: SpCulturaCollector ✅ ativo; ApiFootball, Sympla API, Eventbrite ⏳ aguardando chaves.
- **Coletores LLM**: Firecrawl, SerpAPI, Tavily ⏳ aguardando chaves.
- **Curadoria**: form `/admin/events/new` + CSV import ✅.
- Cron 24h via `run_all_collectors.sh` (thread em `auth_proxy.py`).

### Pipeline (7 etapas)
coleta → normalização (por coletor) → ingest + dedup SHA256 nome|data|geo~110m (`events-ingest.service.ts:96-297`) → geocoding cron 30min → coverage check 80km (`outOfScope`) → enrichment Gemini (relevância 0-100, máx 3 tentativas, retry 24h) → uso no pricing/Event Radar.

**Pontos de limbo:** eventos que falham geocode após retries e eventos que esgotam as 3 tentativas do Gemini ficam invisíveis para o motor, sem alerta.

### Definição de demanda — problema central
`eventDemandScore` (`event-pricing-intelligence.service.ts:221-268`) = relevância 30% (**chute Gemini**) + attendance 25% (**preenchido ~15%** *(estimativa)*, quase só futebol) + venue 15% + raio 10% (chute Gemini) + leadTime 10% (exato) + fonte 10%. **~55% do score vem de estimativa de IA ou defaults.** Não há validação retroativa previsão × resultado — o sistema não aprende.

Brechas de dedup: nomes diferentes entre fontes (há fuzzy match + fila `EventDedupCandidate`); festivais multi-dia viram N linhas.

Event Radar (contract v0): endpoints implementados; `recompute-intelligence` é stub; campos `stub_pending_engine` no front.

### 5 upgrades priorizados
1. **Feedback retroativo** (previsão vs real 7d) — scaffolding existe, ativar cron. Mesmo ground truth da IA Fase 2.
2. **`EventHistoricalData`** — âncora de multiplicador para eventos recorrentes (~3 dias).
3. **APIs oficiais Sympla/Eventbrite** (attendance real) + prompt Gemini com pisos/tetos.
4. **Baseline de ocupação** (começar com calendário de feriados/alta temporada grátis).
5. **Buzz/Trends** (SerpAPI ~US$50/mês) — só depois dos 4 acima.

---

## 3. Mobile — UX/UI/jornada

**Correção importante vs. auditoria de 16/05 (score 2.5/10):** o shell mobile **foi corrigido em maio** — top bar + bottom nav (4 itens: Painel, Calendário, Portfólio, Radar) + drawer "Mais", breakpoint 768px, safe-area. PWA de pé: manifest, SW network-first, offline.html, ícones maskable. Estimativa atual: ~5-6/10.

Pendências:
- **P0** Tabela de propriedades exige ~600px → card view mobile (`properties/page.tsx`).
- **P0** Onboarding nunca testado em viewport 390px (wizard 5 passos, inputs largos, form de preço manual sem grid).
- P1 Botão "Aceitar" da recomendação < 44px de touch target.
- P1 Push notifications sem teste E2E; sem UI de update do SW.
- P2 Sem breakpoint de tablet (768-1024).

---

## 4. Web/desktop — UX/UI/jornada

### Jornada do anfitrião — 3 quebras
1. **Fallback de preço manual no onboarding** (`manual-price-required`, `onboarding/page.tsx:794-843`): modal sem contexto/exemplo/ajuda — maior beco sem saída (~5-10% dos usuários *(estimativa)*).
2. Empty/loading genéricos (dashboard vazio não explica; `AppLoadingStatus` com 15 fases idênticas).
3. Erros indiferenciados (toast igual para rede/cota/permissão).

Telas: ROI 8/10 · Painel 7/10 · Integrações 7/10 (reescrita ✅, era P0) · Calendário 6/10 (seletor com imagem quebrada, painel cortado) · Propriedades 6/10. Consistência visual ~85% (divergem botões 32/40/48px e radius).

### Admin
~23 rotas funcionais, sem navegação categorizada. Recomendação: `AdminShell` com sidebar em 4 grupos (Operação/Dados/Sistema/Beta) + breadcrumbs; eliminar `window.confirm()` nativos (usar `AdminConfirmDialog` existente).

### A11y
axe-core só nas 3 rotas públicas (passando). Sem cobertura autenticada/admin; inputs de preço sem `<label>`; foco de teclado sutil.

### Top 10 UX (impacto × esforço)
1. Fallback manual de preço (wizard com contexto) — 3-5d
2. Propriedades mobile (cards + labels) — 2-3d
3. Painel empty/loading — 1-2d
4. Onboarding mobile 390px — 2-3d
5. AdminShell + navegação — 5-7d
6. RecommendationCard (botão 48px, motivo sem truncar, confirmação visual) — 1d
7. A11y autenticadas + teclado — 2-3d
8. Calendário (seletor + painel sticky) — 1-2d
9. Push notifications E2E — 2-3d
10. Storybook/design tokens — backlog

---

## 5. Import de imóveis do host (fricção de aquisição)

**Confirmado por pesquisa externa:** o Airbnb não exibe o host ID em lugar nenhum; o "truque" é editar a URL do perfil (`/users/` → `/users/show/`). Nenhum concorrente pede ID (PriceLabs/Beyond/Wheelhouse = OAuth oficial ou PMS; Hospitable Connect como ponte B2B).

**O backend já resolve ~90%:**
- `GET /connect/resolve` segue short links `airbnb.com/l/...` ✅
- `GET /propriedades/hostId?propertyId=` + `quick-info` extraem hostId de **qualquer link de anúncio** ✅
- `scrapeHostListings(hostId)` lista todos os anúncios via GraphQL público ✅ — **frágil**: `AIRBNB_GRAPHQL_HASH` expira e exige atualização manual (F12 → Railway); quando expira, o import por host sai do ar.

**Bug encontrado (fix ~3 linhas):** no fluxo individual (caminho principal, único com E2E), o `hostId` retornado pelo `quick-info` é **descartado** — `fetchIndividualProperties` não chama `setHostUserId(info.hostId)` → maioria dos onboardings termina sem `airbnbHostId` no perfil (feature E2 do roadmap furada na prática).

**Plano ranqueado por fricção:**
1. Input único "Cole o link do seu anúncio" com detecção automática + "Encontramos N imóveis. Importar todos?" (UX; backend pronto).
2. Fix do hostId descartado.
3. Instrução visual "app → seu anúncio → Compartilhar → cole aqui" (substitui placeholder `users/show/123456789`).
4. Import por iCal do calendário (listing ID + prova de posse + ocupação de brinde → alimenta ground truth). Não existe; parser + cron.
5. OAuth oficial / via Stays / Hospitable Connect (longo prazo; elimina risco da hash GraphQL e captcha headless).

Riscos transversais: rotação da `AIRBNB_GRAPHQL_HASH`; Playwright lança 1 browser por request (pool/reuso); fluxo host sem E2E.

---

## 6. Design system

**Estado real melhor que o documentado:** migração Chakra **concluída** (0 imports; `npm run design:audit` passa), 38 componentes (22 host `componentes/ui` + 16 admin `_components`), tokens CSS light/dark com contrastes AAA verificados, 3 expressões intencionais (público editorial dark / admin denso dark / host light estilo Stripe). ~90% das telas migradas.

Gaps:
- Resíduos: ~20 classes Tailwind hardcoded; `alert()/confirm()` nativos no admin; emojis como status em tabelas antigas (usar `AdminStatusDot`).
- Tokens primitivos × semânticos misturados (dificulta rebranding e o dark mode do host — existe nos tokens, não testado).
- Sem Storybook, sem tokens.json (Figma sem fonte única).
- Sem componentes de layout (`AppStack`/`AppGrid`/`AppForm`).
- `design-system-audit.mjs` deveria ser gate de CI + flagrar alert/emoji/hex.

Plano 5 sprints: (1) limpeza + audit no CI → (2) componentes de layout → (3) últimos 10% + gate responsividade 390/768/1280 → (4) Storybook + tokens.json → (5) WCAG AA + dark mode host.

---

## 7. Arquitetura e fluxos (resumo textual dos diagramas)

- **Macro:** Anfitrião (browser/PWA) → Frontend Next.js 15 (Railway) → Backend NestJS (Railway: auth/billing · motor de preço · motor de eventos · integrações) → MySQL (Railway). Coletores (Scrapy/REST/LLM) → `POST /events/ingest`. Externos: Gemini, Google Maps, Stripe, Airbnb (scraping/RapidAPI) — os frágeis são Airbnb e Gemini.
- **Fluxo de preço:** disparo (botão/cron) → KNN (3 mocks) → score evento+local → **multiplicadores fixos (ponto frágil)** → guardrails 0.5–4.5x → sugestão + 4 cenários.
- **Pipeline de eventos:** coleta → ingest+dedup → geocode+cobertura → **Gemini (ponto frágil)** → preço/Event Radar.

---

## 8. Higiene de repo — o que não faz sentido

**Alta:**
- 🔴 **~35MB de dumps SQL versionados** (`docs/dump-ai_urban-202603131344.sql`, `inserts-only*.sql`) — risco LGPD + peso. `git rm --cached`.
- Sufixo `-main` nas 5 pastas de serviço (resto de ZIP do GitHub) — renomear.
- 3 pastas de agente (`.agent/`, `.agents/`, `.claude/`) — manter só `.claude/`.
- Módulos duplicados no backend: `email/`(12) vs `mailer/`(4), `notifications/` vs `communications/`, `processos/` vs `process/` — **auditar antes de remover**.

**Média:**
- Front: `/maps-bkp` (backup versionado), `/painel` × `/dashboard`, `/notificacao` órfã; dois lockfiles; `componentes/` PT.
- Naming PT/EN misturado no backend (`propriedades`, `evento`, `processos`).
- `docs/`: artefatos de teste e versões históricas de relatórios; o pacote Word técnico foi posteriormente movido para `archive/docx/urban-ai-documentacao/`, enquanto `v2-2026-05-24/` permanece como snapshot Markdown.
- Pipeline: `debug_pw.py`, `test_scraperapi*.py`, `dump_html.py` etc. na raiz — mover para `tests/`/`scripts/`.
- Imagens 1-2MB não otimizadas em `public/` (`Alfinete.png` 2MB).

**Baixa:** `urban-ai-knn-main/` (remover ~out/2026 conforme DEPRECATED.md), `_build/` órfão, PDFs na raiz, `dashboard/` sem README.

**Nota:** timestamps das 41 migrations com saltos estranhos + P1-028 (migrations não constroem banco fresh) → auditar antes de depender de disaster recovery.

---

## 9. Contexto geral (da avaliação da manhã)

- Último commit: **31/05/2026**. Junho: 0 commits. Roadmap v2.17 (15/05) previa beta S12 / go-live S15–17 → **recalibrar**.
- Pendências não-técnicas desde abril: KYC Stripe, 8 Price IDs F6.5, parceria Stays, AirROI/BigQuery, staging Railway (load tests k6 nunca rodaram), orçamento marketing, contractor, 6 DPAs.
- Segurança em aberto (das auditorias de maio): JWT cookie Fase 2 (accessToken ainda em localStorage), criptografia do token Stays em repouso, ingest com user/pass em vez de service account, migrations sem baseline fresh.
- Pipeline bronze sem deduplicação (`if_exists="append"`) — rodar 2× duplica eventos.
- Backend: `propriedade.service.ts` 2.771 linhas; front: `api.ts` 4.924 linhas; cobertura de testes backend ~10%; front sem unit tests (só E2E Playwright, 22 suites).

---

## 10. Priorização consolidada

1. **IA Fase 1 (10h)** — geocoding + metrô + amenities. Melhor ROI do projeto.
2. **Ground truth (1 esforço, 2 ganhos)** — valida IA e calibra eventos. Plano B: import manual de ocupação via admin.
3. **Onboarding: link único de anúncio + fix hostId** — mata a maior fricção de aquisição com backend pronto.
4. **Mobile: propriedades em cards + onboarding 390px.**
5. **Limpeza de repo (meio dia):** dumps SQL, `.agent(s)`, `/maps-bkp`, lockfile.
6. **Contínuo:** APIs oficiais > spiders, `EventHistoricalData`, AdminShell, Storybook/tokens, JWT Fase 2, token Stays criptografado.

E antes de tudo: **recalibrar o roadmap** (registrar a pausa de junho e novas datas) e executar as 4 decisões comerciais paradas.

---

## 11. Auditorias aprofundadas (adendo)

Oito auditorias temáticas complementares foram executadas em 02/07/2026 —
ver [auditorias-consolidadas-2026-07-02.md](./auditorias-consolidadas-2026-07-02.md).
Destaques que alteram a priorização acima:

- 🔴 **Incidente P0**: dump de produção (~80 usuários, 68 senhas SHA-256 sem salt, e-mails,
  customerIds Stripe) no histórico do git desde 02/04/2026, repo aparentemente público. Rotação de
  senhas + reescrita de histórico + comunicação ANPD.
- 🔴 **Banco não é reconstruível do zero**: 11 tabelas core sem `CREATE` em migration (Baseline no-op);
  falha silenciosa; drill de restore nunca executado; backup sem verificação de integridade.
- 🟢 **Segurança de endpoints**: os 7 P0 de maio estão fechados (auth, ownership, token Stays AES,
  webhook Stripe assinado). Restam pendências médias (coletor Python, Fase 2 do auth no front).
- 🟡 **Copy**: `/precos` promete Pix/boleto mas o checkout Stripe só aceita cartão; afirmações de IA/eventos
  além do que o Tier 0 sustenta.
- 🟡 **Observabilidade**: 2 de 12 pontos de falha têm alerta; alerta da hash Airbnb ainda vai para a Lumina.
- 🟡 **Performance**: import de host faz scraping serial (até 250s); índices compostos faltando; browser por request.

---

*Gerado em 02/07/2026 · Fontes: código dos 5 serviços, docs/ (ADRs 0001-0009, auditorias de abr-mai/2026, roadmaps), git history, pesquisa externa (Airbnb Help, PriceLabs, Hospitable).*
