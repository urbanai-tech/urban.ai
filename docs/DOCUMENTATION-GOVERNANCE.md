# Governança da documentação — Urban AI

**Revisão:** 2026-10-23 · **Owner:** Produto + Engenharia

## Regras

1. **Um documento canônico por assunto.** Documento superado é removido; o histórico do Git preserva o conteúdo. Não se mantêm cópias datadas, auditorias ou planos substituídos no caminho principal.
2. **Documento vivo não leva data no nome.** Datas ficam no cabeçalho (`Revisado: AAAA-MM-DD`). Runbooks e docs operacionais informam owner e data de revisão; revisar após uso real, incidente ou mudança de provedor.
3. **Fato errado leva banner.** Documento ativo com fatos desatualizados recebe no topo `> ⚠️ Desatualizado — ver X` até ser corrigido ou removido.
4. **ADRs e postmortems são imutáveis**; correções entram como adendo.
5. **Evidência não é requisito e não é versionada.** É produzida como artefato de CI (ver [`evidence/README.md`](./evidence/README.md)).
6. **Links internos são relativos** e o gate falha em link quebrado (`npm run audit:docs-links`). Antes de mover ou remover um arquivo, atualize os consumidores no mesmo PR.
7. **Sem dados sensíveis.** Nenhum segredo, dump, dado pessoal, IP ou URL de banco em docs (o repositório é público).
8. **Escopo público fechado.** `npm run gate:public-scope` mantém uma allowlist de pastas e arquivos; todo novo arquivo em `docs/` ou `scripts/` exige atualizar `scripts/public-scope-guard.js` conscientemente.

## Estrutura

```text
docs/
├── README.md                    índice
├── ARQUITETURA-ATUAL.md         estado atual de infra, deploy e integrações
├── ACESSOS-E-FERRAMENTAS.md     acessos por provedor
├── DOCUMENTATION-GOVERNANCE.md  este documento
├── adr/                         decisões arquiteturais
├── product/                     PRD, arquitetura interna, jornadas, design system, data/
├── contracts/                   contratos e fixtures de release (Event Radar)
├── ops/slo.md                   SLOs
├── lgpd/ e legal/               privacidade e documentos jurídicos
├── runbooks/                    operação executável (+ incident-response/)
├── postmortems/                 modelo e incidentes reais
├── e2e-reports/ e evidence/     destinos de relatórios gerados (apenas README versionado)
```

## Fontes canônicas

| Assunto | Fonte |
|---|---|
| Estado atual de infra, ambientes, deploy e integrações | `ARQUITETURA-ATUAL.md` |
| Acessos e ferramentas por provedor | `ACESSOS-E-FERRAMENTAS.md` |
| Variáveis de ambiente | `runbooks/matriz-env-operacional.md` |
| Arquitetura interna (módulos, entidades, fluxos) | `product/ARCHITECTURE.md` + `adr/` |
| Produto, jornadas, design system | `product/PRD.md`, `product/USER-JOURNEYS.md`, `product/DESIGN-SYSTEM.md` |
| Operação e go-live | `runbooks/` + `ops/slo.md` |
