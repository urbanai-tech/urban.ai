# Plano consolidado: inteligencia de eventos, pricing e demanda

> SUPERSEDED: plano historico. Consulte `../../plano-mestre-scorecard-10-10-2026-07-15.md`.

Data: 2026-05-22
Escopo: consolidacao da avaliacao de analytics/relatorios com a proxima etapa de produto: previsao de demanda por evento, curva de absorcao de preco e telas dedicadas de eventos mapeados pela Urban AI para host e admin.

## Tese central

O proximo salto do Urban AI nao e apenas recomendar uma diaria maior quando existe um evento perto. O salto e prever a demanda potencial que cada evento pode gerar, estimar ate onde a diaria pode chegar, calcular a probabilidade de o mercado absorver esse preco e mostrar isso de forma acionavel para host e admin.

Em outras palavras, cada evento deveria responder:

- Qual demanda este evento deve criar?
- Quais regioes ficam mais quentes?
- Quais imoveis do host podem capturar essa demanda?
- Qual faixa de diaria parece absorvivel?
- Ate onde da para forcar preco sem derrubar demais a chance de reserva?
- Qual cenario maximiza receita esperada?
- Quanta confianca temos nessa interpretacao?

A tela dedicada de eventos vira o "radar de demanda" da Urban AI, parecido com o conceito de heatmap do Uber para motoristas, mas aplicado a hospedagem: onde ha demanda futura, por que existe demanda, quais imoveis devem agir e qual preco pode ser testado com seguranca.

## Produto recomendado

O produto deve ter duas experiencias complementares para o host:

1. `Eventos na Cidade`: catalogo exploratorio de eventos mapeados pela Urban AI, parecido com Sympla/Eventbrite, mas com camada propria de inteligencia.
2. `Radar de Eventos`: visao acionavel que mostra quais eventos impactam os imoveis do host, quanto pode gerar e qual preco simular/aplicar.

Para admin, a experiencia continua mais operacional e estrategica:

1. `Eventos`: listagem, cobertura, qualidade e operacao do motor.
2. `Radar de Demanda`: inteligencia economica, heatmap, blind spots e impacto em imoveis.

Rotas sugeridas:

- Host catalogo: `/events` ou `/city-events`.
- Host radar: `/event-radar` ou evoluir `/near-events` para `/event-radar`.
- Admin: `/admin/event-radar` ou evoluir `/admin/events` com abas `Cobertura`, `Radar de Demanda`, `Lista`, `Detalhe`.

Minha recomendacao: criar `Eventos na Cidade` como tela nova de descoberta, evoluir/substituir `/near-events` pelo `Radar de Eventos` e manter `/admin/events` como base operacional com uma aba/tela nova de inteligencia.

## Novo conceito: Event Demand Forecast

O `Event Demand Forecast` e uma camada que transforma um evento bruto em potencial economico.

Ele combina:

- dados do evento: relevancia, categoria, venue type, capacidade estimada, expected attendance, datas, duracao, source, link oficial, crawled URL;
- geografia: lat/lng, bairro/cidade, raio de impacto, tempo ate os imoveis;
- oferta: quantidade de imoveis no entorno, disponibilidade, comparaveis e snapshots;
- historico: eventos parecidos, recomendacoes aceitas, reservas, receita real, MAPE e feedback;
- contexto temporal: antecedencia, dia da semana, feriados, sazonalidade e eventos concorrentes.

Resultado esperado por evento:

- `eventDemandScore`: 0 a 100.
- `eventRevenuePotential`: potencial financeiro estimado.
- `demandRadiusKm`: raio de demanda calculado.
- `sourceReliabilityScore`: confianca da fonte.
- `confidence`: low, medium, high.
- `interpretation`: leitura da Urban AI em linguagem humana.
- `hotRegions`: regioes/celulas aquecidas no mapa.

## Novo conceito: Price Absorption Curve

A `Price Absorption Curve` responde a pergunta mais importante para o host:

> Qual preco o mercado provavelmente absorve para este imovel, nesta data, por causa deste evento?

Ela nao deve apenas dizer "suba para R$ 850". Ela deve mostrar cenarios.

Exemplo conceitual:

| Cenario | Diaria | Multiplicador | Chance de reserva | Receita esperada | Leitura |
|---|---:|---:|---:|---:|---|
| Conservador | R$ 650 | 2.0x | 82% | R$ 533 | Alta chance de capturar demanda. |
| Recomendado | R$ 850 | 2.6x | 63% | R$ 536 | Melhor equilibrio entre preco e absorcao. |
| Agressivo | R$ 1.150 | 3.5x | 32% | R$ 368 | Pode funcionar se a oferta secar, mas risco alto. |
| Extremo | R$ 1.400 | 4.3x | 14% | R$ 196 | So faz sentido em compressao extrema. |

O importante: triplicar ou quadruplicar pode ser correto em alguns casos, mas precisa aparecer como faixa de probabilidade, nao como promessa. O motor deve explicar quando um preco 4x ainda pode ser absorvido e quando ele vira risco de vacancia.

## Objetos de dados recomendados

### `event_intelligence_snapshot`

Snapshot versionado da interpretacao do evento.

Campos sugeridos:

- `id`
- `eventId`
- `generatedAt`
- `jobRunId`
- `metricVersion`
- `modelVersion`
- `eventDemandScore`
- `eventRevenuePotentialCents`
- `demandRadiusKm`
- `sourceReliabilityScore`
- `sourceFreshnessHours`
- `confidence`
- `expectedAttendance`
- `venueType`
- `category`
- `leadTimeDays`
- `overlapEventsCount`
- `supplyCompressionScore`
- `interpretation`
- `riskFlags`
- `dataQualityFlags`

### `event_property_impact`

Conecta evento com imovel.

Campos sugeridos:

- `id`
- `eventId`
- `propertyId`
- `hostUserId`
- `distanceKm`
- `travelTimeMinutes`
- `propertyCaptureScore`
- `basePriceCents`
- `currentPriceCents`
- `recommendedPriceCents`
- `minAbsorbablePriceCents`
- `maxAbsorbablePriceCents`
- `recommendedMultiplier`
- `maxPlausibleMultiplier`
- `bookingProbability`
- `expectedRevenueCents`
- `expectedIncrementalRevenueCents`
- `confidence`
- `mainDrivers`
- `recommendedAction`

### `pricing_decision_snapshot`

Objeto ja recomendado na avaliacao anterior. Deve continuar sendo o objeto central da decisao de preco.

Ele recebe sinais de:

- `event_intelligence_snapshot`
- `event_property_impact`
- `PriceSnapshot`
- `OccupancyHistory`
- `EventProximityFeature`
- regras de pricing do host
- guardrails
- outcomes de `AnalisePreco` e `PriceUpdate`

### `demand_heatmap_cell`

Agrega demanda por regiao no mapa.

Campos sugeridos:

- `cellId`
- `bbox` ou `h3Index`
- `centerLat`
- `centerLng`
- `dateFrom`
- `dateTo`
- `eventDemandScore`
- `revenuePotentialCents`
- `eventsCount`
- `topEventIds`
- `affectedPropertiesCount`
- `averageConfidence`
- `dominantCategory`
- `supplyCompressionScore`

## Tela host: Radar de Eventos

Objetivo: o host enxerga eventos mapeados pela Urban AI, potencial de demanda, mapa de calor e quais imoveis dele podem se beneficiar.

### Layout sugerido

Primeira dobra:

- mapa grande com heatmap de demanda futura;
- filtros por periodo, imovel, raio, categoria e nivel de confianca;
- lista lateral dos eventos mais importantes para o host;
- resumo: "R$ X de potencial estimado", "Y eventos relevantes", "Z noites com oportunidade".

Cards de evento:

- nome do evento;
- data e local;
- categoria e fonte;
- score de demanda;
- faixa de multiplicador possivel: exemplo `2.1x - 3.4x`;
- preco recomendado para o melhor imovel impactado;
- confianca;
- numero de imoveis do host impactados;
- CTA: `Ver detalhes`, `Simular preco`, `Aplicar sugestao`.

### Detalhe do evento para host

Ao clicar em um evento:

- imagem do evento quando existir;
- link oficial do evento;
- link da fonte/crawled URL quando existir;
- data, horario, venue, endereco, cidade/UF;
- capacidade estimada/publico esperado;
- interpretacao Urban AI;
- drivers da demanda;
- mapa com raio de impacto e heatmap local;
- lista dos imoveis do host impactados;
- curva de absorcao de preco por imovel;
- recomendacoes por imovel;
- historico de eventos parecidos quando houver.

Tabela "meus imoveis impactados":

