# Plano de Correções — Delegável por Ticket (02/07/2026)

> Plano de execução derivado das auditorias de 02/07/2026
> ([avaliação](../audits/avaliacao-completa-projeto-2026-07-02.md) ·
> [auditorias consolidadas](../audits/auditorias-consolidadas-2026-07-02.md)).
>
> Cada ticket é **autossuficiente**: contexto, arquivos, passos e critério de aceite.
> Um dev deve conseguir executar sozinho sem reler as auditorias.
>
> **Convenções para todos os tickets:**
> - Branch a partir de `main`: `fix/<id>-slug` (ex.: `fix/SEC-1-git-leak`). Nunca commitar direto em `main`.
> - Rodar antes de abrir PR: no backend `npx tsc --noEmit && npx jest`; no front `npx tsc --noEmit && npm run design:audit`.
> - PR pequeno e com o "Critério de aceite" copiado na descrição, marcado item a item.
> - Nunca commitar `.env`, dumps `.sql` ou credenciais. Segredos vão no Railway, não no código.
> - Se um passo divergir da realidade do código (linha mudou, função renomeada), **pare e confirme** com o líder técnico — não force.
>
> **Legenda de esforço:** P=pequeno (≤4h) · M=médio (1-2 dias) · G=grande (3-5 dias).

---

## Auditoria UI/UX rota a rota (06/07 — app rodando, mobile + desktop)

Varredura com medição de DOM (overflowX real, elementos largos estáticos, erros, imagens quebradas), viewports 322px/375px (mobile) e 1265px (desktop). **Resultado: app sólido e responsivo em todas as rotas testadas — zero scroll horizontal, zero erro, zero imagem quebrada.**

| Rota | Área | Mobile | Desktop | Observação |
|---|---|---|---|---|
| `/precos` | público | ox=0 ✅ | — | glows decorativos clipados (não causam scroll) |
| `/` (login) | público | renderiza ✅ | — | |
| `/painel` | anfitrião | ox=0 ✅ | ox=0 ✅ | dashboard principal |
| `/properties` | anfitrião | ox=0 ✅ | — | cards responsivos |
| `/onboarding` | anfitrião | ox=0 ✅ | — | ⚠️ 3 botões < 40px (touch target) |
| `/admin` | admin | sidebar+breadcrumb ✅ | — | nav categorizada |
| `/admin/finance` | admin | ox=0, tabela contida ✅ | ox=0 ✅ | tabela larga (1120px) scroll no container — padrão correto |
| `/admin/events/dedup` | admin | renderiza ✅ | — | DS-1 dialog |

**Único achado real:** 3 botões < 40px no onboarding (abaixo do alvo de 44px) — podem ser botões-ícone legítimos; a confirmar. Fora isso, nada de scroll horizontal, layout quebrado, erro de runtime ou imagem quebrada em nenhuma rota. A auditoria confirma o padrão: **a UI/UX está em forma muito melhor do que os relatórios de 02/07 indicavam.**

## Validação de UX com o app rodando (06/07 — stack local completo)

Subi o stack inteiro (backend + MySQL Docker + front produção + login real) e validei as telas com medição de DOM (screenshot/click travam neste harness; inspect/snapshot/resize/eval funcionam):

- **PRD-2 (properties mobile)** — a 375px: `scrollWidth == viewport (375)`, **overflowX = 0, zero elementos largos**. Sem scroll horizontal. O gap do audit ("scroll horizontal em 390px") estava errado. ✅
- **Navegação do admin** — `/admin` já tem `<aside>` sidebar + breadcrumb + 30 links **categorizados** (Painel executivo, Financeiro, Funil, ROI, Eventos, Deduplicação, Cobertura, Coletores...). O gap "23 rotas sem navegação" também estava superestimado. ✅
- **DS-1** — `/admin/events/dedup` renderiza limpo com o `AdminConfirmDialog` novo. ✅

**Achado real de robustez (não estava nas auditorias):** o interceptor 401 da axios (`api.ts`) **desloga o usuário em QUALQUER 401**, inclusive um que não é de auth. Descobri porque `/payments/getSubscription` deu 401 (chave Stripe dummy no local) → o app expulsou o usuário logado para o login. Em prod isso é mascarado pela chave real, mas é frágil: um hiccup da Stripe (ou de qualquer endpoint) derruba a sessão. **Recomendação:** o interceptor deve só forçar logout em 401 de endpoints de auth (ou após o refresh realmente falhar), não em 401 de aplicação. (Não alterei às cegas — é caminho crítico, precisa de E2E.)

## Progresso de execução (branch `fix/audit-remediation-2026-07`)

Atualizado 06/07/2026. Trabalho feito com o backend rodando localmente + MySQL 8 em Docker (nada tocou prod).

