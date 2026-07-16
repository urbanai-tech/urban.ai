# Urban AI Docs

Ultima revisao operacional: 2026-07-15.

Este diretorio mistura documentos canonicos de produto, runbooks, evidencias de release, auditorias antigas e saidas do Opensquad. Para onboarding de um novo dev, comece pelo pacote de handoff abaixo.

## Entrada Recomendada

| Documento | Uso |
|---|---|
| [`handoff/README.md`](./handoff/README.md) | Indice do pacote para novo dev. |
| [`handoff/DEV-HANDOFF-2026-07-01.md`](./handoff/DEV-HANDOFF-2026-07-01.md) | Visao executiva, estado tecnico e ordem de trabalho. |
| [`handoff/ACCESS-SECRETS.md`](./handoff/ACCESS-SECRETS.md) | Mapa de acessos e secrets sem expor valores. |
| [`handoff/VALIDATION-CHECKLIST.md`](./handoff/VALIDATION-CHECKLIST.md) | Como provar que o ambiente esta funcionando. |
| [`handoff/BACKLOG-100.md`](./handoff/BACKLOG-100.md) | Pendencias para chegar no 100% operacional. |
| [`handoff/USER-ACTIONS-SCORECARD-10-10.md`](./handoff/USER-ACTIONS-SCORECARD-10-10.md) | Acoes externas do owner para certificar o 10/10 sem expor secrets. |
| [`handoff/CHAT-CONTEXT-SUMMARY.md`](./handoff/CHAT-CONTEXT-SUMMARY.md) | Resumo dos chats recentes que viraram decisao tecnica. |

## Documentos Canonicos

| Area | Documento |
|---|---|
| Auditoria 360 atual | [`auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md`](./auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md) |
| Plano mestre 10/10 | [`plano-mestre-scorecard-10-10-2026-07-15.md`](./plano-mestre-scorecard-10-10-2026-07-15.md) |
| Execução do scorecard | [`scorecard-10-10-execution-status.md`](./scorecard-10-10-execution-status.md) |
| Mapa visual do sistema | [`urban-ai-system-map-2026-07-15.html`](./urban-ai-system-map-2026-07-15.html) |
| Governanca documental | [`DOCUMENTATION-GOVERNANCE.md`](./DOCUMENTATION-GOVERNANCE.md) |
| Produto | [`product/README.md`](./product/README.md) |
| PRD | [`product/PRD.md`](./product/PRD.md) |
| Arquitetura | [`product/ARCHITECTURE.md`](./product/ARCHITECTURE.md) |
| Jornadas | [`product/USER-JOURNEYS.md`](./product/USER-JOURNEYS.md) |
| Design system | [`product/DESIGN-SYSTEM.md`](./product/DESIGN-SYSTEM.md) |
| Rebrand | [`product/REBRAND-MAP.md`](./product/REBRAND-MAP.md) |
| Dados e IA | [`product/data/README.md`](./product/data/README.md) |
| Negócio e sócios | [`product/business/README.md`](./product/business/README.md) |
| Operações e SLO | [`ops/README.md`](./ops/README.md) |
| Runbooks | [`runbooks/README.md`](./runbooks/README.md) |
| Matriz de envs | [`runbooks/matriz-env-operacional.md`](./runbooks/matriz-env-operacional.md) |

## Historico

Auditorias, planos, roadmaps e releases substituidos ficam em [`archive/`](./archive/README.md). Eles preservam contexto e evidencias, mas nao devem ser usados como fonte do estado atual sem conferir a auditoria 360 e o plano mestre.

O pacote Word legado foi triado em [`archive/docx/`](./archive/docx/README.md): 40 DOCX historicos foram arquivados e apenas 3 originais juridicos/LGPD permanecem ativos.

## Regra de Secrets

Nao colocar tokens, senhas, JWTs, private keys ou URLs de banco com credenciais em docs, issues, commits ou chats. Este repo deve conter apenas nomes de variaveis, status de presenca, origem do segredo e procedimento de acesso.

Se alguma chave foi colada em chat antigo, trate como exposta: rotacione no provedor e substitua por segredo novo no Railway, GitHub, Cloudflare, Stripe, Google Cloud, Brevo ou no cofre de senhas.
