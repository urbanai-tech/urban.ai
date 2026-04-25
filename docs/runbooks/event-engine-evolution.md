# Runbook — Evolução do Motor de Eventos

**Contexto:** F6.2 do roadmap. Hoje a Urban AI cobre eventos via 8 spiders Scrapy (Eventim, Sympla, Ingresse, Ticketmaster, Blue Ticket, Even Three, Ticket360 e variantes). Isso pega bem **shows e ingressos venda no varejo**, mas perde o que precificação dinâmica precisa para virar diferencial:

- Conferências e congressos (PMI, RD Summit, Web Summit Rio, Bett, etc)
- Cursos profissionais multi-dia (CSPO, MBA executivo, fórmulas de negócio com presença física)
- Jogos em estádios (Allianz Parque, Morumbi, Itaquera, Pacaembu reaberto)
- Centros de eventos: Anhembi, Expo Center Norte, Transamerica Expo, São Paulo Expo, Frei Caneca, WTC Tower
- Eventos em pequenos centros: salões de buffet, igrejas multi-evento, cervejarias, casas noturnas
- Feiras, exposições, seminários acadêmicos (FAU/USP, FGV, Insper)
- Visitas oficiais, papais (presidência, copa do mundo, F1 etc)

Sem esse tipo de evento, a Urban AI não detecta um pico de demanda óbvio — o anfitrião perde o reajuste e nossa promessa "+30% receita" não se cumpre.

## Diagnóstico do gap

| Tipo de evento | Cobertura hoje | O que falta |
|---|---|---|
| Shows grandes (50k+) | ✅ Eventim, Tickemaster | OK |
| Shows médios (5k-50k) | 🟡 Sympla, Ingresse | Cobertura desigual |
| Shows pequenos (< 5k) | ❌ | Casas noturnas, bares com ingresso |
| Congressos B2B | ❌ | RD Summit, Web Summit, PMI, Forbes Under 30 |
| Cursos profissionais | ❌ | Sebrae, FGV, Insper executivo |
| Jogos esportivos | ❌ | Allianz, Morumbi, Itaquera (calendário CBF/SPFC/Palmeiras/Corinthians) |
| Feiras/exposições | ❌ | São Paulo Expo, Anhembi, Expo Center Norte |
| Eventos cult/teatro | 🟡 Sympla parcial | Teatros menores |
| Festas privadas grandes | ❌ | Casamentos em buffets grandes (impacto de demanda local) |

## Estratégia de evolução em 3 camadas

### Camada 1 — APIs oficiais (substituir scraping cinza)

Migrar de scraping para API quando possível. Reduz risco jurídico e melhora qualidade.

| Plataforma | API oficial | Como começar |
|---|---|---|
| **Sympla** | https://developers.sympla.com.br | Hoje fazemos scraping. Trocar por API legitima — eles têm API REST com filtro por cidade. |
| **Eventbrite** | https://www.eventbrite.com/platform/api | Bom para conferências, cursos e workshops profissionais — público B2B usa muito. |
| **Prefeitura SP — Cidade de São Paulo Open Data** | https://www.prefeitura.sp.gov.br/cidade/secretarias/cultura/sp_aberta | Eventos culturais municipais, calendário oficial de feiras. |
| **CBF / CONMEBOL / FIFA** (jogos) | Calendários públicos em CSV via wikipedia / `api-football.com` (free tier) | Detectar pico de demanda em dia de jogo do Palmeiras/Corinthians/SPFC. |
| **CCXP / UFS / Web Summit Rio** | Sites próprios — não tem API | Tratar como caso especial (camada 3). |

**Esforço:** ~2 semanas para integrar Sympla + Eventbrite + Prefeitura SP. Substitui 3 dos 8 spiders atuais.

### Camada 2 — Firecrawl + LLM extraction (cobertura ampla)