**✅ Feito e verificado (tsc/jest/MySQL real):**
- **DR-1** — banco reconstruível: `CatchupCoreEntities` (11 tabelas core + 60 FKs) testada de ponta a ponta (fresh → 11 core presentes; generate → 0 CREATE TABLE; prod → gate no-op). Corrigiu índice duplicado latente em `events`.
- **PERF-3** — índices compostos de `events` (aplicam limpo).
- **IA-1** — feature engineering (geocode/metro/amenities/category), migração de 2 colunas testada, 15 testes unitários (pegaram bug real do `Number(null)`).
- **LGPD-1** — `payment` FK → CASCADE (testado) + `DELETE /auth/me` self-service.
- **PERF-1** — import de host paralelizado (concorrência 5, util testado).
- **OBS-1** (parcial) — Redis no `/health`, alerta fora da Lumina, captura do webhook Stripe no Sentry.
- **OBS-2** — correlationId por request.
- **DR-2** (parcial) — integridade de backup no workflow + runbook de DR.
- **HIG-1/HIG-2** — limpeza de repo + rota morta.
- **DS-1** (parcial) — `design:audit` como gate de CI + detecção de diálogos nativos.
- **SEC-1** (contenção segura) — untrack dos arquivos de PII + `.gitignore` + postmortem.
- **PRD-3** (parcial) — cópia de pagamento alinhada ao checkout.
- **CI** — consertado o `tsc --noEmit` do backend que estava vermelho no `main`.
- **HIG-3** — investigado: falso positivo (sem duplicação morta), fechado sem mudança.

**🔒 Owner-only (não executável por mim — acesso a conta/console/decisão):**
- **SEC-1 núcleo** — repo privado, reset de senhas, rotação Stripe, reescrita de histórico, ANPD.
- **DR-2 restante** — credencial S3 read-only, versioning/lifecycle do bucket, 1º drill de restore.
- **PRD-3 restante** — decisão de tom das outras afirmações de marketing.

**⏸️ Bloqueado por runtime/chaves que não tenho aqui:**
- **IA-1 restante** — validação com Gemini/Maps real (usei mocks a pedido) + ligar `metroDistance` no objeto que o classifier lê.
- **IA-2** — **~80% já feito (verificado 06/07, backend rodando):** `recordAppliedPrice` **já é chamado** em `sugestion.service.ts:454` (com validação); `POST /admin/occupancy/manual` já existe para popular `OccupancyHistory`; `calculateBacktest`/MAPE já roda sob demanda no admin (`admin.service:1552`). O deep-dive disse "nunca chamado" — estava desatualizado. **Falta só** o cron agendado de feedback (recalcular MAPE periodicamente + alerta se > gate) — não adicionado porque sem dados reais de outcome eu não consigo validar que produz resultado correto (mesma limitação do cron de feature-engineering).
- **PRD-2** — **VERIFICADO: já responsivo (06/07).** A página `/properties` já usa cards (não `<table>`), com breakpoints `@media (max-width: 980px)` e `720px` que empilham tudo em 1 coluna no mobile, e os inputs de preço **já têm `label`** ("Diária referência" etc.). O audit dizia "table com scroll horizontal + inputs só com placeholder" — desatualizado. Falta só QA visual fino (deferido).
- **PRD-1** — onboarding: fluxo individual já persiste `hostId` (verificado antes). A unificação num input único é redesign de UX (subjetivo) — feito melhor com QA visual junto. Deferido.
- **DS-2 (layout)** — ✅ **primitivos criados** (`AppStack`/`AppHStack`/`AppVStack`/`AppGrid` em `componentes/ui/AppLayout.tsx`, tsc verde). Migrar telas para usá-los e o gate de responsividade no CI ficam como follow-up incremental.
- ~~**SEC-3**~~ — **VERIFICADO RESOLVIDO (06/07):** auth já é 100% cookie httpOnly (`withCredentials`), `logout()` já chama `POST /auth/logout`, e **não existe `setItem`/`getItem` de `accessToken`** no front — os `removeItem` remanescentes são só limpeza de legado (benéficos). O risco de XSS da auditoria estava desatualizado. Fechado sem mudança.
- ~~**SEC-2**~~ — **VERIFICADO: código já pronto (06/07).** `UrbanBackendClient._ingest_headers()` já usa a API key (`x-urban-events-ingest-key`) quando `URBAN_EVENTS_INGEST_API_KEY` está setado; o login email/senha é só fallback quando a key não existe. **Resolução = setar a env var nos coletores** (ação de ops) + opcionalmente remover o fallback legado depois (não removido às cegas: quebraria ingestão se a key não estiver configurada). Sem mudança de código necessária.
- **HIG-4** — renomear pastas `-main` (quebra CI/Railway paths; precisa de deploy coordenado).
- **DS-1 restante / DS-2** — refactor do `window.prompt` para drawer + gate de responsividade (precisam de verificação visual).

## Ordem de execução (ondas)

| Onda | Foco | Tickets | Pode paralelizar? |
|---|---|---|---|
| **0 — Contenção** | Incidente de dados + risco de perda de banco | SEC-1, DR-1, DR-2 | SEC-1 sozinho primeiro; DR em paralelo |
| **1 — Fundações** | Destravar IA + confiabilidade | IA-1, IA-2, OBS-1 | Sim (devs diferentes) |
| **2 — Produto** | Aquisição + conversão + honestidade | PRD-1, PRD-2, CItes abaixo | Sim |
| **3 — Hardening** | Performance, observabilidade, LGPD | PERF-1..3, OBS-2, LGPD-1..3 | Sim |
| **4 — Higiene/DS** | Repo limpo + design system | HIG-1..4, DS-1..2 | Sim |

