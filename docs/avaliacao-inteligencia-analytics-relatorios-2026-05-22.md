# Avaliacao de analytics, relatorios e inteligencia

Data: 2026-05-22
Escopo: telas de analytics, relatorios, operacao e inteligencia para host e admin, com foco em como conectar melhor motor de eventos, motor de pricing, ROI e operacao.

## Veredito executivo

O Urban AI ja tem uma base forte para sair de "dashboard que mostra dados" e virar "sistema que recomenda decisoes". As telas principais usam dados reais, ha separacao razoavel entre host e admin, e o admin ja cobre eventos, coletores, jobs, qualidade, ROI, funil, Stays, financeiro e drill-down por imovel.

O principal gap nao e falta de telas. E falta de uma camada unica de inteligencia que explique, registre e compare cada decisao. Hoje o motor de eventos gera sinais, o motor de pricing gera sugestoes, o ROI mede parte do resultado, e o admin monitora saude operacional. Mas a decisao completa ainda nao aparece como um objeto auditavel com drivers, confianca, cenarios, impacto esperado e resultado observado.

Minha leitura: a proxima evolucao deve ser menos "criar mais um painel" e mais criar um `pricing_decision_snapshot` que alimente todos os paineis. Esse snapshot seria a ponte entre eventos, pricing, portfolio, ROI, qualidade, Stays e suporte.

## O que ja esta forte

- Host tem superficies importantes: painel, calendario, portfolio, mapa, eventos proximos, ROI, market intel e regras de pricing.
- Admin tem boa cobertura operacional: dashboard executivo, eventos, saude dos coletores, cobertura geografica, jobs, qualidade, ROI, funil, financeiro, Stays, propriedades e alpha.
- O backend ja possui entidades que permitem evoluir bem: `AnalisePreco`, `PriceSnapshot`, `OccupancyHistory`, `EventProximityFeature` e `PriceUpdate`.
- O componente `RecommendationCard` ja suporta informacao rica como `drivers`, `historicalComparison`, `scenarios` e `confidence`. A UI esta mais pronta do que o payload atual.
- A auditoria consolidada de 2026-05-22 ja apontou um caminho correto: todo numero importante precisa de `generatedAt`, `sampleSize`, `confidence`, `metricVersion` e `jobRunId`.

## Diagnostico central

### 1. Inteligencia esta fragmentada

O host ve recomendacoes, calendario, mapa e ROI em telas separadas. O admin ve eventos, qualidade, jobs, funil e ROI tambem em telas separadas. A conexao causal entre elas ainda depende de interpretacao humana.

Exemplo: um coletor fica stale, isso reduz cobertura de eventos, isso reduz recomendacoes futuras, isso diminui potencial de ROI. O admin ate ve partes desse caminho, mas nao ve o encadeamento como impacto financeiro e risco de produto.

### 2. Recomendacao ainda parece "preco sugerido", nao "decisao explicada"

O motor de pricing calcula preco com regras, guardrails, KNN/adaptive strategy e sinais de evento. Mas a tela do host ainda deveria responder melhor:

- Por que agora?
- Quanto desse aumento vem do evento, do pace, dos comparaveis, da sazonalidade e do guardrail?
- Qual o risco de ficar caro demais?
- Qual o cenario conservador, recomendado e agressivo?
- O que aconteceu em eventos parecidos antes?

### 3. Eventos aparecem como inventario, nao como demanda monetizavel

As telas de eventos estao boas para cobertura e operacao. Para inteligencia, falta transformar evento em demanda estimada:

- potencial de diaria incremental;
- probabilidade de impactar determinada propriedade;
- segmento de publico provavel;
- lead time ideal para alterar preco;
- confianca da fonte;
- risco de evento duplicado, fora de escopo ou superestimado.

### 4. ROI existe, mas a atribuicao precisa amadurecer

As telas de ROI ja separam confirmado, projetado e potencial perdido. A evolucao natural e mostrar atribuicao por driver:

