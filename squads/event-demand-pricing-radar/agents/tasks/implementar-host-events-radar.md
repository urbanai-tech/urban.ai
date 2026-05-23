# Task: Implementar experiencias host

## Objetivo

Criar as telas host `Eventos na Cidade` e `Radar de Eventos`.

## Entradas

- plano consolidado;
- contrato minimo;
- design system host atual;
- paginas atuais `/maps` e `/near-events`.

## Trabalho

1. Criar rota de catalogo (`/events` ou rota confirmada).
2. Criar rota de radar (`/event-radar` ou rota confirmada).
3. Adicionar metodos no client API para catalogo, detalhe, radar, heatmap e property impact.
4. Criar componentes:
   - EventCatalogCard;
   - EventRadarCard;
   - EventImpactTable;
   - PriceAbsorptionScenarios;
   - EventDemandHeatmapPlaceholder/adaptador.
5. Criar detalhe clicavel do evento.
6. Incluir estados loading/empty/error.
7. Usar mocks apenas se backend ainda nao estiver pronto e marcar claramente.

## Output esperado

- Rotas/telas criadas.
- Componentes criados.
- API dependencies listadas.
- Gaps de contrato.
- Como testar manualmente.

## Veto

- Nao misturar informacao operacional admin na UI host.
- Nao esconder incerteza de previsoes.
- Nao editar telas admin.