Regra de bloqueio: **nada de campanha paga ou beta cobrado antes de SEC-1, DR-1 e PRD-3 fechados.**

---

# ONDA 0 — CONTENÇÃO (fazer primeiro, esta semana)

## SEC-1 · Conter vazamento do dump de produção no git · **P0 · M · dev sênior + owner**

**Contexto.** `docs/dump-ai_urban-202603131344.sql`, `docs/inserts-only.sql`, `docs/inserts-only-cols.sql` (~12MB cada), `docs/Emails Urban AI.pdf` e `docs/emails_pdf_content.txt` estão no histórico do git desde o commit `476958f` (02/04/2026). Contêm ~80 usuários com e-mail + hash de senha (68 em SHA-256 sem salt), ~19 endereços com lat/lng, ~54 pagamentos com IDs Stripe. Remote: `github.com/Gustavogm9/urban.ai`.

**Este ticket exige o owner (Gustavo) para as ações de conta/ANPD.** Passos:

1. **Visibilidade (owner, agora):** confirmar se o repo é público em GitHub → Settings → Danger Zone. Se público, **tornar privado imediatamente**.
2. **Rotação de credenciais (dev + owner):**
   - Forçar reset de senha de todos os usuários: invalidar todos os `refresh_token` (truncar tabela ou marcar revoked) e disparar fluxo de reset. As 68 senhas SHA-256 são consideradas vazadas.
   - Confirmar rotação da chave `sk_live_` da Stripe citada em `docs/archive/reports/relatorio-testes-2026-03-18.md` (gerar nova no dashboard Stripe, atualizar `STRIPE_SECRET_KEY` no Railway, revogar a antiga).
3. **Reescrever histórico (dev sênior):**
   - Instalar `git-filter-repo`. Rodar (repo espelhado, backup antes):
     `git filter-repo --path docs/dump-ai_urban-202603131344.sql --path docs/inserts-only.sql --path docs/inserts-only-cols.sql --path "docs/Emails Urban AI.pdf" --path docs/emails_pdf_content.txt --invert-paths`
   - `git push --force origin --all && git push --force --tags`. **Avisar todos os colaboradores para re-clonar** (SHAs mudam). Atenção às 5 branches `codex/*`.
   - Abrir ticket no GitHub Support pedindo expurgo de cache/forks.
4. **Prevenir reincidência:** adicionar ao `.gitignore` da raiz: `docs/*.sql`, `*dump*.sql`, `docs/Emails*.pdf`, `docs/emails_pdf_content.txt`.
5. **Compliance (owner):** registrar RIPD e avaliar comunicação à ANPD conforme `docs/lgpd/politica-privacidade-interna.md`.

**Aceite:**
- [ ] Repo privado (ou confirmado que sempre foi privado).
- [ ] `git log --all -- docs/dump-ai_urban-202603131344.sql` não retorna nada após a reescrita.
- [ ] Senhas resetadas / sessões invalidadas; chave Stripe rotacionada.
- [ ] `.gitignore` atualizado; `git status` limpo.
- [ ] Incidente documentado em `docs/postmortems/incident-git-leak-2026-07.md`.

---

## DR-1 · Tornar o banco reconstruível do zero ("CatchupCoreEntities") · **P1 · M · dev back**

**Contexto.** A migration `src/migrations/1745500000000-Baseline.ts` é um no-op (o schema de prod veio de `synchronize:true`). 11 tabelas core **não têm `CREATE TABLE` em migration nenhuma**: `user`, `addresses`, `list`, `events`, `plans`, `payment`, `process_status`, `analise_preco`, `analise_endereco_evento`, `email_confirmations`, `notifications`. Num MySQL vazio, `migration:run` não falha (as migrations são defensivas), mas produz schema quebrado — falha silenciosa. Isso é o que impede um restore/DR real.

**Passos:**
1. Subir um MySQL **vazio** local (docker: `docker run --name urban-fresh -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=urban -p 3307:3306 -d mysql:8`).
2. Apontar `DATABASE_URL` para ele e rodar `npm run migration:run`. Depois `npm run migration:generate -- src/migrations/CatchupCoreEntities` (nome à escolha). **O diff gerado é exatamente a lista de CREATEs/colunas faltantes.**
3. Revisar a migration gerada: garantir que ela seja **idempotente** (envolver cada `createTable` em `if (!(await queryRunner.hasTable('x')))`, seguindo o padrão das migrations existentes em `src/migrations/`), para não quebrar em prod (que já tem as tabelas).
4. Ordenar o timestamp para rodar **logo após o Baseline** (ex.: `1745510000000`) e antes das que fazem ALTER nessas tabelas — testar a ordem num banco vazio.
5. Repetir passo 1-2 num segundo banco vazio: `migration:run` deve agora criar tudo, e um novo `migration:generate` deve sair **vazio** (prova de reconstrutibilidade).
6. Rodar `npm run audit:migrations:strict` e confirmar que continua verde (mas agora de verdade).

**Aceite:**
- [ ] `migration:run` em MySQL vazio → `migration:generate` subsequente sai vazio.
- [ ] `restore-drill-verify.js` (18 tabelas) passa contra o banco reconstruído.
- [ ] Migration é idempotente (rodar 2x não quebra).
- [ ] Nenhuma alteração de dados em prod (só adiciona CREATEs guardados por `hasTable`).