- ROI gerado por eventos;
- ROI gerado por ajuste de regra;
- ROI gerado por comparaveis/mercado;
- ROI protegido por guardrails;
- ROI perdido por nao aceitar, nao aplicar, sem integracao ou dado insuficiente.

### 5. Admin e forte em operacao, mas pode virar cockpit de decisao

O admin ja mostra muita coisa. O proximo passo e organizar por perguntas:

- Onde estamos perdendo dinheiro agora?
- Qual parte do motor esta limitando o resultado?
- Quais imoveis/clientes precisam de acao humana?
- Qual fonte de evento tem maior impacto economico?
- Qual regra/modelo esta gerando melhor retorno?
- Onde podemos liberar auto-apply com seguranca?

## Inventario das superficies

### Host

| Tela | Hoje | Melhorar |
|---|---|---|
| `/painel` | Feed principal com propriedades, recomendacoes e pace. | Virar central "o que fazer hoje", ordenada por oportunidade, urgencia e confianca. |
| `/dashboard` | Calendario por imovel com eventos do mes. | Trocar contagem por heatmap de impacto esperado, risco de ocupacao e preco recomendado. |
| `/portfolio` | Calendario 60 dias, filtros e acoes em lote. | Adicionar matriz de oportunidade por data/imovel e lotes sugeridos pelo sistema. |
| `/my-roi` | ROI do host com confirmado, projetado e potencial perdido. | Atribuir por driver e mostrar evolucao temporal, confianca e amostra. |
| `/properties/[id]/market` | Market intel com comparaveis internos, percentil, ADR e ocupacao. | Mostrar origem, freshness, tamanho de amostra, confianca e proxima acao recomendada. |
| `/properties/[id]/pricing-rules` | Regras por imovel e preview de 14 dias. | Adicionar backtest, versionamento, impacto esperado em receita e simulacao por eventos. |
| `/maps` | Mapa de eventos e propriedades. | Virar radar economico: aneis de impacto, hotspots, demanda nao capturada e acoes diretas. |
| `/near-events` | Lista eventos proximos por propriedade. | Unificar com radar de eventos ou transformar em ranking de oportunidades monetizaveis. |
| `/event-log` | Na pratica e tela de ajustes/estrategia. | Renomear rota e copy para configuracoes de pricing ou mover para settings. |

### Admin

| Tela | Hoje | Melhorar |
|---|---|---|
| `/admin` | Overview de usuarios, imoveis, eventos, IA e dataset. | Mostrar maturidade do motor por etapa e gaps que impedem troca de tier. |
| `/admin/dashboard` | Cockpit executivo com eventos, waitlist, pipeline, receita, dataset, Stays e alertas. | Separar visoes Exec/Ops/Support e exibir impacto downstream dos alertas. |
| `/admin/events` | Analytics de eventos, cobertura, categorias, cidades, relevancia e timeline. | Adicionar score de qualidade, demanda estimada, blind spots e matriz venue type x bairro. |
| `/admin/collectors-health` | Saude por fonte, stale, erros e pendencias. | Priorizar fontes por impacto financeiro esperado, nao so volume/erro. |
| `/admin/coverage` | Regioes de cobertura e teste de ponto. | Acrescentar cobertura efetiva por receita potencial, bairro, venue e portfolio ativo. |
| `/admin/jobs` | Jobs manuais, historico e resultados. | Conectar `jobRunId` aos relatorios que dependem deles e exibir freshness por painel. |
| `/admin/quality` | MAPE, RMSE, erro mediano e cobertura de ocupacao. | Adicionar calibracao por segmento, vies de preco, qualidade por fonte de evento e cohort. |
| `/admin/roi` | ROI agregado e leaderboard por host. | Atribuir ROI por driver, plano, mercado, tipo de evento e modo de operacao. |
| `/admin/funnel` | Funil de produto e drop-off. | Medir time-to-first-value: cadastro, primeiro evento, primeira sugestao, aceite, aplicacao, reserva. |
| `/admin/finance` | MRR, custos, margem por imovel e matriz de custos. | Conectar custos de APIs/coleta ao valor gerado por motor e margem por cliente/listing. |
| `/admin/stays` | Saude da integracao, pushes e success rate. | Medir auto-apply eligibility, falhas por motivo e impacto perdido por push rejeitado. |
| `/admin/properties` | Lista de imoveis com geo, localidade, preco e recomendacoes. | Adicionar health score, razao do bloqueio e prioridade financeira de correcao. |
| `/admin/properties/[id]` | Drill-down com saude, analises, eventos proximos e historico. | Mostrar timeline de decisoes, drivers, outcomes e recomendacao de suporte. |
| `/admin/alpha` | Auditoria de tester, KPIs reais, CSV e reprocessamento. | Evoluir para customer success cockpit para casos de prova e aprendizado qualitativo. |
| `/admin/pricing-config` | Planos e sync Stripe. | Usar em conjunto com unit economics para sugerir limites/precos por plano. |

