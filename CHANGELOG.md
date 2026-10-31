# Changelog

Todas as mudanças relevantes ficam aqui. Formato baseado em
[Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com versionamento
do produto inteiro (não por serviço). Ordem cronológica reversa — mais novo
primeiro.

---

## [Histórico e qualidade de eventos] — 2026-10-31 — Mudanças, lead time, admin unificado e zero-yield de fonte nova

### Adicionado

- **Histórico de mudanças de evento** (`event_change_history`, migration `1793710000000`, reversível): `first_seen` por evento (semeado de `events.createdAt`), remarcação, troca de venue/URL e cancelamento declarado pela fonte (campo opcional `status` no ingest), sem duplicar o evento. Evento futuro que some da fonte por `EVENT_POSSIBLY_CANCELLED_DAYS` (7) vira "possivelmente cancelado", nunca apagado. Aplicar a nova data fica atrás de `EVENT_HISTORY_APPLY_RESCHEDULE` (desligado). Ver [runbook](docs/runbooks/eventos-historico-mudancas.md).
- **Lead time** (`GET /admin/event-coverage/lead-time`) e **mudanças** (`GET /admin/event-coverage/changes`): mediana e distribuição por fonte, categoria e porte; série diária.
- **Admin unificado** `/admin/event-coverage` com abas Cobertura, Qualidade, Regiões e Mudanças; `/admin/coverage` redireciona para a aba Regiões.
- **Zero-yield para fonte nova**: alerta fonte configurada que nunca entregou após `COLLECTOR_NEVER_DELIVERED_DAYS` (7). O estado de realerta agora é persistido (`collector_alert_state`, migration `1793710000001`) e sobrevive a deploy.

---

## [Senha sem hash no cliente] — 2026-10-28 — Pass-the-hash fechado, migração sem reset

### Segurança

- **A senha trafega em claro sob TLS e é hasheada só no servidor** ([ADR 0025](docs/adr/0025-senha-em-claro-sob-tls-hash-no-servidor.md)).
  O front deixava de mandar a senha e mandava `sha256hex(senha)`, que virava a própria credencial (pass-the-hash).
  Esquema novo `pw:v2:` + bcrypt(12) da senha; senhas novas limitadas a 72 bytes UTF-8 (limite do bcrypt, mensagem
  clara no cadastro/reset/convite/admin, sem truncamento silencioso); contas antigas entram com a
  senha em claro e são regravadas em v2 no login, sem reset. O sha256 hex de um bundle antigo em cache ainda vale só
  para contas não migradas até 2026-11-30 (`AUTH_LEGACY_CLIENT_HASH_UNTIL`, aceita `off`). Sem migration de banco.

---

## [PWA premium] — 2026-10-26 — App instalável, avisos por categoria e silêncio sem perda

### Adicionado

- **App instalável com a marca My Urban AI**: ícones (any, maskable, monochrome), splash do iOS, atalhos e convite de
  instalação (prompt nativo no Android/desktop, instruções "Adicionar à Tela de Início" no iOS Safari); aviso de nova
  versão do app; push no iOS só depois de instalar.
- **Avisos por categoria** (preço, eventos, resumo semanal) ligados às preferências de comunicação (`push_events` é novo),
  teto diário por dispositivo e payloads ricos (ações com link direto, selo do app).
- **Horário de silêncio 22h–8h (São Paulo) sem perda**: pushes gerados nesse intervalo são **adiados** para as 08:00 BRT
  (`push_deliveries.deliverAfter`) e enviados pelo job `push-deferred-drain` (08h–12h, com lock Redis e reivindicação
  atômica por entrega, sem duplicar entre réplicas). Antes de enviar: colapsa por `tag` no mesmo dispositivo (fica o
  mais recente), descarta vencidos (o evento já começou, ou seja, passou do `dataInicio`; se só há a data, vale até 23:59:59 BRT do dia; e mais de 24h) e relê a preferência da categoria e o teto do
  dia. O push de teste do usuário ignora o silêncio. Migrations aditivas `1793200000000` e `1793300000000`.
- **Push de evento relevante perto do imóvel** (categoria "eventos", `push_events`): job `push-event-alert` (de hora em
  hora, lock Redis) avisa o anfitrião sobre evento canônico que começa em até 14 dias, com relevância >= 60
  (`PUSH_EVENT_ALERT_MIN_RELEVANCE`), a partir do vínculo imóvel x evento da `analise_preco` (análise nova ou evento
  recém-enriquecido). No máximo 1 aviso por imóvel e 3 por anfitrião por dia (dia de São Paulo, além do teto global do
  push), nunca repete host+evento (tabela `event_alert_dispatches`, chave única; migration aditiva `1793400000000`),
  só plano pago/trial, respeita `push_events` e o silêncio 22h–8h (adiado e expira no `dataInicio`). Motivos de skip
  vão para o log de comunicação (`kind=event_alert`). O resumo de preços (digest) também passa o início do evento mais
  próximo, então o push adiado expira quando esse evento começa.

---

## [Sessão só por cookie, fase 2] — 2026-10-26 — Nenhum token legível por JavaScript

### Alterado

- `/auth/login`, `/auth/google`, `/auth/refresh` e `/auth/waitlist/accept` deixam de devolver `accessToken` no corpo;
  a sessão vive só nos cookies httpOnly. O front não grava mais token em `localStorage` e remove o legado
  (`accessToken`) na primeira carga, sem deslogar ninguém. Smoke E2E real, k6, product-audit e release-gate
  passam a ler o token do `Set-Cookie`. `Authorization: Bearer` segue aceito no backend (JWTs de serviço).
- Cota diária do Ask Urban passa a contar pelo dia de São Paulo (antes, fuso do servidor).

## [Beta medido] — 2026-10-26 — Resumo semanal, cobrança assistida e resultados v1 × v2

### Adicionado

- **Resumo semanal por anfitrião** (extensão do radar semanal, ainda 1 e-mail/semana): semana passada
  (segunda a domingo, BRT) com recomendações novas, aceitas, preços aplicados (sugerido x aplicado), resultados
  que o anfitrião registrou e lembrete dos pendentes; eventos das próximas 2 semanas. "Sem dados" no lugar de
  zero e nenhuma receita estimada. Respeita o opt-out; janela "uma vez por semana" agora é a segunda 00:00 BRT.
- **Resultados depois do evento**: `GET /sugestoes-preco/resultados-pendentes` e bloco "Como foi?" no painel
  (o calendário só mostrava eventos futuros, então não havia como registrar o resultado depois).
- **v1 × v2**: o preço do motor v2 em sombra passa a ser guardado em `analise_preco.shadow_v2_preco` /
  `shadow_v2_versao` (migration `1793100000000-AddShadowV2ToAnalisePreco`). `/admin/outcomes` compara v1, v2,
  aplicado e resultado; abaixo de 30 casos mostra só n e contagens.
- **Cobrança assistida** (admin): `/admin/billing-hosts` com o estado da assinatura de cada anfitrião e envio, por
  e-mail, do link de portal/checkout que o Stripe já gera (`POST /admin/billing/hosts/:userId/send-link`).
- Runbook [beta-relatorio-e-resultados](docs/runbooks/beta-relatorio-e-resultados.md).

### Alterado

- Assunto do e-mail semanal: "Seu resumo semanal - Urban AI" (antes "Radar semanal de eventos"); preferência
  em Configurações renomeada para "Resumo semanal".

---

## [Plano B do scraping] — 2026-10-26 — Anfitrião informa os dados quando o Airbnb falha

### Adicionado

- `PUT /propriedades/:id/host-baseline` e `GET /propriedades/:id/baseline`: o anfitrião informa diária
  base (obrigatória), mínima (piso das sugestões), fim de semana (só registrada) e dados essenciais
  (quartos, camas, banheiros, hóspedes, tipo). Guarda origem (`host_input`) e data; histórico em
  `pricing_input_history`. Migration aditiva `1793000000000-AddHostInputBaselineToList`.
- `selectBaselinePrice`: escolhe entre a diária lida do Airbnb e a informada (leitura velha nunca derruba
  o valor do anfitrião). Tela do imóvel mostra a origem e o formulário "Preencher manualmente".
- ADR 0010 com o mapa de tudo que depende do Airbnb e o que acontece quando falha.

### Corrigido

- Leitura vazia do Airbnb (snapshot de falha) não grava mais zeros por cima dos dados no onboarding nem
  no re-scraping mensal; dados essenciais informados pelo anfitrião não são sobrescritos por releitura.
- Cron diário não descarta mais a recomendação quando a leitura ao vivo do Airbnb falha.

### Segurança

- Chave pública do cliente web do Airbnb saiu do código: nova variável `AIRBNB_WEB_API_KEY`
  (sem ela, o GraphQL do perfil é pulado e o fallback por navegador é usado). **Ação de deploy:**
  definir a variável nos ambientes que importam por perfil.

---

## [Assinatura] — 2026-10-25 — Acesso pago imposto no backend

### Adicionado

- `SubscriptionGuard` global: rotas que entregam o valor pago respondem **402
  `SUBSCRIPTION_REQUIRED`** sem assinatura `active`/`trialing`, `past_due` dentro da carência
  (`SUBSCRIPTION_GRACE_DAYS`, padrão 3), alpha explícito ou admin. Política por rota em
  `urban-ai-backend-main/src/subscription/subscription-policy.ts` (teste de cobertura reprova rota
  sem classificação). Identidade/LGPD/cobrança/planos e o onboarding pré-pagamento seguem livres.
- Downgrade/cancelamento: imóveis acima da cota são **pausados** (`addresses.quota_paused_at`,
  nunca apagados), o dono é avisado e eles voltam sozinhos quando a cota sobe. Crons de análise,
  re-scraping, digest de preço, radar semanal e auto-apply só processam quem tem direito de uso.
- Frontend: 402 abre o paywall existente (não vai para `/forbidden`); no onboarding a análise é
  adiada até o plano ser ativado.

---

## [Limpeza] — 2026-10 — Enxugamento do repositório público

### Removido

- **Serviço KNN aposentado** (`urban-ai-knn-main/`) e o job `auxiliary-node-services` do CI;
  o gate `scripts/knn-legacy-dependency-gate.js` fica como guarda contra reintrodução
  ([ADR 0007](docs/adr/0007-aposentar-knn-microservice.md)).
- Resquícios do fornecedor anterior: `.github/` de assistentes em `urban-pipeline-main/` e
  `urban-webscraping-main/`, autores `@luminalab.ai`, passo de `git_clone` do `prefect.yaml`
  apontando para o repositório antigo.
- Arquivos sem uso: imagens órfãs do frontend (~5 MB), `runtime.txt`, `yarn.lock`/`pnpm-lock.yaml`
  do backend, utilitários soltos de banco, `ServeStatic('/uploads')`, scripts de depuração do
  pipeline, `scratch/` e `docker_legacy/` do webscraping.
- Documentação histórica: evidências datadas (`docs/evidence/`, agora artefatos de CI),
  relatórios E2E, handoff de 2026-07, auditoria 360, plano mestre e scorecard 10/10, mapa
  visual, `docs/v2-2026-05-24/`, protocolo de devs/agentes e runbooks pontuais de migração de
  DNS/subdomínios, staging e track 3.

### Alterado

- Runbooks consolidados: `go-live-checklist.md` (checklist único), `events-ingest-service-account.md`
  (absorve a Camada 1), `staging-provisioning.md` (absorve as auth fixtures); runbooks sem data no
  nome; `event-radar-release-gate.md` movido de `docs/release/`.
- `docs/README.md` e `DOCUMENTATION-GOVERNANCE.md` reescritos como índice enxuto;
  `public-scope-guard.js` bloqueia `.github/` aninhado e lista só caminhos existentes.

### Histórico dos CHANGELOGs por serviço (removidos)

- **urban-pipeline** — 0.3.0 (2025-09-11): orquestração com Prefect, configuração via variáveis
  Prefect, classe única `SpiderTrigger`; 0.2.0 (2025-08-14): pipeline de disparo das APIs de
  webscraping.
- **urban-webscraping** — 0.2.0 a 0.11.1 (2025-06 a 2025-08): spiders Sympla, Even3, Ticketmaster,
  Blue Ticket, Ingresse e Ticket 360; pipelines de itens e dump em banco; disparo dos spiders como
  API REST e orquestrador agendado.

---

## [Docs] — 2026-10-23 — Sincronização documentação × realidade

### Adicionado

- **`docs/ARQUITETURA-ATUAL.md`** — fonte única do estado atual: topologia, diagrama
  mermaid, fluxo de eventos (coletores/spiders → `POST /events/ingest`), fluxo
  host → front → API, integrações, ambientes, deploy, repositório canônico
  (`urbanai-tech/urban.ai`) e
  pendências conhecidas em termos genéricos.
- **`docs/ACESSOS-E-FERRAMENTAS.md`** — acesso necessário, escopo mínimo e canal
  (MCP oficial / CLI / API) por provedor.

### Alterado

- `docs/runbooks/matriz-env-operacional.md` refeita a partir das variáveis lidas no
  código, por serviço e provedor, com obrigatoriedade e onde configurar.
- README raiz e `docs/README.md` com trilha "comece aqui"; READMEs dos serviços
  alinhados (NestJS 11, Bull v3, npm, sem Chakra, `PREFECT_API_URL`/`PREFECT_API_KEY`,
  bronze S3 inativo, KNN aposentado).
- Adendos nos ADRs 0001, 0003 e 0005; banner "⚠️ Desatualizado" em runbooks e
  handoffs com DNS na Hostinger, hosts `api.`/`staging.` inexistentes ou fluxo antigo.
- Governança documental registra a Onda E e o estado "Desatualizado (banner)".

### Pendências registradas (sem mudança de código)

- ~~`UrbanIngestPipeline` dependia de `URBAN_COLLECTOR_EMAIL/PASSWORD`~~ — corrigido: envio habilitado só pela API key, com outbox persistente.
- `PREFECT_SERVER_URL` ainda citado em `.env.example` do pipeline.
- Backup off-site falhando por credenciais inválidas no provedor; sem MX no domínio;
  hostname canônico da API inexistente; TLS de `staging.myurbanai.com`.

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
- **Documentos:** roadmap pós-sprint v2.16 com changelog completo.

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
- **Doc `relatorio-status-semanas3-4.md`** com o status das semanas 3–4.

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
