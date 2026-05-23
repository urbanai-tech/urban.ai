# Curie Backend Staging Readiness - Radar de Eventos/Pricing

Data: 2026-05-23
Agente: Curie Backend Staging Readiness
Escopo: backend readiness, migrations TypeORM, boot/build, smoke seguro de Event Intelligence contra API real.

## Resumo executivo

O backend tem caminho claro para staging: migrations TypeORM versionadas, build Nest padrao e endpoints admin de Event Intelligence ja expostos atras de `JwtAuthGuard` + `RolesGuard` com role `admin`.

Criei um smoke seguro em `urban-ai-backend-main/scripts/event-intelligence-api-smoke.js`. Por padrao ele roda em `dry-run`: valida os endpoints GET reais de catalogo, detalhe e impacto, escolhe um `eventId` real e imprime o POST exato de recompute sem persistir novos snapshots. O recompute real fica opt-in via `--execute`, porque `POST /admin/events/:eventId/recompute-intelligence` grava `event_intelligence_snapshots`, `event_property_impacts` e, quando houver analises persistiveis, `pricing_decision_snapshots`.

## Arquivos alterados nesta frente

- `urban-ai-backend-main/scripts/event-intelligence-api-smoke.js`
- `urban-ai-backend-main/package.json`
- `squads/event-demand-pricing-radar/output/2026-05-23-roadmap-closure/backend-staging-readiness.md`

Observacao: `urban-ai-backend-main/package.json` ja tinha mudancas paralelas antes desta intervencao; nesta frente apenas acrescentei o script `smoke:event-intelligence`.

## Migrations TypeORM

Scripts disponiveis no backend:

```powershell
cd urban-ai-backend-main
npm run migration:show
npm run migration:run
npm run migration:revert
npm run audit:migrations
npm run audit:migrations:strict
```

Configuracao confirmada:

- DataSource CLI: `src/data-source.ts`.
- Migrations: `src/migrations/*{.ts,.js}`.
- Tabela de controle: `migrations`.
- `synchronize: false` no DataSource de migration.
- Boot Nest usa `DB_SYNCHRONIZE === 'true'` e `MIGRATIONS_RUN === 'true'`.

Migrations relevantes do roadmap:

- `1780600000000-CreateEventIntelligenceFoundation.ts`
  - cria `event_intelligence_snapshots`, `event_property_impacts`, `pricing_decision_snapshots`;
  - inclui indices de lookup por `jobRunId` e relacionamentos de auditoria.
- `1780700000000-AddAnalisePrecoVerificationFields.ts`
- `1780800000000-AddAirbnbObservationFieldsToPriceSnapshots.ts`

Recomendacao para staging:

```powershell
cd urban-ai-backend-main
npm run audit:migrations:strict
npm run migration:show
npm run migration:run
```

Nao rodei migration nem deploy nesta sessao.

## Start/build

Scripts confirmados:

```powershell
cd urban-ai-backend-main
npm run build
npm run start:prod
```

Scripts auxiliares ja existentes:

```powershell
npm run restore:verify:dry
npm run smoke:airbnb-headless
npm run preflight:track3:strict
```

Novo smoke:

```powershell
npm run smoke:event-intelligence
```

Validacao executada aqui:

```powershell
node scripts\event-intelligence-api-smoke.js --help
```

Resultado: passou. A primeira tentativa em sandbox falhou com `Acesso negado` ao `node.exe`; reexecutei com permissao elevada. Nao houve chamada de API.

## Env necessarias para staging

Minimo operacional de backend:

