# Urban AI — Avaliação Minuciosa do Projeto
**Data:** 16/04/2026 · **Responsável:** Gustavo Macedo · **Escopo:** Auditoria técnica e operacional completa · **Objetivo:** Preparar assunção de dev + operação pela Urban AI

---

## 1. Sumário Executivo

O Urban AI está em um estado **funcionalmente operacional mas não pronto para produção com tráfego pago**. O sprint de migração (concluído em 20/03/2026) entregou a infraestrutura base em Railway, mas deixou débitos técnicos críticos de segurança, qualidade de código e processos operacionais que precisam ser saneados antes de abrir o produto para usuários reais pagantes.

Classifico a prontidão global em **65–70%** — o que parece razoável na superfície (stack moderna, 53 entregas no sprint, Sentry funcionando, webhook Stripe assinado) esconde riscos que, se não tratados, vão gerar incidentes caros logo nas primeiras semanas de tráfego pago: vazamento de credenciais, senhas fracas, perda de dados por `synchronize: true` do TypeORM, e ausência total de testes automatizados.

A boa notícia: os problemas são conhecidos, corrigíveis em 2–3 semanas de trabalho focado, e não afetam a arquitetura de alto nível (que é sólida — 5 serviços bem separados, filas Redis, Prefect orquestrando scrapers, KNN isolado). A má notícia: nenhum desses itens está no roadmap pós-sprint atual — ele foca em UX, marketing e produto, não em hardening operacional. **Recomendo inserir uma "Fase F5B — Hardening Operacional" antes de ativar campanhas pagas.**

---

## 2. Arquitetura Geral do Sistema

O produto é composto por **5 serviços independentes + 1 camada de automação interna (Opensquad)**, todos versionados no mesmo monorepo sob `/Urban AI/`:

**Backend (`urban-ai-backend-main/`)** — Monólito NestJS 10.4.22, TypeORM/MySQL, BullMQ/Redis, Stripe, Sentry, Passport-JWT. Expõe a API principal (`/auth`, `/payments`, `/propriedades`, `/evento`, `/dashboard`, `/plans`, `/notifications`, `/maps`, `/airbnb`, `/sugestao`, `/cron`, `/connect`, `/mailer`, `/email`, `/process`, `/processos`). Rodando em Railway em `app.myurbanai.com`.

**Frontend (`Urban-front-main/`)** — Next.js 15.4.10 (App Router, standalone output), Chakra UI + Tailwind coexistindo, NextAuth com Google OAuth + JWT próprio em localStorage, Stripe Elements, Leaflet, i18n, Sentry client. Contextos: `AuthContext`, `LanguageContext`, `PaymentCheckGuard`. Rotas-chave: `/` (home), `/onboarding` (wizard 5 passos), `/dashboard`, `/properties`, `/maps`, `/event-log`, `/my-plan`, `/plans`, `/(institucional)/*` (landing pages Sobre, Contato, Privacidade).

**Motor KNN (`urban-ai-knn-main/`)** — Microserviço Express 5 standalone com 2 endpoints (`POST /api/pricing/suggest`, `GET /api/status`), autenticação via `x-api-key`. Usa `ml-knn` para classificar imóveis em 3 categorias (Econômico/Standard/Premium) e `@turf/turf` + Mapbox APIs (Directions + Isochrones) para calcular atratividade geoespacial. **No código em `urban-ai-knn-main/server.js` o dataset é 3 imóveis hardcoded em memória.** Confirma-se no relatório de QA (Antigravity/Lumina) que o motor KNN foi "consolidado de forma nativa dentro do próprio monólito do Backend" — ou seja, o backend chama `UrbanAIPricingEngine` (package TS dentro de `src/knn-engine/`) em vez do microserviço. O repo `urban-ai-knn-main/` está efetivamente **inativo em produção** hoje, mantido como referência.

**Pipeline (`urban-pipeline-main/`)** — Prefect 3.x orquestrando 2 flows diários: `trigger_all_spiders` (03:00 UTC) e `raw_data_extraction_and_dump` (04:00 UTC). O segundo lê parquets de S3 (bucket `urbanai-data-lake`) e faz append em MySQL (uma tabela por pasta/spider). Secrets injetados via Prefect Blocks, AWS via assume-role. Playwright está presente para bypass anti-bot nos scrapers que o pipeline dispara.

