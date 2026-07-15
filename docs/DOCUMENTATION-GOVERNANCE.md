# Governança da documentação — Urban AI

**Vigência:** 2026-07-15  
**Owner:** Produto + Engenharia  
**Objetivo:** manter uma fonte canônica por assunto, preservar evidências e retirar versões superadas do caminho principal.

## 1. Regra principal

Cada assunto possui **um documento canônico atual**. Auditorias, planos e relatórios datados são registros históricos; quando substituídos, vão para `docs/archive/` e apontam para a fonte atual.

## 2. Estrutura-alvo

```text
docs/
├── README.md                          índice principal
├── auditoria-360-*.md                fotografia atual do sistema
├── plano-mestre-scorecard-10-10-*.md plano de evolução vigente
├── scorecard-10-10-execution-status.md execução e evidências
├── urban-ai-system-map-*.html        mapa visual navegável
├── product/                           PRD, arquitetura, jornadas e design system
│   ├── data/                          datasets, fontes e motores analíticos
│   └── business/                      contexto empresarial e stakeholders
├── ops/                               SLOs e referências do operador
├── adr/                               decisões arquiteturais imutáveis
├── handoff/                           onboarding e transferência operacional
├── runbooks/                          operação executável
├── evidence/                          provas de execução, nunca requisitos
├── contracts/                         contratos e gates de release
├── legal/ e lgpd/                     documentos jurídicos e privacidade
├── postmortems/                       incidentes e aprendizados
└── archive/
    ├── audits/                        auditorias substituídas
    ├── plans/                         planos concluídos ou substituídos
    ├── roadmaps/                      roadmaps históricos
    ├── reports/                       relatórios e status históricos
    ├── data/                          snapshots e estratégias de dados
    ├── design/                        design systems substituídos
    ├── docx/                          pacote Word legado inventariado
    └── releases/                      release notes históricas
```

## 3. Fontes canônicas atuais

| Assunto | Fonte |
|---|---|
| Auditoria atual | `auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md` |
| Plano de evolução | `plano-mestre-scorecard-10-10-2026-07-15.md` |
| Visão visual | `urban-ai-system-map-2026-07-15.html` |
| Produto | `product/PRD.md` |
| Arquitetura | `product/ARCHITECTURE.md` + `adr/` |
| Jornadas | `product/USER-JOURNEYS.md` |
| Design system | `product/DESIGN-SYSTEM.md` |
| Estado dos gaps | plano 10/10; snapshot anterior em `archive/audits/gaps-reais-atualizados-2026-07.md` |
| Operação | `handoff/` + `ops/` + `runbooks/` |
| Evidência | `evidence/` e relatórios E2E datados |

## 4. Ciclo de vida

1. **Draft:** documento em construção, com owner e data.
2. **Canonical:** listado em `docs/README.md`.
3. **Superseded:** substituído, com indicação explícita da nova fonte.
4. **Archived:** movido para `docs/archive/`; conteúdo preservado.
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

### Onda A — aplicada em 2026-07-15

Arquivar documentos datados com zero referências internas, agrupados por auditorias, planos, roadmaps e releases.

### Onda B — em execução desde 2026-07-15

Sete snapshots adicionais de auditoria, plano e status foram movidos após atualização dos consumidores e inclusão do banner `SUPERSEDED`. Continuar em lotes pequenos, sempre com o gate de links verde.

### Onda C — aplicada em 2026-07-15

Os 43 DOCX reais foram inventariados por hash e conteúdo. Quarenta documentos técnicos, relatórios, planos e material de revisão restrita foram movidos para `archive/docx/`; três originais jurídicos/LGPD permanecem ativos. Não havia duplicatas binárias exatas. A renderização visual em lote ficou indisponível por ausência do LibreOffice, registrada no inventário.

### Onda D — aplicada em 2026-07-15

O design system foi consolidado em `product/DESIGN-SYSTEM.md`; 21 auditorias, planos, roadmaps, relatórios e snapshots foram preservados com banner `SUPERSEDED`; 9 documentos ativos foram redistribuídos entre `product/{data,business}/`, `ops/` e `runbooks/`. A raiz passou de 35 para 5 entrypoints Markdown, com consumidores recalculados para os novos caminhos.

## 9. Critério de limpeza concluída

- Raiz de `docs/` com no máximo 10 entrypoints ativos.
- Uma fonte canônica por assunto.
- Zero links internos quebrados.
- Zero dados pessoais, dumps ou secrets no HEAD e no histórico publicado.
- Histórico preservado e pesquisável em `archive/`.
- Gate automatizado no CI.
