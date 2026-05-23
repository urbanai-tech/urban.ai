# Runbook: idempotencia e robustez do recompute de inteligencia de eventos

Data: 2026-05-22
Squad: `event-demand-pricing-radar`
Agente: Recompute Robustness
Escopo: `EventIntelligenceSnapshot`, `EventPropertyImpact`, `PricingDecisionSnapshot`, fila/retry/lock, rollout e smoke checks.

## Leitura executiva

O estado atual ja permite recompute v0 com escrita real de `event_intelligence_snapshots`, `event_property_impacts` e `pricing_decision_snapshots`. A rodada de 2026-05-23 adicionou idempotencia operacional para retry do mesmo `jobRunId`, lock sincronizado por evento/lote e metadados de runtime no retorno do recompute.

Recomendacao central:

- `EventIntelligenceSnapshot`: manter append-only por recompute concluido.
- `EventPropertyImpact`: manter append-only por snapshot de evento, com deduplicacao intra-job.
- `PricingDecisionSnapshot`: usar idempotencia de decisao. Repetir o mesmo calculo nao deve criar nova decisao; mudanca real de sinais/modelo/preco deve criar uma nova decisao e supersedar drafts anteriores.
- `jobRunId`: usar para rastreabilidade e retry do job, nao como chave unica de negocio.
- `idempotencyKey`: adicionar como campo dedicado em P1; ate la, gravar em `inputSignals.idempotencyKey` e buscar antes de inserir.

## Atualizacao implementada em 2026-05-23

Codigo atualizado na frente Backend DB & Recompute:

- `recomputeEventIntelligence` e `recomputeIntelligenceBatch` agora geram um `jobRunId` uma unica vez por chamada e reutilizam o mesmo valor nas tentativas internas.
- O recompute tenta usar MySQL advisory lock (`GET_LOCK`/`RELEASE_LOCK`) quando o `DataSource` e MySQL/MariaDB, mantendo a mesma conexao via `QueryRunner` ate liberar o lock; em ambiente sem DB real, cai para lock em processo.
- O retorno inclui `runtime.lockKey`, `runtime.lockProvider`, `runtime.attempts`, `runtime.operationRetries`, `runtime.retryDelaysMs`, `runtime.queueMode = inline_lock_retry` e politica de retry.
- Retry automatico cobre lock ocupado, deadlock, lock wait timeout, perda de conexao e timeout. No endpoint sincrono, o backoff e curto para nao transformar request manual em worker longo.
- `EventIntelligenceSnapshot` e reutilizado quando ja existe a dupla `jobRunId + eventId`.
- `EventPropertyImpact` e reutilizado quando ja existe a chave `jobRunId + eventId + propertyAddressId + analisePrecoId`.
- Duplicatas intra-job em memoria sao puladas antes de salvar impacts.
- Leituras Host/Admin de impactos persistidos retornam a versao mais recente por `eventId + propertyAddressId + analisePrecoId`, evitando exibir historico append-only como duplicata operacional.
- A migration de fundacao ganhou indices para lookup de retry em `event_intelligence_snapshots(jobRunId, event_id)` e `event_property_impacts(jobRunId, event_id, property_address_id, analise_preco_id)`.

Ainda nao foi criada fila externa BullMQ/Redis ou tabela dedicada de jobs para Event Intelligence. O estado atual e um modo sincrono robustecido; a fila continua recomendada para P1/staging de maior volume.

## Estado atual usado como base

Evidencias nos handoffs de 2026-05-22:

- Backend Persistence: `POST /admin/events/:eventId/recompute-intelligence` e batch ja salvam snapshots e impacts v0, retornando `writes` reais.
- Pricing Audit: `PricingCalculateService.criarSnapshotDecisaoPricingEvento(...)` ja monta um draft persistivel de `PricingDecisionSnapshot`; `criarPatchOutcomeSnapshotDecisao(...)` ja monta patch de outcome.
- Status consolidado: P0 tecnico em aproximadamente 82%; release controlado em 75-78%; lacunas principais sao idempotencia, persistencia de decision snapshot, fila/retry/lock, staging e QA.
- Banco: MySQL via TypeORM.

## Politica por tabela