**Scraping (`urban-webscraping-main/`)** — 8 spiders Scrapy+Scrapyd (eventim, sympla, ingresse, ticketmaster, blue_ticket, even_three, ticket_360 e variantes). `auth_proxy.py` é um reverse-proxy Python que exige `x-api-key` antes de encaminhar para Scrapyd na porta interna 6801. Pipeline de persistência dupla em S3 (JSON + Parquet). `ROBOTSTXT_OBEY=True` ativo, `CONCURRENT_REQUESTS=1`, delay randomizado.

**Opensquad (`_opensquad/`, `squads/`)** — Framework de agentes de IA que roda **apenas no ambiente de desenvolvimento do Gustavo** para automatizar marketing, análise, auditoria de QA e atualização de roadmap. Não é parte do produto entregue ao cliente — é uma ferramenta operacional interna.

**Fluxo ponta-a-ponta do produto:**
Scrapers → S3 (JSON + Parquet) → Pipeline Prefect → MySQL (tabela bronze por spider) → Backend NestJS consulta eventos próximos ao imóvel cadastrado → invoca `UrbanAIPricingEngine` (KNN nativo) → aplica multiplicadores (categoria +10–20%, atratividade +20–50%, travel time <15min +30%, relevância do evento até +50%) → salva `AnalisePreco` com `reasoning` → frontend exibe sugestão no dashboard → cron diário 08:00 BRT manda notificação por e-mail (Mailersend).

---

## 3. Avaliação por Módulo

### 3.1 Backend NestJS — o coração do sistema

**Estrutura de módulos** (21 módulos em `src/`):
- `auth` — JWT + Passport, endpoints `/auth/register`, `/auth/login`, `/auth/google`, `/auth/me`, `/auth/profile`
- `user` — CRUD de usuário, campos `pricingStrategy`, `operationMode`, `percentualInicial/Final`, `airbnbHostId`, `distanceKm`
- `propriedades` — **módulo gigante (~1.672 linhas)**, concentra CRUD de imóveis, análise de preço via KNN local, integração Airbnb GraphQL, `PricingCalculateService`
- `payments` — Stripe Checkout + webhook com validação de assinatura, 5 eventos tratados (`checkout.session.completed`, `payment_intent.succeeded`, `customer.subscription.updated/deleted`, `invoice.payment_failed`), trial de 10 dias
- `plans` — tiers de plano (starter/professional, mensal/anual), `stripePriceId` dinâmico
- `evento` — CRUD de eventos + `EventsEnrichmentService` para análise de proximidade
- `maps` — integração Google Maps (geocoding, isochrone, distance matrix), `@googlemaps/google-maps-services-js`
- `knn-engine` — `UrbanAIPricingEngine`, `PropertyClassifier`, `DisplacementCostMatrix` (código TypeScript, `ml-knn` npm)
- `cron` — 2 jobs: notificação diária 08:00 BRT, re-scraping mensal 1º dia 02:00 (`@nestjs/schedule`)
- `processos` — `BullModule` com fila `processos` (Redis/Upstash)
- `email` + `mailer` — dupla stack SendGrid + Mailersend (migração em curso), templates HTML
- `notifications` — notificações in-app + email
- `connect` — onboarding Airbnb, sincronização de listings
- `airbnb` — proxy para Airbnb (ex-RapidAPI, hoje GraphQL direto com fallback intl)
- `dashboard` — analytics (receita, propriedades, eventos)
- `sugestao`, `process`, `service` — utilitários e stubs

**Entidades (schema MySQL):** `user`, `address`, `list`, `event`, `payment`, `plan`, `analise_preco`, `analise_endereco_evento`, `notification`, `email_confirmation`, `process_status`. Relações: User 1:N Address, User 1:N Notification, User 1:N Payment, Address N:1 List, Event 1:N AnalisePreco.

**Swagger:** exposto em `/api` com bearer auth. Útil, mas não vi documentação escrita para quem vai consumir.

