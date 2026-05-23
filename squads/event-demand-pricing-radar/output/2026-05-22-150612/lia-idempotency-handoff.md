# Lia Contratos / Backend Idempotency - handoff

Data: 2026-05-22
Squad: `event-demand-pricing-radar`
Frente: idempotencia defensiva de `PricingDecisionSnapshot` no recompute.

## Resumo

Implementei idempotencia em codigo para a decisao de pricing gerada pelo recompute de inteligencia de eventos. O `jobRunId` continua sendo usado apenas como rastro da execucao; a identidade da decisao agora vem de uma chave de negocio com hash dos sinais.

Nao criei migration nesta frente, porque o schema atual ja permite guardar `idempotencyKey` e `signalsHash` dentro de `inputSignals`.

## Comportamento implementado

- O recompute monta o draft via `PricingCalculateService.criarSnapshotDecisaoPricingEvento(...)`.
- O backend calcula um `signalsHash` SHA-256 truncado para 32 caracteres usando JSON canonico dos sinais de pricing, cenario escolhido e guardrails.
- O backend grava em `inputSignals`:
  - `idempotencyVersion`
  - `idempotencyKey`
  - `signalsHash`
- A chave de negocio segue o formato:

```text
pricing-decision-v0:{eventId}:{propertyId}:{listId}:{analisePrecoId}:{targetDate}:{decisionType}:{selectedScenario}:{modelVersion}:{metricVersion}:{signalsHash}
```

- Antes de salvar uma nova decisao, o servico busca candidatos pelo escopo de negocio:
  - evento;
  - imovel/endereco;
  - analise de preco;
  - target date;
  - tipo de decisao;
  - modelVersion;
  - metricVersion.
- A filtragem final acontece em memoria por `inputSignals.idempotencyKey`, porque ainda nao ha coluna dedicada.
- Quando a chave ja existe, o recompute reutiliza a decisao existente e nao chama `save` novamente para `pricing_decision_snapshots`.
- Quando os sinais mudarem, a chave muda e uma nova decisao auditavel pode ser criada.

## Testes atualizados

Arquivo: `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.spec.ts`

- O mock de `pricingDecisionSnapshotRepo` agora suporta `find` e simula persistencia em memoria.
- O teste de recompute unico valida que `inputSignals` contem:
  - `idempotencyVersion`;
  - `idempotencyKey`;
  - `signalsHash`.
- Novo teste cobre retry/recompute repetido com sinais identicos:
  - primeiro recompute salva a decisao;
  - segundo recompute reutiliza a decisao existente;
  - `pricingDecisionSnapshotRepo.save` permanece com 1 chamada;
  - a resposta continua retornando 1 decisao.

## Validacao executada

O sandbox bloqueou `node.exe` inicialmente com `Acesso negado`; reexecutei com permissao elevada.

Comandos:

```powershell
node node_modules\typescript\lib\tsc.js --noEmit -p tsconfig.build.json --pretty false
node node_modules\jest\bin\jest.js event-intelligence.service.spec.ts pricing-calculate.service.spec.ts event-pricing-intelligence.service.spec.ts --runInBand
```

Resultado:

- Typecheck backend: passou.
- Jest direcionado: 3 suites passaram, 14 testes passaram.

## Riscos e limites

- A idempotencia ainda e defensiva em nivel de aplicacao. Sem coluna dedicada e indice unico, duas execucoes concorrentes extremas ainda podem criar duplicata se passarem pela busca antes de qualquer uma salvar.
- `inputSignals.idempotencyKey` e `inputSignals.signalsHash` funcionam para curto prazo, mas a versao de staging/scale deve adicionar colunas dedicadas e indice unico logico apos limpeza dos historicos.
- Esta frente nao implementou lock/fila/retry transacional; apenas removeu a duplicacao de decisao para recomputes repetidos com mesmos sinais.
- Esta frente nao atualizou outcome/PriceUpdate nem supersedencia explicita de drafts antigos; uma mudanca real de sinais cria nova decisao, mas a marcacao operacional de `superseded` pode ser uma proxima etapa.

## Proximos passos recomendados

- Criar migration P1 com `idempotencyKey` e `signalsHash` como colunas dedicadas.
- Adicionar indice unico/logico para `idempotencyKey` depois de backfill e limpeza.
- Implementar lock por evento/batch para evitar corrida concorrente.
- Implementar supersedencia de drafts anteriores quando sinais mudarem.
- Rodar smoke em DB real/staging com recompute duplo do mesmo evento.

## Arquivos alterados

- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.ts`
- `urban-ai-backend-main/src/event-intelligence/event-intelligence.service.spec.ts`
- `squads/event-demand-pricing-radar/output/2026-05-22-150612/lia-idempotency-handoff.md`
