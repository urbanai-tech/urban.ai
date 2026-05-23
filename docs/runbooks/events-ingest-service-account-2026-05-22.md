# Events ingest service account

Data: 2026-05-22

Este runbook substitui o trecho antigo de `docs/runbooks/events-ingest-camada1.md`
que recomendava JWT de usuario tecnico admin para coletores.

## Configuracao

Backend:

```bash
EVENTS_INGEST_API_KEY=<valor longo gerado no provedor de segredos>
```

Coletores:

```bash
URBAN_API_BASE=https://api.myurbanai.com
URBAN_EVENTS_INGEST_API_KEY=<mesmo valor configurado no backend>
URBAN_COLLECTOR_NAME=sp-cultura
URBAN_COLLECTOR_VERSION=<versao ou commit sha>
```

## Headers obrigatorios/recomendados

- `x-urban-events-ingest-key`: chave escopada do coletor.
- `x-urban-collector`: nome estavel do coletor.
- `x-urban-collector-version`: versao/build do coletor.
- `x-urban-ingest-run-id`: id da execucao atual.

O backend grava `AdminAuditLog` por batch com totais, fonte, coletor, versao e
`ingestRunId`.

## Smoke manual

```bash
curl -X POST https://api.myurbanai.com/events/ingest \
  -H "x-urban-events-ingest-key: $URBAN_EVENTS_INGEST_API_KEY" \
  -H "x-urban-collector: smoke-manual" \
  -H "x-urban-collector-version: 2026-05-22" \
  -H "x-urban-ingest-run-id: smoke-$(date +%Y%m%d%H%M%S)" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "nome": "Palmeiras x Santos",
      "dataInicio": "2026-05-10T16:00:00Z",
      "latitude": -23.5275,
      "longitude": -46.6783,
      "enderecoCompleto": "Allianz Parque - SP",
      "cidade": "Sao Paulo",
      "estado": "SP",
      "categoria": "esporte",
      "source": "api-football",
      "sourceId": "fixture-12345",
      "venueCapacity": 43000,
      "venueType": "stadium",
      "expectedAttendance": 38000
    }]
  }'
```

## Regras operacionais

- Nao usar JWT admin para automacao de coletores.
- Rotacionar `EVENTS_INGEST_API_KEY` se houver suspeita de vazamento.
- Nao registrar a chave em evidencia, log ou print.
- Sempre gerar um `x-urban-ingest-run-id` por execucao.
- Use o painel de auditoria admin para conferir `events.ingest.batch`.
