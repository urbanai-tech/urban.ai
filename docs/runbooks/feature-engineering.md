# Runbook — Feature Engineering para o Motor de Pricing

**Contexto:** F6.1 Tier 1 do roadmap. O motor `UrbanAIPricingEngine` consome features (lat, lng, metroDistance, amenitiesCount, category) de cada imóvel. Hoje a maioria dos imóveis cadastrados **não tem** essas features preenchidas — o KNN cai no fallback Standard para todo mundo.

Este runbook descreve o pipeline para enriquecer os imóveis ao longo do tempo. O scaffold já está em `src/knn-engine/feature-engineering.service.ts` com os 3 passos como skeleton.

---

## Pipeline em 3 passos

### Passo 1 — Geocoding (lat/lng)

**Quando aplicar:** sempre que `address.latitude IS NULL` ou `longitude IS NULL`.

**Como:**
- Usar `@googlemaps/google-maps-services-js` (já no `package.json`).
- Endereço completo: `${logradouro}, ${numero}, ${bairro}, ${cidade}, ${estado}, Brasil`.
- Validar bbox SP grosso modo: lat entre -24.0 e -23.3, lng entre -47.2 e -46.3. Resultado fora desse retângulo → marcar com flag e descartar do treino.
- Persistir `address.latitude`, `address.longitude`.
- Custo: ~US$ 5 por 1.000 geocodings. Crédito Google Cloud (R$ 1.759 até 15/06/2026) cobre folgado.

**Implementação:** completar `FeatureEngineeringService.geocodePending()`.

### Passo 2 — Distância à estação de metrô mais próxima

**Quando aplicar:** sempre que `address.metro_distance_km IS NULL` E `latitude/longitude` estão preenchidos.

**Como:**
- Pegar lista oficial de estações em https://www.metro.sp.gov.br (CSV público) ou usar dados do Wikipedia/OpenStreetMap (76 estações ativas em SP em 2026).
- Para cada imóvel, calcular haversine simples até cada estação; pegar a mínima.
- Persistir em coluna nova `address.metro_distance_km` (decimal). Migration vai junto.
- Custo: zero (cálculo local).

**Implementação:** completar `FeatureEngineeringService.computeMetroDistancePending()`.

### Passo 3 — `amenitiesCount` via Gemini

**Quando aplicar:** sempre que `list.amenities_count IS NULL` E `list.titulo` está preenchido.

**Como:**
- Reutilizar `GoogleGenerativeAI` client de `events-enrichment.service.ts`.
- Prompt:
  ```
  Você está analisando um título de anúncio Airbnb. Retorne apenas um número
  inteiro entre 0 e 30 representando a quantidade aproximada de comodidades
  premium implícitas no título (ex.: piscina, varanda, vista, mobiliado novo,
  ar-condicionado, cozinha equipada, lavanderia, garagem). Se não tiver clareza,
  retorne 1.

  Título: {titulo}
  ```
- Persistir em `list.amenities_count` (int).
- Custo: ~US$ 0.0001 por imóvel via Gemini Flash. 10.000 imóveis = US$ 1.

**Implementação:** completar `FeatureEngineeringService.estimateAmenitiesPending()`.

### Passo 4 (opcional) — `category` heurística inicial

Antes de termos histórico real para o KNN aprender categoria sozinho, podemos definir uma heurística inicial:

```
if basePrice > 350 AND amenities >= 6: category = 2 (Premium)
if basePrice < 150 OR amenities <= 2:  category = 0 (Econômico)
else:                                   category = 1 (Standard)
```

Persistir em `list.category` (int 0-2). Quando o XGBoost shadow começar a rodar, ele aprende sua própria fronteira.

---

## Quando rodar o pipeline

**Estratégia recomendada:**

1. **One-off backfill (uma vez)** — script `scripts/backfill-features.ts` que percorre TODOS os imóveis e enriquece. Pode levar horas (pelo número de chamadas Google + Gemini).
2. **On-create** — disparar os 3 passos para um imóvel novo logo após o cadastro (assíncrono via BullMQ se necessário).
3. **Cron diário** `0 5 * * *` (BRT) — processa qualquer imóvel residual + retreina o KNN com features novas.

A camada cron já existe em `PricingBootstrapService` (re-treina semanalmente). Adicionar um cron diário de feature engineering quando os 3 passos forem implementados.

---

## Migrations necessárias

Quando habilitar em prod, criar uma migration que adiciona:

```sql
ALTER TABLE address ADD COLUMN metro_distance_km DECIMAL(8,3);
ALTER TABLE list ADD COLUMN amenities_count INT;
ALTER TABLE list ADD COLUMN category TINYINT;  -- 0=Econ, 1=Std, 2=Premium
```

Seguir `docs/runbooks/migrations-cutover.md`. NÃO usar `synchronize:true` para essa mudança em prod.

---

## Métricas de qualidade

Adicionar ao dashboard interno (F9.3):

- % de imóveis com `lat/lng` preenchidos (alvo: ≥98%)
- % com `metro_distance_km` (alvo: ≥95%)
- % com `amenities_count` (alvo: ≥90%)
- % com `category` (alvo: 100%)

Quando todas ≥90%, o motor pode sair do fallback Standard de fato e o XGBoost shadow vira viável.

---

## Custos

| Item | Estimativa para 10k imóveis |
|---|---|
| Google Geocoding | ~US$ 50 (free credit cobre) |
| Gemini Flash (amenities) | ~US$ 1 |
| Cálculo metro local | US$ 0 |
| **Total backfill** | < US$ 60 (free credit) |

**Custo recorrente** (1.000 imóveis novos/mês): ~US$ 5/mês.

---

*Última atualização: 24/04/2026 · F6.1 Tier 1 — skeleton em `src/knn-engine/feature-engineering.service.ts`*
