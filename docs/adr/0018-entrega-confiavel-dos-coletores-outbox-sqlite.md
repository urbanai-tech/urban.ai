# ADR 0018 — Entrega confiável dos coletores: outbox SQLite com quarentena

**Status:** Aceito (26/10/2026) — registra o que já vigora. Operação em [`runbooks/ingest-outbox-entrega.md`](../runbooks/ingest-outbox-entrega.md).

## Contexto

Spiders Scrapy e coletores HTTP (`urban-webscraping-main/`) enviam eventos para `POST /events/ingest`. Se o backend estiver fora do ar, o processo cair ou o envio final falhar, o evento coletado se perdia, e o custo de recoletar (cotas de API, bloqueios) é alto. Um evento inválido, por outro lado, não pode travar o resto do lote.

## Opções consideradas

1. **Enviar direto e logar a falha.** Perde dados.
2. **Fila externa (Redis/SQS) entre coletor e backend.** Mais infraestrutura para um processo que já tem disco.
3. **Outbox em SQLite local, com retentativa e quarentena** (escolhida).

## Decisão

- `UrbanBackendClient` (`urban_webscrapping/utils/urban_backend_client.py`) é usado pela pipeline dos spiders e pelo `BaseCollector`. `add_event` grava o evento no SQLite (WAL, `utils/ingest_outbox.py`) **antes** de seguir; só é apagado depois de o backend confirmar o lote.
- Falha transitória (rede, 5xx, 429, 401/403, resposta inválida) devolve o lote à fila com backoff de 30 s até 1 h. Entrega **pelo menos uma vez**; a idempotência é do backend (`dedupHash`).
- Rejeição permanente (`status: "skipped"` do backend, ou HTTP 400/413/422 após dividir o lote até isolar o item) vai para a **quarentena** (`rejected_events`) com fonte e motivo. Teto de 50 000 pendentes (`URBAN_INGEST_OUTBOX_MAX_EVENTS`) e 10 000 itens em quarentena.
- A resposta do backend é validada (`total` = lote; `created + updated + skipped = total`); divergência não confirma o lote.
- Autenticação por `URBAN_EVENTS_INGEST_API_KEY` apenas; o login por e-mail/senha dos coletores foi removido.

## Consequências

- (+) Backend fora do ar ou redeploy no meio da coleta não perde eventos; itens ruins ficam isolados e auditáveis.
- (−) Exige **volume persistente** no serviço de webscraping (`URBAN_INGEST_OUTBOX_PATH`); sem ele, a fila vale só durante a vida do container e os pendentes somem no redeploy (o cliente loga ERROR e cai para buffer em memória).
- (−) Dois spiders concorrentes no mesmo host são suportados por leases, mas o arquivo não pode ser compartilhado entre hosts.
- (−) Entrega repetida é esperada; qualquer consumidor novo do endpoint precisa ser idempotente.
