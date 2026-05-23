# Task: Implementar contratos backend

## Objetivo

Criar a fundacao de dados e API para o plano de eventos, demanda e pricing.

## Entradas

- `docs/plano-consolidado-inteligencia-eventos-pricing-2026-05-22.md`
- `docs/plano-execucao-paralela-radar-eventos-2026-05-22.md`
- entidades atuais: `Event`, `AnalisePreco`, `PriceSnapshot`, `OccupancyHistory`, `EventProximityFeature`, `PriceUpdate`

## Trabalho

1. Mapear entidades existentes e evitar duplicacao.
2. Propor/criar entidades ou JSONs para:
   - `event_intelligence_snapshot`
   - `event_property_impact`
   - `pricing_decision_snapshot`
3. Criar DTOs/responses para:
   - catalogo host;
   - detalhe de evento;
   - intelligence detail;
   - property impact;
   - heatmap;
   - admin blind spots.
4. Criar endpoints skeleton reais para host/admin.
5. Deixar stubs claros quando o motor do Nico ainda nao estiver conectado.
6. Adicionar specs basicas de contrato quando viavel.

## Output esperado

- Arquivos alterados/criados.
- Lista de endpoints.
- Shape de response.
- Campos que dependem de Nico.
- Gaps/riscos.

## Veto

- Nao quebrar endpoints existentes.
- Nao usar mocks silenciosos sem nomear no codigo ou doc.
- Nao criar campos sem `generatedAt`/`confidence` para metricas de inteligencia.
