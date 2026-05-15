# Fluxo controlado - prontidao real de dados e pricing

Data/hora: 2026-05-15T20:32:26Z
Ambiente: producao
Usuario alpha: `gustavo8gouveia@hotmail.com`
Escopo: leitura de gates reais + jobs admin seguros (`geocoder` e `dataset-snapshot`).

## Veredito

O alpha assistido esta operacional para Gustavo, mas ainda nao bate os gates de beta pago/go-live publico.

O motor de recomendacao esta gerando recomendacoes novas e coerentes com guardrails, porem a prova de ROI ainda e fraca porque so existe 1 preco aplicado e nenhuma reserva/ocupacao confirmada. A camada de eventos esta quase no gate minimo, mas ficou em 95 eventos futuros/30d contra meta de 100 e o geocoder falhou por configuracao externa com HTTP 403.

## Evidencias principais

| Frente | Resultado |
|---|---|
| Eventos totais | 1661 |
| Eventos in-scope | 1661 |
| Eventos proximos 30 dias | 95 |
| Eventos criados ultimas 24h | 52 |
| Pendentes de geocoding | 134 |
| Fontes distintas | 8 |
| Coletores com eventos | 9/21 |
| Coletores com env faltante | 0 |
| Recomendacoes ultimas 24h | 800 |
| Recomendacoes futuras | 806 |
| Cobertura de recomendacao | 62.1% dos enderecos ativos |
| Enderecos ativos | 29 |
| Enderecos com recomendacao futura | 18 |
| Enderecos com cidade/UF invalida | 7 |
| Stripe sync | 8/8 OK |
| Price snapshots | 20, em 9 listings e 3 dias |
| Ocupacao/receita real | 0 registros |
| Event proximity features | 0 registros |

## Gustavo alpha

| Indicador | Resultado |
|---|---|
| Imoveis | 9 |
| Enderecos ativos | 9 |
| Imoveis com diaria manual | 9 |
| Imoveis com receita media mensal | 9 |
| Receita media mensal cadastrada | R$ 40.500 |
| Recomendacoes totais | 808 |
| Recomendacoes retornadas na amostra | 250 |
| Recomendacoes criadas hoje na amostra | 250 |
| Recomendacoes com evento futuro na amostra | 248 |
| Aceites | 1 |
| Precos aplicados | 1 |
| Feedback capturado | 1 |
| Reservas confirmadas | 0 |
| Receita real confirmada | R$ 0 |

Exemplo validado:

- Imovel: Apartamento em Perdizes.
- Evento: Brasil Brau 2026, 2026-06-09.
- Preco atual: R$ 150.
- Preco sugerido/aplicado: R$ 171.
- Lift: 14%.
- Motivo: mercado R$ 150, evento 1.14x, guardrail 25% queda/45% alta.

## ROI e qualidade

| Indicador | Resultado |
|---|---|
| Incremental confirmado | R$ 0 |
| Incremental projetado | R$ 21 |
| Potential lost | R$ 22.171,18 |
| Recomendacoes consideradas no ROI | 808 |
| Taxa de aceite | 0.12% |
| Taxa de aplicacao sobre aceites | 100% |
| Qualidade do ROI | `medium` - falta reserva/receita real |
| MAPE sample size | 1 |
| Quality gate | nao passa, amostra minima insuficiente |

## Jobs executados

### Geocoder

Resultado: `attempted=100`, `succeeded=0`, `failed=100`.

Todas as falhas retornaram `Request failed with status code 403`, indicando problema de configuracao/permissao da API de geocoding no provedor externo. O job antigo marcava isso como `success`; o backend foi corrigido para classificar como `error` quando todos os itens tentados falham.

Validacao pos-deploy: o mesmo fluxo foi rerodado com `limit=1` depois do deploy do backend. O job passou a gravar `status=error` e `errorMessage=Job failed all attempted items (1/1)`, confirmando que o falso verde foi corrigido em producao. Em seguida, o backend recebeu normalizacao de erro Google Maps para trocar `Request failed with status code 403` por uma mensagem acionavel sobre `GOOGLE_MAPS_API_KEY`, restricoes server-side, Geocoding API e billing.

Validacao do cron das 21:00 UTC: a mensagem nova expôs a causa raiz real: `Google Geocoding API request failed (HTTP 403, REQUEST_DENIED)` porque a Geocoding API nao esta ativada no projeto Google Cloud associado a chave. Acao externa pendente: abrir Google Cloud Console do projeto da chave, ativar **Geocoding API**, manter billing ativo e confirmar que a restricao da key permite uso server-side para a API Geocoding.

### Dataset snapshot

Resultado: `captured=0`, `duplicates=9`, `skipped=32`, `totalLists=41`, `skippedMissingPrice=32`, `status=partial_missing_prices`.

Leitura: os 9 listings alpha ja tinham snapshot duplicado para o dia, mas ainda ha 32 listings sem fonte de preco atual.

## Bloqueios que permanecem

1. Corrigir Google Maps/Geocoding em producao: chave existe, mas a Geocoding API nao esta ativada no projeto Google Cloud da chave. A aplicacao ja classifica isso como erro operacional; falta ativar a API no console/projeto correto.
2. Subir eventos futuros de 95 para pelo menos 100 no gate minimo, idealmente 200 SP/30d.
3. Elevar cobertura de recomendacao de 62.1% para pelo menos 70%.
4. Corrigir 7 enderecos ativos com cidade/UF invalidos.
5. Capturar ocupacao/reserva/receita real para sair de ROI estimado.
6. Criar rotina de event proximity features ou acoplar snapshot ao batch de recomendacao. Implementado no workspace atual: cron diario `dataset-event-proximity-snapshot`, endpoint admin `/admin/dataset/event-proximity/run` e botao em `/admin/jobs`; falta deploy/rerun em producao para o contador sair de 0.
7. Configurar `AIRROI_API_KEY` somente quando a aquisicao externa for aprovada.
8. Configurar `STAYS_API_BASE_URL` antes de qualquer smoke real Stays.

## Proximo passo recomendado

Antes de chamar beta pago: corrigir geocoding 403, rerodar geocoder, reprocessar alpha Gustavo e repetir este fluxo ate:

- eventos futuros 30d >= 100;
- cobertura de recomendacao >= 70%;
- pelo menos 3 precos aplicados;
- pelo menos 1 resultado real de reserva/receita;
- quality gate com amostra minima maior que 1.
