# Auditorias Consolidadas — 02/07/2026

> SUPERSEDED: conjunto histórico. Consulte `../../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`.

> Oito auditorias temáticas executadas em 02/07/2026, complementando a
> [avaliação completa do projeto](archive/audits/avaliacao-completa-projeto-2026-07-02.md).
>
> **Método:** análise estática de código + docs + git history + probes read-only em produção
> (endpoints públicos apenas; sem credenciais). Valores marcados *(estimativa)* não foram
> medidos contra faturas/produção — validar.
>
> **Dados de produção coletados (02/07, endpoints públicos):** backend Railway no ar e saudável
> (`/health` = ok, DB 131ms, uptime ~20d); `integrations.ready=false` só por `STAYS_API_BASE_URL`
> ausente (Google Maps, Gemini e chave de cripto Stays **setados** em prod); `version:"unknown"`
> no health (gap de build). **`app.myurbanai.com/health` retorna 404** — o health real vive no
> domínio Railway (`urbanai-production-85fd.up.railway.app`), então o monitor citado no README
> pode estar apontado errado.

---

## 🔴 P0 — INCIDENTE ATIVO: dump de produção no histórico do git

**A auditoria mais grave.** Três arquivos em `docs/` (`dump-ai_urban-202603131344.sql`, `inserts-only.sql`, `inserts-only-cols.sql`, ~12MB cada) são o **dump completo do banco de produção** (MySQL, gerado 13/03/2026), versionados no git **desde o commit `476958f` de 02/04/2026** (~3 meses), em repositório que aparenta ser público (`github.com/Gustavogm9/urban.ai`).

Conteúdo de PII real:
- **~80 usuários**: nome, e-mail (~58 distintos, provedores pessoais), hash de senha, empresa.
- **68 das 80 senhas em SHA-256 sem salt** (quebráveis por rainbow table/GPU) — 12 em bcrypt. É **vazamento de credenciais**, não só de PII.
- **~19 endereços residenciais completos** (logradouro, número, CEP, lat/lng precisas) por `user_id`.
- **~54 pagamentos** com `customerId`/`subscriptionId` Stripe reais; ~215 notificações; ~47 códigos de confirmação.
- Não foram encontrados CPFs. Também versionados: `docs/Emails Urban AI.pdf` e `docs/emails_pdf_content.txt` (threads com nomes/e-mails reais).

Nota: nenhum `.env` real foi commitado; nenhum secret ativo no working tree. Mas `docs/archive/reports/relatorio-testes-2026-03-18.md` menciona uso de uma chave `sk_live_` da Stripe — **confirmar rotação**.

**Plano de remediação (P0, imediato):**
1. Tratar como incidente de dados. Verificar se o repo é público; se sim, exposição desde 02/04.
2. **Forçar reset de senha dos ~80 usuários** e invalidar sessões/refresh-tokens — as 68 SHA-256 são comprometidas.
3. **Reescrever histórico** com git-filter-repo/BFG removendo os blobs + `push --force` coordenado (cuidado com as 5 branches `codex/*`; abrir ticket no GitHub para expurgar cache/forks). Alternativa mais fraca: tornar repo privado + `git rm` do HEAD + rotação de senhas (dados continuam recuperáveis no histórico). Adicionar `docs/*.sql`, `*dump*`, `Emails*.pdf` ao `.gitignore`.
4. Registrar RIPD/comunicação à ANPD conforme a própria política interna.

---

## Auditoria 1 — Segurança de endpoints

**Boa notícia: os 7 P0 de 13/05 estão FECHADOS.** Comparativo:

