# ADR 0028 — Mercado por bairro com várias fontes

**Status:** Aceito (31/10/2026). A coleta própria de anúncios de terceiros segue **desligada** até haver parecer jurídico.

## Contexto

O market intel (`/properties/[id]/market`) usava só os outros clientes do My Urban, num raio fixo de 3 km, e exigia pelo menos 5 anfitriões distintos. Com poucos clientes por bairro, quase todo imóvel caía em "dados insuficientes". `external_listing` e o `InsideAirbnbImportService` existiam só para treino do KNN. A tendência de 30 dias era fixa em 0. O dono decidiu combinar todas as fontes para escalar: clientes, dataset licenciado (fornecedor ainda não contratado) e, no futuro, coleta própria.

## Decisão

### Fontes (`urban-ai-backend-main/src/market-data/`)

Interface `MarketDataSource` com um adaptador por fonte; todas devolvem `MarketListingRecord` (origem, data de coleta, licença, posição, diária, ocupação, tipologia, série opcional).

| Fonte | Origem | Licença do registro | Observação |
|---|---|---|---|
| `customers` | Imóveis ativos de outros clientes (o que já existia) | `first_party` | Única com ocupação real (`occupancy_history`) |
| `licensed_dataset` | CSV importado pelo admin (`external_listing`, `source = licensed:<fornecedor>`) | escolhida no upload | Parquet deve ser convertido para CSV; mapeamento de colunas configurável |
| `inside_airbnb` | Mesmo `InsideAirbnbImportService`, agora lido também como mercado | `cc_by_4` | Ocupação é proxy (1 − `availability365`/365), rotulada como estimativa |
| `own_scraping` | **Só a interface e o adaptador desligado** | — | `MARKET_SCRAPING_ENABLED=false` (padrão): devolve vazio com o motivo "aguardando parecer jurídico". Mesmo ligado, não há coletor implementado. Nenhum código coleta Airbnb/Booking |

`MARKET_SOURCES` (padrão `customers,licensed_dataset,inside_airbnb`) liga as fontes; `own_scraping` só liga se constar na lista **e** `MARKET_SCRAPING_ENABLED=true`. Uma fonte que falha não derruba as outras.

### Precedência e deduplicação

1. **Mesmo anúncio** (id do Airbnb, `abnb:<id>`) vindo de mais de uma fonte conta **uma vez**. Vence a de maior precedência: clientes > dataset licenciado > Inside Airbnb > coleta própria; empate na mesma fonte pela coleta mais recente. Campos vazios do vencedor (ocupação, quartos, tipo, capacidade, bairro, série) são preenchidos com os das perdedoras.
2. **Sem id em comum**, só se casam registros de **fontes diferentes** com a mesma posição (4 casas, ≈ 11 m), mesmos quartos e tipo e diária até 15% distante. Dois registros da mesma fonte nunca se casam por posição (prédio com unidades iguais é legítimo). Registro sem quartos ou sem tipo não se casa.
3. **O próprio imóvel** nunca é comparável: mesmo dono, mesmo id do Airbnb, ou réplica externa no mesmo ponto com mesma tipologia e diária próxima.

### Comp set

Raio configurável de 1 a 5 km (padrão 3) e tipologia opcional (quartos, 4 = "4 ou mais"; tipo de anúncio; faixa de capacidade). Campo pedido e ausente no registro não casa. Dado externo mais velho que `MARKET_EXTERNAL_MAX_AGE_DAYS` (548) ou sem data de coleta fica de fora.

### Privacidade

Só agregados saem. Cada grupo precisa atingir o mínimo **sozinho** para contribuir; um grupo abaixo do mínimo não vaza para o agregado do outro.

- Clientes: `MARKET_INTEL_MIN_GROUP_SIZE` (padrão 5, piso 3) **anfitriões distintos** (muitos imóveis do mesmo dono não bastam).
- Fontes externas: `MARKET_EXTERNAL_MIN_LISTINGS` (padrão 8, piso 5) **anúncios distintos**, contados depois da deduplicação.
- A resposta nunca traz ids, coordenadas ou anúncios individuais. Quando a amostra é insuficiente, diz quantos anfitriões/anúncios distintos existem e o mínimo, e o que mudar (raio, tipologia).

