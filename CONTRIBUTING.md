# Contribuindo com o Urban AI

Guia curto para quem vai desenvolver neste monorepo. Visão geral do produto e da
arquitetura: [`README.md`](./README.md) e [`docs/ARQUITETURA-ATUAL.md`](./docs/ARQUITETURA-ATUAL.md).

## Estrutura

| Pasta | O que é |
|---|---|
| `urban-ai-backend-main/` | API NestJS 11 + TypeORM/MySQL + Bull/Redis |
| `Urban-front-main/` | Frontend Next.js 15 |
| `urban-webscraping-main/` | Coletores de eventos (Scrapy/Scrapyd, Python com `uv`) |
| `urban-pipeline-main/` | Pipeline Prefect (Python com `uv`) |
| `docs/` | Arquitetura, runbooks, ADRs, contratos ([índice](./docs/README.md)) |
| `scripts/` | Gates e utilitários do repositório |

## 1. Subir o ambiente local

Requisitos para **rodar**: Docker com Compose v2 (dê ao Docker pelo menos ~8 GB de
RAM). Para **validar** (seção 2) o host também precisa de Node 20 e npm, e de `uv`
para os serviços Python. A versão está fixada em [`.nvmrc`](./.nvmrc) (`20`, a major
do CI e dos containers; `nvm use` / `fnm use` a seleciona) e nos `engines` dos
`package.json` (`>=20`); `npm run doctor` confere o Node contra o `.nvmrc`.

Antes do primeiro `up`, rode `npm run doctor` (`scripts/doctor.sh`): confere Node,
Docker, portas livres, `.env` e ferramentas opcionais, sem alterar nada.

```bash
docker compose up                       # MySQL 8.4, Redis 7, backend e front
docker compose --profile scraping up    # inclui o scrapyd (opcional, build pesado)
docker compose down -v                  # derruba tudo e apaga o banco local
```

- O primeiro `up` roda `npm ci` dentro dos containers e é **lento**: medido em
  Windows 11 com Docker Desktop (VM de ~7 GB), o backend levou ~31 min para
  responder `/health/live` (MySQL ~2 min; `npm ci`, 59 migrations e a primeira
  compilação do `nest start --watch` o resto) e a primeira requisição à home do
  front ~6 min a mais (Next compila sob demanda). Em Linux costuma ser bem menos.
  Subidas seguintes reaproveitam os volumes e levam poucos minutos. Reensaio de
  2026-10-27 (mesmo Windows, com outros ~20 containers de outros projetos rodando,
  Compose ANTES das mudanças desta seção): MySQL saudável em ~3 min, `npm ci` +
  59 migrations até ~34 min, e a compilação do `nest start --watch` ainda não tinha
  terminado aos 63 min (bind mount no Windows é limitado por I/O). O `frontend` agora
  só inicia quando o backend está `healthy` (não disputam CPU), as migrations/seed
  rodam com `TS_NODE_TRANSPILE_ONLY` e o cache do npm fica em volume próprio; a
  medição do boot com essas mudanças ainda não foi feita (ver docs/ENSAIO-DE-PASSAGEM.md).
- Para acompanhar sem adivinhar: `docker compose ps` (o backend fica
  `health: starting` até estar pronto) e `docker compose logs -f backend`
  (as linhas `Migration ... has been executed successfully` e depois
  `Starting compilation in watch mode` indicam as etapas). Pronto =
  `curl http://localhost:10000/health/live` retornando `{"status":"ok",...}`.
- Os serviços do Compose se chamam `mysql`, `redis`, `backend` e `frontend`
  (o `scrapyd` só com `--profile scraping`). Para subir só o essencial, em
  segundo plano: `docker compose up -d mysql redis backend frontend`.
- Não rode `nest build` (nem `scripts/validate-local.sh --backend`) no host com o
  Compose no ar: o código é um bind mount e ambos gravam `urban-ai-backend-main/dist`.
  Faça `docker compose down` antes. O comando `down -v` apaga também o banco local
  e os volumes de `node_modules`, e a próxima subida repete o `npm ci` demorado;
  use `docker compose down` (sem `-v`) para só parar.
- O backend roda `npm run migration:run` antes de iniciar (`synchronize` fica
  desligado) e depois `npm run start:dev` com hot reload.
- Backend: <http://localhost:10000> (`/health/live`; Swagger em `/api`).
  Front: <http://localhost:3000>.
- Todos os valores do `docker-compose.yml` são fictícios. Para trocar portas ou
  senhas locais, copie [`.env.example`](./.env.example) para `.env`.
- Variáveis de cada serviço: [`docs/runbooks/matriz-env-operacional.md`](./docs/runbooks/matriz-env-operacional.md).
  Chaves de terceiros (Stripe, Brevo, Google, etc.) não são necessárias para subir;
  as funcionalidades que dependem delas ficam inativas.
- Rodar migrations manualmente: `docker compose exec backend npm run migration:run`.

### Logar localmente (usuário de desenvolvimento)

O banco do Compose nasce vazio (só migrations). Para ter um login e telas
populadas, rode o seed de desenvolvimento, **idempotente** (pode repetir):

```bash
docker compose exec backend npm run seed:dev     # com o Compose no ar
SEED_DEV_ON_BOOT=true docker compose up -d       # ou semeia sozinho a cada boot (após as migrations)
```

Cria: um **anfitrião** e um **admin**, a assinatura ativa do anfitrião (sem ela as
rotas pagas respondem 402), 1 imóvel em Pinheiros (SP) com diária base R$ 320,
mínima R$ 250 e fim de semana R$ 420, 5 eventos futuros ao redor (de 3 a 33 dias
a partir de hoje; as datas são renovadas a cada execução), 3 sugestões de preço
(2 pendentes, 1 aceita) e 3 avisos. Com isso Hoje, Calendário, Imóveis, Eventos e
Avisos aparecem preenchidos.

