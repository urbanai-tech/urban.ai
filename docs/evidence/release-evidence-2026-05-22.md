# Release Evidence

Generated at: 2026-05-22T12:59:59.929Z

## Repository

- Path: `C:/Users/gusta/OneDrive/Documentos/GitHub/Urban AI`
- Branch: `main`
- SHA: `67dcaac985f4e76b6f04bd947d04f91614498d77`
- Short SHA: `67dcaac985f4`
- Commit date: 2026-05-22T06:57:14-03:00
- Commit subject: fix(frontend): install with legacy peer deps in docker

## Remotes

| Name | Type | URL |
| --- | --- | --- |
| origin | fetch | https://github.com/Gustavogm9/urban.ai.git |
| origin | push | https://github.com/Gustavogm9/urban.ai.git |
| urbanai-tech | fetch | https://github.com/urbanai-tech/urban.ai |
| urbanai-tech | push | https://github.com/urbanai-tech/urban.ai |

## Working Tree

Only git status codes and file paths are collected; file contents and environment variables are not read.

```text
## main...origin/main
 M .github/workflows/ci.yml
 M .github/workflows/release-gate.yml
 M Urban-front-main/package.json
 M Urban-front-main/src/app/componentes/ui/AskUrbanProvider.tsx
 M Urban-front-main/src/app/componentes/ui/PaceChart.tsx
 M Urban-front-main/src/app/dashboard/page.tsx
 M Urban-front-main/src/app/painel/page.tsx
 M Urban-front-main/src/app/portfolio/page.tsx
 M Urban-front-main/src/app/properties/[id]/market/components/AdrComparisonChart.tsx
 M Urban-front-main/src/app/properties/[id]/pricing-rules/components/PreviewStrip.tsx
 M Urban-front-main/src/app/properties/[id]/pricing-rules/components/PricingRuleCard.tsx
 M Urban-front-main/src/app/service/api.ts
 M docs/auditoria-confiabilidade-dados-graficos-relatorios-2026-05-21.md
 M docs/auditoria-mocks-hardcoded-admin-usuarios-2026-05-21.md
 M docs/auditoria-pwa-push-notifications-2026-05-21.md
 M docs/evidence/README.md
 M docs/runbooks/admin-evolution.md
 M docs/runbooks/backup-restore.md
 M docs/runbooks/matriz-env-operacional.md
 M docs/runbooks/smoke-tests-operacionais.md
 M docs/runbooks/stays-beta-private-smoke.md
 M docs/runbooks/stays-integration-setup.md
 M docs/runbooks/testing-strategy.md
 M package.json
 M urban-ai-backend-main/package.json
 M urban-ai-backend-main/src/admin/admin.service.ts
 M urban-ai-backend-main/src/email/email.module.ts
 M urban-ai-backend-main/src/email/weekly-event-report.service.ts
 M urban-ai-backend-main/src/evento/evento.module.ts
 M urban-ai-backend-main/src/evento/events-enrichment.service.ts
 M urban-ai-backend-main/src/evento/events-geocoder.service.ts
 M urban-ai-backend-main/src/evento/events-ingest.controller.ts
 M urban-ai-backend-main/src/host-panels/host-panels.service.ts
 M urban-ai-backend-main/src/knn-engine/dataset-collector.service.ts
 M urban-ai-backend-main/src/knn-engine/knn-engine.module.ts
 M urban-ai-backend-main/src/knn-engine/pricing-bootstrap.service.ts
 M urban-ai-backend-main/src/stays/stays-auto-apply.service.ts
 M urban-ai-backend-main/src/stays/stays.module.ts
?? Urban-front-main/e2e/ask-urban-entitlement.spec.ts
?? Urban-front-main/src/app/lib/date.ts
?? docs/auditoria-consolidada-dados-graficos-relatorios-2026-05-22.md
?? docs/evidence/enterprise-access-readiness-2026-05-22.md
?? docs/evidence/enterprise-auditabilidade-controles-2026-05-22.md
?? docs/evidence/enterprise-live-gate-dry-run-2026-05-22.md
?? docs/evidence/restore-drill-dry-run-2026-05-22.md
?? docs/plano-minucioso-enterprise-auditabilidade-2026-05-22.md
?? docs/runbooks/enterprise-auditability-live-gate-2026-05-22.md
?? docs/runbooks/events-ingest-service-account-2026-05-22.md
?? scripts/enterprise-access-readiness.js
?? scripts/enterprise-auditability-live-gate.js
?? urban-ai-backend-main/scripts/restore-drill-verify.js
?? urban-ai-backend-main/src/admin-job-runs/
?? urban-ai-backend-main/src/evento/events-ingest-api-key.guard.spec.ts
?? urban-ai-backend-main/src/evento/events-ingest-api-key.guard.ts
?? urban-ai-backend-main/src/host-panels/host-panels.service.spec.ts
?? urban-ai-backend-main/src/stays/stays-auto-apply.service.spec.ts
```

## GitHub CLI

- Status: GitHub CLI is available and authenticated.
- Version: gh version 2.86.0 (2026-01-21)
- Auth: Authenticated for github.com.
- Repository: Gustavogm9/urban.ai
- Repository URL: https://github.com/Gustavogm9/urban.ai
- Default branch: main
- Private: yes

### Recent Workflow Runs

| Run | Workflow | Branch | Event | Status | Conclusion | Updated | URL |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 26281178206 | CI | main | push | completed | failure | 2026-05-22T09:57:36Z | https://github.com/Gustavogm9/urban.ai/actions/runs/26281178206 |
| 26281177931 | Release gate - frontend tsc, build and Playwright | main | push | completed | failure | 2026-05-22T09:57:35Z | https://github.com/Gustavogm9/urban.ai/actions/runs/26281177931 |
| 26280931380 | Release gate - frontend tsc, build and Playwright | main | push | completed | failure | 2026-05-22T09:52:10Z | https://github.com/Gustavogm9/urban.ai/actions/runs/26280931380 |
| 26280931378 | CI | main | push | completed | failure | 2026-05-22T09:52:11Z | https://github.com/Gustavogm9/urban.ai/actions/runs/26280931378 |
| 26273113112 | Backup MySQL DB | main | schedule | completed | failure | 2026-05-22T06:53:03Z | https://github.com/Gustavogm9/urban.ai/actions/runs/26273113112 |

## Secret Hygiene

- Environment variables are not collected.
- File contents are not collected.
- Remote credentials and common token formats are redacted before output.
- GitHub CLI data is limited to repository, pull request, and workflow status metadata.