**Pontos fortes:**
- Separação de módulos clara (um por domínio), seguindo convenção NestJS
- Sentry integrado com exception filter global (`SentryGlobalFilter`)
- Webhook Stripe corretamente usando `bodyParser.raw()` antes da verificação de assinatura (main.ts:22)
- Cron jobs com timezone explícito (`America/Sao_Paulo`)
- BullMQ configurado com suporte a TLS/password do Redis (Upstash)
- Dockerfile multi-stage presente

**Pontos críticos (verificados no código):**

*CRÍTICO #1 — API key da RapidAPI hardcoded e commitada* (`src/airbnb/airbnb.service.ts:11`):
```
private readonly apiKey = 'e8b495920cmsh21fec04b593ce3ep17cb68jsnce9b835f0eef';
```
Esta chave está no git desde antes do último refactor (commit `f7b3a47`). Mesmo que o RapidAPI tenha sido substituído pelo GraphQL Airbnb (F6.2 concluída), a chave ainda existe no código e no histórico de commits — **precisa ser revogada imediatamente no dashboard da RapidAPI**, e o arquivo limpo + histórico higienizado se o repo for público.

*CRÍTICO #2 — Senha em texto-claro nos logs de produção* (`src/auth/auth.service.ts:51`):
```
const isHex = /^[a-f0-9]{64}$/i.test(data.password);
const pwdHash = isHex ? data.password : this.sha256(data.password);
console.log(data.password, pwdHash);
```
Todo registro de usuário escreve a senha em texto-puro no stdout. No Railway isso vai direto para os logs persistidos — qualquer pessoa com acesso ao painel vê as senhas. Fix em 2 linhas.

*CRÍTICO #3 — Hash de senha é SHA-256 com salt fraco ou sem salt*:
- `register()` usa `this.sha256(password)` — **sem salt, sem stretching**
- `hashFrontendPassword()` usa `process.env.FRONTEND_PASSWORD_SALT || 'default-static-salt'` — fallback para salt estático literalmente "default-static-salt"
- Há lógica de "legacy bcrypt" (`$2a$`/`$2b$`) para compat com usuários antigos, mas novos registros são SHA-256
- Rainbow tables para SHA-256 sem salt estão comercialmente disponíveis. Uma senha "minhasenha123" está quebrada em milissegundos.
- **Fix:** migrar para `bcrypt.hash(password, 12)` em todos os caminhos, e nas próximas 4 semanas invalidar senhas SHA-256 forçando reset ("sua senha precisa ser atualizada").

*CRÍTICO #4 — `synchronize: true` no TypeORM em produção* (`src/app.module.ts:83, 95`):
- O TypeORM altera o schema do MySQL automaticamente a cada boot, baseado nas entities
- Qualquer alteração acidental em uma entity (renomear coluna, remover campo) vai executar `ALTER TABLE` ou `DROP COLUMN` em produção na próxima subida
- Já existe um dump SQL de 12MB em `docs/dump-ai_urban-202603131344.sql` — provavelmente tirado para recuperação de um acidente prévio
- **Fix:** desabilitar `synchronize`, gerar migrations com `typeorm migration:generate`, versionar em `src/migrations/`, rodar em deploy com `migration:run`.

*ALTO #5 — Validação DTO ausente*: vários endpoints usam `@Body() data: any` ou objetos `any`. `class-validator` está instalado mas pouco usado. Efeito: payloads maliciosos chegam até os services sem checagem.

*ALTO #6 — Rate limiting inexistente*: `/auth/login` permite brute-force. Não há `@nestjs/throttler` nem helmet instalados.

*ALTO #7 — CORS `*` como fallback* (main.ts:15): `origin: process.env.FRONT_BASE_URL || '*'`. Se FRONT_BASE_URL falhar de ser setada em qualquer ambiente, qualquer origem passa.

*ALTO #8 — `UrbanAIPricingEngine` instanciada direto (não via DI)* em `PropriedadeService`: viola SOLID, dificulta mock em testes.

*MÉDIO #9 — Dockerfile duplicado* (`Dockerfile` e `Dockerfile copy`).

*MÉDIO #10 — Zero testes reais*: existem 2 spec files (`app.controller.spec.ts`, `maps.*.spec.ts`) mas são stubs; cobertura efetiva ≈ 0%. Jest configurado, nunca rodou em CI.

