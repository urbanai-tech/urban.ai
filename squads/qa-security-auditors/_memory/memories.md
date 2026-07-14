# Squad Memory: Squad QA & Security Auditors
## Estilo de Escrita
## Design Visual
## Estrutura de Conteúdo
## Proibições Explícitas
## Técnico (específico do squad)
- 2026-05-26: P0 implementado localmente apos auditoria. Login Google agora exige token/idToken validado server-side contra Google e `GOOGLE_CLIENT_ID`; contas locais nao sao convertidas silenciosamente por login social.
- 2026-05-26: `/health/live` permanece publico, mas `/health` detalhado exige `HEALTH_READINESS_TOKEN`/`ENTERPRISE_GATE_HEALTH_TOKEN` em staging/prod; live gate/readiness foram atualizados para bloquear sem esse token.
- 2026-05-26: Radar de eventos admin/host agora expoe `dataStatus`, `jobRunId`, `modelVersion`, `metricVersion` e flags; leituras derivadas/mock aparecem como nao totalmente auditaveis.
- 2026-05-26: Restore drill real falha quando `admin_job_runs` ou `admin_audit_logs` estao ausentes/vazios; dry-runs pos-P0 salvos em `squads/qa-security-auditors/output/2026-05-26-195514/`.
