# Handoff - Maya Host / Heatmap Host

Data: 2026-05-22
Frente: Maya Host / Heatmap Host
Escopo: telas Host `/event-radar` e componente compartilhado `event-intelligence`

## Arquivos alterados

- `Urban-front-main/src/app/event-radar/page.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx`

## Melhorias entregues

- Evolui o heatmap Host de placeholder/celulas v0 para uma camada acionavel de demanda:
  - bolhas por regiao com intensidade visual por score e potencial;
  - destaque de regiao selecionada quando o evento ativo pertence a celula;
  - legenda de calor com leitura "Muito quente", "Aquecida" e "Monitorar";
  - painel lateral de prioridade por regiao com score, potencial e imoveis impactados;
  - lista de eventos topo por celula com acao para selecionar o evento no radar;
  - acao para abrir detalhe do evento.
- Usei `cells + events + impactedProperties` ja existentes no payload/fallback, sem tocar em `api.ts` nem backend.
- Adicionei leitura de potencial por cidade:
  - eventos por cidade;
  - potencial consolidado;
  - quantidade de imoveis impactados;
  - eventos de alta demanda;
  - eventos sem geo dentro da cidade.
- Adicionei painel de imoveis mais expostos:
  - ranqueado por potencial incremental/esperado;
  - mostra quantidade de eventos que impactam cada imovel;
  - mostra melhor score observado para o imovel.
- Adicionei tratamento explicito para eventos sem geolocalizacao:
  - eles continuam entrando no potencial por cidade;
  - aparecem em bloco proprio para enriquecimento de latitude/longitude;
  - nao sao desenhados como bolha no mapa quando a geo esta incompleta.
- Criei estados robustos dentro do componente:
  - loading;
  - erro com retry;
  - vazio sem eventos/celulas;
  - eventos existentes sem celulas geograficas.
- Ampliei `data-testid` para QA:
  - `host-event-demand-heatmap-header`
  - `host-event-demand-heatmap`
  - `host-event-demand-heatmap-cell`
  - `host-event-demand-heatmap-region-panel`
  - `host-event-demand-heatmap-region-row`
  - `host-event-demand-heatmap-event-link`
  - `host-event-demand-heatmap-city-summary`
  - `host-event-demand-heatmap-property-impact`
  - `host-event-demand-heatmap-missing-geo`
  - `host-event-demand-heatmap-loading`
  - `host-event-demand-heatmap-error`
  - `host-event-demand-heatmap-empty`
  - `host-event-demand-heatmap-no-cells`
  - `host-event-demand-heatmap-legend`

## Integracao no Host Radar

- `/event-radar` agora passa `events`, `selectedEventId`, `onSelectCell`, `onSelectEvent` e `onOpenEvent` para o heatmap.
- Ao clicar em uma regiao, o radar seleciona o primeiro evento da celula que exista no payload atual e atualiza o painel de detalhe/curva.
- Ao clicar em um evento dentro do heatmap, o radar troca o evento selecionado sem navegar.
- A acao "Abrir evento" navega para `/events/{eventId}`.

## Validacoes

- Primeiro attempt com `node` no sandbox falhou com `Acesso negado`.
- Reexecutei com permissao elevada:
  - `node .\node_modules\eslint\bin\eslint.js src/app/event-radar/page.tsx src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx`
  - Resultado: passou.
- Reexecutei com permissao elevada:
  - `node .\node_modules\typescript\bin\tsc --noEmit --pretty false`
  - Resultado: passou.
- `git diff --check` nos arquivos alterados nao apontou erro de whitespace.

## Riscos e observacoes

- O mapa segue sendo uma visualizacao sintetica em canvas/HTML, nao um mapa geografico real com ruas, bairros ou tiles.
- O nome da regiao e inferido por `cellId` quando o backend nao manda um label dedicado. Para 100%, vale adicionar `regionName`, `city`, `state` e talvez `neighborhood` no DTO do heatmap.
- Eventos sem `latitude/longitude` aparecem no painel de enriquecimento, mas a qualidade depende do backend enviar cidade pelo menos.
- Como o dev server Next ja vinha ficando preso em `Starting...` nesta maquina, nao rodei validacao visual em browser real nesta frente. Os checks de tipo/lint passaram.

## Proximos passos

- Adicionar no contrato/backend campos de regiao: `regionName`, `city`, `state`, `neighborhood`, `geoConfidence`.
- Persistir motivo de falta de geo: endereco ausente, venue ambiguo, geocoder falhou ou cidade sem cobertura.
- Evoluir de bolhas sinteticas para mapa real quando houver lib/tile strategy definida.
- Adicionar asserts E2E para os novos test IDs e para o fluxo de selecionar regiao/evento.
- Rodar Playwright real em local/staging quando o dev server estiver estavel.

## Lista final de arquivos alterados

- `Urban-front-main/src/app/event-radar/page.tsx`
- `Urban-front-main/src/app/componentes/ui/event-intelligence/EventDemandHeatmapPlaceholder.tsx`