*MÉDIO #11 — Arquivos de lixo commitados na raiz do backend*: `a.txt`, `backend-logs.txt` (50KB de logs), `backend.txt`, `backend_utf8.txt`, `front.txt`, `front_utf8.txt`, `import_output.txt`, `railway_logs.txt`, `scrap.txt`, `test-mic.wav` — precisam ser removidos do git e adicionados ao `.gitignore`.

### 3.2 Frontend Next.js

**Pontos fortes:**
- Next 15 com App Router, output standalone (pronto para Docker)
- NextAuth + Google OAuth funcionando
- Sentry client configurado (replay 1%, error 100%, traces 10%)
- Interceptor Axios global que injeta Bearer token e redireciona no 401
- Chakra UI com theme customizado (cores brand `#ef7d5a` laranja, `#232f53` azul)
- i18n preparado com next-i18next
- Onboarding wizard 5 passos implementado (commit `eccf56c`)
- Landing page pronta (Glassmorphism Premium, SEO completo: meta tags, OG, Twitter Card, JSON-LD, sitemap, robots.txt)
- Dashboard, properties, maps, event-log, my-plan, plans implementados
- Global Paywall Modal sem redirect (commit `4338591`) — boa UX

**Pontos críticos:**

*ALTO #12 — IP público hardcoded em `next.config.ts`*:
```
destination: 'http://200.142.105.90:31806/copilot/:path*'
```
Três rewrites apontam para o IP `200.142.105.90:31806` (Chainlit Copilot). Se esse servidor mudar de IP ou port, o frontend quebra. Além disso é **HTTP puro em proxy interno**, o que pode causar mixed-content em alguns cenários.

*ALTO #13 — JWT armazenado em localStorage*: vulnerável a XSS. A recomendação de segurança atual é httpOnly cookie com SameSite=Lax e refresh token rotacionado.

*ALTO #14 — ESLint desabilitado no build* (`next.config.ts:8`: `ignoreDuringBuilds: true`). Pull requests com erros de lint passam. Resultado: 126 `console.log` em produção, 33 usos de `any`.

*MÉDIO #15 — Rotas duplicadas/obsoletas*: `/maps` + `/maps-bkp`, `/painel` coexistindo com `/dashboard`. Precisa limpeza.

*MÉDIO #16 — Acessibilidade não auditada*: Chakra UI dá ARIA padrão, mas componentes customizados não foram avaliados contra WCAG 2.1 AA.

*MÉDIO #17 — Zero testes (0 arquivos `.test.ts`/`.spec.ts`)*.

*MÉDIO #18 — Arquivos de lixo no repo do front*: `dsdsd.tx`, `teste.txt`, `test.txt`, `q`, `temp_railway_2/` (pasta inteira), `full-build.txt` (17KB), `lint-output.txt`, `lint-output-utf8.txt`, `last-commit.txt`.

*BAIXO #19 — Dark mode só parcialmente implementado* (CSS vars com `prefers-color-scheme` mas sem toggle real).

*BAIXO #20 — `images.domains` deprecated* no Next 15 (deveria ser `remotePatterns`).

### 3.3 Motor KNN

O arquivo `urban-ai-knn-main/` é um microserviço Express standalone, mas **a lógica foi duplicada/migrada para dentro do backend NestJS** em `src/knn-engine/*.ts`. O relatório de QA (Antigravity, 19/03) confirma: "O algoritmo KNN, antes projetado para rodar em um microserviço avulso e custoso, foi consolidado de forma nativa dentro do próprio monólito do Backend." Recomendação: **decidir explicitamente se o repo standalone vai ser aposentado ou se volta a ser usado como microserviço** (e, nesse caso, removê-lo do monorepo para evitar código morto que confunde).

Problemas do motor em si (aplicáveis à versão embarcada no backend):
- Dataset mock: o QA report menciona "fallback matemático" quando não há dados suficientes — mas a base real de vizinhos para o KNN ainda não está populada. F6.1 ("Conectar dados reais de propriedades cadastradas ao treinamento do KNN" e "Substituir dados mock por histórico real de preços e ocupação") está `⬜ pendente`.
- Zero testes unitários: a lógica de multiplicadores (categoria + atratividade + travel time + relevância) não é validada. Um bug aqui afeta **a recomendação de preço** — o core value do produto.
- `UrbanAIPricingEngine` é instanciada hardcoded no service; sem DI, difícil testar.

