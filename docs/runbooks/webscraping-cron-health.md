# Runbook - Webscraping cron health

Data: 2026-05-15

Objetivo: acompanhar se o servico `urban-webscraping` esta vivo, se o Scrapyd interno responde e se o cron dos coletores esta executando sem depender apenas de logs do Railway.

## Endpoints

Os endpoints abaixo nao exigem API key e nao retornam segredos:

| Endpoint | Uso |
|---|---|
| `/health` | Health geral do webscraping para monitoramento humano ou uptime check. |
| `/health.json` | Alias JSON do health geral. |
| `/health/live` | Alias para liveness externo. |
| `/cron-status.json` | Alias focado no cron dos coletores. |

Resposta esperada:

```json
{
  "status": "ok",
  "service": "urban-webscraping",
  "authConfigured": true,
  "scrapyd": { "status": "ready" },
  "collectorCron": {
    "enabled": true,
    "intervalSeconds": 21600,
    "runOnBoot": true,
    "running": false,
    "runs": 3,
    "lastStatus": "success",
    "lastError": null,
    "nextRunAt": "2026-05-15T21:00:00Z"
  }
}
```

## Como interpretar

| Campo | Sinal bom | Acao se ruim |
|---|---|---|
| `status` | `ok` | Se `degraded`, verificar `scrapyd.status` e `collectorCron.lastStatus`. |
| `scrapyd.status` | `ready` | Se `unavailable`, reiniciar servico e revisar logs de boot/Scrapyd. |
| `collectorCron.lastStatus` | `success` ou `running` | Se `failed`, revisar `lastError`, logs do Railway e rodar collector manual se necessario. |
| `collectorCron.nextRunAt` | Data futura coerente com `intervalSeconds` | Se nulo por muito tempo e `running=false`, reiniciar servico. |
| `collectorCron.runs` | Cresce ao longo do dia | Se nao cresce, conferir `RUN_COLLECTORS_ON_BOOT` e `COLLECTOR_CRON_INTERVAL_SECONDS`. |

## Gate operacional F2

Para considerar a camada de eventos saudavel no alpha/beta:

- `/health` deve responder `200` com `status=ok`.
- `collectorCron.lastStatus` deve ser `success` nas ultimas 24h.
- `collectorCron.nextRunAt` deve estar preenchido.
- O painel admin de collectors deve mostrar fontes criticas sem `missing_key` e sem `stale` prolongado.
- O banco deve apresentar crescimento de eventos futuros SP/30d apos execucoes reais.

## Incidente rapido

1. Abrir `/health` do webscraping em producao.
2. Se `scrapyd.status=unavailable`, reiniciar o servico webscraping no Railway e acompanhar novo health.
3. Se `collectorCron.lastStatus=failed`, copiar somente o erro resumido de `lastError` para o registro de incidente e consultar logs completos no Railway.
4. Se uma API key estiver ausente, corrigir variavel no servico correto e aguardar proximo ciclo ou rodar execucao manual controlada.
5. Se o health estiver `ok`, mas eventos futuros nao crescerem, seguir `docs/runbooks/eventos-fallback-manual.md`.
