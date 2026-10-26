# Arquitetura atual — Urban AI

**Data:** 2026-10-23 · **Owner:** Engenharia (Gustavo) · **Status:** Canônico (estado atual de infraestrutura e integrações)
**Última validação:** 2026-10-23 (código + DNS + provedores) · **Próxima revisão:** após qualquer mudança de provedor, domínio ou deploy; no máximo 2026-11-30.
**Relação com outras fontes:** este documento é a fonte única do *estado atual* de topologia, ambientes, deploy e integrações. Detalhe interno de módulos, entidades e fluxos de negócio continua em [`product/ARCHITECTURE.md`](./product/ARCHITECTURE.md). Decisões e o porquê ficam nos [ADRs](./adr/README.md). Variáveis de ambiente: [`runbooks/matriz-env-operacional.md`](./runbooks/matriz-env-operacional.md). Acessos: [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md).

> Regra deste arquivo: nada de valores de secrets, senhas, IPs, URLs de banco ou detalhes exploráveis. Os repositórios são espelhados num remoto **público**.

---

## 1. Topologia

| Componente | Pasta | Stack (verificada no código) | Onde roda | Domínio / acesso |
|---|---|---|---|---|
| Frontend (marketing + app) | `Urban-front-main/` | Next.js 15 (App Router, output standalone), React 19, Tailwind 4, NextAuth 4, Sentry, Stripe.js | Railway (Dockerfile) atrás do Cloudflare | `myurbanai.com` (marketing) e `app.myurbanai.com` (app); roteamento por host em `src/middleware.ts` |
| Backend (API) | `urban-ai-backend-main/` | NestJS 11, TypeORM 0.3 + mysql2, Bull v3 (`@nestjs/bull` + `bull`), Stripe SDK, Sentry, Passport JWT, Helmet, Throttler | Railway (Dockerfile, Node 20) | Domínio de serviço Railway (`urbanai-production-85fd.up.railway.app`). **Não existe `api.myurbanai.com` ainda** (pendência) |
| Banco | — | MySQL gerenciado | Railway | Somente rede/variáveis do Railway |
| Fila / cache | — | Redis (Upstash) usado pelo Bull (fila `processos`) | Upstash | `REDIS_*` no backend |
| Webscraping | `urban-webscraping-main/` | Python 3.12, Scrapy + Scrapyd + Playwright, coletores HTTP próprios, `auth_proxy.py` na frente do Scrapyd | Railway (Dockerfile) | Domínio de serviço Railway; protegido por `SCRAPYD_API_KEY` |
| Pipeline | `urban-pipeline-main/` | Python 3.12, Prefect 3 (`serve.py`), Pandas/SQLAlchemy/boto3 | Container próprio (Dockerfile → `serve.py`) conectado ao Prefect via `PREFECT_API_URL`/`PREFECT_API_KEY` | Prefect (workspace sob responsabilidade do responsável operacional) |
| KNN legado | `urban-ai-knn-main` (removido em 2026-10) | Node/Express | **Aposentado** ([ADR 0007](./adr/0007-aposentar-knn-microservice.md)); código só no histórico | — |
| Load tests | `load-tests/` | k6 | Local/CI manual | — |

Contagem de referência (2026-10-23, apenas para ordem de grandeza): backend com 36 controllers, 21 jobs `@Cron` e ~90 arquivos `*.spec.ts`. Não use esses números como meta; recalcule quando precisar.

## 2. Diagrama