---

## DR-2 · Integridade de backup + credencial de leitura para restore · **P1 · M · dev back/devops**

**Contexto.** `.github/workflows/backup-db.yml` faz dump diário mas **não valida integridade** (dump truncado subiria "verde"). A credencial do bot tem só `s3:PutObject` — ninguém consegue **baixar** o dump para restaurar. Bucket auto-criado sem versioning/lifecycle. Drill de restore nunca executado.

**Passos:**
1. **Integridade no workflow:** após o `mysqldump | gzip`, antes do upload, adicionar steps que falham o job se: (a) tamanho do `.gz` < um mínimo (ex.: 1MB, ajustar à realidade), (b) `gunzip -t` falha, (c) contagem de `CREATE TABLE` no dump < 40. Registrar `sha256` do artefato no log.
2. **Credencial de leitura:** criar uma IAM policy read-only (`s3:GetObject`, `s3:ListBucket` em `mysql/*`) e guardar as chaves **fora do GitHub Secrets** (cofre dos sócios). Documentar onde estão.
3. **Bucket:** habilitar versioning + lifecycle (IA 30d → Glacier 90d → expira 365d) no bucket de backup.
4. **Runbook:** criar `docs/runbooks/disaster-recovery.md` (hoje é TODO) com o passo-a-passo de restore em produção. Unificar o nome do bucket entre `backup-offsite.md` e `backup-restore.md`.
5. **Primeiro drill (agenda com o owner):** desbloquear `RESTORE_DATABASE_URL` em staging, baixar o último dump, restaurar cronometrando, rodar `node scripts/restore-drill-verify.js --output docs/evidence/restore-drill-2026-Q3.md` (sem `--dry-run`), preencher os checkboxes de `docs/runbooks/backup-restore.md §5`.

**Aceite:**
- [ ] Workflow de backup falha propositalmente se o dump for corrompido/pequeno (testar com um dump falso).
- [ ] Existe credencial read-only documentada e testada (baixou um dump com ela).
- [ ] Bucket com versioning + lifecycle.
- [ ] `docs/evidence/restore-drill-2026-Q3.md` gerado a partir de um drill real (Pass > 0).

---

# ONDA 1 — FUNDAÇÕES (destravar IA e confiabilidade)

## IA-1 · Completar feature engineering (tirar a IA do Tier 0) · **P1 · M · dev back**

**Contexto.** `src/knn-engine/feature-engineering.service.ts` tem 3 métodos stub que retornam 0: `geocodePending` (linha 43), `computeMetroDistancePending` (linha 69), `estimateAmenitiesPending` (linha 87), orquestrados por `runFullPipeline` (linha 94). Sem eles, `trainingReady=false` em quase tudo e o auto-tier fica preso no Tier 0. Os clients já estão instalados (`@googlemaps/google-maps-services-js`, `@google/generative-ai`).

> **⚠️ Correções de premissa (levantadas na exploração de 02/07 — leia antes de codar):**
> - **Geocoding já existe e funciona** em `maps.service.ts` → `updateAllAddressLatLng()` (linha 193) usa o mesmo client Google e persiste lat/lng em `addresses`. **Não reimplementar no FeatureEngineeringService** — fazer `geocodePending` **delegar** para o `MapsService` (injetar; atenção a possível dependência circular knn-engine↔maps — se houver, extrair o geocoding para um provider compartilhado). O stub é redundante, não um gap real.
> - **`list.amenitiesCount` JÁ EXISTE** como coluna (`list.entity.ts:123-124`, `@Column({ type: 'int', nullable: true })`). **Não criar** essa coluna. Falta só **popular** via `estimateAmenitiesPending` (Gemini).
> - **`list.category` NÃO existe** e **`address.metro_distance_km`/`metroDistance` NÃO existe** — só essas duas colunas precisam de migration.
> - Naming no banco é camelCase para colunas normais (`latitude`, `venueType`) e snake_case só em FKs/datas (`list_id`, `created_at`) e em casos explícitos (`AnaliseEnderecoEvento.distancia_metros`). **Rodar `migration:generate` num MySQL vazio para pegar o DDL exato** — não hand-escrever (foi por isso que este ticket não foi implementado às cegas na sessão de auditoria).
> - Confirmar qual nome o KNN classifier lê (`metroDistance` vs `metro_distance_km`) em `knn-classifier.ts` e alinhar a coluna a ele.

**Passos:**
1. **`geocodePending`:** buscar `Address` com `latitude`/`longitude` nulos; chamar Google Geocoding pelo endereço completo; validar que o resultado cai na bbox de SP (lat ~ -23.3..-24.0, lng ~ -46.3..-47.0 — ajustar); persistir `latitude`/`longitude`. Processar em lotes (`limit`), respeitar rate limit.
2. **Migration de colunas** (fazer antes do passo 3): criar migration idempotente adicionando `addresses.metro_distance_km` (decimal), `list.amenities_count` (int), `list.category` (varchar) — seguir `docs/runbooks/migrations-cutover.md`.
3. **`computeMetroDistancePending`:** carregar as ~76 estações do metrô/CPTM de SP (CSV estático no repo, sem API); para cada `Address` com lat/lng, calcular a estação mais próxima por Haversine; persistir `metro_distance_km`.
4. **`estimateAmenitiesPending`:** para cada `List` com título, chamar Gemini com prompt fechado ("conte comodidades implícitas neste título, responda só um número 0-30"); persistir `amenities_count`. Lote de 50/dia, com try/catch por item.
5. **Heurística de `category`:** Premium se `basePrice>350 && amenities>=6`; Econ se `basePrice<150 || amenities<=2`; senão Standard.
6. **Cron:** agendar `runFullPipeline` diário às 04:00 BRT (após o snapshot das 03:30). Registrar via `AdminJobRun`.
7. **Backfill:** rodar uma vez manualmente (endpoint admin ou script) para preencher os imóveis existentes.

