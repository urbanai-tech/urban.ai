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

Requisitos: Docker com Compose v2. Nada além disso é necessário para rodar.

```bash
docker compose up                       # MySQL 8.4, Redis 7, backend e front
docker compose --profile scraping up    # inclui o scrapyd (opcional, build pesado)
docker compose down -v                  # derruba tudo e apaga o banco local
```

- O primeiro `up` roda `npm ci` dentro dos containers e demora alguns minutos.
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

## 2. Validar antes de abrir PR

```bash
scripts/validate-local.sh              # tudo (padrão: --all)
scripts/validate-local.sh --backend    # ou --front, --webscraping, --pipeline, --root
```

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
