# Enterprise Auditability Live Gate

Generated at: 2026-05-25T10:18:02.577Z
Run id: `enterprise-gate-20260525T101802576Z`
Environment: `staging`
Dry run: yes
Mutations allowed: no
Backend URL: `<backend-url>`
Frontend URL: `<frontend-url>`

## Summary

Pass: 0
Fail: 0
Skip: 3
Planned: 3

| Check | Status | Duration | Detail |
| --- | --- | --- | --- |
| backend.live | PLANNED | 0ms | GET <backend-url>/health/live |
| backend.health | PLANNED | 0ms | GET <backend-url>/health |
| frontend.root | PLANNED | 0ms | GET <frontend-url> |
| admin.readonly | SKIP | 0ms | Needs admin JWT. |
| ask.entitlement | SKIP | 0ms | Needs host JWT. |
| events.ingest | SKIP | 0ms | Needs ingest key or was skipped. |

## Detailed Results

### backend.live

- Status: planned
- Description: GET <backend-url>/health/live

### backend.health

- Status: planned
- Description: GET <backend-url>/health

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