| Tabela | Politica recomendada | Por que |
|---|---|---|
| `event_intelligence_snapshots` | Append-only | Cada recompute representa uma fotografia historica do evento, modelo, metricVersion e dados de entrada. |
| `event_property_impacts` | Append-only por snapshot, com dedupe intra-job | Cada impacto deve apontar para o snapshot que o gerou; retry do mesmo job nao pode duplicar linhas. |
| `pricing_decision_snapshots` | Idempotente por decisao, append-only quando sinais mudam | A decisao e auditavel. O mesmo calculo nao deve aparecer duas vezes; uma nova realidade deve gerar nova decisao. |
| Outcome de decisao | Update controlado no snapshot original | Resultado real altera o estado da decisao original, sem apagar a recomendacao que foi feita. |

## Chave recomendada de idempotencia

### `PricingDecisionSnapshot`

Chave logica recomendada:

```text
pricing-decision-v0:
  eventId:
  propertyAddressId:
  listId:
  analisePrecoId:
  targetDate:
  decisionType:
  selectedScenario:
  modelVersion:
  metricVersion:
  signalsHash
```

Forma compacta:

```text
pricing-decision-v0:{eventId}:{propertyAddressId}:{analisePrecoId}:{targetDate}:{selectedScenario}:{modelVersion}:{metricVersion}:{signalsHash}
```

Campos:

- `eventId`: evento que causou a recomendacao.
- `propertyAddressId`: imovel/endereco impactado.
- `listId`: anuncio, quando existir.
- `analisePrecoId`: origem operacional do impacto; se ausente, usar `no-analysis`.
- `targetDate`: noite alvo em `YYYY-MM-DD`. No v0, usar `event.dataInicio` normalizado ou a primeira noite impactada. Em P1, criar decisao por noite quando a aplicacao de preco for diaria.
- `decisionType`: `event_pricing`.
- `selectedScenario`: `recommended` por padrao; tambem aceita `conservative`, `aggressive` ou `extreme`.
- `modelVersion` e `metricVersion`: entram na chave para que mudanca de modelo gere nova decisao auditavel.
- `signalsHash`: hash canonico dos sinais abaixo.

`signalsHash` deve ser calculado com JSON canonico, chaves ordenadas e numeros normalizados:

```json
{
  "basePriceCents": 50000,
  "currentPriceCents": 50000,
  "marketReferencePriceCents": 70000,
  "eventDemandScore": 82,
  "propertyCaptureScore": 76,
  "supplyCompressionScore": 79,
  "affectedNights": 2,
  "selectedScenario": {
    "scenario": "recommended",
    "priceCents": 90000,
    "multiplier": 1.8,
    "bookingProbability": 0.42,
    "expectedRevenueCents": 75600
  },
  "guardrails": {
    "minMultiplier": 0.8,
    "maxMultiplier": 3,
    "cappedRecommendedPrice": false
  }
}
```

Hash recomendado: SHA-256 truncado para 24 ou 32 caracteres hexadecimais. O truncamento reduz tamanho de indice sem perder seguranca pratica para este volume.

### Curto prazo sem coluna nova

Como a entidade atual ainda nao tem `idempotencyKey`, usar:

- `inputSignals.idempotencyKey`
- `inputSignals.signalsHash`
- `inputSignals.auditTrailVersion`

Antes de inserir:

1. montar o draft com `criarSnapshotDecisaoPricingEvento(...)`;
2. calcular `idempotencyKey`;
3. buscar snapshot existente por `analise_preco_id`, `targetDate`, `event_id`, `property_address_id`, `modelVersion`, `metricVersion`;
4. filtrar no app por `inputSignals.idempotencyKey`;
5. se existir snapshot `draft` ou `suggested`, retornar o existente;
6. se existir snapshot `accepted` ou `applied`, nao sobrescrever; criar nova decisao apenas se os sinais mudaram e marcar risco `existing_active_decision`.

### Medio prazo com migration

Adicionar:

- `idempotencyKey varchar(160) null`
- `signalsHash varchar(64) null`
- indice unico parcial/logico por `idempotencyKey`

Em MySQL, se precisar aceitar `null`, a regra operacional deve garantir que toda decisao nova tenha chave preenchida. O indice unico deve ser criado quando a populacao historica estiver limpa.

