# Urban AI V2 - Pacote de Auditoria, Produto e Operacao

Data: 2026-05-24  
Idioma: Portugues (Brasil)  
Escopo: documentos atuais, codigo, produto, arquitetura, rotas, operacao, narrativa executiva e carta para investidores.

## Como usar este pacote

Este pacote consolida o estado atual da Urban AI e vira a nova base de trabalho para uma V2 atualizada. Ele nao apaga o historico anterior: os roadmaps, DOCX, PDFs, runbooks e auditorias antigas continuam como evidencia de percurso. A diferenca e que aqui existe uma leitura unica, organizada por decisao.

## Entregaveis

| Arquivo | Para que serve |
|---|---|
| `auditoria-e-estado-atual.md` | Auditoria dos documentos existentes, o que esta forte, o que esta datado e quais lacunas devem ser fechadas. |
| `mapa-funcional-tecnico.md` | Mapa de funcionalidades, modulos, rotas, superficies, servicos, dados e contratos principais. |
| `prd-roadmap-v2.md` | PRD e plano de desenvolvimento V2 com fases, criterios de pronto, gates e prioridades. |
| `arquitetura-operacao-runbook.md` | Arquitetura alvo, fluxo de dados, operacao, manutencao, runbook, incidentes e governanca. |
| `material-executivo-e-carta-investidores.md` | Material executivo nao tecnico, resumo do que a Urban faz hoje, melhorias entregues e carta aos investidores. |

## Veredito consolidado

A Urban AI saiu de uma fase de transicao e dependencia de terceiros para uma plataforma propria, com frontend, backend, admin, billing, eventos, pricing, automacoes, runbooks, ADRs, evidencias de teste e fundacao para inteligencia proprietaria.

O estado atual e forte tecnicamente, especialmente para um produto em fase inicial: ha monorepo organizado, API NestJS, UI Next.js, radar de eventos, painel admin, Stays em beta controlado, Stripe, LGPD, evidencia de testes e runbooks de operacao. A diferenca para uma V2 madura nao e "criar mais telas". O trabalho central agora e transformar os dados e recomendacoes em decisoes auditaveis, mensuraveis e explicaveis.

## Principais mensagens

1. **Produto atual:** plataforma para anfitrioes e gestores de hospedagem identificarem eventos proximos, entenderem demanda local e receberem recomendacoes de preco.
2. **Diferencial:** inteligencia de eventos + pricing + geografia + operacao, com caminho para dataset proprietario e auto-aplicacao segura.
3. **Ponto forte:** muita infraestrutura ja esta feita: produto, admin, dados, governanca, runbooks e release gates.
4. **Lacuna central:** ainda e preciso consolidar staging real, dados reais de outcomes, calibracao de preco e evidencias de beta antes de prometer ganhos quantitativos amplos.
5. **V2 recomendada:** radar de demanda, `pricing_decision_snapshot`, outcomes reais, ROI por driver, operacao assistida e beta Stays seguro.

## Fonte de verdade recomendada

A partir deste pacote, usar:

- `prd-roadmap-v2.md` como roadmap de produto.
- `mapa-funcional-tecnico.md` como inventario vivo de modulos e rotas.
- `arquitetura-operacao-runbook.md` como manual de operacao.
- `material-executivo-e-carta-investidores.md` como base de apresentacao para socios e investidores.

Documentos antigos que continuam relevantes:

- `docs/adr/`
- `docs/runbooks/`
- `docs/evidence/`
- `docs/product/DESIGN-SYSTEM.md`
- `Urban-front-main/docs/design-system-guardrails.md`
- `docs/archive/reports/status-roadmap-analytics-eventos-pricing-2026-05-23.md`
- `docs/archive/reports/status-entregas-radar-eventos-2026-05-22.md`
- `docs/archive/audits/auditoria-consolidada-dados-graficos-relatorios-2026-05-22.md`
- `docs/archive/audits/avaliacao-inteligencia-analytics-relatorios-2026-05-22.md`