**Aceite:**
- [ ] Após rodar o pipeline, `SELECT count(*) FROM addresses WHERE latitude IS NOT NULL` sobe; idem `amenities_count`/`metro_distance_km`.
- [ ] `datasetDiagnostics()` deixa de reportar `readiness: 'empty'`.
- [ ] Uma análise de preço num imóvel com features retorna categoria **diferente** do fallback "Standard".
- [ ] Testes unitários para Haversine e para a heurística de category.

---

## IA-2 · Ativar ground truth (preço aplicado + ocupação) · **P1 · G · dev back**

**Contexto.** `recordAppliedPrice()` (em `src/knn-engine/dataset-collector.service.ts`) **nunca é chamado** e a entity `OccupancyHistory` **nunca é populada**. Sem isso não há MAPE nem prova de "+30% de receita" — o `PricingOutcomeLearningService` está pronto mas ocioso. Como a parceria Stays não fechou, este ticket entrega o **plano B manual** primeiro.

**Passos:**
1. **Preço aplicado:** no fluxo em que o anfitrião aceita/aplica uma sugestão (`sugestao.controller.ts` `PATCH :id/aplicado`), chamar `recordAppliedPrice()` gravando `appliedPriceCents` no `PriceSnapshot` correspondente.
2. **Ocupação — import manual (bootstrap):** criar endpoint admin `POST /admin/occupancy/import` (CSV: `listingId,date,status,revenueCents`) que popula `OccupancyHistory`. Isso permite carregar histórico dos alpha testers sem Stays. Reusar o parser CSV já existente em `events-csv-import`.
3. **Ativar o feedback retroativo:** cron semanal que compara previsão (`AnalisePreco`) com resultado real (ocupação/receita) e alimenta `PricingOutcomeLearningService`. Registrar MAPE via `backtesting.ts`.
4. **Expor no admin:** um card em `/admin/quality` mostrando `trainingReady` de `PriceSnapshot` e `OccupancyHistory`, e o MAPE atual.
5. **(Quando Stays fechar):** implementar `StaysConnector.listReservations` para popular `OccupancyHistory` automaticamente — deixar `TODO` marcado.

**Aceite:**
- [ ] Aceitar/aplicar uma sugestão grava `appliedPriceCents`.
- [ ] Import CSV popula `OccupancyHistory` (testar com arquivo de exemplo).
- [ ] Cron de feedback roda e grava um MAPE (mesmo que com amostra pequena).
- [ ] `/admin/quality` mostra os contadores de dataset e o MAPE.

---

## OBS-1 · Alertas críticos (os 5 primeiros) · **P1 · M · dev back**

**Contexto.** Só 2 de 12 pontos de falha silenciosa têm alerta. Detalhes e snippets em `docs/archive/audits/auditorias-consolidadas-2026-07-02.md` (Auditoria 6).

**Passos (implementar os 5 mais críticos):**
1. **Redis no `/health`:** adicionar um ping ao Upstash com timeout 1s em `src/health/health.service.ts`; retornar `degraded` se indisponível.
2. **Webhook Stripe:** em `payments.controller.ts`, envolver o handler em try/catch com `Sentry.captureException` (tags `component: stripe-webhook`); criar Sentry alert rule para qualquer erro desse componente.
3. **Dead-man's switch de crons:** expor em `/health` o `lastRunAt` dos crons críticos (via `AdminJobRun`); marcar `stale` se > 48h. Garantir que todo cron grave `AdminJobRun` mesmo em falha.
4. **Staleness de coletores:** cron 6h que verifica último evento por `source`; se > 6h sem novidade, `Sentry.captureMessage`.
5. **Backup obrigatório:** tornar a notificação de falha do `.github/workflows/backup-db.yml` obrigatória (não opcional) — falhar visível se o webhook não estiver configurado.
6. **Corrigir destinatário:** o alerta da hash Airbnb expirada ainda aponta hardcoded para a Lumina (agência anterior) — trocar para o e-mail/lista atual (env var).

**Aceite:**
- [ ] `/health` retorna status de Redis e dos crons críticos.
- [ ] Simular erro no webhook Stripe gera evento no Sentry.
- [ ] Alerta da hash Airbnb vai para o destinatário atual (via env), não Lumina.
- [ ] 5 Sentry alert rules criadas (documentar no runbook de observabilidade).

---

# ONDA 2 — PRODUTO (aquisição, conversão, honestidade)

## PRD-1 · Import de imóveis com um único link + verificar captura de hostId · **P1 · M · dev full-stack**