```mermaid
flowchart LR
  user([Usuário / anfitrião]) -->|HTTPS| cf[Cloudflare DNS + proxy]
  cf --> mkt[myurbanai.com<br/>Next.js marketing]
  cf --> app[app.myurbanai.com<br/>Next.js app]
  mkt & app -->|NEXT_PUBLIC_API_URL| api[Backend NestJS<br/>Railway service domain]
  api --> db[(MySQL Railway)]
  api --> redis[(Upstash Redis<br/>Bull)]
  api --> stripe[Stripe]
  api --> brevo[Brevo e-mail]
  api --> google[Google OAuth / Maps]
  api --> gemini[Gemini]
  api --> rapid[RapidAPI / Airbnb]
  api --> stays[Stays Open API]
  api & app --> sentry[Sentry]

  subgraph scraping[Webscraping container - Railway]
    proxy[auth_proxy.py<br/>cron interno 6h] --> collectors[Coletores HTTP]
    proxy --> scrapyd[Scrapyd + spiders]
  end
  prefect[Prefect<br/>03:00 UTC] -->|trigger_all_spiders| proxy
  collectors -->|POST /events/ingest<br/>x-urban-events-ingest-key| api
  scrapyd -->|UrbanIngestPipeline| api

  gha[GitHub Actions<br/>repo canônico] -->|backup diário| s3[(AWS S3 backup)]
  gha -->|restore drill| s3
```

## 3. Fluxo de eventos (caminho vivo)

1. **Agendamento** — dois gatilhos coexistem:
   - Prefect: deployment `urban_webscraping` (`trigger_all_spiders`) às **03:00 UTC**, que pede ao Scrapyd para rodar os spiders.
   - Cron interno do container de webscraping (`auth_proxy.py`): roda os coletores a cada `COLLECTOR_CRON_INTERVAL_SECONDS` (padrão 21600 s = **6 h**) e, por padrão, também ao subir (`RUN_COLLECTORS_ON_BOOT`). Com `RUN_LEGACY_SPIDERS=true`, o runner agregado também agenda os spiders no Scrapyd.
2. **Coleta** — coletores HTTP (`urban_webscrapping/collectors/`) e spiders Scrapy (`urban_webscrapping/spiders/`).
3. **Envio** — ambos usam `UrbanBackendClient` e fazem `POST /events/ingest` no backend com o header `x-urban-events-ingest-key`. O backend valida contra `EVENTS_INGEST_API_KEY` (guard `EventsIngestApiKeyGuard`); no webscraping o mesmo valor fica em `URBAN_EVENTS_INGEST_API_KEY`. Headers opcionais de auditoria: `x-urban-collector`, `x-urban-collector-version`, `x-urban-ingest-run-id`.
4. **Backend** — dedup por `dedupHash`, geocoding lazy (`pendingGeocode`), escopo de cobertura, enrichment e inteligência de eventos (detalhe em [`product/ARCHITECTURE.md`](./product/ARCHITECTURE.md) §6).

**Envio confiável:** spiders e coletores habilitam o envio só com `URBAN_EVENTS_INGEST_API_KEY` (o login por e-mail/senha foi removido) e usam um outbox SQLite persistente ([ADR 0018](./adr/0018-entrega-confiavel-dos-coletores-outbox-sqlite.md); `URBAN_INGEST_OUTBOX_PATH`, em volume persistente no Railway) com retentativa, quarentena e validação das contagens. Detalhes em [`runbooks/ingest-outbox-entrega.md`](./runbooks/ingest-outbox-entrega.md).

**Fluxo S3 "bronze" do [ADR 0003](./adr/0003-prefect-cloud.md): inativo.** As pipelines S3 estão comentadas em `urban_webscrapping/settings.py`, e o bucket/prefixo que o webscraping gravaria não bate com o que o flow `raw_data_extraction_and_dump` (04:00 UTC) lê. Na prática esse flow não tem dados novos para carregar. Decisão pendente: reativar com bucket alinhado ou remover o flow ([ADR 0022](./adr/0022-vercel-e-fluxo-bronze-do-prefect.md)).

## 4. Fluxo de requisição (host → front → API)

