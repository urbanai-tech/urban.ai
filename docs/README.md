# Urban AI Docs

Ultima revisao operacional: 2026-07-01.

Este diretorio mistura documentos canonicos de produto, runbooks, evidencias de release, auditorias antigas e saidas do Opensquad. Para onboarding de um novo dev, comece pelo pacote de handoff abaixo.

## Entrada Recomendada

| Documento | Uso |
|---|---|
| [`handoff/README.md`](./handoff/README.md) | Indice do pacote para novo dev. |
| [`handoff/DEV-HANDOFF-2026-07-01.md`](./handoff/DEV-HANDOFF-2026-07-01.md) | Visao executiva, estado tecnico e ordem de trabalho. |
| [`handoff/ACCESS-SECRETS.md`](./handoff/ACCESS-SECRETS.md) | Mapa de acessos e secrets sem expor valores. |
| [`handoff/VALIDATION-CHECKLIST.md`](./handoff/VALIDATION-CHECKLIST.md) | Como provar que o ambiente esta funcionando. |
| [`handoff/BACKLOG-100.md`](./handoff/BACKLOG-100.md) | Pendencias para chegar no 100% operacional. |
| [`handoff/CHAT-CONTEXT-SUMMARY.md`](./handoff/CHAT-CONTEXT-SUMMARY.md) | Resumo dos chats recentes que viraram decisao tecnica. |

## Documentos Canonicos

| Area | Documento |
|---|---|
| Produto | [`product/README.md`](./product/README.md) |
| PRD | [`product/PRD.md`](./product/PRD.md) |
| Arquitetura | [`product/ARCHITECTURE.md`](./product/ARCHITECTURE.md) |
| Jornadas | [`product/USER-JOURNEYS.md`](./product/USER-JOURNEYS.md) |
| Design system | [`product/DESIGN-SYSTEM.md`](./product/DESIGN-SYSTEM.md) |
| Rebrand | [`product/REBRAND-MAP.md`](./product/REBRAND-MAP.md) |
| Auditoria tecnica mais recente | [`reavaliacao-360-tecnica-proximos-passos-2026-06-21.md`](./reavaliacao-360-tecnica-proximos-passos-2026-06-21.md) |
| Matriz de envs | [`runbooks/matriz-env-operacional.md`](./runbooks/matriz-env-operacional.md) |

## Regra de Secrets

Nao colocar tokens, senhas, JWTs, private keys ou URLs de banco com credenciais em docs, issues, commits ou chats. Este repo deve conter apenas nomes de variaveis, status de presenca, origem do segredo e procedimento de acesso.

Se alguma chave foi colada em chat antigo, trate como exposta: rotacione no provedor e substitua por segredo novo no Railway, GitHub, Cloudflare, Stripe, Google Cloud, Brevo ou no cofre de senhas.