**Contexto.** O host não acha o próprio ID no Airbnb (fricção de onboarding). O backend já resolve quase tudo: `GET /connect/resolve` (short links), `GET /propriedades/hostId` e `quick-info` (extraem hostId de qualquer link de anúncio), `scrapeHostListings`. Objetivo: um único campo "cole o link do seu anúncio".

**⚠️ Verificar antes de assumir bug:** a auditoria disse que `fetchIndividualProperties` descarta o `hostId`, mas na leitura de `Urban-front-main/src/app/onboarding/page.tsx` o fluxo individual (a partir da linha 1034) **chama** `setHostUserId(userId)` na linha ~1179. **Passo 0: confirmar** se o `airbnbHostId` realmente chega ao perfil no fluxo individual (testar um onboarding real e checar `user.airbnbHostId` no banco). Só implementar o "fix" se o dado não estiver sendo persistido.

**Passos:**
1. Passo 0 acima (verificação).
2. Unificar as duas abas ("Imóvel individual" e "Importar tudo") num **input único** "Cole o link do seu anúncio ou perfil". Detecção automática: se for link de anúncio → resolver hostId → perguntar "Encontramos N imóveis do mesmo anfitrião. Importar todos?".
3. Substituir o placeholder assustador `users/show/123456789` por um mini-guia: "Abra seu anúncio no app do Airbnb → Compartilhar → Copiar link → cole aqui".
4. Garantir que o custom link `airbnb.com/{slug}` seja aceito (o `/connect/resolve` já segue redirect; só validar a regex do resultado).
5. Se o passo 0 confirmar o bug: persistir `info.hostId` no perfil também no fluxo individual.

**Aceite:**
- [ ] Colar link de um anúncio importa o imóvel E oferece importar os demais do mesmo host.
- [ ] Após onboarding individual, `user.airbnbHostId` está preenchido (verificado no banco).
- [ ] Placeholder/guia novo no lugar do `users/show/...`.
- [ ] Teste e2e do fluxo host (hoje inexistente) adicionado em `e2e/`.

---

## PRD-2 · Mobile: propriedades em cards + onboarding em 390px · **P1 · M · dev front**

**Contexto.** O shell mobile já foi corrigido (bottom nav + drawer). Faltam dois pontos: a tabela de `properties/page.tsx` exige ~600px (scroll horizontal em 390px) e o wizard de onboarding nunca foi testado em viewport mobile.

**Passos:**
1. **Propriedades:** em `src/app/properties/page.tsx`, renderizar **card view** abaixo de 768px (um card por imóvel: foto, nome, diária, receita, ações empilhadas) e manter a tabela acima. Adicionar `<label>` aos inputs de preço (hoje só placeholder).
2. **Onboarding:** testar `src/app/onboarding/page.tsx` em 390×844; corrigir inputs largos (o campo de link + botão devem empilhar), o form de preço manual (grid de 1 coluna em mobile) e a rolagem entre passos.
3. **Touch targets:** botão "Aceitar" da recomendação → mínimo 44px de altura.
4. Adicionar viewport 390px ao gate visual (ver DS-2).

**Aceite:**
- [ ] `/properties` usável em 390px sem scroll horizontal (card view).
- [ ] Onboarding completável em 390px sem estouro de layout.
- [ ] Inputs de preço com label; botão Aceitar ≥ 44px.
- [ ] Screenshots antes/depois no PR.

---

## PRD-3 · Alinhar copy pública ao que o produto entrega (anti-enganosa) · **P1 · P · dev front + owner**

**Contexto.** Risco CDC art. 37. Achados VERMELHOS: `/precos` promete "Pix e boleto" mas o checkout (`payments.service.ts:317`) usa `payment_method_types: ['card']` — só cartão. Também: "5K+ eventos atualizados todo dia", "Integração Stays (push automático)" (Stays não ativo em prod), "modelo aprende a cada análise" (Tier 0), "20-40% da receita perdida".

**Passos (escolher por claim: corrigir a realidade OU suavizar o texto — decisão do owner):**
1. **Pix/boleto:** ou (a) habilitar `payment_method_types: ['card', 'boleto']` no Stripe checkout e testar, ou (b) trocar a copy de `/precos` para "Cartão via Stripe. Pix e boleto no roadmap." — **não deixar as duas divergentes.**
2. **"5K+ eventos atualizados todo dia":** confirmar o número real no `/admin/events` e ajustar; se a atualização não é diária hoje, remover "todo dia".
3. **"Integração Stays automático":** marcar como "em beta privado, sob convite" enquanto `STAYS_API_BASE_URL` não estiver em prod.
4. **"modelo aprende a cada análise" / "20-40%":** suavizar para linguagem de estimativa/aspiração com disclaimer (sugestões de reescrita honesta em `docs/archive/audits/auditorias-consolidadas-2026-07-02.md`, Auditoria 5).
5. Manter os disclaimers bons que já existem (FAQ de `/lancamento`, status "em validação" no SEO).

**Aceite:**
- [ ] Nenhuma afirmação VERMELHA na copy pública sem correspondência no produto.
- [ ] Checkout e página de preços concordam sobre métodos de pagamento.
- [ ] Owner revisou e aprovou os textos finais.

---