### 3.4 Pipeline Prefect

**Forte:** arquitetura decente — `trigger_all_spiders` dispara os scrapers, `raw_data_extraction_and_dump` consolida em MySQL. Secrets via Prefect Blocks. Tests folder presente (pytest.ini).

**Crítico:**
- **Zero enriquecimento de dados**: o flow lê parquet → escreve em MySQL em modo append. Não há geocoding, correlação com imóveis, cálculo de features para o KNN. Essa transformação está sendo feita em runtime dentro do backend (lento, não cacheado).
- Sem monitoramento de falhas além dos logs nativos do Prefect — um flow que falha por 3 dias não gera alerta por e-mail/WhatsApp.
- Dependência da conta Prefect Cloud Free — o QA report menciona que a Lumina precisou migrar de `worker` para `serve.py` porque o plano free mudou. Risco recorrente.
- Risco jurídico: os dados scraped vêm de Eventim, Sympla, Ingresse, Ticketmaster — todos com TOS que **proíbem scraping explícito**. Não há documento interno de posicionamento jurídico. Para eventos públicos em SP, considerar a API oficial da Prefeitura (F6.2, ainda pendente).

### 3.5 Webscraping

**Forte:** `ROBOTSTXT_OBEY=True`, `CONCURRENT_REQUESTS=1`, delay randomizado, user-agent rotation, `auth_proxy.py` protegendo Scrapyd com `x-api-key`. Dockerfile 2-stage usando imagem oficial Playwright da Microsoft (prevenção de ataques supply-chain).

**Crítico:**
- **Bucket S3 hardcoded** em `pipelines.py` (`urbanai-data-lake`) — não dá pra ter ambiente de staging sem mudar código
- Eventim/Sympla/etc. — mesma preocupação jurídica do pipeline
- Zero testes automatizados
- Playwright stealth mode pode ser considerado "ato deliberado de evadir proteção" em alguns frameworks jurídicos — documentar posicionamento

---

## 4. Infraestrutura, Deploy e Operação

**Stack atual confirmada** (segundo memória + relatório de status semanas 3-4):
- **Railway** — hosting de backend, frontend, Scrapyd, pipeline Prefect (+/- R$ 1.000/mês)
- **MySQL** — gerenciado pelo Railway
- **Upstash Redis** — BullMQ + possível cache (usado em `switchback.proxy.rlwy.net:56406` segundo o .env)
- **AWS S3** — `urbanai-data-lake` (crédito USD 200 grátis)
- **Google Cloud Maps** — crédito R$ 1.759 até 15/06/2026
- **Stripe** — ambiente teste (`sk_test`), produção bloqueada em KYC
- **Mailersend** — transacional
- **SendGrid** — dual-stack legada, migração incompleta
- **Sentry** — `urbanai-ff` org, backend e frontend instrumentados
- **Domínios** — `app.myurbanai.com` ativo (SSL ok), `urbanai.com.br` e `myurbanai.com` ainda com Lumina Lab
- **CI/CD** — apenas `.github/workflows/mirror.yml` (replica repo para outro host). Não há pipeline de build/test/deploy. Deploy é manual via Railway CLI ou UI.

**Ausências críticas para produção:**

*Sem staging environment.* O sistema está operando direto em produção desde D14. Qualquer mudança vai ao vivo. Recomendo duplicar os 5 serviços em Railway com suffix `-staging` e subdomínio `staging.myurbanai.com` antes de F6 começar.

*Sem migrations versionadas.* `synchronize: true` + ausência de `src/migrations/` = schema caminha de forma ad-hoc.

*Sem backup policy documentada.* Railway faz backup automático de MySQL, mas não há SOP para restore, frequência, retenção, ou teste de restore.

*Sem SLA/SLO.* Nada documentado sobre uptime target, RTO, RPO.

*Sem runbooks operacionais.* "O que fazer se o Scrapyd parar de responder", "se o Prefect flow falhar 3 dias seguidos", "se o Mailersend ficar rate-limited", "se o Stripe mudar um price ID" — tudo vai depender da memória do Gustavo.