## Camada de inteligencia recomendada

Criar uma entidade ou JSON versionado associado a cada `AnalisePreco`, por exemplo `pricing_decision_snapshot`.

Campos sugeridos:

- `decisionId`
- `propertyId`
- `eventId`
- `targetDate`
- `generatedAt`
- `jobRunId`
- `metricVersion`
- `modelVersion`
- `strategyTier`
- `sourceFreshness`
- `sampleSize`
- `confidence`
- `currentPrice`
- `suggestedPrice`
- `guardrailMin`
- `guardrailMax`
- `guardrailApplied`
- `expectedOccupancyDelta`
- `expectedRevenueDelta`
- `riskLevel`
- `drivers.event`
- `drivers.pace`
- `drivers.compSet`
- `drivers.seasonality`
- `drivers.rules`
- `drivers.guardrail`
- `scenarios.conservative`
- `scenarios.recommended`
- `scenarios.aggressive`
- `historicalComparison.similarEvents`
- `historicalComparison.acceptanceRate`
- `historicalComparison.bookedRate`
- `historicalComparison.avgLift`
- `outcome.acceptedAt`
- `outcome.appliedAt`
- `outcome.bookedAt`
- `outcome.realRevenue`

Essa camada alimentaria:

- `RecommendationCard` no host, usando os props ricos que ja existem.
- ROI host e admin, com atribuicao por driver.
- Quality admin, com MAPE por segmento e estrategia.
- Stays, com elegibilidade de auto-apply.
- Jobs/admin dashboard, com rastreabilidade por `jobRunId`.
- Market Intel, com freshness e sample size.

## Motor de eventos: melhorias de inteligencia

### Scoring de demanda

Hoje a relevancia do evento e util, mas pode virar um score composto:

- tamanho/capacidade estimada;
- categoria e venue type;
- distancia e tempo de deslocamento por propriedade;
- duracao do evento;
- dia da semana;
- antecedencia;
- sobreposicao com outros eventos;
- fonte e confianca;
- historico de impacto em propriedades parecidas.

Resultado esperado: `eventDemandScore` e `eventRevenuePotential`.

### Coverage economica

Em vez de apenas "quantos eventos temos", medir:

- % de eventos relevantes cobertos por bairro;
- % de venues estrategicos monitorados;
- latencia anuncio -> base;
- falsos positivos e duplicados;
- fontes stale ponderadas por potencial de receita;
- eventos futuros com impacto em propriedades ativas;
- eventos sem recomendacao gerada e motivo.

### Blind spots

Adicionar no admin uma visao de lacunas:

- venues com historico de impacto, mas sem eventos recentes;
- bairros com propriedades ativas e baixa cobertura;
- categorias subrepresentadas como congressos, cursos, jogos, feiras e eventos corporativos;
- fontes que pararam de produzir dados;
- eventos com alta relevancia mas sem coordenadas.

## Motor de pricing: melhorias de inteligencia

### Explicabilidade por driver

Cada sugestao deveria decompor a diferenca:

- preco base do anfitriao;
- ajuste por mercado/comparaveis;
- ajuste por evento;
- ajuste por pace/ocupacao;
- ajuste por sazonalidade;
- ajuste por regra do usuario;
- ajuste por guardrail.

Isso reduz duvida do host e melhora debug admin.

### Cenarios e risco

Para cada recomendacao:

- conservador: menor lift, maior chance de reserva;
- recomendado: equilibrio entre lift e ocupacao;
- agressivo: maior lift, maior risco;
- risco de ficar acima do mercado;
- risco de perder oportunidade se nao aplicar.

### Backtest e versionamento

As regras de pricing precisam de:

- historico de versoes;
- preview com receita esperada, nao so diaria;
- backtest dos ultimos 30/60/90 dias;
- comparacao "regra atual vs regra proposta";
- impacto por tipo de evento e dia da semana.

### Auto-apply seguro

Definir cohorts elegiveis para auto-apply:

- alta confianca;
- evento com fonte confiavel;
- comp set suficiente;
- guardrail nao extremo;
- historico positivo do host;
- Stays conectado;
- recomendacao dentro de faixa aprovada.

O admin/Stays deveria mostrar "precos que poderiam ter sido auto-aplicados com seguranca" e o valor perdido por ainda estar em manual.

## Melhorias por tela host

### `/painel`

Evoluir para uma fila de decisoes:

- Top 3 acoes de hoje.
- Cards ordenados por `opportunityScore`.
- Badge: "alta confianca", "precisa revisar", "dados insuficientes".
- Explicacao curta: evento + pace + comparaveis + guardrail.
- CTA contextual: aplicar, simular, ver calendario, ignorar com motivo.

### `/dashboard`

Adicionar heatmap por impacto:

- cor por receita incremental esperada;
- icone de evento relevante;
- marcador de risco de ocupacao;
- preco atual vs sugerido;
- tooltip com driver principal;
- filtro "mostrar datas sem acao".

### `/portfolio`

Transformar em cockpit de otimizacao:

- ranking de datas/imoveis com maior dinheiro na mesa;
- sugestoes em lote geradas pelo sistema;
- simulacao antes de aplicar lote;
- resumo: receita esperada, risco medio, quantidade de noites;
- historico auditavel das acoes em lote.

### `/my-roi`

Melhorar narrativa de valor:

- confirmado, projetado e potencial separados visualmente;
- ROI por evento, por regra e por propriedade;
- grafico temporal de lift acumulado;
- casos recentes com antes/depois;
- confianca e amostra por numero;
- explicacao de atribuicao.

### `/properties/[id]/market`

Adicionar confiabilidade e acao:

- tamanho do comp set;
- raio e filtros usados;
- freshness dos snapshots;
- percentil por dia de semana;
- comparaveis impactados por eventos;
- proxima melhor acao para o imovel.

### `/properties/[id]/pricing-rules`

Adicionar decisao e aprendizado:

- backtest por regra;
- versionamento;
- diferenca entre regra global e regra local;
- preview por receita esperada;
- alertas de regra conflitante;
- recomendacao automatica de ajuste de regra baseada em outcomes.

### `/maps` e `/near-events`

Evitar duplicacao. Uma opcao melhor:

- manter `/maps` como radar geografico visual;
- transformar `/near-events` em lista priorizada de oportunidades;
- ambos usando o mesmo `eventDemandScore`.

### `/event-log`

Renomear para algo como `/settings/pricing` ou mover para `/settings`. O nome atual promete log de eventos, mas entrega configuracao de estrategia.

## Melhorias por tela admin

### `/admin/dashboard`

Adicionar tres modos:

- Exec: crescimento, ROI, receita, margem, risco.
- Ops: eventos, coletores, jobs, dataset, Stays.
- Support: usuarios/imoveis com bloqueios, tickets, proximas acoes.

Cada alerta deveria ter impacto:

- qual metrica afeta;
- quantos hosts/listings;
- dinheiro estimado em risco;
- acao recomendada;
- dono operacional.

### `/admin/events`

Adicionar:

- score de qualidade por evento;
- score de demanda;
- matriz categoria x bairro;
- eventos sem pricing gerado;
- eventos com pricing gerado mas sem aceite;
- duplicados provaveis;
- eventos out-of-scope com alto potencial.

### `/admin/collectors-health`

Adicionar:

- esperado vs observado por fonte;
- SLA por fonte;
- impacto potencial por fonte stale;
- ranking de fontes por receita influenciada;
- drill-down de erros e exemplos.

### `/admin/quality`

Evoluir alem de MAPE global:

- MAPE por categoria de evento;
- MAPE por bairro;
- MAPE por faixa de preco;
- MAPE por estrategia/tier;
- viés medio, se o motor erra para cima ou para baixo;
- calibracao de confianca, se "alta confianca" realmente performa melhor.

### `/admin/roi`

Adicionar cortes:

- por plano;
- por cidade/bairro;
- por tipo de evento;
- por estrategia de pricing;
- por modo manual/auto;
- por cohort de onboarding;
- por host com maior potencial perdido.

### `/admin/funnel`

Adicionar etapas orientadas a valor:

- primeiro imovel completo;
- primeiro evento relevante detectado;
- primeira recomendacao gerada;
- primeira recomendacao entendida/aberta;
- primeira recomendacao aceita;
- primeiro preco aplicado;
- primeira reserva atribuida;
- primeira prova de ROI.

### `/admin/finance`

Conectar com inteligencia:

- custo de coleta/enriquecimento por evento util;
- custo de API por recomendacao aplicada;
- margem por cliente/listing;
- ROI da propria plataforma por motor;
- CAC/LTV quando dados de aquisicao estiverem disponiveis.

### `/admin/stays`

Adicionar:

- motivo de rejeicao por push;
- valor perdido por push falho;
- elegibilidade de auto-apply;
- tempo entre recomendacao e aplicacao;
- rollback rate;
- idempotency/audit trail visivel.

### `/admin/properties` e `/admin/properties/[id]`

Adicionar health score unico:

- geo/localidade;
- preco base;
- ocupacao historica;
- comp set;
- eventos proximos;
- recomendacoes futuras;
- Stays conectado;
- ROI historico;
- prioridade financeira.

No detalhe, mostrar timeline:

- evento detectado;
- recomendacao gerada;
- host abriu;
- aceitou/rejeitou;
- preco aplicado;
- reserva/receita;
- feedback.

## Roadmap sugerido

### P0 - 1 a 2 semanas

1. Alimentar `RecommendationCard` com `drivers`, `confidence`, `scenarios` e `historicalComparison`.
2. Adicionar badges de `generatedAt`, freshness, sample size e confianca nos relatorios host.
3. Renomear `/event-log` para configuracao real de pricing.
4. Mostrar fonte/metric version nos principais numeros de ROI, Market Intel e Pace.
5. Persistir audit log real para acoes em lote do portfolio.

### P1 - 30 a 45 dias

1. Criar `pricing_decision_snapshot` associado a `AnalisePreco`.
2. Ligar `jobRunId` aos relatorios dependentes de jobs.
3. Criar backtest de regras de pricing.
4. Adicionar dashboard de blind spots do motor de eventos.
5. Criar health score por imovel no admin.
6. Criar atribuicao de ROI por driver.

### P2 - 60 a 90 dias

1. Forecast de demanda por venue/tipo de evento.
2. Calibracao de confianca do pricing.
3. Segmentacao de qualidade por bairro, evento, preco e estrategia.
4. Auto-apply com cohorts seguros e rollout controlado.
5. Customer success cockpit usando `/admin/alpha` como base.

## Metricas novas recomendadas

### Motor de eventos

- `eventDemandScore`
- `eventRevenuePotential`
- `sourceReliabilityScore`
- `ingestionLatencyHours`
- `coverageByVenueType`
- `coverageByNeighborhood`
- `duplicateRate`
- `falsePositiveRate`
- `eventsWithPricingGeneratedRate`
- `highPotentialEventsWithoutRecommendation`

### Motor de pricing

