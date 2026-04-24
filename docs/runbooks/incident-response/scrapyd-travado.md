# Incidente — Scrapyd travado / spiders não rodam

**Severidade:** SEV2 (não bloqueia uso, mas trava o pipeline de eventos novos).
**RTO alvo:** 4h (não user-facing, RTO mais frouxo que SEV1).

## Detecção

- Painel Prefect Cloud mostra `trigger_all_spiders` falhando com erro de conexão para `urban-webscraping-production.up.railway.app`.
- Tabela `evento` no MySQL não recebe linhas novas há 24h+ (query: `SELECT MAX(criado_em) FROM event`).
- Logs Railway do serviço `urban-webscraping`: pode mostrar Scrapyd em loop, OOM, ou processo morto.

## Triagem

1. **Anotar hora.**
2. Painel Railway → `urban-webscraping` → status:
   - **Crashed**: serviço caiu — provavelmente OOM (Playwright + Scrapy consomem bastante).
   - **Running mas não responde**: deadlock interno do Scrapyd.
   - **Status ok**: o problema é em outro lugar (auth_proxy, networking).

## Mitigação

### Caso 1 — Restart simples

Quase sempre resolve.

**Ação:** painel Railway → Service → Restart. Aguardar 60s; conferir logs.

### Caso 2 — OOM persistente

Logs mostram processo killed por memória.

**Ação curta:** subir plano para dobrar memória do serviço.
**Ação longa:** revisar o concurrency dos spiders — `CONCURRENT_REQUESTS=1` já está conservador, mas se Playwright estiver rodando, a memória dele que cresce.

### Caso 3 — `auth_proxy.py` rejeitando o Prefect

Logs mostram `403 Forbidden` quando Prefect tenta disparar via `/crawl.json`.

**Ação:** confirmar que `SCRAPYD_API_KEY` está sincronizada entre os dois ambientes (Prefect Cloud Block + Railway env). Pode ter rotacionado em um lado e esquecido o outro.

### Caso 4 — Site externo bloqueando

Spiders saem mas voltam todos com 0 results — possível anti-bot ativo (Eventim, Sympla atualizaram defesas).

**Ação:**
- Não é incidente "nosso" — é mudança upstream.
- Atualizar o spider afetado, fazer deploy.
- Se for recorrente em vários sites, é hora de migrar para APIs oficiais (Sympla API, Prefeitura SP) — escalar para Gustavo.

## Resolução

- Disparar manualmente `trigger_all_spiders` no Prefect Cloud para confirmar.
- Em 1h, a tabela `event` deve receber linhas novas.
- Se ok: alerta fechado.

## Após estabilizar

- Se o restart resolveu mas a causa é desconhecida: monitorar próximas 48h e abrir issue para investigação.
- Se OOM virou padrão: planejar upgrade de plano + revisão de concurrency.
- Documentar mudança em `docs/postmortems/` se downtime > 24h.

## O que NÃO fazer

- ❌ Restartar o serviço em loop — se restart não resolve em 2 tentativas, há causa raiz a investigar.
- ❌ Desabilitar o auth_proxy "para testar" — a `x-api-key` é a única proteção do Scrapyd hoje.
- ❌ Mexer nos spiders sem testar localmente primeiro (pode quebrar mais sites de uma vez).

---

*Última atualização: 24/04/2026*