*Sem cofre de secrets formal.* As secrets estão como env vars no Railway (tolerável para start), mas não há rotação programada, log de acesso, ou política de quem pode ver o quê. A RapidAPI key hardcoded mostra que a cultura de "secret em .env" não está consolidada.

*Sem rate limiting na API.* Vulnerável a DoS e brute-force.

*Sem WAF ou proteção DDoS* além do que o Railway provê nativamente.

*Sem policy de LGPD.* O sistema armazena e-mail, CPF (implícito via Stripe KYC), dados de imóveis, eventos — e faz scraping. Não há `politica-privacidade.md` internamente (a página pública existe, mas o documento de compliance ausente).

---

## 5. Documentação

### 5.1 O que existe (`docs/`)

**Bom:** a pasta `docs/` está ativa e densa. Relatórios de status recorrentes, roadmap detalhado, brand book, presentations. O `relatorio-status-semanas3-4.md` (13/04) é exemplar — 20KB, bem estruturado, com commits referenciados.

**Roadmaps:** `roadmap.md` (original), `roadmap-pos-sprint.md` (ativo, versão 2.0), `roadmap-assumir-operacao.docx` (histórico).

**Relatórios de status:** série completa D7, D9, D14, Semanas 3-4, Relatório 2/3/4/5. Rastreabilidade boa.

**Técnicos:** `relatorio-cliente-prestacao-de-contas.md` (QA/engineering — saída da Lumina), `relatorio-testes-2026-03-18.md`, `checklist-seguranca-d13.md`, `ADENDO_TECNICO_KNN.md`, `banco-antigo-analise.md` + `banco-antigo-schemas.md`.

**Brand:** `apresentacao-cliente-urban-ai.pptx`, `Roadmap Urban Ai.pdf`, `Emails Urban AI.pdf`.

### 5.2 O que falta

*ADRs (Architecture Decision Records).* Por que escolhemos NestJS monolito? Por que KNN no Node e não Python? Por que Prefect e não Airflow? Sem ADRs, a próxima pessoa que questionar essas decisões vai discutir do zero.

*Runbooks.* Zero.

*Onboarding de dev.* O `README.md` raiz explica Opensquad, não Urban AI. `CLAUDE.md` idem. **Se outro dev chegar amanhã, ele não sabe como rodar o projeto localmente.** Isso é um bloqueio concreto para escalar a equipe.

*Documentação de API.* Swagger existe em `/api`, mas não há guia de "como consumir a API do Urban AI" para eventuais integrações B2B (PMCs, parceiros).

*Política de LGPD interna.* Só a página pública, não o documento que vai ser exigido em due diligence.

*Guia de contribuição* (PR template, commit convention, branching model).

*Arquivo `.env.example`* em cada módulo. Hoje, backend não tem, frontend não tem, KNN não tem, scraping não tem. Pipeline tem.

*Diagramas.* Nenhum diagrama C4 ou de sequência do fluxo ponta-a-ponta.

### 5.3 Ruído no repositório

Identifiquei **31+ arquivos de "lixo"** espalhados: logs commitados (`backend-logs.txt`, `railway_logs.txt`, `railway-front-logs.txt`), outputs de lint e build (`lint-output.txt`, `full-build.txt`), dumps SQL massivos (`dump-ai_urban-202603131344.sql` — 12MB, `inserts-only.sql` — 12MB, `inserts-only-cols.sql` — 12MB, **~37MB só aí**), arquivos vazios (`a.txt`, `q`, `dsdsd.tx`, `teste.txt`, `test.txt`), HTMLs de teste de scraping (`airbnb_dump.html`, `airbnb_search.html`, `scraper_test.html`), um `test-mic.wav` inexplicável. Isso tudo está versionado no git, inflando clone size e sinalizando processo imaturo.

---

## 6. Avaliação do Roadmap Pós-Sprint

O `roadmap-pos-sprint.md` (versão 2.0, 13/04) é um documento **bem estruturado** mas **deixa lacunas críticas**:

**Fases cobertas:** F5A (UX/validação de produto) em 60%, F5 (presença digital) em 78%, F6 (IA + produto) em 20%, F7 (beta + go-live) em 10%.

