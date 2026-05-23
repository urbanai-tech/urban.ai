# Maya Host handoff - 2026-05-22

## Rotas criadas

- `/events`
- `/events/[eventId]`
- `/event-radar`

## Componentes criados

- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventCatalogCard.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventRadarCard.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventImpactTable.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/PriceAbsorptionScenarios.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/formatters.ts`

## API/sidebar

- Adicionado bloco host event radar em `Urban-front-main/src/app/service/api.ts`.
- Adicionado fallback temporario em `Urban-front-main/src/app/service/hostEventRadarMocks.ts`.
- Exportados componentes em `Urban-front-main/src/app/componentes/ui/index.ts`.
- Sidebar host recebeu `/event-radar` e `/events`.

## Mocks temporarios

- `hostEventRadarMocks.ts` cobre catalogo, radar, detalhe, heatmap, property impact e simulacao.
- O fallback so e usado para rede/404/501/503; 401/403 continuam subindo para o fluxo de auth/permissao.

## Gaps de contrato

- Confirmar shape final de `GET /host/events/catalog`.
- Confirmar shape final de `GET /host/events/radar`.
- Confirmar se detalhe deve vir unificado em `GET /host/events/:eventId` ou separado em intelligence/property-impact.
- Confirmar nomes reais para absorption scenarios e recommendedAction.
- Confirmar se heatmap vira celulas H3/bbox e se tera coordenadas/raio por celula.

## Validacao

- `node .\node_modules\typescript\bin\tsc --noEmit` passou.
- `node .\node_modules\eslint\bin\eslint.js "src/app/events/**/*.tsx" "src/app/event-radar/**/*.tsx" "src/app/componentes/ui/event-intelligence/**/*.tsx" "src/app/service/hostEventRadarMocks.ts"` passou.
- `git diff --check` passou; apenas avisos CRLF ja existentes.

## Bloqueio

- `npm` nao esta no PATH neste shell.
- `next dev -p 3000` iniciou, mas ficou preso em `Starting...` e nao abriu a porta 3000; processo encerrado para nao deixar servidor pendurado.