## Append-only vs upsert

### `EventIntelligenceSnapshot`

Manter append-only.

Regra:

- Recompute manual novo cria novo snapshot.
- Batch novo cria novo snapshot por evento processado.
- Retry do mesmo job deve reutilizar `jobRunId` e nao duplicar snapshot para o mesmo `event_id`.

Dedup recomendado em retry:

```text
jobRunId + eventId
```

Se ja existir snapshot com a mesma dupla, carregar e reutilizar.

### `EventPropertyImpact`

Manter append-only por snapshot, mas deduplicar dentro do mesmo job.

Chave de dedupe intra-job:

```text
jobRunId + eventId + propertyAddressId + analisePrecoId
```

Se `analisePrecoId` for nulo, usar:

```text
jobRunId + eventId + propertyAddressId + listId + targetDate
```

Ao consultar telas Host/Admin, usar sempre a versao mais recente por:

```text
eventId + propertyAddressId + analisePrecoId
order by generatedAt desc
```

Nao fazer upsert destrutivo em `event_property_impacts`, porque isso apaga a trilha de como o impacto evoluiu entre modelos e recomputes.

### `PricingDecisionSnapshot`

Usar idempotencia por decisao.

Fluxo recomendado:

1. gerar `EventIntelligenceSnapshot`;
2. gerar ou reutilizar `EventPropertyImpact`;
3. montar draft de decisao com o builder do Pricing Audit;
4. calcular `idempotencyKey`;
5. buscar decisao existente;
6. se chave ja existe e status e `draft` ou `suggested`, retornar snapshot existente;
7. se chave nao existe, salvar nova decisao;
8. se sinais mudaram para o mesmo evento/imovel/data e havia draft antigo, marcar antigo como `superseded`;
9. se havia decisao `accepted` ou `applied`, preservar e criar nova decisao apenas como nova recomendacao, com risco de divergencia.

Nunca usar `jobRunId` como chave principal de idempotencia de pricing, porque dois jobs diferentes podem chegar a mesma recomendacao de negocio.

## Status e transicoes de decisao

Estados atuais:

```text
draft -> suggested -> accepted -> applied
draft -> suggested -> rejected
draft -> suggested -> expired
draft -> superseded
suggested -> superseded
```

Regras:

- `draft`: gerado pelo recompute, ainda nao exibido ou ainda sem acao de produto.
- `suggested`: exibido para host/admin como recomendacao acionavel.
- `accepted`: usuario/admin aceitou a recomendacao, mas aplicacao pode ainda nao ter sido confirmada.
- `applied`: preco foi aplicado em canal/calendario.
- `rejected`: recomendacao recusada explicitamente.
- `expired`: evento passou ou janela de aplicacao fechou.
- `superseded`: uma recomendacao nova substituiu a anterior antes de aceite/aplicacao.

Outcome posterior deve atualizar a mesma linha:

- `inputSignals.outcome.status`
- `appliedPriceCents`
- `price_update_id`
- `inputSignals.outcome.realizedRevenueCents`
- `inputSignals.outcome.bookedNights`
- `inputSignals.outcome.revenueDeltaCents`

Nao criar uma nova decisao so para registrar outcome.

## Fila, retry e lock

### Job types

| Job | Uso | Lock |
|---|---|---|
| `event-intelligence.recompute-event` | Recompute manual de um evento | `event-intelligence:event:{eventId}` |
| `event-intelligence.recompute-batch` | Recompute por cidade/periodo/filtro | `event-intelligence:batch:{city}:{from}:{to}:{filtersHash}` |
| `event-intelligence.recompute-stale` | Reprocessar eventos com snapshot antigo | `event-intelligence:stale:{dateBucket}` |
| `pricing-decision.outcome-sync` | Atualizar outcomes posteriores | `pricing-decision:outcome:{snapshotId}` |

### Lock recomendado

Opcoes aceitaveis:

- Redis/BullMQ com lock de job e retry.
- MySQL advisory lock com `GET_LOCK(lockKey, timeoutSeconds)` e `RELEASE_LOCK(lockKey)` se ainda nao houver infraestrutura de fila.
- Tabela de jobs em MySQL, com status, heartbeat e tentativa, se a Urban preferir operar sem Redis neste momento.

