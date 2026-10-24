# Governança da documentação — Urban AI

**Vigência:** 2026-07-15  
**Owner:** Produto + Engenharia  
**Objetivo:** manter uma fonte canônica por assunto, preservar evidências e retirar versões superadas do caminho principal.

## 1. Regra principal

Cada assunto possui **um documento canônico atual**. Auditorias, planos e relatórios datados são registros históricos; quando substituídos, recebem banner `SUPERSEDED` e apontam para a fonte atual.

## 2. Estrutura-alvo

```text
docs/
├── README.md                          índice principal
├── ARQUITETURA-ATUAL.md               estado atual de infra, deploy e integrações
├── ACESSOS-E-FERRAMENTAS.md           acessos por provedor e canal MCP/CLI
├── auditoria-360-*.md                fotografia atual do sistema
├── plano-mestre-scorecard-10-10-*.md plano de evolução vigente
├── scorecard-10-10-execution-status.md execução e evidências
├── urban-ai-system-map-*.html        mapa visual navegável
├── product/                           PRD, arquitetura, jornadas e design system
│   └── data/                          datasets, fontes e motores analíticos
├── ops/                               SLOs e referências do operador
├── adr/                               decisões arquiteturais imutáveis
├── handoff/                           onboarding e transferência operacional
├── runbooks/                          operação executável
├── evidence/                          provas de execução, nunca requisitos
├── contracts/                         contratos e gates de release
├── legal/ e lgpd/                     documentos jurídicos e privacidade
└── postmortems/                       incidentes e aprendizados
```

## 3. Fontes canônicas atuais

| Assunto | Fonte |
|---|---|
| Auditoria atual | `auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md` |
| Plano de evolução | `plano-mestre-scorecard-10-10-2026-07-15.md` |
| Visão visual | `urban-ai-system-map-2026-07-15.html` |
| Produto | `product/PRD.md` |
| Estado atual de infra, ambientes, deploy e integrações | `ARQUITETURA-ATUAL.md` |
| Acessos e ferramentas por provedor | `ACESSOS-E-FERRAMENTAS.md` |
| Variáveis de ambiente | `runbooks/matriz-env-operacional.md` |
| Arquitetura interna (módulos, entidades, fluxos) | `product/ARCHITECTURE.md` + `adr/` |
| Jornadas | `product/USER-JOURNEYS.md` |
| Design system | `product/DESIGN-SYSTEM.md` |
| Estado dos gaps | plano 10/10 |
| Operação | `runbooks/` + `ops/` (`handoff/` é registro de 2026-07-01) |
| Evidência | `evidence/` e relatórios E2E datados |

## 4. Ciclo de vida

1. **Draft:** documento em construção, com owner e data.
2. **Canonical:** listado em `docs/README.md`.
3. **Superseded:** substituído, com indicação explícita da nova fonte.
3a. **Desatualizado (banner):** documento ativo com fatos errados recebe no topo `> ⚠️ Desatualizado — ver X` até ser corrigido ou arquivado.
4. **Archived:** retirado do caminho principal do repositório; o histórico Git preserva o conteúdo.
5. **Deleted:** somente duplicata binária comprovada, segredo ou dado pessoal, após aprovação.

## 5. Metadados mínimos

Todo documento novo deve informar data, owner, status e relação com a fonte canônica. Documentos operacionais também precisam de última validação e próximo prazo de revisão.

## 6. Política de atualização

- PRD, arquitetura, jornadas e design system: revisão mensal ou após mudança material.
- Auditoria 360 e scorecard: revisão ao final de cada fase do plano.
- Runbooks: revisão após uso real, incidente ou mudança de provedor.
- Evidências: append-only; não editar para “melhorar” um resultado histórico.
- ADRs e postmortems: imutáveis; correções por adendo.

## 7. Política de links

- Links internos devem ser relativos.
- Antes de mover qualquer arquivo, contar referências e atualizar consumidores no mesmo PR.
- O gate documental deve falhar em link quebrado, título duplicado canônico ou arquivo datado novo na raiz sem justificativa.

## 8. Migração

### Ondas A–D — aplicadas em 2026-07-15

Documentos datados superados foram retirados da raiz de `docs/` ou receberam banner `SUPERSEDED`, o design system foi consolidado em `product/DESIGN-SYSTEM.md` e o pacote Word legado foi inventariado por hash e conteúdo (sem duplicatas binárias exatas). A raiz passou de 35 para 5 entrypoints Markdown, com consumidores recalculados.

### Onda E — aplicada em 2026-10-23

Sincronização docs × realidade: criados `ARQUITETURA-ATUAL.md` e `ACESSOS-E-FERRAMENTAS.md` (canônicos, sem data no nome por serem documentos vivos), matriz de envs refeita a partir do código, adendos nos ADRs 0001/0003/0005 e banner "⚠️ Desatualizado" em runbooks e handoffs que ficaram errados. Nada foi apagado ou movido nesta onda.

## 9. Critério de limpeza concluída

- Raiz de `docs/` com no máximo 10 entrypoints ativos.
- Uma fonte canônica por assunto.
- Zero links internos quebrados.
- Zero dados pessoais, dumps ou secrets no HEAD e no histórico publicado.
- Histórico preservado e pesquisável no Git.
- Gate automatizado no CI.
