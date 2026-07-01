# Checklist de Validacao

Data base: 2026-07-01.

Use este checklist para provar que o ambiente esta bom antes de mexer em feature.

## 0. Pre-condicao Local

Liberar espaco em disco:

```powershell
Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" |
  Select-Object DeviceID,FreeSpace,Size
```

Meta minima: 5 GB livres. Recomendado: 10 GB.

## 1. Estado Git

```powershell
git status --short --branch
git remote -v
git branch -vv
git worktree list
```

Nao usar `git reset --hard` sem confirmar com Gustavo.

## 2. Opensquad

```powershell
npm run opensquad:check
```

Esperado: `Opensquad readiness check passed.`

## 3. Frontend

```powershell
npm --prefix Urban-front-main ci --legacy-peer-deps
npm --prefix Urban-front-main run typecheck
npm --prefix Urban-front-main run build
```

Status em 2026-07-01:

- typecheck passou.
- build falhou por `ENOSPC`, nao por erro confirmado de codigo.

Depois de liberar espaco, rerodar build.

## 4. Backend

```powershell
npm --prefix urban-ai-backend-main ci
npm --prefix urban-ai-backend-main run build
npm --prefix urban-ai-backend-main test -- --runInBand
npm --prefix urban-ai-backend-main audit --audit-level=high
```

Status em 2026-07-01:

- install passou.
- build passou.
- Jest falhou.
- audit encontrou 46 vulnerabilidades.

Falhas conhecidas para atacar:

- `dataset-collector.service.spec.ts` com `latestá`.
- specs de CSV com datas que ficaram no passado.
- `event-intelligence.service.spec.ts` expectativa de confidence.
- `airbnb-pricing-attempt-log.service.spec.ts` input sem `startedAt`/`finishedAt`.
- `ENOSPC` em cache Jest.

## 5. Dashboard Opensquad

```powershell
npm --prefix dashboard run build
```

Status em 2026-07-01: passou com warning de bundle grande.

## 6. Enterprise Access

Sem carregar `.env.staging`, o readiness parece bloqueado. Carregue via argumento suportado pelos scripts:

```powershell
node scripts/enterprise-access-readiness.js --env-file .env.staging
```

Com `.env.staging` atual em 2026-07-01:

- Enterprise live gate read-only: READY, mas JWT admin/host recomendados ausentes.
- Events ingest controlled smoke: READY.
- Restore drill verifier: BLOCKED por falta de `RESTORE_DATABASE_URL`.
- Stays sandbox: BLOCKED por falta de `STAYS_API_BASE_URL`.

## 7. Staging Read-only Gate

```powershell
node scripts/enterprise-auditability-live-gate.js `
  --env-file .env.staging `
  --env=staging `
  --strict `
  --skip-events-ingest
```

Status em 2026-07-01:

- backend.live: PASS.
- backend.health: PASS.
- frontend.root: PASS.
- admin.readonly: SKIP por falta de JWT.
- ask.entitlement: SKIP por falta de JWT.

Proximo passo: configurar `ENTERPRISE_GATE_ADMIN_JWT` e `ENTERPRISE_GATE_HOST_JWT`.

## 8. Track 3 Backend Preflight

```powershell
npm --prefix urban-ai-backend-main run preflight:track3
```

Status em 2026-07-01: 2/6 ready.

Bloqueios:

- Stripe billing sem Price IDs locais.
- Stays sem `STAYS_API_BASE_URL`.
- Suporte/LGPD sem owners.
- Admin/ops sem CORS/Sentry/Admin alert.

## 9. Depois dos Fixes

Quando tudo estiver pronto, gerar evidencia:

```powershell
node scripts/enterprise-access-readiness.js --env-file .env.staging --output docs/evidence/enterprise-access-readiness-staging-YYYY-MM-DD.md
node scripts/enterprise-auditability-live-gate.js --env-file .env.staging --env=staging --strict --output docs/evidence/enterprise-live-gate-staging-YYYY-MM-DD.md
```

Nunca escrever valores de secrets em evidencia.
