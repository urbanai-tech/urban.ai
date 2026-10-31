# Runbook — Histórico de mudanças de evento e lead time

Owner: engenharia de dados/backend · Última revisão: 2026-10-31

## O que é

A tabela `event_change_history` guarda, para cada evento, a primeira vez que entrou (`first_seen`) e as
mudanças relevantes entre ingestões. O evento nunca é duplicado nem apagado por causa de uma mudança.

| Tipo | Quando |
|---|---|
| `first_seen` | Criação do evento (eventos antigos foram semeados de `events.createdAt` na migration). |
| `rescheduled` | A **mesma fonte** reenviou o evento com outro dia (em SP) ou horário além da tolerância. |
| `venue_changed` / `url_changed` | A mesma fonte reenviou outro endereço normalizado / outra URL canônica. |
| `cancelled` / `postponed` | A fonte informou `status` cancelado/suspenso ou adiado (campo opcional do ingest). |
| `possibly_cancelled` | Evento futuro não visto na fonte há `EVENT_POSSIBLY_CANCELLED_DAYS` dias (cron diário 06:15 BRT, `event-possibly-cancelled`). |
| `reappeared` | Um evento marcado como possivelmente cancelado voltou a aparecer. |

Salvaguardas: data/venue/URL só são comparados entre envios da mesma fonte (fontes diferentes divergem
naturalmente); fontes ignoradas (`COLLECTOR_ZERO_YIELD_IGNORE_SOURCES`, ex.: `admin-*`) nunca são marcadas;
se a própria fonte ficou muda no período, o sumiço é falha do coletor (zero-yield), não cancelamento.

## Variáveis (todas opcionais)

| Variável | Padrão | Efeito |
|---|---|---|
| `EVENT_HISTORY_ENABLED` | `true` | `false` desliga o registro (a ingestão não é afetada). |
| `EVENT_HISTORY_APPLY_RESCHEDULE` | `false` | `true` atualiza `dataInicio`/`dataFim` do evento quando a fonte remarca. Padrão só registra. |
| `EVENT_POSSIBLY_CANCELLED_DAYS` | `7` | Dias sem ver um evento futuro na fonte para marcá-lo. |
| `EVENT_RESCHEDULE_TOLERANCE_MIN` | `30` | Diferença de horário abaixo disso (no mesmo dia) não é remarcação. |
| `COLLECTOR_NEVER_DELIVERED_ENABLED` | `true` | Alerta de fonte configurada que nunca entregou. |
| `COLLECTOR_NEVER_DELIVERED_DAYS` | `7` | Dias de espera desde que o cron viu a fonte como configurada. |

## Lead time

Antecedência em dias entre `first_seen` e `dataInicio` (eventos canônicos, dentro da cobertura, de 90 dias atrás
a 180 à frente). Eventos que entraram depois de começar ficam fora das estatísticas (contados à parte). Porte:
maior entre público esperado e capacidade do venue — grande ≥ 10 mil, médio ≥ 2 mil. Meta de produto: mediana ≥ 21 dias.

## Fonte configurada que nunca entregou

"Configurada" = está em `collector-registry.ts` com todas as chaves (`requiredEnv`) presentes. A espera conta a
partir da primeira execução do cron `collector-zero-yield` que a viu configurada (`collector_alert_state`, tipo
`expected`); se a chave sair e voltar, a espera recomeça. Se a fonte é intencionalmente inativa, inclua-a em
`COLLECTOR_ZERO_YIELD_IGNORE_SOURCES`. O estado de realerta (`COLLECTOR_ZERO_YIELD_REALERT_HOURS`) agora fica na
mesma tabela e sobrevive a deploy; sem a tabela (migration pendente) cai para memória.

## Onde ver

`/admin/event-coverage` (abas Qualidade e Mudanças); API `GET /admin/event-coverage/changes?days=&types=&limit=` e
`GET /admin/event-coverage/lead-time?days=`.

## Rollback

`npm run migration:revert` (duas vezes) remove as tabelas; nada em `events` muda. Para só parar de registrar:
`EVENT_HISTORY_ENABLED=false`.
