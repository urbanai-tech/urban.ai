# Urban AI Docs

Última revisão do índice: 2026-10-23 (sincronização docs × realidade).

## Comece aqui

| Passo | Documento | Para quê |
|---|---|---|
| 1 | [`../README.md`](../README.md) | Visão geral do monorepo e setup local. |
| 2 | [`ARQUITETURA-ATUAL.md`](./ARQUITETURA-ATUAL.md) | **Fonte única do estado atual**: topologia, fluxos, integrações, ambientes, deploy, repositório canônico e pendências. |
| 3 | [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md) | Acessos por provedor, escopo mínimo e canal (MCP/CLI/API). |
| 4 | [`runbooks/matriz-env-operacional.md`](./runbooks/matriz-env-operacional.md) | Variáveis de ambiente lidas no código, por serviço (somente nomes). |
| 5 | [`runbooks/README.md`](./runbooks/README.md) | Procedimentos operacionais. |

## Documentos canônicos

| Área | Documento |
|---|---|
| Estado atual de infra e integrações | [`ARQUITETURA-ATUAL.md`](./ARQUITETURA-ATUAL.md) |
| Acessos e ferramentas | [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md) |
| Arquitetura interna (módulos, entidades, fluxos de negócio) | [`product/ARCHITECTURE.md`](./product/ARCHITECTURE.md) |
| Decisões arquiteturais | [`adr/README.md`](./adr/README.md) |
| Auditoria 360 | [`auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`](./auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md) |
| Plano mestre 10/10 | [`plano-mestre-scorecard-10-10-2026-07-15.md`](./plano-mestre-scorecard-10-10-2026-07-15.md) |
| Execução do scorecard | [`scorecard-10-10-execution-status.md`](./scorecard-10-10-execution-status.md) |
| Mapa visual do sistema (2026-07-15) | [`urban-ai-system-map-2026-07-15.html`](./urban-ai-system-map-2026-07-15.html) |
| Governança documental | [`DOCUMENTATION-GOVERNANCE.md`](./DOCUMENTATION-GOVERNANCE.md) |
| Produto | [`product/README.md`](./product/README.md) · [`PRD`](./product/PRD.md) · [`Jornadas`](./product/USER-JOURNEYS.md) · [`Design system`](./product/DESIGN-SYSTEM.md) · [`Rebrand`](./product/REBRAND-MAP.md) |
| Dados e IA | [`product/data/README.md`](./product/data/README.md) |
| Operações e SLO | [`ops/README.md`](./ops/README.md) |
| Runbooks | [`runbooks/README.md`](./runbooks/README.md) |
| Contratos de release | [`contracts/`](./contracts/event-radar-contract-v0.md) |
| LGPD | [`lgpd/dpa-checklist.md`](./lgpd/dpa-checklist.md) |
| Postmortems | [`postmortems/_template.md`](./postmortems/_template.md) |
| Evidências (append-only) | [`evidence/README.md`](./evidence/README.md) |

## Handoff 2026-07-01 (registro histórico com partes ainda úteis)

| Documento | Uso hoje |
|---|---|
| [`handoff/README.md`](./handoff/README.md) | Índice do pacote de handoff. |
| [`handoff/DEV-HANDOFF-2026-07-01.md`](./handoff/DEV-HANDOFF-2026-07-01.md) | Contexto de julho; estado atual de infra está em `ARQUITETURA-ATUAL.md`. |
| [`handoff/VALIDATION-CHECKLIST.md`](./handoff/VALIDATION-CHECKLIST.md) | Como provar que o ambiente funciona. |

Acessos por provedor: [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md).

## Histórico

Documentos ativos que ficaram desatualizados levam um banner "⚠️ Desatualizado" no topo apontando para a fonte atual. Auditorias, planos e roadmaps substituídos não fazem parte deste repositório.

## Regra de secrets

Não colocar tokens, senhas, JWTs, private keys, IPs ou URLs de banco com credenciais em docs, issues, commits ou chats. O repositório `urbanai-tech/urban.ai` é **público**. Este repositório contém apenas nomes de variáveis, origem do segredo e procedimento de acesso.

Se alguma chave foi colada em chat antigo, trate como exposta: rotacione no provedor e substitua no Railway, GitHub, Prefect, Cloudflare, Stripe, Google Cloud, Brevo ou no cofre de senhas.
