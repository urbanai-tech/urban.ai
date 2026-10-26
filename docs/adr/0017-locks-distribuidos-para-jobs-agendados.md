# ADR 0017 — Locks distribuídos para jobs agendados e timeouts HTTP padronizados

**Status:** Aceito (26/10/2026) — registra o que já vigora.

## Contexto

O backend tem dezenas de jobs `@Cron` (e-mail, push, Stays, enriquecimento, coleta). Com duas ou mais réplicas, cada uma dispararia o mesmo job: e-mail em dobro, preço enviado duas vezes. Além disso, uma chamada externa sem prazo pode pendurar uma request ou um cron inteiro.

## Opções consideradas

1. **Réplica única.** Simples, mas impede escalar e trava num deploy com sobreposição.
2. **Lock só em MySQL (`GET_LOCK`).** Funciona, mas prende uma conexão por job longo.
3. **Redis `SET NX PX` por tick + claim por janela em MySQL** (escolhida).

## Decisão

- **Lock por tick** (`urban-ai-backend-main/src/common/redis-lock.ts`, `RedisLockService`): adquire com `SET urban:lock:<nome> <token> NX PX <ttl>`; libera e renova por script Lua só se o valor ainda for o **nosso token**, para uma réplica lenta nunca apagar o lock de outra. TTL padrão 2 min, com renovação automática enquanto o job roda. `ScheduledJobRunnerService.run` usa `job:<nome>`.
- **Fail-closed**: com o Redis fora do ar, o job é **pulado** e o erro logado; só roda sem lock em runtime local (`development`/`dev`/`test`/`local`) ou com `failOpen: true` explícito. Perder um tick é preferível a duplicar um efeito colateral. `REDIS_JOB_LOCK_ENABLED=false` desliga o lock (instância única).
- **Janela única**: `ScheduledJobRunnerService.runOncePerWindow` (e o recompute de `event-intelligence`) usa `SELECT GET_LOCK(?, 0)` do MySQL como claim da janela; quem não ganha devolve o resultado "duplicado". O próximo tick recupera o trabalho que ficou sem execução.
- **Timeouts HTTP**: `src/common/http-timeouts.ts` define `HTTP_TIMEOUT_MS` — `fast` 10 s, `default` 15 s, `slow` 20 s, `heavy` 45 s (Gemini, SPARQL), `scrape` 60 s (Firecrawl), `stripe` 20 s — e `fetchWithTimeout` (AbortController) para `fetch`, que não tem timeout nativo. Chamadas de saída devem usar essas constantes, não números soltos.

## Consequências

- (+) Escalar para N réplicas sem duplicar e-mail, push ou preço; nenhuma chamada externa fica pendurada indefinidamente.
- (−) Redis fora do ar = jobs agendados parados em produção (por escolha). O Redis passa a ser dependência crítica também para cron, não só para a fila Bull.
- (−) Job mais longo que o TTL depende da renovação; se ela falhar, outra réplica pode assumir (`stats.lockLost` registra).
- (−) Timeout curto demais gera falso erro em fornecedor lento; ajustar a constante, não o chamador.
