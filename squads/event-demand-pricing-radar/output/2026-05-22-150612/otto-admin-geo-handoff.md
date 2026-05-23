# Otto Admin / Geo Ops Heatmap - Handoff

Data: 2026-05-22

## Arquivos alterados

- `Urban-front-main/src/app/admin/event-radar/page.tsx`
- `squads/event-demand-pricing-radar/output/2026-05-22-150612/otto-admin-geo-handoff.md`

## Melhorias entregues

- Adicionado filtro local `Foco Geo Ops` para separar a leitura do heatmap em: todos, hotspots, gaps de cobertura, eventos sem geo e maior receita.
- Criado painel operacional do heatmap com indicadores de hotspots, gaps de cobertura, eventos sem geo e receita potencial top 5.
- As celulas do heatmap agora mostram a proxima acao recomendada: corrigir geo, abrir cobertura, resolver bloqueios, priorizar pricing, monitorar oferta ou observar.
- Adicionadas listas curtas para `Maior receita potencial` e `Eventos sem geo`, ajudando o admin a sair da leitura agregada para a acao.
- Blind spots ganharam um resumo por frente operacional: geo/dado, pricing, fonte e receita travada.
- Incluidos `data-testid` para QA em filtro, painel, cards, celulas, listas e resumo de blind spots.
- Mantida responsividade via variaveis CSS existentes, com novos grids para Geo Ops em desktop/tablet/mobile.

## Testes e validacoes

- `node .\node_modules\eslint\bin\eslint.js src/app/admin/event-radar/page.tsx` passou sem erros.
- `node .\node_modules\typescript\bin\tsc --noEmit --pretty false` passou.
- `git diff --check -- Urban-front-main/src/app/admin/event-radar/page.tsx` nao retornou erros.

## Riscos e observacoes

- A separacao de `Eventos sem geo` cruza evento e celula por cidade/estado. Quando o backend expuser relacao direta evento-celula ou geohash, esse matching deve ser trocado por chave geografica real.
- `Gaps cobertura` usa `coverageScore`, `averageConfidence` e blind spots por cidade. A leitura fica operacional agora, mas ainda depende de agregacao geo real para chegar no nivel de mapa de calor tipo Uber.
- A lista de receita usa eventos do recorte atual e nao abre detalhe diretamente porque a tabela principal ja centraliza o clique por linha.

## Proximos passos

- Ligar cada celula a uma rota/drawer de operacao por regiao quando houver endpoint de detalhe geo.
- Adicionar heatmap visual com coordenadas reais quando `centerLat/centerLng` e geohash estiverem confiaveis.
- Rodar Playwright real em browser local/staging assim que o dev server Next estabilizar.
