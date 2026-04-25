# Fase F6.2 Plus — Cobertura Total de Eventos em SP
**Versão 1.0 · 24/04/2026 · Autorização:** Gustavo concedeu em 24/04 (chat)

> Esta fase expande o que estava escopado em F6.2 do roadmap: vai além de **substituir scraping por API** e cobre **descoberta ampla de eventos** que hoje não vemos (conferências, congressos, jogos, centros de eventos pequenos e grandes), incluindo os KPIs de qualidade visíveis no painel admin.

---

## Justificativa

O motor da Urban AI depende de **eventos detectados** para sugerir aumento de preço. Hoje a cobertura é limitada a 8 spiders Scrapy de plataformas de venda de ingresso. Isso significa:

- Anfitrião próximo do **Allianz Parque em dia de jogo** não recebe pico de demanda detectado
- Conferências grandes como **RD Summit, Web Summit Rio, Bett, PMI Conference** passam despercebidas
- Cursos profissionais multi-dia (Sebrae, FGV executivo, Insper) não entram
- Eventos em **centros de exposição** (Anhembi, Expo Center Norte, São Paulo Expo) só aparecem se a venda passa por Sympla/Eventim
- Eventos **acadêmicos**, **religiosos grandes**, **festas privadas em buffets premium** ficam de fora

A consequência é que o motor **subestima sistematicamente** dias de demanda alta — o oposto do que a promessa "+30% receita" exige.

---

## Estratégia em 3 camadas

### Camada 1 — APIs oficiais (substituir scraping cinza)

Trocar scraping de Sympla/Eventim/etc por chamadas autenticadas a APIs públicas. Reduz risco jurídico e melhora qualidade.

| Plataforma | API | Cobertura | Custo |
|---|---|---|---|
| **Sympla** | `developers.sympla.com.br` | Cursos B2B, eventos médios | Free tier generosa |
| **Eventbrite** | `eventbrite.com/platform/api` | Conferências profissionais, workshops | Free → US$ 0.50/1k requests |
| **Prefeitura SP — São Paulo Aberta** | `sp_aberta` | Eventos culturais municipais, feiras | Grátis |
| **api-football.com** | calendário oficial | Jogos Allianz/Morumbi/Itaquera/Pacaembu | Free → US$ 19/mês |
| **Eventim API B2B** | (parceria comercial) | Continua para shows grandes | A negociar |

**Esforço:** ~2 semanas de dev. Substitui 3 dos 8 spiders atuais.

### Camada 2 — Firecrawl + LLM extraction (cobertura ampla)