### Licenças: uso interno × exibição agregada

| Licença | Motor v2 / admin | Tela do anfitrião |
|---|---|---|
| `first_party` | sim | sim, agregado |
| `cc_by_4` | sim | sim, com atribuição "Inside Airbnb, CC BY 4.0" |
| `licensed_display_aggregate` | sim | sim, só agregados (mediana, faixas) |
| `licensed_internal_only` | sim | **nunca** |
| `unknown` | **não** | **não** |

A licença é **obrigatória e sem padrão** no upload (`cc_by_4`, `licensed_display_aggregate` ou `licensed_internal_only`) e fica gravada por linha em `external_listing.license`, junto com `collectedAt`, o lote (`ingestBatchId`) e o registro em `market_ingest_log` (quem, quando, arquivo, contagens). Linhas anteriores à migration: Inside Airbnb vira `cc_by_4`; o restante, `unknown`. **Antes de contratar um fornecedor, conferir se o contrato permite exibir agregados ao cliente** (revenda de dado bruto não é permitida; mostrar mediana e faixas é o que o produto faz); na dúvida, subir como `licensed_internal_only`.

### Métricas de bairro

Percentil do anúncio, medianas e p25–p75 de diária e ocupação, sazonalidade por mês (índice sobre a mediana do período, mínimo de observações por mês), efeito dos eventos de alto impacto (mediana do bairro em dias com evento × sem), tendência de 30 dias (variação da mediana dos comparáveis e do percentil, só com anúncios com preço nos dois períodos). Quando não há dado suficiente a métrica vem **indisponível com o motivo**, nunca zero. `percentileTrend30d` legado fica 0 nesses casos e o campo novo `trend30d.available` diz a verdade.

### Contrato da API

`GET /properties/:id/market-intel` mantém todos os campos antigos. Query opcional nova: `radiusKm`, `rooms`, `listingType`, `capacity` (valor inválido = 400). Campos novos opcionais (`schemaVersion: 2`, `dataSources`, `attribution`, `typology`, `radius`, `trend30d`, `seasonality`, `neighborhoodEventEffect`, `insufficiency`, `occupancyAvailable`, `occupancyIsProxy`…). Admin: `GET /admin/market/health` e `POST /admin/market/licensed-dataset/import` (multipart, 25 MB, mutação auditada pela trilha global).

### Insumo do motor v2 em sombra

`MARKET_ENGINE_SIGNAL_ENABLED` (padrão `false`) faz a análise de preço anexar um `MarketSignalV2` (só agregados, uso interno) ao contexto do v2. Ele entra como driver informativo `market_position` (peso 0) e em `details.shadowV2.market`; **não altera o preço do v1 nem o do v2**. No modo v1 nada é consultado. Usar o sinal para mudar preço é decisão do [ADR 0019](./0019-quando-ligar-o-motor-v2.md).

## Consequências

- (+) Cobertura deixa de depender da escala de clientes; cada número diz de onde vem e de quando é.
- (+) Fornecedor trocável: o adaptador é o CSV com mapeamento; nada fica amarrado a AirROI/Base dos Dados/AirDNA.
- (+) Scraping não existe no código; ligar a flag não faz nada sozinha.
- (−) Dado de dataset é mensal/semanal e sem pickup: ocupação futura e ritmo de reservas (fase 2 da proposta) exigem fornecedor com calendário ou parecer para a coleta própria.
- (−) O casamento por posição entre fontes é heurístico; pode deixar passar duplicata sem id (superestima levemente o mínimo) mas evita juntar unidades diferentes.
- (−) Cobertura no admin roda uma consulta por imóvel (amostra de 300, cache de 5 min).

## Pendências do dono

Escolher e contratar o fornecedor; confirmar no contrato a exibição agregada ao cliente; parecer jurídico sobre qualquer coleta própria (inclui os termos de uso de Airbnb/Booking).

Como converter Parquet para CSV: `python -c "import pandas as pd; pd.read_parquet('arquivo.parquet').to_csv('arquivo.csv', index=False)"`.
