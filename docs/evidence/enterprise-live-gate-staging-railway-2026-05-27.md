# Enterprise Auditability Live Gate

Generated at: 2026-05-27T15:21:19.165Z
Run id: `enterprise-gate-20260527T152119164Z`
Environment: `staging`
Dry run: no
Mutations allowed: no
Backend URL: `https://urban-ai-backend-staging-staging.up.railway.app`
Frontend URL: `https://urban-ai-frontend-staging-staging.up.railway.app`

## Summary

Pass: 2
Fail: 0
Skip: 4
Planned: 0

| Check | Status | Duration | Detail |
| --- | --- | --- | --- |
| backend.live | PASS | 994ms | GET /health/live returns status ok |
| backend.health | SKIP | 0ms | Detailed /health needs ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN. |
| frontend.root | PASS | 769ms | Frontend root responds |
| admin.readonly | SKIP | 0ms | Admin read-only checks need ENTERPRISE_GATE_ADMIN_JWT or ADMIN_JWT. |
| ask.entitlement | SKIP | 0ms | AskUrban live checks need ENTERPRISE_GATE_HOST_JWT or HOST_JWT. |
| events.ingest | SKIP | 0ms | Skipped by --skip-events-ingest. |

## Detailed Results

### backend.live

- Status: pass
- Description: GET /health/live returns status ok

```json
{
  "statusCode": 200,
  "status": "ok",
  "uptimeSec": 51819
}
```

### backend.health

- Status: skip
- Description: Detailed /health needs ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN.

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

- Status: skip
- Description: Skipped by --skip-events-ingest.

## Secret Hygiene

- JWTs, API keys, passwords and authorization headers are never printed.
- Mutating checks are skipped by default; staging mutation requires `--allow-mutations`.
- Production mutation also requires `ENTERPRISE_GATE_PROD_MUTATION_OK=YES`.
