# Runbook — Backfill geocoder (gap H1)

Atende o gap H1 do roadmap: "16/29 imoveis com cidade 'A definir' e estado 'A '".

## Quando rodar

- Apos ativar Geocoding API no GCP Console + billing.
- Apos cadastrar/atualizar `GOOGLE_MAPS_API_KEY` em prod ou staging.
- Quando o admin `/admin/properties` mostra "Localidade invalida" > 0.

## Pre-condicoes

1. Geocoding API ativa no GCP (https://console.cloud.google.com → APIs & Services → Library → Geocoding API → **Enable**).
2. Billing habilitado no projeto Google Cloud.
3. `GOOGLE_MAPS_API_KEY` no env do backend, **sem restricao IP/HTTP referer** (server-side).
4. `DATABASE_URL` apontando para o banco alvo (prod ou staging).

## Como rodar

### Dry run (sem chamar Google, sem salvar)

```bash
cd urban-ai-backend-main
DRY_RUN=true GOOGLE_MAPS_API_KEY=dummy DATABASE_URL=mysql://... npm run backfill:geocoder:dry
```

Lista os imoveis elegiveis e a query que seria enviada. Use pra validar que a logica de selecao bate com `/admin/properties`.

### Execucao real

```bash
cd urban-ai-backend-main
export GOOGLE_MAPS_API_KEY=sk_...           # do GCP
export DATABASE_URL=mysql://...               # do Railway
npm run backfill:geocoder
```

### Opcoes

| Variavel | Default | Descricao |
|---|---|---|
| `DRY_RUN` | `false` | Se `true`, so loga. Nao chama Google nem salva. |
| `LIMIT` | `0` (todos) | Processa apenas os primeiros N imoveis elegiveis. |
| `GEOCODER_BACKFILL_RPS` | `1` | Requisicoes/segundo. Google permite mais; manter 1 evita custo acidental. |

### Testar com 5 imoveis primeiro

```bash
LIMIT=5 npm run backfill:geocoder
```

## Saida esperada

```
[backfill-geocoder] DB conectado
[backfill-geocoder] 29 imoveis encontrados no total
[backfill-geocoder] 16 imoveis elegiveis pra backfill (cidade='A definir' ou sem coords)
[backfill-geocoder] [1/16] abc-123 → Sao Paulo/SP (-23.5505, -46.6333)
[backfill-geocoder] [2/16] def-456 → Rio de Janeiro/RJ (-22.9068, -43.1729)
...
[backfill-geocoder] === RESUMO ===
[backfill-geocoder] Elegiveis  : 16
[backfill-geocoder] Sucesso   : 14
[backfill-geocoder] Sem match : 2
[backfill-geocoder] Pulados   : 0
[backfill-geocoder] Proximo passo: rodar /admin/jobs > "Reset enrichment stale" pra reprocessar recomendacoes.
```

## Falhas comuns

| Erro | Causa | Acao |
|---|---|---|
| `Google REQUEST_DENIED: ...` | Geocoding API nao ativa ou key restrita a IP/referer | Ativar Geocoding API + remover restricao IP da key |
| `Sem match` em endereco generico ("rua x, sao paulo") | Endereco incompleto no banco | Atualizar manualmente via `/properties` ou `/admin/properties/[id]` |
| `ECONNREFUSED` | `DATABASE_URL` errada ou sem conectividade | Conferir secret Railway |

## Pos-execucao

1. Abrir `/admin/properties` — coluna "Localidade invalida" deve cair pra 0.
2. Abrir `/admin/jobs` → rodar **"Reset enrichment stale"** para forcar reprocessamento de eventos que dependiam de coords.
3. Conferir `/admin/properties/[id]` de algum imovel processado — card "Saude do imovel" deve passar a checagem Geo + Localidade.
4. Esperar proximo cron de recomendacoes (ou rodar manual no `/admin/jobs`) — `futureRecommendationsCount` deve subir.

## Custo aproximado

Google Geocoding API: **US$ 5 / 1.000 requisicoes** (apos $200 free credit/mes). Backfill de 29 imoveis = US$ 0.15.