Implementado agora:

- `lockKey` single: `event-intelligence:event:{eventId}`;
- `lockKey` batch: hash canonico dos filtros normalizados;
- provider preferencial: `mysql_advisory_lock`;
- fallback sem DB real: `in_process`;
- modo de fila declarado no response: `inline_lock_retry`.
- em batch, cada evento tambem recebe retry curto proprio dentro do lock do lote antes de virar falha parcial.

TTL sugerido:

- evento unico: 15 minutos;
- batch pequeno: 60 minutos;
- stale/backfill: 120 minutos.

Se o job ultrapassar TTL, marcar como `stalled` e permitir retomada com o mesmo `jobRunId`.

### Retry

Politica:

- maximo 3 tentativas automaticas;
- backoff de worker recomendado: 1 min, 5 min, 15 min, com jitter;
- backoff sincrono implementado no endpoint atual: 50 ms, 150 ms;
- retry deve reutilizar o mesmo `jobRunId`;
- cada evento do batch deve rodar em transacao propria;
- falha em um evento nao deve cancelar o batch inteiro;
- erro terminal deve salvar `failedReason`, `failedAt`, `attempts`.

Erros retryable:

- timeout de DB;
- deadlock;
- falha transitoria de rede;
- lock ocupado;
- pool saturado.

Erros nao retryable:

- evento inexistente;
- schema/migration ausente;
- FK impossivel por dado inconsistente;
- payload invalido sem `eventId` ou `propertyAddressId`.

## Transacao recomendada

Para recompute de evento:

```text
BEGIN
  acquire lock(eventId)
  load event + analyses
  create or reuse EventIntelligenceSnapshot by jobRunId + eventId
  create or reuse EventPropertyImpact by jobRunId + eventId + property + analisePreco
  create or reuse PricingDecisionSnapshot by idempotencyKey
  update writes counters
COMMIT
release lock
```

Para batch:

- nao abrir uma transacao unica para todos os eventos;
- cada evento deve ter sua propria transacao;
- manter `jobRunId` do batch em todos os snapshots/impacts/decisions;
- retornar resumo por evento, incluindo falhas parciais.

## Rollout em staging

### Fase 0: preflight

- Rodar migrations em staging.
- Confirmar que as tres tabelas existem.
- Confirmar indices atuais.
- Confirmar que feature flags estao desligadas para hosts.
- Escolher 3 eventos reais com `AnalisePreco` e imoveis impactados.

Gate:

- `event_intelligence_snapshots`, `event_property_impacts` e `pricing_decision_snapshots` existem.
- Nenhum endpoint novo quebra com flag desligada.

### Fase 1: recompute single controlado

- Rodar recompute de 1 evento via API admin.
- Conferir `jobRunId`.
- Conferir contadores `writes`.
- Conferir duplicatas por `jobRunId`.
- Conferir que Host/Admin leem a ultima versao persistida.

Gate:

- snapshot count = 1 por evento/job;
- impacts count igual ao numero de analises persistiveis;
- decision snapshots criados ou, se ainda nao ligados, explicitamente `pricingDecisionSnapshot: false`.

### Fase 2: batch pequeno

- Rodar batch por cidade e janela curta.
- Limitar a 5 ou 10 eventos inicialmente.
- Medir tempo, erros e duplicatas.

Gate:

- sucesso >= 95%;
- nenhuma duplicidade intra-job;
- nenhuma tela fica sem fallback;
- logs contem `jobRunId`.

### Fase 3: UI interna

- Ligar Admin para usuarios internos.
- Manter Host atras de flag.
- Validar radar admin, detalhe de evento, blind spots e links de fonte.

Gate:

- admins conseguem explicar por que uma recomendacao apareceu;
- nenhum evento sem geo vira ponto real de heatmap;
- nenhum preco extremo aparece sem probabilidade/risco.

### Fase 4: beta host

- Ligar Host para ate 10% da base beta.
- Monitorar aceite/rejeicao de recomendacoes e feedback qualitativo.

Gate para ampliar:

- taxa de erro de endpoints < 1%;
- jobs sem duplicidade;
- p95 de recompute single < 60s;
- nenhuma recomendacao aplicada acima de guardrail sem revisao.

## Smoke SQL