1. O navegador resolve `myurbanai.com` / `app.myurbanai.com` no Cloudflare, que faz proxy para o serviço de frontend no Railway.
2. O `middleware.ts` do Next.js separa marketing (apex) e app (`app.`); `www` e `.com.br` redirecionam (301) para o apex; rotas cruzadas redirecionam para o host correto.
3. O frontend chama a API em `NEXT_PUBLIC_API_URL`, que hoje aponta para o **domínio de serviço Railway** do backend (não há hostname canônico de API). As variáveis `NEXT_PUBLIC_*` são embutidas **no build** (Dockerfile `ARG`), então mudar a URL da API exige rebuild do front.
4. O backend autentica por JWT em cookie httpOnly com refresh rotativo ([ADR 0012](./adr/0012-sessao-cookie-httponly-refresh-rotativo.md); Bearer ainda aceito por retrocompatibilidade), aplica CORS por whitelist (`CORS_ALLOWED_ORIGINS`) e rate limit global. Sem prefixo global de rota.
5. Health: `GET /health/live` (liveness, público) e `GET /health` (detalhado; exige `HEALTH_READINESS_TOKEN` fora de dev). Swagger em `/api` (desligado em produção, salvo `ENABLE_SWAGGER=true`).

## 5. Integrações

| Provedor | Uso | Quem chama | Variáveis (nomes) |
|---|---|---|---|
| Stripe | Checkout, assinatura, portal, webhook `POST /payments/webhook` | Backend; Stripe.js no front | `STRIPE_*`, `*_PRICE_*`, `*_PLAN`, `SUCCESS_URL`, `CANCEL_URL`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Stays | Conectar conta, sincronizar listings, preview/push/rollback de preço, auto-apply (fail-closed) | Backend | `STAYS_API_BASE_URL`, `STAYS_TOKEN_ENCRYPTION_KEY`, `STAYS_AUTO_APPLY_*` |
| Brevo | E-mail transacional | Backend | `BREVO_API_KEY`, `EMAIL_SENDER*`, `BREVO_API_BASE_URL` |
| Google OAuth | Login Google (front NextAuth + validação do idToken no backend) | Front + backend | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET` |
| Google Maps | Geocoding, distâncias | Backend | `GOOGLE_MAPS_API_KEY` |
| Gemini | Enrichment de eventos; extração LLM nos coletores Firecrawl/Tavily | Backend + webscraping | `GEMINI_API_KEY` |
| RapidAPI | Dados de anúncios Airbnb | Backend | `RAPIDAPI_KEY`, `AIRBNB_*` |
| Sentry | Erros/tracing | Backend + front | `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (build) |
| Upstash Redis | Fila Bull | Backend | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS` |
| Prefect | Agendamento dos spiders | Pipeline | `PREFECT_API_URL`, `PREFECT_API_KEY`, Secret blocks |
| Scrapyd | Execução de spiders | Pipeline → webscraping | `SCRAPYD_URL`/`WEBSCRAPPING_API_URL`, `SCRAPYD_API_KEY` |
| APIs de eventos | Ticketmaster, API-Football, SerpAPI, Firecrawl, Tavily, SP Cultura | Webscraping | uma chave por coletor (ver matriz) |
| AWS S3 | Backup off-site do MySQL e restore drill (GitHub Actions); bronze legado (inativo) | GitHub Actions; webscraping/pipeline (legado) | `AWS_*`, `S3_BUCKET` (GitHub secrets) |
| Cloudflare | DNS autoritativo e proxy de `myurbanai.com` | — | Painel/API |
| Analytics | GA4 e Meta Pixel (opcionais) | Front | `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID` |

## 6. Ambientes

| Ambiente | Frontend | Backend | Observações |
|---|---|---|---|
| Produção | `myurbanai.com`, `app.myurbanai.com` (Cloudflare → Railway) | Domínio de serviço Railway | Deploy automático pelo Railway a partir da `main` |
| Staging | Domínio de serviço Railway (`*-staging-staging.up.railway.app`) | Domínio de serviço Railway (`*-staging-staging.up.railway.app`) | `staging.myurbanai.com` **falha em TLS** hoje; use os domínios Railway. Em host `*.railway.app`, `COOKIE_DOMAIN=none` |
| Local | `localhost:3000` | `localhost:10000` (padrão local) | `.env` / `.env.local` fora do Git |

### DNS e e-mail do domínio

- Nameservers de `myurbanai.com`: **Cloudflare**. A antiga zona na Hostinger não é mais autoritativa (a Hostinger pode continuar sendo apenas o registrador; confirmar).
- Brevo: registros DKIM (`brevo1`/`brevo2`) e DMARC com `p=none` publicados.
- **Não há registro MX.** Endereços como `privacidade@` e `suporte@myurbanai.com` **não recebem e-mail hoje** — pendência.

## 7. Deploy

- **Frontend e backend:** Railway, build via Dockerfile de cada pasta, disparado pelo push na `main` (produção) e na branch de staging configurada no Railway.
- **Webscraping:** Railway, Dockerfile (Scrapyd + `auth_proxy.py`).
- **Pipeline:** container `serve.py` registrado no Prefect. Confirmar no Railway/Prefect se o serviço está ativo antes de depender dele.
- **Vercel:** o `vercel.json` da raiz **desliga deploys por Git** (os deploys são geridos fora do Git). O [ADR 0005](./adr/0005-hospedagem-railway.md) registra o Vercel como descartado para o produto. Estado honesto: **o produto roda no Railway**; não há deploy de produto via Vercel. Se alguma peça auxiliar vier a ser publicada via Vercel, registrar em um ADR (ver [ADR 0022](./adr/0022-vercel-e-fluxo-bronze-do-prefect.md)).
- **CI (GitHub Actions, repo canônico):** `ci.yml` (gates de repositório, testes/build de backend e front, migrations em MySQL limpo, testes Python, smoke E2E condicional), `release-gate.yml`, `codeql.yml`, `backup-db.yml` (diário 03:00 UTC), `restore-drill.yml` (manual).

## 8. Repositório canônico

`urbanai-tech/urban.ai` é o repositório canônico e público ([ADR 0011](./adr/0011-repositorio-publico-canonico.md)): CI, CodeQL, `backup-db` e `restore-drill` rodam aqui. Toda mudança entra por Pull Request.

```bash
git fetch origin
npm run gate:repository            # secrets no HEAD, links de docs, DR, KNN legado
gitleaks git --no-banner           # ou "gitleaks detect": varredura antes de publicar
git push origin <branch>           # abrir PR contra a main
```

Nunca publicar sem rodar `npm run gate:repository` e o gitleaks. Qualquer arquivo com dado sensível deve ser tratado antes do push, porque o histórico público não se apaga com um commit novo.

## 9. Pendências conhecidas (genéricas)

| # | Pendência | Tipo |
|---|---|---|
| 1 | Há incidente de segurança P0 aberto; detalhes tratados fora deste repositório. | Segurança |
| 2 | Workflow de backup off-site está falhando por credenciais inválidas no provedor de armazenamento; restaurar credenciais e validar com um restore drill. | Operação / DR |
| 3 | Hostname canônico da API (`api.myurbanai.com`) não existe; front aponta para o domínio de serviço Railway. | Infra |
| 4 | `staging.myurbanai.com` falha em TLS. | Infra |
| 5 | Sem MX: caixas `privacidade@`/`suporte@` não recebem e-mail; DMARC ainda em `p=none`. | E-mail / LGPD |
| 6 | Pipeline de ingest dos spiders depende de variáveis legadas para ser habilitada (ver §3). | Código |
| 7 | Fluxo S3 bronze inativo e desalinhado (bucket/prefixo); decidir reativar ou remover ([ADR 0022](./adr/0022-vercel-e-fluxo-bronze-do-prefect.md)). | Código / dados |
| 8 | `urban-pipeline-main/.env.example` ainda cita `PREFECT_SERVER_URL`; o código lê `PREFECT_API_URL`. `prefect.yaml` aponta para repositório/host antigos. | Código |
| 9 | Situação do Vercel e de qualquer projeto auxiliar ([ADR 0022](./adr/0022-vercel-e-fluxo-bronze-do-prefect.md)). | Decisão |
| 10 | Produção roda em `LAUNCH_MODE=prelaunch` (cadastro desviado para waitlist). Abertura depende do PR #22 + env explícita no Railway. | Produto |
| 11 | PRs em draft no repo da org: #22 (site comercial, modo `public`) e #19 (conector Stays com Basic auth/calendário, outbox de ingest, pipeline transacional). Ordem sugerida: #22 → rebase #19 → corrigir CodeQL/mypy do #19. | Código |
| 12 | Tabelas de preço divergentes entre site público, tabela `plans` do banco e matriz em `plans.service.ts`; definir fonte única (a guarda de assinatura, [ADR 0014](./adr/0014-guarda-de-assinatura-e-registro-de-politicas.md), decide por direito de uso, não por preço). | Produto / cobrança |
| 13 | Lockfile do frontend fora de sincronia com `package.json` (`npm ci` falha); dependências com vulnerabilidades altas/críticas no front e no back (`npm audit`). | Código |
| 14 | `main` sem proteção de branch; secret scanning e alertas Dependabot desativados no repo da org. | Governança |

## 10. Mapa de arquitetura: fluxos principais

Visão de leitura rápida para quem assume o projeto. Detalhe de módulos e entidades: [`product/ARCHITECTURE.md`](./product/ARCHITECTURE.md). O porquê de cada escolha: [ADRs](./adr/README.md) (links na tabela da seção 11).

### 10.1 Serviços, dados e provedores

| Camada | O quê | Onde no repositório |
|---|---|---|
| Interface | Next.js (marketing + app), sessão por cookie httpOnly | `Urban-front-main/` |
| API e jobs | NestJS (monólito modular), guard global de assinatura, jobs `@Cron` com lock distribuído | `urban-ai-backend-main/` |
| Dados | MySQL (fonte de verdade), Redis (fila Bull + locks de job), SQLite local no webscraping (outbox) | Railway / Upstash / volume do webscraping |
| Coleta | Spiders Scrapy + coletores HTTP, entrega com outbox | `urban-webscraping-main/` |
| Orquestração | Prefect (gatilho dos spiders; flow bronze inativo) | `urban-pipeline-main/` |
| Provedores | Stripe, Stays, Brevo, Google (OAuth/Maps), Gemini, RapidAPI/Airbnb, Sentry, Cloudflare, AWS S3 (backup) | seção 5 |

### 10.2 Do onboarding ao resultado

```mermaid
flowchart LR
  A[Onboarding<br/>link do anúncio, endereço,<br/>diária base] --> B[Análise<br/>POST /processos<br/>fila Bull]
  B --> C[Recomendação<br/>KNN + regras + evento<br/>motor v1, v2 em sombra]
  C --> D{Aplicar}
  D -->|manual| E[Anfitrião atualiza<br/>o preço no canal]
  D -->|Stays| F[preview, push, rollback<br/>escrita desligada por padrão]
  E --> G[Outcome<br/>reserva, receita, ocupação]
  F --> G
  G --> H[ROI e calibração]
  H -.-> C
