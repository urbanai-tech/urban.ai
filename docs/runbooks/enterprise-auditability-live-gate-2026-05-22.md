# Runbook - enterprise auditability live gate

Data: 2026-05-22

Escopo: executar um gate reproduzivel para provar, em staging/producao, que os controles de dados, graficos e relatorios estao saudaveis antes de chamar a Urban AI de enterprise-auditable em ambiente real.

## O que o gate cobre

- Backend `/health/live`.
- Backend `/health` com status `ok`.
- Frontend respondendo HTTP menor que 400.
- Admin read-only: dashboard summary, jobs runs, audit logs e Stays health.
- AskUrban: `GET /ask/usage` com entitlement server-side e bloqueio de `POST /ask/question` quando `canUse=false`.
- Events ingest: smoke mutante controlado opcional em staging, nunca ligado por default.
- Evidencia markdown sem imprimir JWT, API key, senha ou token.

## Arquivo executavel

```text
scripts/enterprise-auditability-live-gate.js
```

Scripts:

```powershell
node Urban-front-main\scripts\staging-gate-preflight.mjs --gate enterprise-live-gate
npm run gate:enterprise:dry
npm run gate:enterprise -- --env=staging --strict --skip-events-ingest
```

## Variaveis

Obrigatorias para live run:

```text
ENTERPRISE_GATE_BACKEND_URL=https://<api>
ENTERPRISE_GATE_FRONTEND_URL=https://<app>
```

Recomendadas:

```text
ENTERPRISE_GATE_ADMIN_JWT=<jwt-admin-curto>
ENTERPRISE_GATE_HOST_JWT=<jwt-host-controlado>
ENTERPRISE_GATE_EVENTS_INGEST_KEY=<events-ingest-api-key>
```

O script tambem aceita aliases operacionais:

```text
BACKEND_BASE_URL
FRONTEND_BASE_URL
E2E_API_URL
E2E_BASE_URL
ADMIN_JWT
HOST_JWT
EVENTS_INGEST_API_KEY
```

## Dry-run local

```powershell
node scripts\enterprise-auditability-live-gate.js --dry-run
```

Criterio: deve imprimir checks planejados e pular checks que precisam de credencial. Nao acessa rede e nao muta dado.

## Staging read-only

```powershell
$env:ENTERPRISE_GATE_BACKEND_URL="https://api-staging.example.com"
$env:ENTERPRISE_GATE_FRONTEND_URL="https://app-staging.example.com"
$env:ENTERPRISE_GATE_ADMIN_JWT="<admin-jwt>"
$env:ENTERPRISE_GATE_HOST_JWT="<host-jwt>"

node scripts\enterprise-auditability-live-gate.js `
  --env=staging `
  --strict `
  --skip-events-ingest `
  --output docs/evidence/enterprise-live-gate-staging.md
```

Criterio:

- `backend.live` passa.
- `backend.health` passa com `status=ok`.
- frontend responde.
- checks admin read-only passam.
- Ask usage retorna contrato completo.
- se o usuario host estiver sem direito/quota, `ask.blocked-question` retorna 403/429.

## Staging com ingestao controlada

Rode apenas se o ambiente aceita evento smoke.

```powershell
$env:ENTERPRISE_GATE_EVENTS_INGEST_KEY="<events-ingest-api-key>"

node scripts\enterprise-auditability-live-gate.js `
  --env=staging `
  --strict `
  --allow-mutations `
  --output docs/evidence/enterprise-live-gate-staging.md
```

O payload cria/atualiza um evento `source=enterprise-live-gate` com `x-urban-ingest-run-id` unico. Depois confira:

```text
GET /admin/audit-logs?action=events.ingest.batch
GET /admin/events/list?source=enterprise-live-gate
```

## Producao

Padrao recomendado:

```powershell
node scripts\enterprise-auditability-live-gate.js `
  --env=production `
  --strict `
  --skip-events-ingest `
  --output docs/evidence/enterprise-live-gate-production.md
```

Mutacao em producao e bloqueada por default. So rode ingestao em producao se houver janela assistida e estas duas travas:

```powershell
$env:ENTERPRISE_GATE_PROD_MUTATION_OK="YES"
node scripts\enterprise-auditability-live-gate.js --env=production --strict --allow-mutations
```

## GitHub Actions

O workflow `.github/workflows/release-gate.yml` tem job manual:

```text
enterprise-live-gate
```

Ele agora tambem pode passar por PR/push de branch interna, mas o passo real so
executa quando o preflight encontra URLs de staging e identidade admin + host.
Sem essas variaveis/secrets, o job registra skip seguro no summary e nao roda
login, Playwright ou live gate.

Variaveis/segredos minimos para sair do skip:

```text
vars.E2E_API_URL ou vars.ENTERPRISE_GATE_BACKEND_URL
vars.E2E_BASE_URL ou vars.ENTERPRISE_GATE_FRONTEND_URL
secrets.ENTERPRISE_GATE_ADMIN_JWT ou secrets.ENTERPRISE_GATE_ADMIN_EMAIL/PASSWORD
secrets.ENTERPRISE_GATE_HOST_JWT ou secrets.ENTERPRISE_GATE_HOST_EMAIL/PASSWORD
```

Fallbacks para `E2E_AUTH_EMAIL/PASSWORD` continuam aceitos para ambientes de
staging controlados, mas os valores nunca sao impressos em log/evidencia.

## Resultado esperado

O release fica bloqueado quando:

- qualquer check retorna `FAIL`;
- `--strict` encontra check essencial pulado por falta de credencial;
- `/health` esta `degraded`;
- AskUrban nao retorna `canUse/plan/reason/quota/hardCap`;
- admin read-only nao autentica;
- ingestao mutante em staging nao gera batch idempotente/auditavel.

O release pode seguir quando o arquivo em `docs/evidence/` registra ambiente, run id, comandos e todos os checks obrigatorios como `PASS`.