- `APP_ENV=staging`
- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL` ou `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `DB_SYNCHRONIZE=false`
- `MIGRATIONS_RUN=true` apenas se o deploy de staging deve aplicar migrations no boot; caso contrario, rodar `npm run migration:run` no job controlado.
- `JWT_SECRET`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TLS`
- `FRONT_BASE_URL`
- `CORS_ALLOWED_ORIGINS`
- `COOKIE_DOMAIN`
- `ENABLE_SWAGGER=true` em staging se desejarem Swagger para QA
- `SENTRY_DSN` recomendado

Para Event Intelligence e eventos:

- `GOOGLE_MAPS_API_KEY` para geocoding/distancia quando aplicavel.
- `GEMINI_API_KEY` para enriquecimento.
- `RAPIDAPI_KEY` e variaveis Airbnb quando o smoke incluir precos reais.
- Fontes de coleta opcionais conforme readiness: `SERPAPI_KEY`, `TAVILY_API_KEY`, `FIRECRAWL_API_KEY`.

Para o smoke API:

- `URBAN_API_BASE_URL` ou `API_BASE_URL`
- `ADMIN_BEARER_TOKEN`
- Opcionais: `EVENT_ID`, `EVENTS_FROM`, `EVENTS_TO`, `EVENTS_CITY`, `EVENTS_SOURCE`, `EVENTS_CATEGORY`, `EVENTS_SCOPE`, `EVENTS_LIMIT`

## Smoke seguro de Event Intelligence

Dry-run padrao, sem escrita:

```powershell
cd urban-ai-backend-main
$env:URBAN_API_BASE_URL="https://<staging-api>"
$env:ADMIN_BEARER_TOKEN="<jwt-admin>"
npm run smoke:event-intelligence -- --dry-run --limit 5
```

Com evento especifico, ainda sem escrita:

```powershell
npm run smoke:event-intelligence -- --dry-run --event-id "<event-id>"
```

O dry-run valida:

- `GET /admin/events/intelligence`
- `GET /admin/events/:eventId/intelligence`
- `GET /admin/events/:eventId/property-impact`

Recompute real, com escrita controlada em staging:

```powershell
npm run smoke:event-intelligence -- --execute --event-id "<event-id>"
```

Endpoint chamado no modo execute:

```text
POST /admin/events/:eventId/recompute-intelligence
```

Sinais esperados no retorno:

- `jobRunId` preenchido.
- `runtime.lockKey` preenchido.
- `runtime.lockProvider` como `mysql_advisory_lock` em MySQL real ou `in_process` em fallback.
- `runtime.attempts >= 1`.
- `writes`/`stats` com contadores de created/reused/skipped.
- Segunda execucao do mesmo cenario deve mostrar reuso/idempotencia de decision snapshot quando os sinais nao mudarem.

## Riscos e mitigacoes

- Recompute nao e dry-run no backend: o POST persiste snapshots. Mitigacao: smoke novo usa GET por padrao e exige `--execute`.
- Migration `178060...` cria tabelas e indices centrais. Mitigacao: rodar `audit:migrations:strict`, `migration:show` e aplicar primeiro em staging com backup/restore drill validado.
- `MIGRATIONS_RUN=true` no boot pode esconder falhas dentro do deploy. Mitigacao: preferir migration job explicito para o primeiro corte de staging.
- Token admin precisa ser real e ativo; `RolesGuard` busca role no DB, nao basta claim antiga no JWT.
- Dados de staging podem nao ter `AnalisePreco` persistivel para gerar impacts/pricing decisions. Mitigacao: usar `EVENT_ID` de evento com analises reais ou aceitar smoke parcial de catalogo/detalhe/impact vazio.
- Fila externa ainda nao existe para Event Intelligence; recompute segue sincrono com lock/retry curto. Para lote grande, usar filtros estreitos ou rodar fora de janela critica.

## Percentual Curie

- Backend readiness para staging controlado: **94%**.
- Smoke seguro/API readiness: **96%** depois do script novo, pendente apenas de execucao contra staging real.
- Release controlado do backend Radar/Pricing: **92%** ate migrations e smoke `--execute` passarem em staging com um evento real.

Nao marcaria 100% antes de: migration aplicada em staging, `smoke:event-intelligence --dry-run` passando com token admin real, um recompute `--execute` validado em evento controlado, e verificacao de duplicidade/idempotencia apos segunda rodada.