| Achado (13/05) | Status 02/07 |
|---|---|
| P0-001 a P0-007 (rotas sem auth, reset por userId, delete sem ownership, pricing job público) | ✅ **Todos fechados** — `JwtAuthGuard`+`RolesGuard`, ownership por `userId`, reset com token hasheado+TTL |
| P1-007 token Stays em claro | ✅ **AES-256-GCM** (`enc:v1:iv:tag:ct`), chave obrigatória em prod, fail-close |
| P1-018 webhook Stripe sem assinatura | ✅ `constructEvent()` + raw body |
| P1-005/006/020/021/022 leitura/dashboard/airbnb públicos | ✅ Fechados com auth + ownership |
| CSV import | ✅ limite 5MB, admin-only |
| Logs com PII | ✅ redaction estruturada |

**Pendências remanescentes (média/baixa):**
- **CRIT-001** Coletor Python ainda usa username/password + token no body (o `POST /events/ingest` já tem `EventsIngestApiKeyGuard`, mas a coleta legada não migrou) → criar service account, rotacionar.
- **CRIT-002/003** Fase 2 do auth no front: logout não chama `/auth/logout`; `accessToken` ainda referenciado em `localStorage` (removeItem) e no body de login.
- **M-008** Confirmar se a api-key pública do Airbnb GraphQL está hardcoded (mover para env se sim).
- Swagger: garantir `ENABLE_SWAGGER=false` em prod; definir SLA de rotação de secrets.

Validação reportada pelo agente: backend 144 testes ok, tsc/build ok; webscraping 83 testes ok.

---

## Auditoria 2 — LGPD e vazamentos (além do P0 acima)

**Código LGPD majoritariamente bom:**
- Consentimento de cookies: 3 categorias, analytics/marketing **opt-in** (default off), GA4/Pixel só injetados após consentimento, GA4 com `anonymize_ip`. ✅
- `/privacidade` e `/termos` existem e linkadas. ✅

**Lacunas:**
- **Consentimento só em localStorage** — sem persistência server-side; não serve como prova à ANPD. (roadmap já marcava pendente.)
- **Exclusão de conta só via admin** (`DELETE /auth/:id` é `@Roles('admin')`) — não há self-service do titular. Cascade cobre a maioria das entidades, mas `payment.user_id` **sem `ON DELETE CASCADE`** (exclusão pode falhar/deixar órfão com customerId Stripe) e `addresses`/`price_snapshot` usam `SET NULL` (endereço+geo sobrevivem à conta).
- **Nenhum job de expurgo/retenção** — `PriceSnapshot`, `notifications`, `audit-log`, snapshots do dataset crescem indefinidamente. A política interna promete retenção/anonimização que **não existe em código**.
- E-mails pessoais espalhados em vários `docs/*.md`; `base-socios.md` e outreach com dados societários no repo de código.

---

## Auditoria 3 — Disaster Recovery e migrations

**Achado central [P1]: o banco NÃO é reconstruível do zero, e a falha é silenciosa.** A migration `1745500000000-Baseline.ts` é um **no-op deliberado** (o schema de prod veio de `synchronize:true` histórico). **11 tabelas core não têm `CREATE` em migration nenhuma**: `user`, `addresses`, `list`, `events`, `plans`, `payment`, `process_status`, `analise_preco`, `analise_endereco_evento`, `email_confirmations`, `notifications`. Num MySQL vazio, `migration:run` **não falha** (migrations são defensivas com `hasTable`/`hasColumn`) — cria 32 tabelas, marca tudo como aplicado, e o app quebra na primeira query a `user`. O `audit:migrations:strict` passa (43/43), mas é **falso-positivo**: verifica menção ao nome da tabela + whitelist, não `CREATE TABLE`.

Outros achados:
- **[P1] Backup sem verificação de integridade** — só imprime tamanho; sem size-check mínimo, `gunzip -t`, checksum ou contagem de tabelas. Dump truncado subiria "verde". Bucket S3 auto-criado (commit 8174db7, 26/05) **sem versioning/lifecycle**; o commit sugere que o bucket não existia antes de 26/05 (backups anteriores podem nunca ter subido).
- **[P1] Drill de restore nunca executado** — única evidência é um dry-run de 22/05 (0 checks). RTO de 2h não é crível; estimativa real 4–8h+.
- **[P2] Credencial de backup é write-only** (`s3:PutObject`) — ninguém consegue *baixar* o dump para restaurar; acesso de leitura não documentado. `disaster-recovery.md` é TODO.
- **[P2] Drift prod×migrations** não reconciliado; o próprio runbook admite não saber se prod ainda está com `synchronize:true`.
- **[P3]** Timestamps de migrations backdatados (~1 ano); nomes de bucket divergem entre runbooks.