| Papel | E-mail | Senha |
|---|---|---|
| Anfitrião | `host@urban.local` | `UrbanLocal#2026` |
| Admin | `admin@urban.local` | `UrbanLocal#2026` |

São valores **fictícios, só para o ambiente local**. O seed **recusa rodar** se `APP_ENV`/`NODE_ENV` não for
`development`/`dev`/`local`, se houver marcador de hospedagem (Railway, Vercel…)
ou se o banco não for `localhost`/`mysql`; nunca roda em produção ou staging.
A senha é tratada como no fluxo real: o front envia a senha em texto puro (só sob
TLS) e o hash é feito só no servidor (esquema v2, ver
[ADR 0025](docs/adr/0025-senha-em-claro-sob-tls-hash-no-servidor.md)). Para logar por
`curl` (o login limita 5 tentativas por minuto):

```bash
curl -i -X POST http://localhost:10000/auth/login -H 'Content-Type: application/json'   -d '{"email":"host@urban.local","password":"UrbanLocal#2026"}'   # 200/201 + Set-Cookie
```

## 2. Validar antes de abrir PR

```bash
scripts/validate-local.sh              # tudo (padrão: --all)
scripts/validate-local.sh --backend    # ou --front, --webscraping, --pipeline, --root
scripts/validate-local.sh --backend --skip-install   # sem reinstalar dependências
```

Por padrão o script reinstala tudo (`npm ci`, `uv sync`), como o CI. Com
`--skip-install` ele pula essas etapas quando `node_modules` (ou `.venv`) já existe
e o hash do lockfile bate com o gravado na última instalação feita pelo script
(`.validate-lock-stamp`); se o lockfile mudou, ou na primeira vez, instala
normalmente. Para rodar um único teste do backend:
`cd urban-ai-backend-main && npx jest src/caminho/arquivo.spec.ts`.

O script roda, em sequência, as mesmas verificações do CI
([`.github/workflows/ci.yml`](./.github/workflows/ci.yml)), imprime `nome=codigo`
por etapa e termina com um resumo; sai com código diferente de zero se algo
falhar. Funciona em Git Bash (Windows) e Linux. Os serviços Python exigem `uv`
(ou `python -m uv`). Não cobre E2E Playwright, smoke contra staging nem o
Gitleaks, que rodam só no CI.

## 3. Branches, commits e PRs

- Nunca commitar direto na `main`. Toda mudança entra por Pull Request.
- Branch: `<tipo>/<assunto-curto>` com data quando for lote de trabalho, por
  exemplo `fix/fuso-restante-2026-10-25` ou `feat/guard-assinatura-2026-10-25`.
- Commits em português no padrão Conventional Commits, com escopo:
  `fix(seguranca): ...`, `feat(backend): ...`, `chore(front): ...`,
  `docs(runbooks): ...`. Mensagem diz o que mudou e por quê, no imperativo/presente.
- Um PR por assunto. Descreva o problema, a solução e como foi validado (saída do
  `validate-local.sh`). Atualize `CHANGELOG.md`, a documentação e o `.env.example`
  do serviço no mesmo PR quando o comportamento ou as variáveis mudarem.
- Nunca incluir segredos, tokens, dumps de banco ou dados pessoais em código,
  docs, issues ou PRs: o repositório é público. O CI roda um scanner
  (`scripts/security-head-scan.js`) e o Gitleaks.

## 4. Banco de dados e migrations

- **Nunca** usar `synchronize` (`DB_SYNCHRONIZE` deve ser `false` em todo
  ambiente). Todo ajuste de schema é uma migration TypeORM em
  `urban-ai-backend-main/src/migrations/`.
- Fluxo: alterar a entity, gerar/escrever a migration (`npm run migration:generate`
  ou `migration:create`), conferir o SQL e aplicar com `npm run migration:run`.
- Rode `npm run audit:migrations:strict` (em `urban-ai-backend-main`): falha se
  houver entity sem migration correspondente. O CI também aplica todas as
  migrations em um MySQL limpo.
- Detalhes: [`docs/runbooks/migrations-audit.md`](./docs/runbooks/migrations-audit.md)
  e [`docs/runbooks/migrations-cutover.md`](./docs/runbooks/migrations-cutover.md).
- Não editar `src/stays/` sem alinhamento prévio com o time responsável.

## 5. Onde está a documentação

- Índice: [`docs/README.md`](./docs/README.md).
- Runbooks (operação, release, incidentes, backup/restore): [`docs/runbooks/`](./docs/runbooks/README.md).
- Decisões arquiteturais: [`docs/adr/`](./docs/adr/README.md).
- Links locais de docs são verificados: `node scripts/audit-document-links.js`.

## 6. Repositório canônico e escopo

- O repositório público **`urbanai-tech/urban.ai`** é o canônico para o código.
  CI, CodeQL e os gates rodam nele.
- O escopo do que pode existir no repositório público é uma allowlist em
  [`scripts/public-scope-guard.js`](./scripts/public-scope-guard.js)
  (`npm run gate:public-scope`). Arquivo novo na raiz, em `scripts/` ou em `docs/`
  fora das pastas já permitidas exige atualizar essa lista de forma consciente.
  Um hook de `pre-push` (`npm run hooks:install`) aplica o guarda antes de
  enviar para o repositório público.
- Mantenha cada PR pequeno, sem arquivos gerados e sem depender de pastas que
  não estejam neste repositório.
- Antes de publicar: `npm run gate:repository` e `gitleaks git --no-banner`
  (ver [`docs/ARQUITETURA-ATUAL.md`](./docs/ARQUITETURA-ATUAL.md), seção 8).