Substituir variaveis antes de rodar.

```sql
SET @event_id = 'EVENT_UUID';
SET @job_run_id = 'JOB_RUN_ID';

SELECT COUNT(*) AS snapshots
FROM event_intelligence_snapshots
WHERE event_id = @event_id
  AND jobRunId = @job_run_id;

SELECT event_id, jobRunId, COUNT(*) AS qty
FROM event_intelligence_snapshots
WHERE jobRunId = @job_run_id
GROUP BY event_id, jobRunId
HAVING COUNT(*) > 1;

SELECT event_id, property_address_id, COALESCE(analise_preco_id, 'no-analysis') AS analysis_key, jobRunId, COUNT(*) AS qty
FROM event_property_impacts
WHERE jobRunId = @job_run_id
GROUP BY event_id, property_address_id, COALESCE(analise_preco_id, 'no-analysis'), jobRunId
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS impacts_with_curve
FROM event_property_impacts
WHERE jobRunId = @job_run_id
  AND bookingProbability IS NOT NULL
  AND priceAbsorptionScenarios IS NOT NULL;

SELECT COUNT(*) AS pricing_decisions
FROM pricing_decision_snapshots
WHERE jobRunId = @job_run_id;
```

Smoke para decisao idempotente, depois que `inputSignals.idempotencyKey` estiver populado:

```sql
SELECT
  JSON_UNQUOTE(JSON_EXTRACT(inputSignals, '$.idempotencyKey')) AS idempotency_key,
  COUNT(*) AS qty
FROM pricing_decision_snapshots
WHERE event_id = @event_id
GROUP BY JSON_UNQUOTE(JSON_EXTRACT(inputSignals, '$.idempotencyKey'))
HAVING COUNT(*) > 1;
```

Smoke de qualidade JSON:

```sql
SELECT COUNT(*) AS invalid_input_signals
FROM pricing_decision_snapshots
WHERE inputSignals IS NOT NULL
  AND JSON_VALID(inputSignals) = 0;

SELECT COUNT(*) AS missing_selected_scenario
FROM pricing_decision_snapshots
WHERE inputSignals IS NOT NULL
  AND JSON_EXTRACT(inputSignals, '$.selectedScenario.scenario') IS NULL;
```

Smoke de leitura de ultima versao:

```sql
SELECT eis.event_id, eis.generatedAt, eis.jobRunId, eis.eventDemandScore, eis.confidence
FROM event_intelligence_snapshots eis
JOIN (
  SELECT event_id, MAX(generatedAt) AS maxGeneratedAt
  FROM event_intelligence_snapshots
  GROUP BY event_id
) latest
  ON latest.event_id = eis.event_id
 AND latest.maxGeneratedAt = eis.generatedAt
WHERE eis.event_id = @event_id;
```

## Smoke API

Exemplo com token admin:

```bash
curl -sS -X POST "$API_BASE/admin/events/$EVENT_ID/recompute-intelligence" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Verificar na resposta:

- `status` = `ok`;
- `jobRunId` preenchido;
- `runtime.lockProvider` = `mysql_advisory_lock` em DB MySQL real ou `in_process` em smoke local sem advisory lock;
- `runtime.attempts` >= 1;
- `writes.created.eventIntelligenceSnapshots + writes.reused.eventIntelligenceSnapshots` = 1 no recompute single;
- `writes.eventIntelligenceSnapshot` = `true`;
- `writes.eventPropertyImpact` = `true` quando houver `AnalisePreco`;
- `writes.pricingDecisionSnapshot` = `true` quando houver impacto persistivel;
- `writes.pricingDecisionSnapshotsCount` igual ao numero de decisoes criadas ou reutilizadas conforme politica final.

Smoke de retry manual:

1. Rodar o recompute single uma vez.
2. Repetir o mesmo recompute para o mesmo evento.
3. Confirmar que o segundo recompute cria novo `event_intelligence_snapshot` por ser job manual novo, mas reutiliza `pricing_decision_snapshot` se os sinais de negocio forem identicos.
4. Confirmar que telas Host/Admin mostram apenas o ultimo impact por evento/imovel/analise.

Batch pequeno:

```bash
curl -sS -X POST "$API_BASE/admin/events/intelligence/recompute?city=Sao%20Paulo&from=2026-06-01&to=2026-06-30&limit=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

