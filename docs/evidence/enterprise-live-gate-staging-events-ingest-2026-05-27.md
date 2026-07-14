# Enterprise Auditability Live Gate

Generated at: 2026-05-27T15:30:32.949Z
Run id: `enterprise-gate-20260527T153032948Z`
Environment: `staging`
Dry run: no
Mutations allowed: yes
Backend URL: `https://urban-ai-backend-staging-staging.up.railway.app`
Frontend URL: `https://urban-ai-frontend-staging-staging.up.railway.app`

## Summary

Pass: 4
Fail: 0
Skip: 2
Planned: 0

| Check | Status | Duration | Detail |
| --- | --- | --- | --- |
| backend.live | PASS | 800ms | GET /health/live returns status ok |
| backend.health | PASS | 750ms | GET /health is fully ready |
| frontend.root | PASS | 739ms | Frontend root responds |
| admin.readonly | SKIP | 0ms | Admin read-only checks need ENTERPRISE_GATE_ADMIN_JWT or ADMIN_JWT. |
| ask.entitlement | SKIP | 0ms | AskUrban live checks need ENTERPRISE_GATE_HOST_JWT or HOST_JWT. |
| events.ingest | PASS | 268ms | POST /events/ingest creates/updates controlled smoke event |

## Detailed Results

### backend.live

- Status: pass
- Description: GET /health/live returns status ok

```json
{
  "statusCode": 200,
  "status": "ok",
  "uptimeSec": 91
}
```

### backend.health

- Status: pass
- Description: GET /health is fully ready

```json
{
  "statusCode": 200,
  "status": "ok",
  "env": "staging",
  "db": "ok"
}
```

### frontend.root

- Status: pass
- Description: Frontend root responds

```json
{
  "statusCode": 200,
  "bytes": 27918
}
```

### admin.readonly

- Status: skip
- Description: Admin read-only checks need ENTERPRISE_GATE_ADMIN_JWT or ADMIN_JWT.

### ask.entitlement

- Status: skip
- Description: AskUrban live checks need ENTERPRISE_GATE_HOST_JWT or HOST_JWT.

### events.ingest

- Status: pass
- Description: POST /events/ingest creates/updates controlled smoke event

```json
{
  "total": 1,
  "created": 1,
  "updated": 0,
  "skipped": 0,
  "resultStatus": "created",
  "auditLookup": "GET /admin/audit-logs?action=events.ingest.batch"
}
```

## Secret Hygiene

- JWTs, API keys, passwords and authorization headers are never printed.
- Mutating checks are skipped by default; staging mutation requires `--allow-mutations`.
- Production mutation also requires `ENTERPRISE_GATE_PROD_MUTATION_OK=YES`.