| Imovel | Distancia | Captura | Diaria atual | Faixa absorvivel | Recomendado | Chance | Acao |
|---|---:|---:|---:|---:|---:|---:|---|
| Studio Vila Mariana | 1.8 km | 87 | R$ 320 | R$ 650-950 | R$ 850 | 63% | Simular/aplicar |
| Loft Paulista | 4.2 km | 72 | R$ 410 | R$ 680-1.050 | R$ 920 | 58% | Simular/aplicar |

### Linguagem para o host

Evitar jargao tecnico. Exemplos:

- "Este evento deve aquecer a regiao por 2 noites."
- "Seu imovel esta dentro do raio de maior impacto."
- "A faixa segura parece entre R$ 650 e R$ 950."
- "Acima de R$ 1.100, a chance de reserva cai bastante."
- "Recomendamos R$ 850 porque equilibra diaria maior e chance de reservar."

## Tela host: Eventos na Cidade

Objetivo: oferecer um catalogo simples e confiavel dos eventos mapeados pela Urban AI por cidade, data, categoria e regiao. Essa tela funciona como descoberta de mercado, parecida com Sympla/Eventbrite, mas com a interpretacao proprietaria da Urban AI.

A diferenca para o `Radar de Eventos`:

- `Eventos na Cidade` responde: "o que esta acontecendo na minha cidade?"
- `Radar de Eventos` responde: "quais desses eventos mexem com meus imoveis e o que devo fazer?"

### Layout sugerido

Primeira dobra:

- titulo por cidade: "Eventos em Sao Paulo";
- filtros por cidade, periodo, categoria, bairro/venue, relevancia e fonte;
- busca textual;
- alternancia de visualizacao: `Lista`, `Mapa`, `Calendario`;
- quick filters: `Perto dos meus imoveis`, `Alto impacto`, `Este fim de semana`, `Proximos 30 dias`.

Cards de evento:

- imagem quando existir;
- nome;
- data e horario;
- local/venue, bairro, cidade/UF;
- categoria;
- publico estimado ou capacidade;
- score Urban AI;
- badges: `alto impacto`, `perto de voce`, `demanda aquecida`, `fonte oficial`, `evento monitorado`;
- link oficial;
- CTA: `Ver evento`, `Ver impacto nos meus imoveis`.

### Detalhe do evento no catalogo

Ao clicar em um evento:

- dados publicos: imagem, nome, descricao, data, horario, local, cidade, link oficial;
- fonte: source, crawled URL ou fonte oficial quando disponivel;
- interpretacao Urban AI: por que esse evento pode aquecer a regiao;
- potencial de demanda: score, raio, publico estimado e confianca;
- mini mapa do local;
- eventos relacionados/proximos;
- bloco "Impacto nos seus imoveis" quando o host tiver imoveis na regiao;
- CTA para abrir o `Radar de Eventos` filtrado naquele evento.

### Valor de produto

Essa tela cria confianca antes da recomendacao de preco. O host ve que a Urban AI esta monitorando a cidade de forma ampla, nao apenas reagindo a um evento isolado. Tambem aumenta frequencia de uso: mesmo quando nao ha acao imediata, o host pode explorar o calendario da cidade e entender o mercado.

## Tela admin: Event Radar / Inteligencia de Eventos

Objetivo: o admin entende cobertura, qualidade, demanda potencial, impacto em receita e gargalos do motor.

### Layout sugerido

Abas:

1. `Radar de Demanda`
2. `Eventos`
3. `Heatmap`
4. `Impacto em Imoveis`
5. `Qualidade & Fontes`
6. `Blind Spots`

### Radar de Demanda

KPIs principais:

- demanda potencial total nos proximos 7/30/90 dias;
- eventos de alto potencial;
- receita potencial influenciada;
- propriedades impactadas;
- recomendacoes geradas;
- eventos de alto potencial sem recomendacao;
- confianca media;
- cobertura geografica ponderada por receita.

Lista priorizada:

- evento;
- demanda score;
- revenue potential;
- categoria;
- fonte;
- confianca;
- propriedades impactadas;
- recomendacoes geradas;
- status de geocode/enrichment;
- acoes: reprocessar, editar, ver detalhe, marcar duplicado.

### Heatmap admin

Mapa de calor por:

- demanda potencial;
- receita potencial;
- quantidade de eventos;
- propriedades impactadas;
- demanda nao capturada;
- cobertura baixa;
- categoria/venue type.

Uso estrategico:

- ver onde coletar melhor;
- onde expandir cobertura;
- quais regioes merecem parceria/vendas;
- quais venues precisam de coletor dedicado;
- onde ha demanda alta mas poucos clientes ativos.