```

1. **Onboarding** (rotas `free` na guarda de assinatura, [ADR 0014](./adr/0014-guarda-de-assinatura-e-registro-de-politicas.md)): importa o anúncio, cadastra o endereço (geocoding) e a diária base. Se a leitura do Airbnb falha, vale o que o anfitrião informa ([ADR 0010](./adr/0010-plano-b-do-scraping.md)).
2. **Análise**: o processamento é enfileirado (`POST /processos`, fila Bull `processos`); exige direito de uso (402 `SUBSCRIPTION_REQUIRED` se não houver; o front aguarda a ativação do plano).
3. **Recomendação**: `propriedade.service` combina classificação KNN, proximidade/atratividade do evento e regras do usuário; o v2 roda em sombra ([ADR 0015](./adr/0015-motor-de-preco-v2-em-sombra.md)) e o resultado vira `AnalisePreco`/`PricingDecisionSnapshot`.
4. **Aplicação**: manual, ou pela Stays com preview, push idempotente e rollback ([ADR 0016](./adr/0016-conector-stays-slug-escrita-desligada-rollback.md)); a auto-aplicação é um job com lock ([ADR 0017](./adr/0017-locks-distribuidos-para-jobs-agendados.md)).
5. **Outcome**: reserva, receita e ocupação alimentam o ROI e a calibração (`reservaStatus`, `OccupancyHistory`, `pricing-outcome-learning`).

### 10.3 Ingestão de eventos

Coletores e spiders → outbox SQLite ([ADR 0018](./adr/0018-entrega-confiavel-dos-coletores-outbox-sqlite.md)) → `POST /events/ingest` (chave de máquina) → dedup por `dedupHash`, geocoding, escopo de cobertura, enriquecimento (Gemini) → evento canônico → sinais de proximidade por imóvel. Detalhes na seção 3 e em `product/ARCHITECTURE.md` §6.1. O "dia" de um evento é o de São Paulo ([ADR 0013](./adr/0013-calendario-sao-paulo-para-todo-dia.md)).

### 10.4 Cobrança

Checkout Stripe → webhook `POST /payments/webhook` → `Payment` ativo → quota de imóveis e direito de uso lidos pela guarda de assinatura. Rotas de pagamento e planos são `free` para permitir comprar antes de ter assinatura.

### 10.5 Stays

Conta conectada por **slug** (sem URL livre), token criptografado, listagens sincronizadas; leituras com retry, escritas desligadas até `STAYS_PRICE_WRITES_ENABLED=true`; cada push gera `PriceUpdate` e pode ser revertido por um novo push com `origin=rollback` ([ADR 0016](./adr/0016-conector-stays-slug-escrita-desligada-rollback.md)).

### 10.6 Sessão

Login → cookies httpOnly (acesso 15 min, refresh 7 dias rotativo, reuso derruba todas as sessões) → renovação em `POST /auth/refresh` ([ADR 0012](./adr/0012-sessao-cookie-httponly-refresh-rotativo.md)).

## 11. Decisões: tomadas e em aberto

| ADR | Assunto | Status |
|---|---|---|
| [0011](./adr/0011-repositorio-publico-canonico.md) | Repositório público canônico e allowlist de escopo | Aceito |
| [0012](./adr/0012-sessao-cookie-httponly-refresh-rotativo.md) | Sessão em cookie httpOnly + refresh rotativo | Aceito |
| [0013](./adr/0013-calendario-sao-paulo-para-todo-dia.md) | Calendário de São Paulo para todo "dia" | Aceito |
| [0014](./adr/0014-guarda-de-assinatura-e-registro-de-politicas.md) | Guarda de assinatura (402) e registro de políticas | Aceito |
| [0015](./adr/0015-motor-de-preco-v2-em-sombra.md) | Motor de preço v2 em sombra | Aceito |
| [0016](./adr/0016-conector-stays-slug-escrita-desligada-rollback.md) | Conector Stays: slug, escrita desligada, rollback | Aceito |
| [0017](./adr/0017-locks-distribuidos-para-jobs-agendados.md) | Locks distribuídos e timeouts HTTP | Aceito |
| [0018](./adr/0018-entrega-confiavel-dos-coletores-outbox-sqlite.md) | Outbox SQLite dos coletores | Aceito |
| [0019](./adr/0019-quando-ligar-o-motor-v2.md) | Quando ligar `PRICING_ENGINE_V2=true` | **Em aberto** |
| [0020](./adr/0020-ask-urban-llm-ou-reposicionar.md) | Ask Urban: LLM ou reposicionar a cópia | **Em aberto** |
| [0021](./adr/0021-login-com-google.md) | Login com Google: concluir ou remover | **Em aberto** |
| [0022](./adr/0022-vercel-e-fluxo-bronze-do-prefect.md) | Vercel e fluxo bronze do Prefect | **Em aberto** |
| [0023](./adr/0023-stays-automatico-abaixo-de-1x.md) | Stays automático abaixo de 1,0× | **Em aberto** |
| [0024](./adr/0024-retencao-de-dados-pessoais.md) | Retenção de IP/user-agent, convite, dados de cobrança | **Em aberto** |