# ONDA 3 — HARDENING

## PERF-1 · Paralelizar import de host e cron de análises · **P1 · M · dev back**

**Contexto.** `connect.service.ts:134` faz scraping **serial** de N imóveis (50 imóveis = 100-250s → timeout em prod). `cron.service.ts:204` processa em série com `sleep(2000)` fixo (1000 análises = 33+ min).

**Passos:**
1. No import de host, trocar o `for...await` por processamento concorrente com limite (ex.: `p-limit` com concorrência 5). Não disparar 50 browsers de uma vez.
2. No cron, mover para processamento com worker pool / concorrência configurável por env; remover o sleep fixo (ou torná-lo jitter pequeno só para respeitar rate limit da fonte).

**Aceite:**
- [ ] Import de host com 20+ imóveis conclui sem timeout (medir antes/depois).
- [ ] Cron de análises processa em tempo proporcional à concorrência, não à soma dos sleeps.

---

## PERF-2 · Browser pool do Playwright + cache de geocoding · **P1 · M · dev back**

**Contexto.** `airbnb-browser-scraper.service.ts` lança **um browser por request** (~80MB; Railway 512MB → só 5-6 concorrentes). Geocoding é refeito por imóvel sem cache.

**Passos:**
1. Implementar um pool de browsers Playwright (máx 3, reutilizados) em vez de 1 launch/request.
2. Cache de geocoding: LRU/Redis com TTL 24h por endereço normalizado (evita ~90% das chamadas repetidas ao Google Maps).

**Aceite:**
- [ ] Sob carga leve, o processo não estoura a RAM da Railway (medir).
- [ ] Geocoding repetido do mesmo endereço não gera nova chamada ao Maps (log/contador).

---

## PERF-3 · Índices compostos + paginação · **P1 · P · dev back**

**Contexto.** `events.entity.ts` sem índices para as queries mais frequentes; `connect.service.ts:465` faz `find()` sem paginação e `:651` carrega `relations` desnecessárias.

**Passos:**
1. Migration adicionando índices: `(dataInicio, outOfScope)`, `(latitude, longitude, dataInicio)`, `(cidade, estado, outOfScope)` em `events`.
2. Adicionar `take/skip` no `find()` de listagens por usuário; remover `relations: ['list','user']` onde não são usadas.

**Aceite:**
- [ ] `EXPLAIN` das queries de radar usa os novos índices.
- [ ] Endpoint de listagem por usuário pagina (não carrega tudo).

---

## OBS-2 · Logging estruturado + correlationId · **P2 · M · dev back**

**Passos:** middleware NestJS que injeta `request-id`; propagar como tag no Sentry (`userId`, `analiseId`, `propertyId`); padronizar mensagens `[COMPONENT] [LEVEL] [CONTEXT]`. Substituir os ~50 `console.*` remanescentes pelo `Logger` do NestJS.

**Aceite:** dá para rastrear uma análise de preço ponta a ponta por um único id; nenhum `console.log` em serviço de produção.

---

## LGPD-1 · Self-service de exclusão de conta + cascade de pagamentos · **P2 · M · dev back**

**Contexto.** `DELETE /auth/:id` é admin-only (titular não apaga a própria conta). `payment.user_id` não tem `ON DELETE CASCADE` (exclusão pode falhar/deixar órfão com customerId Stripe); `addresses`/`price_snapshot` usam `SET NULL` (endereço+geo sobrevivem).

**Passos:** criar endpoint self-service (`DELETE /auth/me` autenticado pelo próprio titular); migration ajustando o FK `payment.user_id` para `CASCADE` (ou anonimização explícita do registro fiscal); revisar os `SET NULL` para não deixar endereço+geolocalização órfãos.

**Aceite:** titular consegue apagar a própria conta; exclusão não deixa `payment`/`addresses` órfãos com PII.

---

## LGPD-2 · Consentimento server-side + jobs de retenção · **P2 · M · dev back**

**Passos:** entity de consent no backend (timestamp + versão) gravada quando o usuário decide no banner (hoje só em localStorage, sem valor probatório); crons de expurgo/anonimização para `notifications`, `PriceSnapshot`, snapshots do dataset e `email_confirmations` expirados, conforme a retenção prometida em `docs/lgpd/politica-privacidade-interna.md`.

**Aceite:** consentimento persistido no servidor; ao menos um job de retenção rodando e comprovável.

---

## SEC-2 · Coletor Python → service account/API key · **P2 · M · dev back**

**Contexto.** `POST /events/ingest` já tem `EventsIngestApiKeyGuard`, mas a coleta Python legada (`urban-webscraping-main`) ainda autentica com username/password de um usuário técnico + token no body. Fecha o CRIT-001 da auditoria de segurança.

**Passos:** criar service account dedicado com escopo só de ingest; migrar os coletores para usar `EVENTS_INGEST_API_KEY` no header `x-urban-events-ingest-key`; remover o login por username/password e o `accessToken` do body; rotacionar a credencial antiga.

**Aceite:** coletores ingerem eventos usando só a API key; o usuário técnico "collector" com senha pode ser desativado.

---

## SEC-3 · Fase 2 do auth no front (tirar accessToken do localStorage) · **P2 · M · dev front**