### Detalhe do evento admin

Ao clicar:

- dados brutos do evento;
- link oficial e crawled URL;
- imagem;
- source/sourceId/dedupHash;
- dataCrawl, createdAt, updatedAt;
- geocode/enrichment status;
- relevancia, raio, capacidade estimada, expected attendance, venue capacity;
- interpretacao Urban AI;
- explicacao dos scores;
- propriedades impactadas em toda a plataforma;
- hosts impactados;
- recomendacoes geradas;
- aceites/aplicacoes/reservas/outcomes;
- auditoria de mudancas;
- acoes operacionais.

### Blind Spots

Quadros importantes:

- eventos com alta demanda e sem preco gerado;
- eventos sem coordenada;
- eventos sem link oficial;
- eventos com source stale;
- eventos duplicados provaveis;
- venues estrategicos sem novos eventos;
- regioes com muitos imoveis mas baixa cobertura;
- eventos out-of-scope com alto potencial.

## Como isso se conecta as telas existentes

### Host

- `/events` ou `/city-events`: catalogo de descoberta por cidade, data, categoria, mapa e calendario.
- `/event-radar`: transforma eventos relevantes em oportunidade financeira e acao.
- `/painel`: mostra os eventos mais urgentes como acoes de hoje.
- `/dashboard`: usa o heatmap para colorir dias por oportunidade.
- `/portfolio`: permite aplicar lotes em datas/imoveis impactados.
- `/my-roi`: atribui ROI por evento e por curva de absorcao.
- `/properties/[id]/market`: mostra como eventos alteram comparaveis e percentil.
- `/properties/[id]/pricing-rules`: testa regras contra eventos futuros e passados.
- `/maps` e `/near-events`: podem ser reorganizados entre `Eventos na Cidade` e `Radar de Eventos`.

### Admin

- `/admin/events`: evolui de cobertura/lista para inteligencia de demanda.
- `/admin/collectors-health`: prioriza fontes por receita potencial.
- `/admin/coverage`: mostra cobertura ponderada por demanda e receita.
- `/admin/jobs`: reprocessa snapshots de demanda e curvas.
- `/admin/quality`: mede erro por evento, categoria e faixa de multiplicador.
- `/admin/roi`: atribui ROI por evento, fonte, venue e categoria.
- `/admin/stays`: mede auto-apply elegivel por evento.
- `/admin/properties/[id]`: mostra timeline de evento -> recomendacao -> aplicacao -> reserva.

## Endpoints sugeridos

### Host

- `GET /host/events/catalog?city=&from=&to=&category=&venue=&search=&nearMyProperties=`
- `GET /host/events/radar?from=&to=&propertyId=&category=&confidence=`
- `GET /host/events/:eventId`
- `GET /host/events/:eventId/intelligence`
- `GET /host/events/:eventId/property-impact`
- `GET /host/events/heatmap?from=&to=&propertyId=`
- `POST /host/events/:eventId/simulate-pricing`

### Admin

- `GET /admin/events/intelligence?from=&to=&source=&category=&scope=&confidence=`
- `GET /admin/events/:eventId/intelligence`
- `GET /admin/events/:eventId/property-impact`
- `GET /admin/events/heatmap?from=&to=&metric=`
- `POST /admin/events/:eventId/recompute-intelligence`
- `POST /admin/events/intelligence/recompute`
- `GET /admin/events/blind-spots`

## Motor v0: calculo inicial sem ML pesado

Da para criar uma versao inicial com regras explicaveis usando campos que ja existem.

### Event demand score

Entradas:

- `relevancia`
- `expectedAttendance` ou `capacidadeEstimada`
- `venueCapacity`
- `venueType`
- `categoria`
- `raioImpactoKm`
- `leadTimeDays`
- `source`
- `dataCrawl`
- sobreposicao com outros eventos

Saida:

- `eventDemandScore`
- `confidence`
- `interpretation`

### Property capture score

Entradas:

- distancia ao evento;
- tempo de deslocamento quando disponivel;
- preco base;
- ocupacao historica;
- comp set;
- capacidade do imovel;
- availability;
- historico de aceite/aplicacao.

Saida:

- `propertyCaptureScore`
- `affectedNights`
- `recommendedAction`

### Price absorption curve v0

Entradas:

- diaria base;
- faixa de mercado/comparaveis;
- event demand score;
- property capture score;
- supply compression;
- guardrail do host;
- historico de eventos parecidos.

Saida:

- cenarios conservador, recomendado, agressivo e extremo;
- preco;
- multiplicador;
- probabilidade estimada;
- receita esperada;
- risco.

Formula mental:

`receita_esperada = diaria_sugerida * probabilidade_de_reserva * noites_impactadas`

O motor deve escolher o preco que maximiza receita esperada, respeitando guardrails e risco.

## Roadmap consolidado

### P0 - Fundacao e UX inicial

1. Criar `event_intelligence_snapshot` v0.
2. Criar `event_property_impact` v0.
3. Criar `pricing_decision_snapshot` ligado a `AnalisePreco`.
4. Expor endpoints host/admin para radar, detalhe e impacto.
5. Alimentar `RecommendationCard` com drivers, cenarios e confianca.
6. Criar detalhe de evento com link oficial, crawled URL, interpretacao e imoveis impactados.
7. Criar `Eventos na Cidade` v0 com lista, filtros, link oficial e detalhe do evento.
8. Renomear/reorganizar `/near-events` e `/maps` em direcao ao `Radar de Eventos`.

### P1 - Heatmap e absorcao de preco

1. Criar heatmap por demanda potencial.
2. Criar curva de absorcao por imovel/evento.
3. Mostrar faixas de multiplicador possivel.
4. Adicionar simulacao de preco por evento.
5. Criar admin blind spots.
6. Atribuir ROI por evento e por driver.
7. Adicionar backtest de pricing por evento/categoria.
8. Adicionar visualizacoes `Mapa` e `Calendario` em `Eventos na Cidade`.

### P2 - Aprendizado e auto-apply

1. Calibrar probabilidade de reserva com outcomes reais.
2. Medir bias do motor por categoria/venue/bairro.
3. Criar forecast de demanda por venue e calendario.
4. Criar cohorts de auto-apply seguro.
5. Usar Stays para fechar ciclo: sugestao -> push -> reserva -> receita real.
6. Priorizar coletores/fontes por receita gerada.

## Riscos e guardrails de produto

- Nao prometer que triplicar/quadruplicar vai reservar. Mostrar como faixa provavel e probabilidade.
- Separar claramente estimativa, projecao e receita confirmada.
- Exibir confianca e tamanho de amostra sempre que houver recomendacao forte.
- Evitar recomendacoes extremas sem guardrail e sem justificativa.
- Manter link oficial/fonte para o usuario validar o evento.
- Registrar `modelVersion`, `metricVersion`, `generatedAt` e `jobRunId` em todo snapshot.
- Permitir feedback do host: "preco alto demais", "evento irrelevante", "reservei fora da plataforma", "apliquei outro preco".

## O que eu acho da segunda parte

A tela dedicada de eventos e muito boa porque transforma a Urban AI de "ferramenta de recomendacao de preco" em "radar de demanda futura". Isso aumenta valor percebido mesmo antes de o host aplicar qualquer preco.

Para o host, ela responde: "onde esta a oportunidade?"
Para o admin, responde: "onde nosso motor esta criando ou perdendo dinheiro?"
Para o pricing, cria contexto.
Para eventos, cria accountability.
Para ROI, cria atribuicao.

Eu trataria essa tela como uma das principais experiencias do produto, nao como tela secundaria. Ela pode virar a narrativa visual da Urban AI: "nos mapeamos a cidade, entendemos a demanda e mostramos onde seu imovel pode ganhar mais".

Com a adicao de `Eventos na Cidade`, a jornada fica ainda mais forte:

1. O host descobre o calendario da cidade.
2. A Urban AI interpreta quais eventos importam.
3. O Radar mostra quais imoveis sao impactados.
4. O pricing sugere cenarios e curva de absorcao.
5. O portfolio/calendario executa a acao.
6. O ROI comprova o resultado.

## Referencias do estado atual

- Evento ja possui campos uteis: `linkSiteOficial`, `imagem_url`, `source`, `sourceId`, `dedupHash`, `venueType`, `venueCapacity`, `expectedAttendance`, `crawledUrl`, `relevancia`, `raioImpactoKm`, `capacidadeEstimada`.
- Admin ja possui `/admin/events` com cobertura, relevancia, categorias, cidades, timeline e listagem.
- Host ja possui `/maps` e `/near-events`, que podem ser evoluidos para o radar.
- O backend ja possui `AnalisePreco`, `PriceSnapshot`, `OccupancyHistory`, `EventProximityFeature` e `PriceUpdate`, suficientes para iniciar uma camada v0.
