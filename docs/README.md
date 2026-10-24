# Urban AI Docs

Índice da documentação. Revisão: 2026-10-23.

## Comece aqui

| Passo | Documento | Para quê |
|---|---|---|
| 1 | [`../README.md`](../README.md) | Visão geral do monorepo e setup local. |
| 2 | [`ARQUITETURA-ATUAL.md`](./ARQUITETURA-ATUAL.md) | **Fonte única do estado atual**: topologia, fluxos, integrações, ambientes, deploy, repositório canônico e pendências. |
| 3 | [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md) | Acessos por provedor, escopo mínimo e canal (MCP/CLI/API). |
| 4 | [`runbooks/matriz-env-operacional.md`](./runbooks/matriz-env-operacional.md) | Variáveis de ambiente lidas no código, por serviço (somente nomes). |
| 5 | [`runbooks/smoke-tests-operacionais.md`](./runbooks/smoke-tests-operacionais.md) | Como provar que o ambiente funciona (seção 11: validação inicial). |

## Mapa

| Área | Onde |
|---|---|
| Estado atual de infra e integrações | [`ARQUITETURA-ATUAL.md`](./ARQUITETURA-ATUAL.md) |
| Acessos e ferramentas | [`ACESSOS-E-FERRAMENTAS.md`](./ACESSOS-E-FERRAMENTAS.md) |
| Governança da documentação | [`DOCUMENTATION-GOVERNANCE.md`](./DOCUMENTATION-GOVERNANCE.md) |
| Decisões arquiteturais | [`adr/`](./adr/README.md) |
| Produto: PRD, arquitetura interna, jornadas, design system | [`product/`](./product/README.md) |
| Dados e IA (datasets, fontes de eventos) | [`product/data/`](./product/data/README.md) |
| Contratos e gates de release (Event Radar) | [`contracts/`](./contracts/event-radar-contract-v0.md) |
| SLOs | [`ops/slo.md`](./ops/slo.md) |
| Runbooks (operação, release, go-live, incidentes) | [`runbooks/`](./runbooks/README.md) |
| Resposta a incidentes | [`runbooks/incident-response/`](./runbooks/incident-response/README.md) |
| Postmortems | [`postmortems/_template.md`](./postmortems/_template.md) · [`incident-git-leak-2026-07.md`](./postmortems/incident-git-leak-2026-07.md) |
| LGPD | [`lgpd/dpa-checklist.md`](./lgpd/dpa-checklist.md) · documentos jurídicos em [`legal/`](./legal/) |
| Evidências (artefatos de CI) | [`evidence/README.md`](./evidence/README.md) |

## Histórico

Auditorias, planos, handoffs e relatórios datados que foram superados não fazem parte deste repositório; o histórico do Git preserva o conteúdo. Runbooks ativos com fatos errados levam o banner "Desatualizado" no topo apontando para a fonte atual.

## Regra de secrets

Não colocar tokens, senhas, JWTs, private keys, IPs ou URLs de banco com credenciais em docs, issues, commits ou chats. O repositório `urbanai-tech/urban.ai` é **público**. Aqui há apenas nomes de variáveis, origem do segredo e procedimento de acesso.

Se alguma chave foi colada em chat antigo, trate como exposta: rotacione no provedor e substitua no Railway, GitHub, Prefect, Cloudflare, Stripe, Google Cloud, Brevo ou no cofre de senhas.