Para fontes sem API, usar **Firecrawl** ([firecrawl.dev](https://www.firecrawl.dev)) ou alternativa similar. Vantagens:

- Crawl + extract estruturado por LLM em uma chamada
- Handle de JavaScript renderizado, paywalls leves, rate limit
- Custo: ~US$ 16/mês para ~100 sites mapeados, escala bem
- Mais resistente a mudanças de layout que Scrapy puro

**Sites alvo da Camada 2** (sem API oficial):

- **Centros de eventos SP:** anhembi.com.br, expocenternorte.com.br, transamericaexpo.com.br, saopauloexpo.com.br, fcanecaeventos.com.br, wtcsaopaulo.com.br
- **Estádios:** allianzparque.com.br/eventos, saopaulofc.net/agenda, palmeiras.com.br/agenda, corinthians.com.br/agenda
- **Conferências/cursos:** rdsummit.com.br, websummit.com/rio, sebrae.com.br/sites/sp/eventos, fgv.br/cursos-executivos, insper.edu.br/agenda
- **Calendários acadêmicos:** usp.br/eventos, fgv.br/eventos
- **Buffets/salões:** lista pública dos top 30 buffets de SP via Google My Business

**Esforço:** ~3 semanas para implementar coletor Firecrawl + esquema unificado de extração + persistir na tabela `event` existente. Adicionar coluna `event.source = 'firecrawl' | 'sympla_api' | 'scrapy_eventim' | ...`.

### Camada 3 — Curadoria humana (eventos de cauda longa)

Para eventos importantes que escapam dos crawlers (festas privadas grandes, eventos VIP, casamentos em buffets premium):

- Form admin para inserir manualmente um evento
- Importação semestral de calendários de associações (PMI, ABRH, ABMP)
- Parceria com SP Tourism Bureau (SPTuris) para feed oficial de turismo

**Esforço:** ~1 semana para form admin + import CSV.

## Arquitetura proposta

```
┌──────────────────────────────────────────────────────────┐
│             EVENT INGESTION ORCHESTRATOR                 │
│              (Prefect flow `events_ingest`)              │
│                                                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ Camada 1     │ │ Camada 2     │ │ Camada 3     │    │
│  │ APIs ofic.   │ │ Firecrawl    │ │ Manual/CSV   │    │
│  │              │ │ + LLM extract│ │              │    │
│  │ Sympla       │ │              │ │ Admin form   │    │
│  │ Eventbrite   │ │ Centros      │ │ CSV semestral│    │
│  │ Prefeitura SP│ │ Estádios     │ │ SPTuris feed │    │
│  │ Football API │ │ Conferências │ │              │    │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘    │
│         │                │                │              │
│         └────────────┬───┴────────────────┘              │
│                      ▼                                   │
│              ┌──────────────┐                            │
│              │ Normalização │  (deduplicar por hash      │
│              │ + dedup      │   título+data+local)        │
│              └──────┬───────┘                            │
│                     ▼                                    │
│              ┌──────────────┐                            │
│              │   Gemini     │  (relevância 0-100,        │
│              │  enrichment  │   categoria)                │
│              └──────┬───────┘                            │
│                     ▼                                    │
│              ┌──────────────┐                            │
│              │ MySQL: event │                            │
│              └──────────────┘                            │
└──────────────────────────────────────────────────────────┘
```

## Modificações necessárias na entity `event`

```sql
ALTER TABLE event ADD COLUMN source VARCHAR(64) DEFAULT NULL;
ALTER TABLE event ADD COLUMN source_id VARCHAR(128) DEFAULT NULL;
ALTER TABLE event ADD COLUMN dedup_hash VARCHAR(64) DEFAULT NULL;
ALTER TABLE event ADD COLUMN venue_capacity INT DEFAULT NULL;
ALTER TABLE event ADD COLUMN venue_type VARCHAR(64) DEFAULT NULL;
ALTER TABLE event ADD UNIQUE INDEX uk_event_dedup (dedup_hash);
```

`dedup_hash = sha256(lower(nome) + '|' + dataInicio + '|' + lat + ',' + lng)` arredondado a 100m. Permite a mesma orquestração rodar 3 vezes sem duplicar evento que aparece em Sympla + Eventbrite + Anhembi.

`venue_type` ∈ {`stadium`, `arena`, `convention_center`, `theater`, `bar`, `church`, `outdoor`, `other`}. Usado pelo motor de pricing para ponderar diferente um show no Allianz vs uma noite de pagode num bar.

## Cronograma sugerido (alinhado com F6.2 do roadmap)

| Semana | Entrega |
|---|---|
| **S6** | Migration + coluna `source/dedup_hash/venue_type` |
| **S6–7** | Camada 1: integrar Sympla API + Eventbrite + Prefeitura SP |
| **S7–8** | Camada 1: futebol (Allianz + Morumbi + Itaquera + Pacaembu) via api-football.com |
| **S8–9** | Camada 2: Firecrawl PoC com 5 sites alvo (Anhembi, RD Summit, Sebrae SP, FGV cursos, allianz parque) |
| **S9–10** | Camada 2: expandir para 30 sites, refinar extração LLM |
| **S10–11** | Camada 3: form admin + import CSV |
| **S11+** | Curadoria contínua + parceria SPTuris |

## Custo estimado

| Item | Custo mensal |
|---|---|
| Firecrawl Hobby (3k credits/mês — ~30 sites checados diariamente) | US$ 16 |
| api-football.com Free → Basic | US$ 0 → US$ 19 |
| Gemini Flash extração (já temos chave) | ~US$ 5 (volume baixo) |
| Sympla / Eventbrite API | grátis (até quota generosa) |
| **Total adicional** | **~US$ 20–40/mês** para cobertura ampla |

## Riscos e mitigações

- **Firecrawl indisponível** → fallback para Scrapy spiders existentes; ingestão fica esparsa por algumas horas mas não cai.
- **Mudança de layout em sites alvo** → LLM extraction é mais resistente que Scrapy puro, mas não imune. Reprocessar com prompt ajustado.
- **Volume de duplicatas** → dedup_hash + LLM normalização de título resolve 95%. Curadoria admin para 5%.
- **Spam de eventos irrelevantes** (curso com 30 pessoas) → filtro por `expected_attendance` (LLM extrai) + relevância Gemini ≥ 30 antes de virar evento "ativo" para o motor.

## Métricas de sucesso

- **Cobertura** = % de eventos relevantes em SP (verificado por amostragem manual semanal) que aparecem na nossa base. Hoje: ~30% (estimativa). Alvo S10: ≥80%.
- **Latência** = tempo entre evento ser anunciado publicamente e entrar na nossa base. Hoje: 1-7 dias. Alvo S10: < 24h.
- **Falsos positivos** = eventos cadastrados que não aconteceram. Alvo: < 5%.
- **Diversidade** = distribuição por `venue_type`. Alvo: cobertura mínima de 5 venue_types diferentes em qualquer dia ativo.

---

*Última atualização: 24/04/2026 · F6.2 expandida — proposta concreta de evolução.*