**Checklist do primeiro drill** (resumo): desbloquear `RESTORE_DATABASE_URL` em staging; criar credencial AWS read-only fora do GitHub; baixar último dump + `gunzip -t` + sha256; restaurar em staging vazio cronometrando; rodar `restore-drill-verify.js` sem `--dry-run`; **teste de reconstrução do zero** (`migration:run` em schema vazio + `migration:generate` — o diff é a lista de CREATEs faltantes → abrir tarefa "CatchupCoreEntities"); adicionar step de integridade ao workflow de backup.

---

## Auditoria 4 — Custos e unit economics *(valores em grande parte estimados — validar com faturas)*

Serviços pagos/limitados: RapidAPI (3+ hosts Airbnb), Gemini, Google Maps, Stripe (~4.99% efetivo), Sentry (~R$260/mês), Upstash, Railway, Brevo (free 3k/mês), + pendentes (SerpAPI/Firecrawl/Tavily/api-football). `seedDefaultCosts` tem 13 custos (~R$870/mês fixo), mas **RapidAPI não está cadastrado** e SerpAPI/Tavily/api-football tampouco.

- **Matriz F6.5 (seed):** Starter R$149→97/imóvel/mês (mensal→anual); Profissional R$99→67. Breakeven aproximado *(estimativa)*: ~15–20 assinantes Profissional cobrem o fixo.
- **Riscos de custo:** browser Playwright lançado por request (CPU Railway); observações Airbnb projetadas em 10 janelas/listing/dia; cron mensal de re-scrape em série; RapidAPI virando primário se headless falha.
- **Top otimizações:** pool de browser Playwright (−CPU, −latência 50%), cache de geocoding (dedup ~90%), batch maior no Gemini, resampling das observações Airbnb, desligar hosts RapidAPI redundantes.

*(Ressalva: custos unitários por chamada — ex. geocoding — parecem superestimados no relatório; tratar como ordem de grandeza até validar contra Google Cloud/Stripe/Railway.)*

---

## Auditoria 5 — Honestidade da copy (copy pública × Tier 0)

Risco moderado-alto de publicidade enganosa (CDC art. 37). Achados VERMELHOS:

| Local | Texto | Problema |
|---|---|---|
| `/precos` | "cartão, débito, **Pix e boleto**" | Checkout Stripe aceita só `['card']` — promessa não cumprida no checkout |
| `/landing` | "**5K+ eventos** mapeados, atualizados **todo dia**" | "todo dia" não se sustenta; volume real a confirmar em prod |
| `/precos`, `/landing` | "Integração Stays (push automático)" | `STAYS_API_BASE_URL` ausente em prod — feature não ativa |
| `seoPagesData.ts` | "modelo proprietário **aprende a cada análise**" | Sem dataset/ground truth em prod (Tier 0) |
| `/landing` | "**20–40%** da receita perdida" | Número sem auditoria |

**Bom:** FAQ de `/lancamento` e artigos SEO usam disclaimers honestos ("não prometemos aumento fixo", status "em validação"). Recomendação: alinhar checkout à copy (ou vice-versa) e suavizar as 5 afirmações VERMELHAS antes de qualquer campanha paga. *(Nota: o "2 eventos futuros" citado pelo agente vem da auditoria de 13/05, não de medição de prod atual — confirmar no `/admin/events`.)*

---

## Auditoria 6 — Observabilidade e alertas

**Só 2 de ~12 pontos de falha silenciosa têm alerta ativo.** Detecção hoje é majoritariamente passiva (badge STALE que alguém precisa abrir).