**Passos:** remover toda referência a `accessToken` em `localStorage` (`api.ts`, `AuthContext`); logout deve chamar `POST /auth/logout` antes de redirecionar; sessão validada por `GET /auth/me` (cookie httpOnly), não por localStorage; decidir manter ou remover o NextAuth (dois sistemas de auth hoje). Testar múltiplas abas/refresh/logout.

**Aceite:** nenhum token em localStorage; logout revoga refresh token; sessão sobrevive a refresh só por cookie.

---

# ONDA 4 — HIGIENE E DESIGN SYSTEM

## HIG-1 · Remover lixo do git e dados pesados · **P2 · P · dev back**
Remover do versionamento (após SEC-1): dumps `.sql`, PDFs de relatório soltos (~16MB), pastas `docs/e2e-reports/*` e `docs/controlled-flows/*` com timestamps (mover para CI artifact / ignorar). Escolher **um** lockfile no front (`package-lock.json` **ou** `yarn.lock`) e remover o outro. Otimizar/mover imagens de 1-2MB em `Urban-front-main/public/`. **Aceite:** `git` sem dumps/artefatos de teste; um único lockfile; imagens otimizadas.

## HIG-2 · Remover backups e rotas órfãs do front · **P2 · P · dev front**
Remover `src/app/maps-bkp/`; decidir entre `/painel` e `/dashboard` (consolidar numa, redirecionar a outra); avaliar `/notificacao` órfã. **Aceite:** sem `-bkp`; sem duas rotas fazendo a mesma coisa.

## HIG-3 · Auditar módulos duplicados no backend · **✅ INVESTIGADO — falso positivo**
**Verificado em 06/07 (com o backend rodando): não há duplicação morta.** Os três pares são serviços **complementares** com nomes parecidos, todos ativos e interdependentes:
- `mailer/` (`MailerService`) = camada de transporte (envio); `email/` (`EmailService`) = camada de domínio/templates construída **sobre** o MailerService. Ambos usados por cron/payments/admin/connect/maps/propriedades.
- `process/` (`ProcessService`) = tracking de status de processo; `processos/` = módulo da **fila BullMQ** (`@Controller('processos')` + `registerQueue('processos')` + `@Processor('processos')`). Coisas diferentes.
- `notifications/` = notificações in-app ao usuário; `communications/` = log de auditoria de eventos de comunicação.

**Ação:** NÃO remover/consolidar (quebraria o sistema). Único resíduo real é clareza de nomes (`process`/`processos`), um nit de nomenclatura — não vale o risco de renomear módulos amplamente usados. Ticket fechado sem mudança de código.

## HIG-4 · Padronizar estrutura dos serviços · **P3 · M · dev**
Remover sufixo `-main` das 5 pastas de serviço (atualizar scripts/docs/CI que referenciam); mover scripts experimentais do pipeline (`test_*.py`, `debug_*.py`) para `tests/`/`scripts/`; consolidar as 3 pastas de agente (`.agent/`, `.agents/`, `.claude/`) mantendo só `.claude/`; documentar no README que `dashboard/`, `_opensquad/`, `_build/` são ferramenta interna. **Aceite:** estrutura consistente; CI verde após renomeações.

## DS-1 · Limpar resíduos do design system + audit no CI · **P2 · M · dev front**
Remover ~20 classes Tailwind hardcoded (`text-slate-*` etc.), trocar `alert()/confirm()` nativos do admin por `AdminConfirmDialog`, trocar emojis de status por `AdminStatusDot`. Estender `scripts/design-system-audit.mjs` para flagrar `alert(`, emoji e hex inline, e **adicionar como gate no CI** (`.github/workflows/ci.yml`). **Aceite:** `npm run design:audit` estendido passa e roda no CI bloqueando regressão.

## DS-2 · Gate de responsividade + componentes de layout · **P3 · M · dev front**
Adicionar teste visual/e2e nos breakpoints 390/768/1280 como gate; criar `AppStack`/`AppGrid`/`AppForm` para eliminar estilos inline de flex/gap. (Storybook + tokens.json ficam para backlog.) **Aceite:** CI reprova telas quebradas em mobile; componentes de layout disponíveis e usados nas telas novas.

---

## Resumo de sequenciamento para o líder

1. **Semana 1:** SEC-1 (owner+sênior) em paralelo com DR-1 e DR-2. Nada mais entra em prod antes de SEC-1.
2. **Semana 2-3:** IA-1 + IA-2 (um dev back dedicado), OBS-1, PRD-1 (full-stack), PRD-3 (rápido, destrava marketing honesto).
3. **Semana 3-4:** PRD-2 (front), PERF-1/2/3, SEC-2, SEC-3.
4. **Contínuo/paralelo:** LGPD-1/2, OBS-2, HIG-*, DS-*.

Dependências: IA-2 depende de IA-1 (features antes de treino); DR-2 (drill) depende de DR-1 (banco reconstruível) para o teste de reconstrução; PRD-3 pode sair sozinho e rápido.

---

*Gerado em 02/07/2026. Âncoras de código verificados: `payments.service.ts:317` (só cartão), `feature-engineering.service.ts:43/69/87` (stubs), `onboarding/page.tsx:1034/1179` (fluxo individual já chama setHostUserId — ver ⚠️ em PRD-1).*