Para fontes sem API, usar Firecrawl ([firecrawl.dev](https://www.firecrawl.dev)). Custo ~US$ 16/mês para ~30 sites mapeados diariamente. Resistente a mudança de layout (LLM extraction).

**Sites alvo prioritários (ordem de impacto):**

#### Centros de eventos (cobertura geográfica essencial)
- anhembi.com.br/agenda
- saopauloexpo.com.br
- expocenternorte.com.br/eventos
- transamericaexpo.com.br
- frei-caneca.com.br/eventos
- wtcsaopaulo.com.br

#### Estádios (impacto altíssimo em dia de jogo)
- allianzparque.com.br/eventos
- saopaulofc.net/agenda
- corinthians.com.br/agenda
- estádios menores: NeoQuímica Arena, Pacaembu (quando reabrir)

#### Conferências e cursos profissionais
- rdsummit.com.br
- websummit.com/rio
- conferenciaforbesundewr30.com (e similares)
- sebrae.com.br/sites/sp/eventos
- fgv.br/cursos-executivos
- insper.edu.br/agenda
- pmi.org.br (calendário SP)

#### Acadêmicos / culturais
- usp.br/eventos
- bienalsaopaulo.org.br
- museu da imagem e do som — agenda
- teatros municipais

**Esforço:** ~3 semanas. Inclui:
- Coletor Firecrawl genérico que aceita URL + LLM prompt de extração
- Schema unificado de evento normalizado
- Pipeline Prefect novo (`events_firecrawl_ingest`) que roda diariamente
- Persistência na tabela `event` com `source = firecrawl_<site>` + `dedup_hash`

### Camada 3 — Curadoria humana (cauda longa)

Para eventos que escapam dos crawlers ou exigem inserção manual:

- **Form admin** `/admin/events/new` para inserir 1 evento de cauda longa
- **Import CSV** semestral de calendários de associações (PMI, ABRH, ABMP, AAPA)
- **Parceria com SPTuris** (Observatório de Turismo SP) para feed oficial mensal
- **Webhook receiver** que aceita eventos de parceiros confiáveis (futuro)

**Esforço:** ~1 semana. Form admin + endpoint POST + import script + email mensal SPTuris.

---

## Modificações no domínio

```sql
-- migration: AddEventCoverageFields
ALTER TABLE event ADD COLUMN source VARCHAR(64) NULL;
ALTER TABLE event ADD COLUMN source_id VARCHAR(128) NULL;
ALTER TABLE event ADD COLUMN dedup_hash VARCHAR(64) NULL;
ALTER TABLE event ADD COLUMN venue_capacity INT NULL;
ALTER TABLE event ADD COLUMN venue_type VARCHAR(64) NULL;  -- stadium, convention_center, theater, bar, church, outdoor, other
ALTER TABLE event ADD COLUMN expected_attendance INT NULL;
ALTER TABLE event ADD COLUMN crawled_url TEXT NULL;
ALTER TABLE event ADD UNIQUE INDEX uk_event_dedup (dedup_hash);
ALTER TABLE event ADD INDEX ix_event_source (source);
ALTER TABLE event ADD INDEX ix_event_venue_type (venue_type);
```

`dedup_hash = sha256(lower(nome) + '|' + dataInicio.toISOString().slice(0,10) + '|' + Math.round(lat*1000)/1000 + ',' + Math.round(lng*1000)/1000)` — arredonda lat/lng a ~100m. Permite Sympla + Eventbrite + Anhembi reportarem o mesmo evento sem duplicar.

`venue_type` permite o motor de pricing ponderar diferente:
- `stadium` (capacidade 30k+) → boost extra de relevância
- `convention_center` → boost médio, mas com fator de público B2B
- `theater` → boost localizado (raio menor)
- `bar` → boost mínimo, raio de 300m

---

## KPIs no painel admin

Já implementados em `/admin/events`:

| KPI | Como medir | Alvo S10 |
|---|---|---|
| **Cobertura geográfica** | % eventos com lat/lng | ≥ 95% |
| **Enriquecimento Gemini** | % eventos com `relevancia` populada | ≥ 90% |
| **Volume futuro 30d** | total `dataInicio` em janela 30d | ≥ 200 SP |
| **Mega-eventos 30d** | `relevancia ≥ 80` em janela 30d | tracker |
| **Diversidade** | # de `venue_type` distintos ativos | ≥ 5 |
| **Cobertura por categoria** | distribuição em `byCategory` | ≥ 6 categorias com 5+ eventos |
| **Latência de ingestão** | `dataCrawl - dataInicio` (média) | ≤ 24h |
| **Top 10 próximos** | tabela com nome + relevância + capacidade + geo | qualidade visível |

KPIs novos a adicionar (post-Camada 2):

- **Eventos por fonte** (`source` count) — visualizar Camada 1 vs Camada 2 vs scraper antigo
- **Taxa de dedup** — quantos hits de `dedup_hash` colidem (saúde do pipeline)
- **Falsos positivos** — eventos cadastrados mas não realizados (taxa, mín 5%)

---

## Cronograma autorizado

| Semana | Entrega | KPI alvo |
|---|---|---|
| **S6** | Migration + colunas `source/dedup_hash/venue_type/etc` | — |
| **S6–7** | Camada 1: Sympla API + Eventbrite + Prefeitura SP integrados; substituir 3 spiders | Volume +20% em 7d |
| **S7–8** | Camada 1: api-football.com (Allianz + Morumbi + Itaquera) | Mega-eventos 30d +50% |
| **S8** | Coletor Firecrawl genérico (template + 1 site PoC: anhembi.com.br) | — |
| **S8–9** | Camada 2: ampliar para 10 sites (centros + estádios + RD Summit + Sebrae + FGV) | Diversidade ≥ 4 venue_types |
| **S9–10** | Camada 2: ampliar para 30 sites (long tail) | Cobertura ≥ 80%, Diversidade ≥ 5 |
| **S10** | Camada 3: form admin + endpoint POST + entity completa | — |
| **S10–11** | Camada 3: import semestral primeira vez (PMI + ABRH) | Volume +30 eventos B2B |
| **S11** | Métricas novas no painel admin (`source`, `dedup`, false positive) | KPIs visíveis |

---

## Custo total

| Item | Custo mensal |
|---|---|
| Firecrawl Hobby (~3k credits/mês) | US$ 16 |
| api-football.com Basic | US$ 19 |
| Gemini Flash (relevância) — incremento | ~US$ 5 |
| Sympla/Eventbrite/Prefeitura SP | grátis |
| **Total adicional** | **~US$ 40/mês** |

---

## Riscos e mitigações

- **Firecrawl muda layout / fica fora do ar** → fallback para Scrapy spiders existentes; ingestão fica esparsa por horas
- **api-football.com mudar plano gratuito** → migrar para SofaScore scrape (cinza) ou Wikipedia scrape (público) como fallback
- **Mudança de layout em sites alvo** → LLM extraction é robusta mas não imune; reprocessar com prompt ajustado
- **Volume de duplicatas alto** → dedup_hash + LLM normalização de título resolve 95%; curadoria admin para 5%
- **Spam de eventos irrelevantes** (curso com 30 pessoas) → filtro `expected_attendance < 100` + relevância Gemini < 30 antes de virar evento "ativo" para o motor

---

## Aprovação

✅ **Autorizado para iniciar a Camada 1 nesta sessão** — Gustavo, 24/04/2026 (chat).

Camada 2 e 3 aguardam apenas conclusão da Camada 1 + budget Firecrawl ativo.

---

## Documentos relacionados

- `docs/runbooks/event-engine-evolution.md` — runbook técnico detalhado de cada camada
- `docs/runbooks/admin-evolution.md` — onde os KPIs aparecem
- `docs/estado-da-IA-e-evolucao.md` — Parte 4 cobre eventos
- F6.2 do `docs/roadmap-pos-sprint.md` — fase formal no roadmap

---

*Última atualização: 24/04/2026*