**Lacuna #1 — Não há "F5B" de hardening operacional.** As questões de segurança (senha em log, API key hardcoded, synchronize, rate limiting, testes) não estão listadas em nenhum lugar. A transferência da Lumina para Urban AI foi feita assumindo que o sistema estava "pronto", mas os problemas acima mostram que o QA report da Antigravity/Lumina foi superficial — focou em "webhooks funcionando" e não em "senhas estão seguras".

**Lacuna #2 — F6.1 prevê "conectar dados reais de propriedades ao treinamento do KNN" mas não define como o dataset histórico será obtido.** Cadastrar 5 imóveis via beta não é suficiente para KNN (mínimo prático ~200+ imóveis para classificação confiável). Ou se parceira com uma PMC com histórico, ou se começa com o "fallback matemático" declarado.

**Lacuna #3 — F7 prevê go-live em Semana 13-14 (final de junho) mas nenhum critério de entrada para beta está formalizado.** "Fluxo de ponta a ponta validado" é vago — precisa de checklist concreto (smoke test e2e, SLO observado por 1 semana, KYC aprovado, orçamento fechado, 3 usuários beta ativos).

**Bloqueios atuais que precisam tratamento imediato:**
- 🔴 **KYC Stripe** (carryover de 20/03) — nenhum centavo real entra antes disso
- 🔴 **Aprovação de orçamento de marketing** pelos sócios — R$ 4.340–8.170/mês bloqueia F5.3
- 🔴 **Transferência de domínio `urbanai.com.br`** com Lumina Lab — landing não publica
- 🟡 **Google Analytics 4 + Meta Pixel** com placeholders (precisa de IDs reais)

---

## 7. Ranking Consolidado de Riscos

Usando o padrão de priorização do próprio projeto (CRIT/1/2/3):

**CRIT — Resolver nos próximos 7 dias:**
1. Revogar e rotacionar a RapidAPI key hardcoded em `airbnb.service.ts:11`, mesmo que esteja desativada
2. Remover `console.log(data.password, ...)` em `auth.service.ts:51`
3. Desabilitar `synchronize: true` + gerar migrations versionadas
4. Criar `.env.example` no backend + frontend + KNN + scraping, commit; remover qualquer `.env` real de `git ls-files` (confirmar que não está commitado — hoje não está, mas vigiar)
5. Submeter KYC Stripe (já em andamento)
6. Destaque no `.gitignore` para `*.log`, `*-logs.txt`, `*.sql`, `temp_*`, `lint-output*`, `full-build*`

**Prioridade 1 — Próximas 2 semanas:**
7. Migrar todas as senhas SHA-256 → bcrypt(12) com salt por usuário + forçar reset via e-mail para usuários pré-migração
8. Adicionar `@nestjs/throttler` em `/auth/login`, `/auth/register`, `/auth/google` + limites globais
9. Adicionar `helmet` + CSP básico
10. Implementar testes e2e do fluxo crítico: signup → confirmar e-mail → cadastrar imóvel via link Airbnb → receber recomendação de preço → assinar plano Stripe → cancelar
11. Criar staging em Railway (5 serviços duplicados) com subdomain `staging.myurbanai.com`
12. Aprovar orçamento de marketing com Fabrício e Rogério
13. Remover IP `200.142.105.90:31806` hardcoded de `next.config.ts` → `process.env.NEXT_PUBLIC_COPILOT_URL`
14. Reativar ESLint no build do frontend (`ignoreDuringBuilds: false`) + saneamento inicial

**Prioridade 2 — Próximas 4 semanas:**
15. Decidir e documentar o destino do repo `urban-ai-knn-main/` (aposentar ou voltar a ser microserviço)
16. Escrever runbooks dos 5 cenários mais prováveis (DB down, Scrapyd travado, Prefect falhando, Mailersend rate-limited, Stripe price mudado)
17. Escrever documento de posicionamento jurídico sobre scraping (Eventim/Sympla/etc.) + avaliar APIs oficiais
18. Aumentar cobertura de testes para ≥ 50% no backend, começando pelos services críticos (`AuthService`, `PaymentsService`, `UrbanAIPricingEngine`)
19. Migrar JWT de localStorage para httpOnly cookie com refresh rotation
20. Documentar ADRs principais retroativamente (top 5)
21. Criar `README.md` raiz e `README.md` de cada serviço com "getting started" (stack, portas, env vars, comandos)
22. Remover rotas duplicadas do front (`/maps-bkp`, `/painel`)
23. Limpar os 31+ arquivos de lixo do git

