# Railway status evidence - 2026-05-17

Generated from Railway MCP and direct public health checks on 2026-05-17.

## Scope

- Project: `backend`
- Environment: `production`
- Service: `urban.ai`
- Active deployment: `c8604305-4802-4e9e-99b2-a29e8f009309`
- Active commit: `f56b46a0eeeea8528b680d69045f30c7215a9a97`
- Status: `SUCCESS`
- Active deployments: `1`

The current feature branch commit `2efbc7bbc1ca991c614bd996f51a7dc241d8a785`
is pushed to GitHub but is not the active Railway production deployment yet.

## Health Checks

Direct checks against `https://urbanai-production-85fd.up.railway.app`:

- `GET /health`: `200 OK`, `status=ok`, `checks.db=ok`
- `GET /health/live`: `200 OK`, `status=ok`

## HTTP Sample

Railway HTTP sample:

- Total: `295`
- 2xx: `24`
- 3xx: `0`
- 4xx: `271`
- 5xx: `0`

Response time sample:

- p50: `63ms`
- p90: `128ms`
- p95: `132ms`
- p99: `254ms`

Most observed 404s were `HEAD /`, consistent with uptime or crawler probes
hitting the backend root rather than `/health`.

## Findings

No platform outage was observed: the deployment is successful, health checks
pass, DB responds, latency is low, and no 5xx responses were found in the
sample.

Operational warnings still need follow-up:

- Google Geocoding is returning `HTTP 403 REQUEST_DENIED`, which points to
  Google Cloud API enablement, billing, or server key restrictions.
- Price prediction fallback is logging repeated
  `dataset to predict must be an array or a matrix` messages, causing log
  volume pressure.
- MailerService logged an email failure with insufficient error detail
  (`[object Object]`), which should be made more diagnosable without exposing
  secrets or PII.