Leitura Host:

```bash
curl -sS "$API_BASE/host/events/$EVENT_ID/property-impact" \
  -H "Authorization: Bearer $HOST_TOKEN"
```

Leitura Admin:

```bash
curl -sS "$API_BASE/admin/events/$EVENT_ID/property-impact" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Criticos:

- `dataStatus` deve virar `persisted` quando houver impacto persistido.
- `jobRunId` deve aparecer nos payloads persistidos.
- `bookingProbability` e `priceAbsorptionScenarios` nao devem sumir apos persistencia.

## Observabilidade minima

Logar em cada job:

- `jobRunId`;
- `scope`: event, batch, stale;
- `eventId`;
- filtros do batch;
- `attempt`;
- tempo total;
- snapshots criados/reutilizados;
- impacts criados/reutilizados;
- decision snapshots criados/reutilizados/superseded;
- skips por falta de `AnalisePreco`, imovel, host ou preco base;
- erro com stack apenas em log seguro.

Metricas:

- `event_intelligence_recompute_success_total`;
- `event_intelligence_recompute_failed_total`;
- `event_intelligence_recompute_duration_ms`;
- `event_property_impacts_written_total`;
- `pricing_decision_snapshots_written_total`;
- `pricing_decision_snapshots_reused_total`;
- `pricing_decision_snapshots_superseded_total`;
- `recompute_duplicate_detected_total`.

Alertas:

- duplicidade intra-job > 0;
- falhas de recompute > 5% em 30 min;
- p95 recompute single > 60s;
- batch stalled > 1h;
- `pricingDecisionSnapshotsCount = 0` em eventos com impacts persistidos apos a frente Backend Decision Persistence.

## Rollback

Rollback deve preservar auditoria.

Passos:

1. desligar flag de recompute/event radar no backend;
2. pausar fila;
3. desligar UI host/admin por feature flag;
4. manter tabelas e dados;
5. nao deletar snapshots gerados;
6. marcar jobs novos como `paused` ou `cancelled`;
7. investigar por `jobRunId`;
8. se houver recomendacao errada exibida, criar registro de supersedencia ou invalidacao, nao apagar a linha.

## Sequencia recomendada para Backend Decision Persistence

1. Injetar `Repository<PricingDecisionSnapshot>` no modulo/servico que persiste recompute.
2. Injetar ou reutilizar `PricingCalculateService`.
3. Para cada `EventPropertyImpact` persistido, montar draft com `criarSnapshotDecisaoPricingEvento(...)`.
4. Calcular `signalsHash` e `idempotencyKey`.
5. Preencher `inputSignals.idempotencyKey` e `inputSignals.signalsHash`.
6. Buscar decisao existente por chave.
7. Reutilizar existente quando a chave for igual.
8. Criar nova decisao quando os sinais mudarem.
9. Marcar drafts anteriores como `superseded` quando aplicavel.
10. Atualizar `writes.pricingDecisionSnapshot` e `writes.pricingDecisionSnapshotsCount`.
11. Criar specs para retry duplo, recompute repetido e mudanca real de sinal.

## Criterios de aceite

- Repetir o mesmo retry com o mesmo `jobRunId` nao duplica snapshot, impact ou decision.
- Repetir recompute manual novo pode criar novo snapshot de evento, mas nao duplica decisao se a recomendacao de negocio for identica.
- Mudanca de modelo, metricVersion, preco base, guardrail ou cenario recomendado cria nova decisao auditavel.
- Outcome atualiza a decisao original.
- Batch continua mesmo com falha parcial.
- Logs e SQL permitem explicar qualquer recomendacao por `jobRunId` e `idempotencyKey`.

## Lacunas deliberadas

- Fila externa ainda nao foi criada; o codigo atual usa recompute sincrono com lock e retry curto.
- Ainda falta decidir se a fila P1 sera BullMQ/Redis ou MySQL job table dedicada.
- Ainda falta migration para `idempotencyKey` e `signalsHash` como colunas dedicadas.
- Ainda falta definir se P1 tera decisao por noite ou por evento agregado.
- Smoke SQL/API precisa ser rodado em staging com IDs reais depois da migration aplicada.