**Prioridade 3 — Antes do go-live (Semanas 10-12):**
24. Política LGPD interna + DPA com Stripe/Mailersend
25. Backup/restore MySQL testado trimestralmente
26. SLA/SLO declarados (sugestão: 99.5% uptime, RTO 2h, RPO 24h)
27. Observabilidade estendida: métricas de negócio no Sentry (ARR, DAU, conversão)
28. Auditoria WCAG 2.1 AA no frontend
29. Load test (k6) simulando 100 usuários simultâneos
30. Smoke test automatizado rodando contra `staging` a cada merge

---

## 8. Plano de Ação Sugerido para as Próximas 4 Semanas

**Semana 1 (16–22/04):** Hardening crítico — itens CRIT 1–6. Em paralelo, continuar F5A.1/5A.3 (UX de erros, cadastro de imóveis) e aguardar KYC Stripe.

**Semana 2 (23–29/04):** Hardening P1 — itens 7–14. Começar a testar staging. Aprovar orçamento com sócios até 25/04.

**Semana 3 (30/04–06/05):** Cobertura de testes + runbooks + ADRs. Se F5A chegar a 100%, abrir F6.1 (conectar KNN a dados reais). Começar posts orgânicos.

**Semana 4 (07–13/05):** Load test + backup restore drill + WCAG audit. Validar fluxo e2e ponta-a-ponta uma última vez antes de abrir o beta.

**Semana 5 (14–20/05):** **Beta fechado inicia** com 5–10 anfitriões. Começa F7.1. Rodar campanhas pagas só quando KYC aprovado, orçamento liberado, e F5A = 100%.

---

## 9. Comentário Final

O Urban AI tem a ossatura certa: produto bem posicionado ("Síndrome da Casa Barata", promessa de +30% de receita), stack moderna, arquitetura de 5 serviços bem separados, 53 entregas de sprint documentadas, Sentry instrumentado, Stripe com webhook assinado. A transição da Lumina foi bem orquestrada na camada de infraestrutura (Railway próprio, MySQL próprio, S3 próprio, Stripe próprio).

O problema não é o **produto**, é a **prontidão operacional**. Muitos dos atalhos que fazem sentido em MVP de startup (synchronize true, console.log para debug, ESLint off, API key no código "só por enquanto", zero testes) viram **passivos reais** no momento em que o produto recebe tráfego pago, porque cada um desses atalhos é um vetor de incidente que, quando acontece, vai custar ou dinheiro (leak de credenciais = rebuild de infra) ou reputação (senhas comprometidas = churn instantâneo) ou noites perdidas (schema corrompido sem migration = restore de backup).

A boa notícia é que nenhum desses itens é arquitetural — são todos "pendurados" em arquivos pontuais. Duas semanas focadas em hardening colocam o Urban AI em patamar operacional adequado para lançar. **Se adotarmos a disciplina de "nada novo em produção antes de resolver o bloco CRIT + P1", chegamos no beta de maio com um sistema que aguenta crescer.**

---

## 10. Próximos Passos Imediatos (para mim como seu parceiro técnico)

Para eu poder assumir efetivamente o desenvolvimento e operação, preciso:

1. Confirmar acesso a Railway, Sentry, Mailersend, Stripe Dashboard, AWS Console, Upstash, GitHub (quais roles?)
2. Confirmar acesso ao cofre de secrets atual (Railway env vars) e como preferir evoluir para cofre formal (Railway Secrets, Doppler, Vault)
3. Confirmar se o repo `urban-ai-knn-main/` pode ser aposentado do monorepo
4. Alinhar a cadência de reporte (semanal + quinzenal, como prevê o roadmap pós-sprint)
5. Alinhar prioridade: começamos pelo bloco CRIT nesta semana?

*Documento gerado em 16/04/2026 por Gustavo + Claude · Uso interno · Urban AI*