- `decisionConfidence`
- `expectedRevenueDelta`
- `expectedOccupancyDelta`
- `driverContribution`
- `guardrailHitRate`
- `scenarioSpread`
- `backtestMape`
- `biasPercent`
- `calibrationByConfidence`
- `autoApplyEligibilityRate`

### ROI e negocio

- `roiByDriver`
- `roiByEventType`
- `potentialLostByReason`
- `timeToFirstValue`
- `timeRecommendationToApply`
- `manualVsAutoLift`
- `costPerUsefulEvent`
- `costPerAppliedRecommendation`
- `marginPerActiveListing`

## Referencias de codigo observadas

- Host analytics: `Urban-front-main/src/app/painel/page.tsx`, `Urban-front-main/src/app/dashboard/page.tsx`, `Urban-front-main/src/app/portfolio/page.tsx`, `Urban-front-main/src/app/my-roi/page.tsx`, `Urban-front-main/src/app/maps/page.tsx`, `Urban-front-main/src/app/near-events/page.tsx`.
- Host pricing/market: `Urban-front-main/src/app/properties/[id]/market/page.tsx`, `Urban-front-main/src/app/properties/[id]/pricing-rules/page.tsx`, `Urban-front-main/src/app/event-log/page.tsx`.
- Recommendation UI: `Urban-front-main/src/app/componentes/ui/RecommendationCard.tsx`, `Urban-front-main/src/app/types/recommendation.ts`.
- Admin analytics: `Urban-front-main/src/app/admin/dashboard/page.tsx`, `Urban-front-main/src/app/admin/events/page.tsx`, `Urban-front-main/src/app/admin/collectors-health/page.tsx`, `Urban-front-main/src/app/admin/quality/page.tsx`, `Urban-front-main/src/app/admin/roi/page.tsx`, `Urban-front-main/src/app/admin/funnel/page.tsx`, `Urban-front-main/src/app/admin/finance/page.tsx`, `Urban-front-main/src/app/admin/jobs/page.tsx`, `Urban-front-main/src/app/admin/stays/page.tsx`, `Urban-front-main/src/app/admin/properties/page.tsx`, `Urban-front-main/src/app/admin/properties/[id]/page.tsx`, `Urban-front-main/src/app/admin/alpha/page.tsx`.
- Front API contracts: `Urban-front-main/src/app/service/api.ts`.
- Host backend: `urban-ai-backend-main/src/host-panels/host-panels.service.ts`.
- Admin backend: `urban-ai-backend-main/src/admin/admin.service.ts`, `urban-ai-backend-main/src/admin/admin.controller.ts`.
- Pricing backend: `urban-ai-backend-main/src/propriedades/pricing-calculate.service.ts`, `urban-ai-backend-main/src/propriedades/pricing-guardrail.service.ts`, `urban-ai-backend-main/src/knn-engine/pricing-engine.ts`, `urban-ai-backend-main/src/knn-engine/strategies/adaptive-pricing.strategy.ts`.
- Entities de aprendizado/outcome: `urban-ai-backend-main/src/entities/AnalisePreco.ts`, `urban-ai-backend-main/src/entities/price-snapshot.entity.ts`, `urban-ai-backend-main/src/entities/occupancy-history.entity.ts`, `urban-ai-backend-main/src/entities/event-proximity-feature.entity.ts`, `urban-ai-backend-main/src/entities/price-update.entity.ts`.

## Conclusao

O sistema nao precisa apenas de mais relatorios. Ele precisa transformar cada recomendacao em uma decisao explicavel, auditavel e mensuravel. Quando essa decisao virar um objeto compartilhado entre host, admin, eventos, pricing, ROI e Stays, as telas existentes ganham muito mais valor sem necessariamente aumentar a complexidade visual.

Minha recomendacao e comecar pelo `pricing_decision_snapshot`, porque ele destrava quase tudo: explicabilidade para o host, qualidade para o admin, ROI por driver, backtest, auto-apply seguro e uma narrativa de produto muito mais forte.