| Ponto de falha | Detecção hoje | Alerta recomendado |
|---|---|---|
| Webhook Stripe falha | log, sem alerta | 🔴 Sentry + retry queue/DLQ |
| Cron não dispara (container kill) | AdminJobRun só registra se dispara | 🔴 dead-man's switch em `/health` |
| Redis/BullMQ (Upstash) down | stderr; `/health` **não checa Redis** | 🔴 Redis ping no health |
| Coletores/spiders quebrados | badge STALE passivo | 🟠 cron "0 eventos novos em 6h" |
| Gemini/geocoding falhando em série | log; eventos em limbo | 🟠 alerta de bulk failure |
| Backup GitHub Actions falha | Slack **se** webhook configurado | 🟠 tornar notificação obrigatória |
| Hash Airbnb expirada | e-mail ao admin | ⚠️ **e-mail aponta hardcoded para a Lumina (agência anterior)** — corrigir destinatário |

`version:"unknown"` no `/health` e o monitor apontado para `app.myurbanai.com/health` (404) reforçam o gap. Top 5 para configurar já: webhook Stripe, Redis no health, dead-man's switch de cron, staleness de coletores, notificação obrigatória de backup.

---

## Auditoria 7 — Performance (estática)

| Sev | Local | Problema | Fix |
|---|---|---|---|
| P0 | `connect.service.ts:134` | Import de host: scraping **serial** de N imóveis (50 imóveis = 100–250s, timeout em prod) | `Promise.all` com concorrência limitada |
| P0 | `cron.service.ts:204` | Cron de análises em série + `sleep(2000)` fixo (1000 análises = 33+ min) | worker pool concorrente |
| P1 | `events.entity.ts` | Índices compostos faltando (`dataInicio+outOfScope`, `lat+lng+dataInicio`, `cidade+estado+outOfScope`) | migration de índices |
| P1 | `connect.service.ts:465,651` | `find()` sem paginação; `relations` carregadas sem uso | take/skip; remover relations |
| P1 | `airbnb-browser-scraper` | 1 browser Playwright por request (~80MB; Railway 512MB = 5-6 concorrentes) | browser pool (máx 3) |
| P1/P2 | front | Leaflet/react-player/framer-motion sem `dynamic()`; `api.ts` 4.924 linhas; imagens sem `next/image` | code splitting |

Top 5 quick wins (~3-4h → 5-10x no pico): paralelizar import de host, índices compostos, remover relations, dynamic import no front, browser pool. Load tests k6 cobrem só 3 endpoints básicos — faltam onboarding/pricing/radar.

---

## Priorização geral das 8 auditorias

**P0 (imediato):**
1. Incidente do dump no git — rotação de senhas + reescrita de histórico + repo privado + ANPD.
2. Confirmar rotação da chave `sk_live_` Stripe citada em relatório de teste.

**P1 (antes de qualquer beta pago):**
3. Reconstrutibilidade do banco (migration "CatchupCoreEntities" para as 11 tabelas) + primeiro drill de restore + integridade no backup + credencial de leitura do S3.
4. Alertas críticos: webhook Stripe, Redis no health, dead-man's switch de cron; corrigir destinatário do alerta da hash Airbnb (ainda Lumina).
5. Copy: alinhar Pix/boleto ao checkout e suavizar as afirmações VERMELHAS.
6. Coletor Python → service account/API key (fecha CRIT-001).

**P2:**
7. Performance: paralelizar import de host, índices, browser pool.
8. LGPD: self-service de exclusão, consentimento server-side, jobs de retenção, `ON DELETE CASCADE` em `payment`.
9. Custos: cadastrar RapidAPI no finance, otimizações de browser/geocoding, validar valores reais.
10. Fase 2 do auth no front.

---

*Gerado em 02/07/2026 · 8 auditorias (segurança, LGPD/git, DR/migrations, custos, copy, observabilidade, performance) + probes read-only em produção. Fontes: código dos 5 serviços, docs/, git history, `/health` de prod.*
