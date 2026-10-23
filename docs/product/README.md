# Documentação de Produto — Urban AI

Documentos canônicos e vivos do produto. Mantidos atualizados conforme o sistema evolui.

Para onboarding de novo dev, comece por [`../handoff/README.md`](../handoff/README.md). Os documentos abaixo descrevem produto e arquitetura; o handoff descreve estado operacional, acessos/secrets, validações e pendências atuais.

| Documento | O que é | Quando usar |
|-----------|---------|-------------|
| [PRD.md](./PRD.md) | Product Requirements (v2.0): visão em 3 camadas, personas, funcionalidades com profundidade real, regras de negócio, métricas | Decidir escopo, priorizar features, onboarding de novos devs |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Arquitetura: serviços, módulos, grafo de integração, modelo de dados, fluxos críticos + anexo de features recentes em profundidade | Implementar features que cruzam módulos, revisar integrações |
| [USER-JOURNEYS.md](./USER-JOURNEYS.md) | Jornadas reais (extraídas dos E2E): caminho feliz, fricções, time-to-first-value, PWA/mobile | Melhorar onboarding/retenção, priorizar UX |
| [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md) | Design system: tokens (prontos para rebrand), tipografia, três superfícies, componentes, acessibilidade | Criar/revisar telas, manter consistência visual |
| [REBRAND-MAP.md](./REBRAND-MAP.md) | Mapa de troca de nome, domínio, cores e assets — para o rebrand ser mecânico | Quando o naming/identidade forem decididos |

| [data/README.md](./data/README.md) | Índice de dados, IA, datasets e fontes de eventos | Evoluir ingestão, proveniência e motores analíticos |

| Handoff operacional | O que é | Quando usar |
|---|---|---|
| [`../handoff/DEV-HANDOFF-2026-07-01.md`](../handoff/DEV-HANDOFF-2026-07-01.md) | Estado real do sistema em 2026-07-01 | Antes de qualquer novo dev mexer no projeto |
| [`../ACESSOS-E-FERRAMENTAS.md`](../ACESSOS-E-FERRAMENTAS.md) | Mapa de acessos por provedor, sem valores sensíveis | Ao transferir acesso para dev/operação |


**Última atualização:** 2026-07-01 (rev. 4 — handoff operacional adicionado; documentos de produto continuam baseados na varredura de 2026-06-21)
**Base de verdade (revalidada em 15/07/2026):** `urban-ai-backend-main/` (**36 controllers, 223 endpoints, 45 entidades cobertas, 48 migrations**), `Urban-front-main/` (**78 telas mapeadas; build atual gera 76 páginas/rotas**), `urban-pipeline-main/` e `urban-webscraping-main/`.

> Convenção: estes documentos descrevem **o que existe hoje no código** (verificado) e marcam claramente o que é **proposta/futuro**. Não confundir os dois. Para diagnóstico técnico e próximos passos operacionais, ver `../auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md` e `../plano-mestre-scorecard-10-10-2026-07-15.md`.
