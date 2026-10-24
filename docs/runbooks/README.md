# Runbooks

Procedimentos executáveis de operação, validação, release, dados, integrações e resposta a incidentes. Cada runbook deve registrar owner e data de revisão ([governança](../DOCUMENTATION-GOVERNANCE.md)).

Antes de qualquer runbook, leia [`../ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md) (hosts, ambientes e deploy) e [`../ACESSOS-E-FERRAMENTAS.md`](../ACESSOS-E-FERRAMENTAS.md) (acessos e canais). Runbooks com fatos errados levam o banner "Desatualizado" no topo.

## Ambientes, release e go-live

- [Matriz operacional de variáveis de ambiente](./matriz-env-operacional.md)
- [Go-live: checklist único](./go-live-checklist.md)
- [Release gate](./release-gate.md) · [Event Radar release gate](./event-radar-release-gate.md)
- [Provisionamento de staging](./staging-provisioning.md) (inclui contas técnicas de smoke) · [Staging release drill](./staging-release-drill.md)
- [Modo pré-lançamento](./prelaunch-mode.md) · [Beta fechado assistido](./beta-fechado-assistido.md)
- [Smoke tests operacionais](./smoke-tests-operacionais.md) · [Estratégia de testes](./testing-strategy.md)

## Banco, backup e recuperação

- [Backup e restore](./backup-restore.md) · [Backup MySQL](./mysql-backup.md) · [Backup off-site](./backup-offsite.md) (pendência operacional aberta)
- [Disaster recovery](./disaster-recovery.md)
- [Cutover para migrations versionadas](./migrations-cutover.md) · [Auditor de migrations](./migrations-audit.md)
- [Incidentes](./incident-response/README.md): banco fora do ar, flow Prefect falhando, Scrapyd travado, rate limit do Brevo, Price ID do Stripe alterado

## Segurança, API e conformidade

- [Autorização de rotas](./authorization-security.md) · [Observabilidade segura](./observability-security.md)
- [Compatibilidade e depreciação da API](./api-compatibility.md) · [Migração de JWT para cookie](./jwt-cookie-migration.md)
- [Controles LGPD e solicitações de titulares](./lgpd-data-subject-requests.md) · [Suporte e LGPD no beta pago](./suporte-lgpd-beta-pago.md)
- [Onboarding de acessos](./access-onboarding.md) · [Assunção operacional](./assuncao-operacional.md)

## Eventos, dados e pricing

- [Ingest de eventos (API key e coletores)](./events-ingest-service-account.md) · [Saúde do cron do webscraping](./webscraping-cron-health.md)
- [Identidade e deduplicação de eventos](./event-dedup-identity.md) · [Recompute idempotente da inteligência de eventos](./event-intelligence-recompute-idempotency.md) · [Fallback manual de eventos](./eventos-fallback-manual.md) · [Backfill do geocoder](./backfill-geocoder.md) · [Datas de eventos e fuso horário](./datas-e-fuso-horario.md) (inclui backfill de datas) · [Coletores sem dados (zero-yield) e duplo agendamento](./coletores-zero-yield.md)
- [Evolução do motor de eventos](./event-engine-evolution.md) · [Motor de demanda](./motor-demanda.md)
- [Aquisição de dataset](./dataset-acquisition.md) · [Ground truth do dataset](./dataset-ground-truth-smoke.md) · [Feature engineering](./feature-engineering.md) · [Smoke de recomendação](./recomendacao-nova-smoke.md)
- [Integrações, outcomes e calibração](./integracoes-outcomes-calibracao.md) · [Contrato do Portfolio Cockpit](./portfolio-cockpit-contract.md)

## Integrações, cobrança e admin

- [Smoke Stripe e billing](./stripe-billing-smoke.md) · [Cobrança por imóvel](./f65-pricing-100pc.md) · [Smoke Brevo](./brevo-transactional-smoke.md)
- [Setup da integração Stays](./stays-integration-setup.md) · [Stays beta privado](./stays-beta-private-smoke.md)
- [Enterprise auditability live gate](./enterprise-auditability-live-gate.md) · [E2E admin + host](./e2e-admin-host-tester-completo.md) · [Evolução do painel admin](./admin-evolution.md)
- [SEO/GEO](./seo-geo-operacionalizacao.md) · [Framework de evidências de cases](./seo-case-evidence-framework.md)
- [Auditoria WCAG](./wcag-audit-checklist.md) · [Dívida de ESLint](./eslint-debt.md)

SLOs e referências do operador: [`../ops/slo.md`](../ops/slo.md).
