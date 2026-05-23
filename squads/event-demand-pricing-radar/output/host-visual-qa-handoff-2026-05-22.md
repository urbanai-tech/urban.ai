# Host Visual QA - Radar de Eventos

Data: 2026-05-22

## Escopo executado

Atuei apenas nas telas e componentes Host permitidos:

- `Urban-front-main/src/app/events/`
- `Urban-front-main/src/app/event-radar/`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/`

Nao toquei admin, backend, `Urban-front-main/src/app/service/api.ts` ou E2E.

## Melhorias aplicadas

- Removi pontos de overflow em filtros Host usando `minWidth: 0`, containers com `overflow: hidden` e breakpoints mais conservadores.
- Melhorei responsividade do Radar Host em larguras intermediarias: coluna lateral passa a quebrar antes, e metric cards viram 2 colunas antes de cair para 1 coluna.
- Reforcei cards e componentes com `minWidth: 0`, `overflowWrap: anywhere`, `textOverflow: ellipsis` e limites para badges/categorias longas.
- Melhorei estados de loading em `/events` e `/event-radar` com skeletons leves e `role="status"`.
- Mantive empty/error states existentes e acrescentei feedback de carregamento para o filtro de imoveis no Radar.
- Ajustei a tabela de impacto para ficar mais segura no mobile: cards mobile, botao full-width em telas muito pequenas e grid de metricas em 1 coluna abaixo de 420px.
- Ajustei heatmap v0 para reduzir risco de labels/circulos estourarem no mobile.
- No detalhe do evento, adicionei fallback quando nao ha drivers explicaveis e humanizacao simples de risk flags.
- Adicionei `data-testid` leves em regioes principais: filtros, lista, mapa/calendario, heatmap, tabela de impacto, loading e cenarios de absorcao.

## Arquivos alterados

- `Urban-front-main/src/app/events/page.tsx`
- `Urban-front-main/src/app/events/[eventId]/page.tsx`
- `Urban-front-main/src/app/event-radar/page.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventCatalogCard.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventRadarCard.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventImpactTable.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/PriceAbsorptionScenarios.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx`

## Validacoes

- `node .\node_modules\eslint\bin\eslint.js src/app/events/page.tsx "src/app/events/[eventId]/page.tsx" src/app/event-radar/page.tsx src/app/componentes/ui/event-intelligence/EventCatalogCard.tsx src/app/componentes/ui/event-intelligence/EventRadarCard.tsx src/app/componentes/ui/event-intelligence/EventImpactTable.tsx src/app/componentes/ui/event-intelligence/PriceAbsorptionScenarios.tsx src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx`
  - Resultado: passou sem erros.

- `node .\node_modules\typescript\bin\tsc --noEmit`
  - Resultado: falhou por erro fora do escopo em `src/app/onboarding/page.tsx`, linha 1107, `cep: null` incompatível com `CreateAddressDto.cep: string`.
  - Nao alterei o arquivo por estar fora do ownership deste agente.

## Browser/visual

Tentei iniciar `npm run dev -- -p 3007` para validacao visual, mas o Next ficou preso em `Starting...` e a porta 3007 nao abriu, repetindo a lacuna ja registrada pela Maya. Encerrei o processo que eu iniciei e removi os logs temporarios.

Pendente para QA visual real:

- Abrir `/events`, `/events/[eventId]` e `/event-radar` em desktop e mobile quando o dev server estiver saudavel.
- Conferir se o `HostShell`/sidebar nao reduz demais a largura util em notebooks pequenos.
- Validar visual do heatmap com muitos pontos e nomes longos de categoria.
- Validar cards com nomes reais de eventos/imoveis muito longos.
