# Fabricio Dashboard Horizon + Event Intelligence Backfill

Data: 2026-05-27

## Diagnostico

- O banco ja tinha sugestoes futuras para o Fabricio alem dos proximos 30 dias.
- A sensacao de limite de 30 dias vinha da tela de dashboard, que carregava apenas a janela mensal/30 dias da API antiga.
- As tabelas novas de inteligencia (`event_intelligence_snapshots`, `event_property_impacts`, `pricing_decision_snapshots`) estavam vazias porque ainda nao havia backfill/cron ativo.

## Implementacao

- Dashboard do host agora carrega mes atual + 8 meses, mostra resumo de janela, contador de sugestoes futuras e faixa clicavel de meses.
- Backfill operacional adicionado em `EventIntelligenceService`, com endpoint admin auditado e cron opt-in.

## Disparo Executado

Payload autorizado:

```json
{
  "from": "2026-05-27",
  "lookaheadDays": 365,
  "limit": 25,
  "scope": "in",
  "force": false
}
```

Banco: Railway via `DB_HOST=switchback.proxy.rlwy.net`, `DB_NAME=railway`.

Resultado verificado no banco:

- `jobRunId`: `event-intelligence-backfill-20260527233344193`
- `event_intelligence_snapshots`: 25
- `event_property_impacts`: 60
- `pricing_decision_snapshots`: 60
- Candidatos restantes no horizonte 2026-05-27 a 2027-05-27 sem snapshot: 181

Observacao: o processo de disparo estourou o timeout da ferramenta antes de imprimir o relatorio final, mas a verificacao direta no banco confirmou as escritas.

## Validacoes Locais

- Backend Jest focado: `event-intelligence.service.spec.ts` passou com 7/7.
- Frontend typecheck: `tsc --noEmit` passou.
- Backend typecheck: `tsc --noEmit` passou.
- `git diff --check` passou.
