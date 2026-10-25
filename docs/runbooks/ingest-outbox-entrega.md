# Entrega confiável de eventos dos scrapers (outbox)

Revisado: 2026-10-25

Cobre a fila SQLite (`outbox`) que garante que eventos de spiders Scrapy e de coletores HTTP não se percam quando o backend está fora do ar, quando o processo cai ou quando o flush final falha. Complementa [`events-ingest-service-account.md`](./events-ingest-service-account.md) (autenticação e contrato do `POST /events/ingest`).

## Como funciona

1. `UrbanIngestPipeline` (spiders) e `BaseCollector` (coletores, `collectors/run_all.py`) usam o **mesmo** `UrbanBackendClient`.
2. `add_event` grava o evento no SQLite (WAL) **antes** de seguir. Só depois de o backend confirmar o lote o evento é apagado da fila.
3. Ao fechar o spider/coletor o cliente drena todos os lotes elegíveis (inclusive o backlog de execuções anteriores).
4. Falha transitória (rede, 5xx, 429, 401/403, resposta inválida): o lote volta à fila com **backoff** de 30 s, 60 s, 120 s ... até 1 h. A próxima execução reenvia.
5. Entrega **pelo menos uma vez**: um timeout depois de o backend gravar causa reenvio; a idempotência é do backend (`dedupHash`).
6. Rejeição permanente vai para a **quarentena** (`rejected_events`) com fonte e motivo, sem travar o resto:
   - evento com `status: "skipped"` na resposta do backend (motivo = `reason` do backend);
   - HTTP 400/413/422 para o lote: o cliente divide o lote até isolar o evento ruim (`http_422: ...`).
7. Teto: `URBAN_INGEST_OUTBOX_MAX_EVENTS` (padrão 50 000) pendentes. Ao estourar, os mais antigos sem lease vão para a quarentena com motivo `outbox_cap_exceeded` e há log ERROR. A quarentena guarda no máximo 10 000 itens (os mais recentes).

A resposta do backend é validada: `total` deve ser igual ao lote enviado e `created + updated + skipped = total`; com `skipped > 0` o `results` por evento é obrigatório e deve bater com as contagens. Qualquer divergência **não** confirma o lote (ele permanece na fila).

## Configuração

| Variável | Obrigatória | Descrição |
|---|---|---|
| `URBAN_EVENTS_INGEST_API_KEY` | Sim | Única credencial aceita; habilita a pipeline e os coletores. O login `URBAN_COLLECTOR_EMAIL/PASSWORD` foi **removido** (o backend nunca o aceitou). |
| `URBAN_INGEST_OUTBOX_PATH` | Sim em produção | Arquivo SQLite da fila. Padrão: `/var/lib/scrapyd/dbs/ingest-outbox.sqlite3` se `/var/lib/scrapyd` existir, senão `.urban-ingest/outbox.sqlite3`. |
| `URBAN_INGEST_OUTBOX_MAX_EVENTS` | Não | Teto de pendentes (padrão 50 000). |

### Railway: volume persistente é obrigatório

O sistema de arquivos do container é efêmero. **Monte um volume persistente do Railway no serviço `urban-webscraping`** (por exemplo em `/var/lib/scrapyd`) e aponte `URBAN_INGEST_OUTBOX_PATH` para dentro dele. Sem volume a fila funciona durante a vida do container (cobre backend fora do ar entre execuções), mas **os eventos pendentes são perdidos no redeploy/restart**. Se o arquivo não puder ser aberto, o cliente loga ERROR (`SEM durabilidade`), usa buffer em memória e a stat `urban_ingest/outbox_degraded` fica 1.

Não compartilhe o arquivo entre hosts (NFS); vários processos no mesmo host (spiders concorrentes no Scrapyd) são suportados via leases.

## Sinais e alertas

| Sinal | Significado | Ação |
|---|---|---|
| Log ERROR `UrbanIngestPipeline NÃO configurada em produção` e stat `urban_ingest/misconfigured=1` | Falta `URBAN_EVENTS_INGEST_API_KEY` | Configurar a chave no serviço de webscraping e reiniciar. |
| `run_all` sai com código 1 e `missing required env: URBAN_EVENTS_INGEST_API_KEY` | Idem, no runner de coletores | Idem. |
| Log ERROR `N evento(s) NÃO confirmados pelo backend`; stats `urban_ingest/pending_after_close > 0`, `urban_ingest/delivery_failed=1`; coletor com erro `outbox_pending: N` | Backend fora do ar, chave recusada (401/403) ou resposta inválida | Checar backend e a chave; os eventos são reenviados na próxima execução. |
| Log WARNING `Ingest REJEITOU evento: source=... reason=...` | Backend rejeitou o item (dado inválido da fonte) | Ver motivo; corrigir o coletor/spider da `source`. Item fica na quarentena. |
| Log ERROR `Outbox de ingestão acima do teto` | Backend indisponível por tempo demais | Restabelecer o backend; revisar o teto. |
| Stat `urban_ingest/rejected`, `received`, `created`, `updated` | Contadores da execução (spiders) | Acompanhar no log do Scrapyd. |

## Inspeção (sem enviar requisições nem expor eventos)

```bash
python -m urban_webscrapping.utils.ingest_outbox "$URBAN_INGEST_OUTBOX_PATH" --destination "$URBAN_API_BASE"
# {"pending": 0, "leased": 0, "deferred": 0, "rejected": 0}
python -m urban_webscrapping.utils.ingest_outbox "$URBAN_INGEST_OUTBOX_PATH" --destination "$URBAN_API_BASE" --rejections
# [{"id": 1, "source": "scraper-sympla", "reason": "...", "rejected_at": 1761400000.0}]
```

- `pending`: eventos na fila; `leased`: em envio agora; `deferred`: aguardando backoff; `rejected`: em quarentena.
- `--destination` deve ser igual a `URBAN_API_BASE` (a fila é separada por destino).
- Reenfileirar uma rejeição já revisada: `IngestOutbox(path, destino).requeue(<id>)` (uma única vez por item).

## Remoção do login legado

`URBAN_COLLECTOR_EMAIL` e `URBAN_COLLECTOR_PASSWORD` não têm mais efeito: foram removidos de `UrbanBackendClient`, de `UrbanIngestPipeline` e do pré-requisito do `run_all`. Podem ser apagadas das variáveis do serviço. Contas JWT de coletores não devem mais existir (ver regra "Não usar JWT admin para automação" no runbook de ingest).
