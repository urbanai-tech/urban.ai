# Runbooks

Procedimentos executáveis de operação, validação, release, dados, integrações e resposta a incidentes. Cada runbook deve registrar owner, última validação e próximo prazo de revisão conforme a [governança documental](../DOCUMENTATION-GOVERNANCE.md).

Antes de qualquer runbook, leia [`../ARQUITETURA-ATUAL.md`](../ARQUITETURA-ATUAL.md) (estado atual de hosts, ambientes e deploy) e [`../ACESSOS-E-FERRAMENTAS.md`](../ACESSOS-E-FERRAMENTAS.md) (acessos e canais MCP/CLI). Runbooks com fatos que ficaram errados levam banner "⚠️ Desatualizado" no topo.

Entradas recomendadas:

- [Matriz operacional de ambientes](./matriz-env-operacional.md)
- [Release gate](./release-gate.md)
- [Compatibilidade e depreciação da API](./api-compatibility.md)
- [Controles LGPD e solicitações de titulares](./lgpd-data-subject-requests.md)
- [Observabilidade segura](./observability-security.md)
- [Autorização de rotas mutáveis e administrativas](./authorization-security.md)
- [Smoke tests operacionais](./smoke-tests-operacionais.md)
- [Go-live manual](./go-live-manual-checklist.md)
- [Disaster recovery](./disaster-recovery.md)
- [Backup off-site](./backup-offsite.md) (pendência operacional aberta)
- [Ingest de eventos via service account](./events-ingest-service-account-2026-05-22.md)
- [Saúde do cron do webscraping](./webscraping-cron-health.md)
- [Motor de demanda](./runbook-motor-demanda-2026-07.md)
- [SEO/GEO](./seo-geo-operacionalizacao-2026-05-19.md)

Para SLOs e referências do operador, consulte [`../ops/`](../ops/README.md).
