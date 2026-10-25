# Ingest de eventos (API key de serviço e coletores)

Revisado: 2026-10-23

> **Corrigido (2026-10-25):** spiders e coletores habilitam o envio **somente** com `URBAN_EVENTS_INGEST_API_KEY`; o login por `URBAN_COLLECTOR_EMAIL/PASSWORD` foi removido. A entrega passa por uma fila SQLite persistente com quarentena e retry — ver [`ingest-outbox-entrega.md`](./ingest-outbox-entrega.md) (inclui o volume persistente exigido no Railway e `URBAN_INGEST_OUTBOX_PATH`).

Este runbook cobre como coletores autenticam no `POST /events/ingest` do backend e como obter as credenciais das fontes externas. A automação de coletores **não** usa JWT de usuário admin: o backend aceita apenas a API key escopada (`x-urban-events-ingest-key`).

## Configuração

Backend:

```bash
EVENTS_INGEST_API_KEY=<valor longo gerado no provedor de segredos>
```

Coletores:

```bash
URBAN_API_BASE=<dominio-de-servico-railway-do-backend>   # api.myurbanai.com ainda nao existe
URBAN_EVENTS_INGEST_API_KEY=<mesmo valor configurado no backend>
URBAN_INGEST_OUTBOX_PATH=<arquivo-sqlite-em-volume-persistente>   # ver ingest-outbox-entrega.md
URBAN_COLLECTOR_NAME=sp-cultura
URBAN_COLLECTOR_VERSION=<versao ou commit sha>
```

## Headers

- `x-urban-events-ingest-key`: chave escopada do coletor (obrigatório).
- `x-urban-collector`: nome estável do coletor.
- `x-urban-collector-version`: versão/build do coletor.
- `x-urban-ingest-run-id`: id da execução atual (um por execução).

O backend grava `AdminAuditLog` por batch com totais, fonte, coletor, versão e `ingestRunId` (evento `events.ingest.batch`, visível no painel de auditoria admin).

## Comportamento do endpoint

- Limite de 500 eventos por batch; throttling de 60 req/min.
- `dedupHash = sha256(nome|YYYY-MM-DD|lat~3,lng~3)` calculado no servidor.
- UPSERT conservador: cria novo ou preenche só campos vazios da linha existente, sem sobrescrever `relevancia`/`raioImpactoKm` já calculados.
- Eventos sem lat/lng são aceitos quando `enderecoCompleto` está presente: ficam com `pendingGeocode=true` e `ativo=false` até o cron do `EventsGeocoderService` (a cada 30 min) ou `POST /events/geocoder/run?limit=N` processá-los.
- Resposta agregada por fonte: `{ total, created, updated, skipped, bySource, results }`. Reenviar o mesmo evento retorna `updated`; mesma posição (< 100 m) e mesma data deduplica; data diferente cria novo.

## Schema do payload

```ts
interface IngestEventInput {
  // Obrigatórios
  nome: string;
  dataInicio: string | Date;     // ISO 8601
  latitude: number;              // [-90, 90]
  longitude: number;             // [-180, 180]
  source: string;                // procedência: 'api-football' | 'sympla-api' | ...

  // Recomendados
  dataFim?: string | Date | null;
  enderecoCompleto?: string;
  cidade?: string;
  estado?: string;               // UF, 2 caracteres

  // Opcionais
  descricao?: string | null;
  categoria?: string | null;
  linkSiteOficial?: string | null;
  imagemUrl?: string | null;
  sourceId?: string | null;          // id externo na fonte
  venueCapacity?: number | null;
  venueType?: string | null;         // stadium | convention_center | theater | bar | church | outdoor | other
  expectedAttendance?: number | null;
  crawledUrl?: string | null;
}
```

## Smoke manual

```bash
curl -X POST <dominio-de-servico-railway-do-backend>/events/ingest \
  -H "x-urban-events-ingest-key: $URBAN_EVENTS_INGEST_API_KEY" \
  -H "x-urban-collector: smoke-manual" \
  -H "x-urban-collector-version: manual" \
  -H "x-urban-ingest-run-id: smoke-$(date +%Y%m%d%H%M%S)" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [{
      "nome": "Palmeiras x Santos",
      "dataInicio": "2026-12-10T16:00:00Z",
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

## Coletores e credenciais das fontes

Cada coletor concreto herda de `BaseCollector` (`urban-webscraping-main/urban_webscrapping/collectors/`) e implementa `fetch_raw()` + `normalize(raw)`; login/chave, batch, dedup, geocoding lazy, enrich via `venue_map`, retry e métricas vêm da base. O `SpCulturaCollector` (MapaCultural da Prefeitura de SP) não exige credencial:

```bash
python -m urban_webscrapping.collectors.sp_cultura   # SP_CULTURA_LOOKAHEAD_DAYS (padrão 60); DRY_RUN=true só loga
```

Para as demais fontes, criar a conta de desenvolvedor e guardar a chave no provedor de segredos (nunca no repositório); as variáveis exatas por coletor estão em [`matriz-env-operacional.md`](./matriz-env-operacional.md):

| Fonte | Onde obter | Observação |
|---|---|---|
| api-football.com | Dashboard após cadastro | Plano gratuito: 100 req/dia; calendário oficial de jogos dos estádios de SP |
| Sympla API | developers.sympla.com.br | Cursos e conferências; token no painel de desenvolvedor |
| Eventbrite | eventbrite.com/platform/api | Eventos B2B e conferências; token privado |
| Dados abertos da Prefeitura de SP | catalogo.dados.sp.gov.br | Opcional, best-effort; formato varia por dataset |

## Regras operacionais

- Não usar JWT admin para automação de coletores.
- Rotacionar `EVENTS_INGEST_API_KEY` se houver suspeita de vazamento.
- Não registrar a chave em evidência, log ou print.
- Sempre gerar um `x-urban-ingest-run-id` por execução.
