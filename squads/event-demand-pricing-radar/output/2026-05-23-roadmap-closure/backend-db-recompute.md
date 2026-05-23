# Backend DB & Recompute - fechamento de roadmap

Data: 2026-05-23
Frente: Backend DB & Recompute
Squad: `event-demand-pricing-radar`

## Resumo executivo

Fechei a lacuna principal de recompute operacional no backend: retry do mesmo job agora reutiliza o mesmo `jobRunId` e nao duplica `EventIntelligenceSnapshot`, `EventPropertyImpact` nem `PricingDecisionSnapshot` quando a tentativa anterior ja persistiu parte do trabalho. O endpoint continua sincrono, mas agora roda sob lock e retry curto; em MySQL real tenta `GET_LOCK`/`RELEASE_LOCK`, e em ambiente sem DB real usa lock em processo.

O retorno do recompute tambem ficou auditavel para staging: `runtime.lockKey`, `runtime.lockProvider`, `runtime.attempts`, `runtime.operationRetries`, `runtime.retryDelaysMs`, `writes.created`, `writes.reused` e `writes.skipped` mostram se a execucao criou ou reaproveitou linhas. No MySQL real, o advisory lock fica preso na mesma conexao via `QueryRunner` ate o `RELEASE_LOCK`.

## O que mudou

- `EventIntelligenceService`
  - adiciona lock por evento e por batch;
  - tenta MySQL advisory lock quando o `DataSource` suporta;
  - usa fallback `in_process` para testes/local sem DB real;
  - faz retry automatico para lock ocupado, deadlock, lock wait timeout, perda de conexao e timeout;
  - reutiliza snapshot por `jobRunId + eventId`;
  - reutiliza impact por `jobRunId + eventId + propertyAddressId + analisePrecoId`;
  - pula duplicatas intra-job antes de persistir;
  - mantem `PricingDecisionSnapshot` idempotente por `inputSignals.idempotencyKey`;
  - em batch, falha parcial de um evento nao cancela todo o lote;
  - em batch, cada evento recebe retry curto proprio antes de ser marcado como falha parcial;
  - leituras Host/Admin de impacts persistidos retornam a versao mais recente por evento/imovel/analise.

- Entidades/migration
  - `event_intelligence_snapshots` ganhou indice logico para lookup de retry por `jobRunId + event_id`;
  - `event_property_impacts` ganhou indice logico para lookup de retry por `jobRunId + event_id + property_address_id + analise_preco_id`.

- Runbook
  - documenta o estado implementado em 2026-05-23;
  - separa o modo atual `inline_lock_retry` da fila P1 recomendada;
  - atualiza smoke API/SQL para validar `runtime` e contadores created/reused.

## Arquivos alterados

- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.spec.ts`
- `urban-ai-backend-main/src/entities/event-intelligence-snapshot.entity.ts`
- `urban-ai-backend-main/src/entities/event-property-impact.entity.ts`
- `urban-ai-backend-main/src/migrations/1780600000000-CreateEventIntelligenceFoundation.ts`
- `docs/runbooks/event-intelligence-recompute-idempotency-2026-05-22.md`
- `squads/event-demand-pricing-radar/_memory/memories.md`
- `squads/event-demand-pricing-radar/output/2026-05-23-roadmap-closure/backend-db-recompute.md`

## Validacoes executadas

```powershell
cd urban-ai-backend-main
node node_modules\typescript\lib\tsc.js --noEmit -p tsconfig.build.json --pretty false
node node_modules\jest\bin\jest.js event-intelligence.service.spec.ts --runInBand
```

Resultado:

- Typecheck backend: passou.
- Jest direcionado: 1 suite passou, 6 testes passaram.

Observacao: os comandos Node precisaram de permissao elevada porque o sandbox retornou `Acesso negado` para `node.exe`.

## Smoke real/staging

Nao rodei API smoke contra DB real/staging nesta sessao porque nao ha `API_BASE`, token admin/host e IDs reais de evento/imovel fornecidos no ambiente. O runbook agora deixa o smoke objetivo:

- aplicar migration em staging;
- escolher um evento real com `AnalisePreco` persistivel;
- rodar `POST /admin/events/:eventId/recompute-intelligence`;
- conferir `runtime.lockProvider`, `runtime.attempts`, `writes.created`, `writes.reused`;
- repetir recompute para confirmar decision idempotente;
- rodar SQL de duplicatas por `jobRunId`;
- validar leitura Host/Admin com `dataStatus = persisted`.

## Lacunas restantes

- Fila externa P1 ainda nao foi criada; o modo atual e sincrono com lock/retry curto.
- `idempotencyKey` e `signalsHash` ainda estao em `inputSignals`; colunas dedicadas e indice unico ficam para migration futura apos backfill.
- Smoke DB/staging precisa ser executado com credenciais e IDs reais.
- Supersedencia explicita de drafts antigos quando os sinais mudam ainda e evolucao P1.

## Percentual recomendado

- P0 tecnico comprovado desta frente: **97%**.
- Pronto para gate DB/staging: **99%**.
- Release controlado geral do Event Radar: **92%** enquanto faltar smoke real/staging e Playwright final.

Leitura honesta: o backend de recompute deixou de ser apenas "persistencia v0" e virou uma base operacional defensiva. Eu nao marcaria 100% ate a migration rodar em staging e o smoke real confirmar duplicidade zero em DB vivo.
