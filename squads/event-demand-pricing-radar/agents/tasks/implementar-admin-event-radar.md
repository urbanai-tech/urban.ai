# Task: Implementar admin event intelligence

## Objetivo

Evoluir o admin para enxergar demanda potencial, blind spots, impacto financeiro e qualidade do motor de eventos.

## Entradas

- plano consolidado;
- contrato minimo;
- pagina atual `/admin/events`;
- componentes admin existentes.

## Trabalho

1. Criar `/admin/event-radar` ou aba/visao em `/admin/events`.
2. Adicionar API client admin para intelligence, heatmap, property impact e blind spots.
3. Criar KPIs:
   - demanda potencial;
   - eventos alto potencial;
   - propriedades impactadas;
   - eventos sem pricing;
   - confianca media;
   - cobertura ponderada.
4. Criar tabela priorizada por potencial.
5. Criar blind spots.
6. Criar detalhe admin de evento com dados brutos e interpretacao.
7. Incluir links para eventos, coletores, coverage, jobs quando fizer sentido.

## Output esperado

- Tela/aba criada.
- KPIs/tabelas/filtros.
- Gaps de endpoint.
- Como testar.

## Veto

- Nao colocar dados internos na tela host.
- Nao duplicar regra de scoring no frontend se puder consumir backend.
- Nao editar backend scoring.
