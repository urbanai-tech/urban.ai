# Runbook — Fonte de eventos sem dados (zero-yield) e duplo agendamento

Owner: engenharia de dados/backend · Última revisão: 2026-10-24

## Problema (D2)

Quando o HTML ou a API de um site muda, o spider/coletor **termina com sucesso e 0 itens**.
Nada alerta: `run_all.py` só reporta o status do agendamento, o Scrapyd marca o job como
finalizado e o Prefect fica verde. O `collector-staleness` (07:00 BRT) só enxerga eventos
**novos** (`createdAt`), então não percebe uma fonte que parou mas cujos eventos já existiam.

## Detecção (backend, independente do scheduler)

Serviço `CollectorZeroYieldService` (`urban-ai-backend-main/src/evento/collector-zero-yield.service.ts`),
cron `collector-zero-yield` a cada 6 h (`30 */6 * * *`, America/Sao_Paulo; aparece em
`/admin/jobs` como `AdminJobRun`).

Para cada `source`, com base no que já foi ingerido (`event_sources.lastSeenAt`, com
`events.dataCrawl` como fallback legado — cada item reenviado atualiza esses campos):

- **baseline** = itens vistos nos últimos `COLLECTOR_ZERO_YIELD_BASELINE_DAYS` (a fonte é "normalmente ativa" se ≥ `MIN_BASELINE_ITEMS`);
- **janela** = últimas `COLLECTOR_ZERO_YIELD_WINDOW_HOURS` horas;
- **alerta** quando a fonte é normalmente ativa e **nada** foi visto na janela.

Fontes que nunca tiveram volume (baseline baixo) e fontes ignoradas não alertam.

### Variáveis (todas opcionais)

| Variável | Padrão | Efeito |
|---|---|---|
| `COLLECTOR_ZERO_YIELD_ENABLED` | `true` | `false` desliga cron e painel. |
| `COLLECTOR_ZERO_YIELD_WINDOW_HOURS` | `36` | Silêncio máximo tolerado (coletores rodam a cada 6 h; spiders 1×/dia). |
| `COLLECTOR_ZERO_YIELD_BASELINE_DAYS` | `14` | Janela para considerar a fonte "normalmente ativa". |
| `COLLECTOR_ZERO_YIELD_MIN_BASELINE_ITEMS` | `5` | Mínimo de itens no baseline. |
| `COLLECTOR_ZERO_YIELD_IGNORE_SOURCES` | `admin-*,marcha-para-jesus` | Lista separada por vírgula; sufixo `*` = prefixo. Curadoria manual e evento anual não devem alertar. |
| `COLLECTOR_ZERO_YIELD_SOURCE_WINDOWS` | vazio | Janela própria por fonte, ex.: `api-football:168,sympla:72`. |
| `COLLECTOR_ZERO_YIELD_REALERT_HOURS` | `24` | Intervalo para reenviar o mesmo alerta (estado em memória; reinício rearma). |

### Onde o alerta aparece

1. **Painel admin** `/admin/collectors-health` (endpoint `GET /admin/events/collectors-health`):
   campo `zeroYield` (config + `alerts[]`), e em cada fonte afetada `status: "zero_yield"`,
   `signals: ["zero_yield"]` e `zeroYield: {...}`; a página mostra um banner e o badge de status.
2. **Sentry**: `captureMessage("Fonte de eventos sem dados (zero-yield)")`, nível `error`,
   tag `component=collector-zero-yield`, `extra.alerts` com as fontes.
3. **E-mail** para `ADMIN_ALERT_EMAIL` (fallback `OPS_ALERT_EMAIL`), via `MailerService`.
   Sem nenhuma das duas, só Sentry/log.
4. **Webscraping**: o coletor loga `WARNING [<source>] ZERO_ITEMS ...` quando `fetch_raw()`
   devolve 0 itens (ou nenhum item sobrevive ao `normalize`), e o spider Scrapy loga
   `WARNING [scraper-<spider>] ZERO_ITEMS ...` ao fechar sem itens — útil nos logs do Railway.

## Triagem quando o alerta dispara

1. Abra `/admin/collectors-health`: confira `Último crawl` e `status` da fonte.
2. Rode a fonte à mão com `DRY_RUN=true python -m urban_webscrapping.collectors.<nome>` (ou o
   spider via Scrapyd) e veja o log `ZERO_ITEMS`/erros HTTP.
3. Causas comuns: seletor/HTML mudou; API passou a exigir chave/headers; bloqueio (403/429);
   chave expirada (`status=missing_key` no painel).
4. Corrija o coletor. O alerta se resolve sozinho no ciclo seguinte (≤ 6 h) em que a fonte
   voltar a enviar itens.
5. Falso positivo recorrente (fonte sazonal/semanal): aumente a janela dessa fonte em
   `COLLECTOR_ZERO_YIELD_SOURCE_WINDOWS` ou inclua-a em `COLLECTOR_ZERO_YIELD_IGNORE_SOURCES`.

## Agendamento duplo (estado atual — apenas documentado)

Hoje **dois gatilhos coexistem** (ver `ARQUITETURA-ATUAL.md` §3):

- **Prefect**: deployment `urban_webscraping` (`trigger_all_spiders`) às 03:00 UTC, pede ao Scrapyd os spiders.
- **Cron interno** do container de webscraping (`auth_proxy.py`): roda `collectors.run_all` a cada
  `COLLECTOR_CRON_INTERVAL_SECONDS` (padrão 6 h) e ao subir (`RUN_COLLECTORS_ON_BOOT`); com
  `RUN_LEGACY_SPIDERS=true` também agenda os spiders no Scrapyd — ou seja, os spiders podem
  rodar pelos dois caminhos.

Consequências: execução redundante dos spiders (mais carga/risco de bloqueio nas fontes),
dois "verdes" que não significam dados novos e dificuldade de saber qual caminho falhou.

**Recomendação (decisão de ops, não aplicada em código):** escolher um dono por tipo de fonte —
coletores REST no cron interno (6 h, sem dependência do Prefect Cloud) e spiders Scrapy num só
agendador (Prefect *ou* `RUN_LEGACY_SPIDERS=true`, nunca os dois). Seja qual for a escolha, o
detector zero-yield do backend continua valendo, pois olha o dado recebido e não o scheduler.
