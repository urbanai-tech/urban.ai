# Portfolio Cockpit Contract - 2026-05-24

## Escopo

Runbook curto para QA/contratos do cockpit de portfolio. O objetivo e validar o contrato sem depender de banco real, cobrindo range, formato do calendario, simulacao e retorno auditavel de acoes em lote.

## Contrato backend

`GET /portfolio/calendar`

- Autenticacao: `JwtAuthGuard`; usuario lido de `req.user.userId`.
- Query: `from`, `to`, `propertyIds` CSV opcional, `strategy` opcional.
- Janela: default de 60 dias e limite maximo de 360 dias. Se `to` ultrapassar a janela, o backend clampa a resposta a partir de `from`.
- A resposta inclui `range`, `strategy`, `strategyMetadata`, `base`, `override`, `strategyApplied`, `lift`, `risk` e `confidence` quando estes sinais existem.
- Response minima:

```json
{
  "range": { "from": "2026-01-01", "to": "2026-12-26", "days": 360 },
  "properties": [
    {
      "propertyId": "address-uuid",
      "name": "Studio Vila Mariana",
      "thumbnail": "https://example.com/image.jpg",
      "strategy": "balanced",
      "days": [
        {
          "date": "2026-06-12",
          "sugestao": 850,
          "sugestaoOriginal": 850,
          "atual": 320,
          "base": 320,
          "lift": 530,
          "risk": "alta",
          "confidence": "alta",
          "evento": {
            "id": "event-uuid",
            "nome": "Grande Premio de Sao Paulo",
            "impacto": "alta"
          }
        }
      ]
    }
  ]
}
```

`GET /portfolio/opportunities`

- Retorna as maiores oportunidades derivadas do calendario, ordenadas por `lift`.
- Response contem `range`, `summary` e `opportunities[]`.

`POST /portfolio/simulate-action`

- Body igual ao bulk action.
- Nao persiste mudancas.
- Response: `{ simulated: true, action, items, summary }`.

`POST /portfolio/bulk-action`

- Body: `propertyIds`, `action`, `payload`, `dates` ou `from`/`to` quando a acao opera por data.
- Acoes aceitas hoje: `apply-strategy`, `set-base-price`, `set-date-price`, `accept-suggestions`.
- `apply-strategy` normaliza `conservadora/conservative`, `moderada/balanced`, `agressiva/aggressive`, `automatico/autonomous/ai`.
- Response minima auditavel:

```json
{
  "applied": 1,
  "failed": [],
  "auditLogId": "portfolio-action-run-uuid",
  "summary": {
    "applied": 1,
    "failed": 0,
    "affectedProperties": 1,
    "affectedDates": 0,
    "estimatedLift": 0
  }
}
```

`GET /portfolio/action-runs`

- Lista action runs persistidas com `summary`, `status`, `selectedPropertyIds`, `targetDates` e timestamps.

## Cobertura automatizada desta rodada

- `urban-ai-backend-main/src/host-panels/host-panels.portfolio.spec.ts`
- Unit test sem banco real para:
  - clamp de range 360 dias em `portfolioCalendar`;
  - shape de `properties[].days[]` com `sugestao`, `atual`, `evento`, `lift`, `risk` e `confidence`;
  - simulacao `set-date-price` sem persistir action run;
  - normalizacao de estrategia em `portfolioBulkAction` e persistencia em settings por imovel;
  - `auditLogId` como id da action run;
  - rejeicao de estrategia invalida antes de salvar estado.

## Evidencia e riscos

- A simulacao de evento continua no contrato `POST /host/events/:eventId/simulate-pricing`; o cockpit de portfolio usa `POST /portfolio/simulate-action` para preview de lote.
- `auditLogId` deve apontar para `portfolio_action_runs.id`. Antes de rollout mutante real, validar migrations aplicadas e consulta em `GET /portfolio/action-runs` contra staging.
