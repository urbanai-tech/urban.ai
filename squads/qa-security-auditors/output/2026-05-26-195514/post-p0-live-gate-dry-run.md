# Enterprise Auditability Live Gate

Generated at: 2026-05-26T23:39:34.352Z
Run id: `enterprise-gate-20260526T233934350Z`
Environment: `staging`
Dry run: yes
Mutations allowed: no
Backend URL: `<backend-url>`
Frontend URL: `<frontend-url>`

## Summary

Pass: 0
Fail: 0
Skip: 4
Planned: 2

| Check | Status | Duration | Detail |
| --- | --- | --- | --- |
| backend.live | PLANNED | 0ms | GET <backend-url>/health/live |
| backend.health | SKIP | 0ms | Needs ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN. |
| frontend.root | PLANNED | 0ms | GET <frontend-url> |
| admin.readonly | SKIP | 0ms | Needs admin JWT. |
| ask.entitlement | SKIP | 0ms | Needs host JWT. |
| events.ingest | SKIP | 0ms | Needs ingest key or was skipped. |

## Detailed Results

### backend.live

- Status: planned
- Description: GET <backend-url>/health/live

### backend.health

- Status: skip
- Description: Needs ENTERPRISE_GATE_HEALTH_TOKEN or HEALTH_READINESS_TOKEN.

### frontend.root

- Status: planned
- Description: GET <frontend-url>

### admin.readonly

- Status: skip
- Description: Needs admin JWT.

### ask.entitlement

- Status: skip
- Description: Needs host JWT.

### events.ingest

- Status: skip
- Description: Needs ingest key or was skipped.

## Secret Hygiene

- JWTs, API keys, passwords and authorization headers are never printed.
- Mutating checks are skipped by default; staging mutation requires `--allow-mutations`.
- Production mutation also requires `ENTERPRISE_GATE_PROD_MUTATION_OK=YES`.
