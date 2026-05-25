# Enterprise Access Readiness

Generated at: 2026-05-25T10:18:02.372Z
Env file: process + default local env files

This file reports presence/absence only. Secret values are not printed.

## Summary

Ready groups: 0/4

| Group | Status | Missing Required | Missing Recommended |
| --- | --- | --- | --- |
| Enterprise live gate read-only | BLOCKED | ENTERPRISE_GATE_BACKEND_URL, ENTERPRISE_GATE_FRONTEND_URL | ENTERPRISE_GATE_ADMIN_JWT, ENTERPRISE_GATE_HOST_JWT |
| Events ingest controlled smoke | BLOCKED | ENTERPRISE_GATE_BACKEND_URL, ENTERPRISE_GATE_EVENTS_INGEST_KEY | none |
| Restore drill verifier | BLOCKED | RESTORE_DATABASE_URL | none |
| Stays sandbox/assisted account smoke | BLOCKED | STAYS_API_BASE_URL, STAYS_TOKEN_ENCRYPTION_KEY | STAYS_AUTO_APPLY_ENABLED, STAYS_AUTO_APPLY_DRY_RUN, STAYS_AUTO_APPLY_ALLOWED_USER_IDS, STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS |

## Details

### Enterprise live gate read-only

- Status: blocked
- Command when ready: `node scripts/enterprise-auditability-live-gate.js --env=staging --strict --skip-events-ingest --output docs/evidence/enterprise-live-gate-staging.md`

| Variable | Type | Present | Found as |
| --- | --- | --- | --- |
| ENTERPRISE_GATE_BACKEND_URL | required | no |  |
| ENTERPRISE_GATE_FRONTEND_URL | required | no |  |
| ENTERPRISE_GATE_ADMIN_JWT | recommended | no |  |
| ENTERPRISE_GATE_HOST_JWT | recommended | no |  |

### Events ingest controlled smoke

- Status: blocked
- Command when ready: `node scripts/enterprise-auditability-live-gate.js --env=staging --strict --allow-mutations --output docs/evidence/enterprise-live-gate-staging.md`

| Variable | Type | Present | Found as |
| --- | --- | --- | --- |
| ENTERPRISE_GATE_BACKEND_URL | required | no |  |
| ENTERPRISE_GATE_EVENTS_INGEST_KEY | required | no |  |

### Restore drill verifier

- Status: blocked
- Command when ready: `cd urban-ai-backend-main && node scripts/restore-drill-verify.js --output ../docs/evidence/restore-drill-YYYY-QX.md`

| Variable | Type | Present | Found as |
| --- | --- | --- | --- |
| RESTORE_DATABASE_URL | required | no |  |

### Stays sandbox/assisted account smoke

- Status: blocked
- Command when ready: `Seguir docs/runbooks/stays-beta-private-smoke.md com conta sandbox/assistida.`

| Variable | Type | Present | Found as |
| --- | --- | --- | --- |
| STAYS_API_BASE_URL | required | no |  |
| STAYS_TOKEN_ENCRYPTION_KEY | required | no |  |
| STAYS_AUTO_APPLY_ENABLED | recommended | no |  |
| STAYS_AUTO_APPLY_DRY_RUN | recommended | no |  |
| STAYS_AUTO_APPLY_ALLOWED_USER_IDS | recommended | no |  |
| STAYS_AUTO_APPLY_ALLOWED_LISTING_IDS | recommended | no |  |

## Next Step

Set the missing variables in the terminal/session, GitHub secrets, Railway variables or a local env file, then re-run this script. Do not paste secret values into chat or evidence files.

