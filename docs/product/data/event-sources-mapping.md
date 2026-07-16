# Mapa completo de fontes de eventos — São Paulo capital

**Data:** 25/04/2026 · **Owner:** Gustavo · **Origem:** F6.2 Plus

> Catálogo de TODAS as fontes públicas de eventos que valem a pena
> integrar no motor Urban AI, ranqueadas por **impacto na demanda de
> hospedagem por temporada** (Airbnb).
>
> Critérios de impacto:
> 1. **Volume de público** (mais pessoas = mais demanda de quarto)
> 2. **% de visitantes de fora** (turistas mexem em Airbnb, locais não)
> 3. **Concentração geográfica** (eventos com público concentrado num raio
>    elevam preços daquele bairro especificamente)
> 4. **Predictibilidade** (anunciado com antecedência > anunciado em cima)
> 5. **Cobertura geográfica** (todos bairros, não só centro)
> 6. **Acessibilidade da fonte** (API > feed > scraping fácil > scraping difícil)

---

## 🏆 Top 20 fontes — por ROI no Urban AI

### Tier S — pico massivo de demanda regional (>30k pessoas, alto turismo)

| # | Evento/Fonte | Volume típico | Cobertura técnica | Impacto |
|---|---|---|---|---|
| **1** | **api-football.com** — Allianz/Morumbi/Itaquerão/Pacaembu | 30–60k por jogo, 100+ jogos/ano | API oficial paga ($19/mês) | 🔥🔥🔥 |
| **2** | **CCXP (Comic Con Experience)** | 280k em 4 dias | Site próprio + Eventim | 🔥🔥🔥 |
| **3** | **Lollapalooza Brasil** | 300k em 3 dias | Site oficial + Eventim | 🔥🔥🔥 |
| **4** | **Brasil Game Show (BGS)** | 320k em 5 dias | Site próprio + Sympla | 🔥🔥🔥 |
| **5** | **Bienal do Livro SP** | 600k em 11 dias | Site oficial Anhembi | 🔥🔥🔥 |
| **6** | **Salão do Automóvel** (quando ocorre) | 700k em 12 dias | Site Reed Exhibitions | 🔥🔥🔥 |
| **7** | **Réveillon Paulista (Av. Paulista)** | 350k em 1 noite | Prefeitura SP — anual fixo | 🔥🔥 |
| **8** | **Carnaval SP — sambódromo + bloquinhos** | 1M+ na semana | LIESP + Prefeitura | 🔥🔥🔥 |
| **9** | **Marcha pra Jesus** (junho) | 3M+ em 1 dia | Site oficial — anual | 🔥🔥 |
| **10** | **Virada Cultural** (anual maio) | 4M+ em 24h, 60+ pontos cidade | Prefeitura SP + SP Cultura ✅ | 🔥🔥 |

### Tier A — eventos B2B grandes e festivais consolidados (5k–50k)

| # | Evento/Fonte | Volume típico | Cobertura técnica | Impacto |
|---|---|---|---|---|
| **11** | **Hospitalar** (feira B2B saúde) | 100k em 4 dias | SP Expo + Sympla | 🔥🔥 |
| **12** | **Bett Brasil** (educação) | 70k em 4 dias | SP Expo | 🔥🔥 |
| **13** | **Stock Car / F1 em Interlagos** | 60–150k por dia evento | Site oficial F1/Stock Car | 🔥🔥🔥 |
| **14** | **São Paulo Fashion Week (SPFW)** | 30k VIPs + público | Site oficial SPFW | 🔥🔥 |
| **15** | **Primavera Sound, Coala, Festival de Inverno SP** | 50–80k cada | Site próprio + Sympla | 🔥🔥 |
| **16** | **Salão do Imóvel, Couromoda, Fispal Tec** | 20–60k cada | Sites organizadores | 🔥 |
| **17** | **RD Summit (quando vem a SP)** | 10–15k em 3 dias | Site rdsummit.com.br | 🔥 |
| **18** | **TEDx São Paulo, Campus Party** | 5–20k cada | Site próprio | 🔥 |
| **19** | **Anima SP / festas de cosplay** | 15–30k por edição | Sympla | 🔥 |
| **20** | **Grandes Shows individuais** (Allianz, Morumbi) — Coldplay, Taylor, BTS | 60–100k por noite | Site oficial venue + Eventim | 🔥🔥🔥 |

---

## 📋 Catálogo completo (categorizado)

### A. Esportes 🏟️

| Fonte | Tipo de cobertura | Custo | Status |
|---|---|---|---|
| **api-football.com** | API REST paga | $19/mês | ⏳ aguarda key |
| **CBF** (calendário oficial Brasileirão) | Scraping cbf.com.br/agenda | grátis | a fazer |
| **Federação Paulista de Futebol** (Paulistão, A2) | Scraping fpf.org.br | grátis | a fazer |
| **CB Voleibol** (Superliga em SP) | Scraping cbv.com.br/superliga | grátis | a fazer |
| **NBB Basquete** | Site oficial nbb.com.br | grátis | a fazer |
| **Stock Car** | Site stockcar.com.br | grátis | a fazer |
| **Autódromo Interlagos** | Site oficial calendário | grátis | a fazer |
| **Times próprios:** palmeiras.com.br, saopaulofc.net, corinthians.com.br | Scraping (Firecrawl ideal) | grátis | a fazer |

### B. Música & Shows 🎵

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **Sympla** | API oficial (cursos/shows) | grátis | ⏳ aguarda token |
| **Sympla** | Scraping HTML | grátis | ✅ ativo (legado) |
| **Eventim** | Scraping HTML | grátis | ✅ ativo |
| **Ticketmaster** | API oficial | grátis | ✅ ativo (key já existe) |
| **Ingresse** | Scraping HTML | grátis | ✅ ativo |
| **Ticket360, BlueTicket, EvenThree** | Scraping HTML | grátis | ✅ ativo |
| **Allianz Parque agenda** | Scraping site venue | grátis | a fazer |
| **Audio (Barra Funda)** | Scraping audiosp.com.br | grátis | a fazer |
| **Espaço Unimed** | Scraping site venue | grátis | a fazer |
| **Vibra (ex-Credicard)** | Scraping site venue | grátis | a fazer |
| **Tokio Marine Hall** | Scraping site venue | grátis | a fazer |

### C. Conferências & Feiras B2B 💼

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **Eventbrite** | API oficial | grátis (1k req/h) | ⏳ aguarda token |
| **SP Expo** | Scraping saopauloexpo.com.br/agenda | grátis | a fazer (Firecrawl ideal) |
| **Distrito Anhembi** | Scraping anhembi.com.br | grátis | a fazer |
| **Expo Center Norte** | Scraping expocenternorte.com.br | grátis | a fazer |
| **Transamérica Expo** | Scraping site | grátis | a fazer |
| **WTC SP** | Scraping site | grátis | a fazer |
| **Frei Caneca** | Scraping site | grátis | a fazer |
| **Reed Exhibitions BR** | Site reedexpo.com.br | grátis | a fazer |
| **Informa Markets BR** | Site informamarkets.com.br | grátis | a fazer |
| **PMI São Paulo Capítulo** | Scraping pmisp.org.br | grátis | a fazer |
| **Sebrae SP** | API ou scraping sebraesp.com.br | grátis | a fazer |
| **FIESP** | Scraping fiesp.com.br/agenda | grátis | a fazer |

### D. Cultural / Acadêmico 🎭

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **SP Cultura (MapaCultural)** | API pública | grátis | ✅ pronto (`SpCulturaCollector`) |
| **USP Eventos** | Scraping usp.br/eventos | grátis | próximo |
| **Bienal de São Paulo (artes)** | Scraping site bienal | grátis | a fazer |
| **MASP** | Scraping masp.org.br/agenda | grátis | a fazer |
| **Pinacoteca** | Scraping pinacoteca.org.br | grátis | a fazer |
| **Theatro Municipal SP** | Scraping theatromunicipal.org.br | grátis | a fazer |
| **OSESP / Sala SP** | Scraping osesp.art.br | grátis | a fazer |
| **Sesc SP (35+ unidades)** | API/feed sescsp.org.br | grátis | a fazer (alto valor) |
| **CCBB SP** | Scraping bb.com.br/cultura | grátis | a fazer |
| **Itaú Cultural** | Scraping itaucultural.org.br | grátis | a fazer |
| **Insper** | Scraping insper.edu.br/agenda | grátis | a fazer |
| **FGV EAESP** | Scraping fgv.br/eventos | grátis | a fazer |
| **PUC-SP, Mackenzie** | Scraping sites próprios | grátis | a fazer |

### E. Cinema 🎬

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **Mostra Internacional de Cinema** | Scraping mostra.org | grátis | a fazer |
| **Festival de Cinema Latino-Americano** | Scraping site | grátis | a fazer |
| **CineSesc, Reserva Cultural, IMS** | Scraping sites | grátis | a fazer |

### F. Religioso ⛪

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **Marcha pra Jesus** | Scraping marchaparajesus.com.br | grátis | a fazer (anual fixo, fácil) |
| **Templo de Salomão (Igreja Universal)** | Scraping site | grátis | a fazer |
| **Catedral da Sé / Mosteiro de São Bento** | Scraping sites | grátis | a fazer (datas litúrgicas) |

### G. Gastronomia / Lifestyle 🍽️

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **SP Restaurant Week** | Scraping site oficial | grátis | a fazer |
| **Mesa SP** | Scraping site | grátis | a fazer |
| **Comida di Buteco (etapa SP)** | Scraping comidadibuteco.com.br | grátis | a fazer |

### H. Cívico / Política 🏛️

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **Câmara Municipal SP — agenda** | Scraping camara.sp.gov.br | grátis | a fazer (eventos abertos) |
| **Eventos eleitorais** (debates, comícios) | Notícias + scraping | difícil | adiado |

### I. Long tail / Catch-all 🎣

| Fonte | Tipo | Custo | Status |
|---|---|---|---|
| **SerpAPI Google Events box** | API REST paga | $50/mês | ⏳ aguarda key |
| **Bright Data SERP API** | Alternativa | mais cara | adiado |
| **SPTuris (Observatório de Turismo SP)** | Feed mensal por email | grátis (parceria) | manual via CSV |
| **Eventbrite Long-tail** | API oficial | grátis | mesma da B (compartilha key) |

---

## 🚀 Plano de execução priorizado (em ordem de implementação)

Considerando: ROI, custo de credencial, complexidade de implementação:

### Imediato (sem credencial nova — eu posso seguir já)

1. ✅ **`SpCulturaCollector`** — pronto
2. **`UspEventosCollector`** — scraping leve, calendário público
3. **`SpExpoFirecrawlCollector`** — quando tiver Firecrawl, mas dá pra começar via scraping HTML simples
4. **`AnhembiFirecrawlCollector`** — idem
5. **`MarchaParaJesusCollector`** — anual fixo, super fácil
6. **`AllianzParqueAgendaCollector`** — scraping calendário de shows

### Quando você liberar credencial — em ordem de impacto

| # | Credencial | O que destrava | Custo/mês |
|---|---|---|---|
| **1** | **api-football.com** | Tier S #1 — jogos Allianz/Morumbi/Itaquerão | $19 |
| **2** | **Sympla developers** | Sympla API oficial (substitui scraper HTML) | grátis |
| **3** | **Eventbrite** | Conferências B2B internacionais | grátis |
| **4** | **Firecrawl** | TODOS os scrapers de centros de evento + estádios + universidades + casas de show via LLM extraction (>40 sites cobertos com 1 conta) | $16 |
| **5** | **SerpAPI** | Catch-all do Google Events — pega o que escapou | $50 |

### Manual (sem código novo)

7. **CSV semestral SPTuris/PMI/ABRH** via `/admin/events/import` (já pronto ✅)
8. **Cadastro manual de mega-eventos confirmados** via `/admin/events/new` (já pronto ✅)

---

## 💰 Custo total para cobertura completa

- api-football: **$19/mês**
- Firecrawl: **$16/mês** (substitui necessidade de scrapers HTML pra ~40 sites)
- SerpAPI: **$50/mês** (catch-all)
- Sympla, Eventbrite, SP Cultura, Prefeitura: **grátis**
- **Total: ~$85/mês** para cobertura próxima de 95% dos eventos relevantes em SP capital

ROI esperado: 1 cliente Profissional anual com 5 imóveis = R$ 4.020/ano. **Pago com 1 cliente.**

---

## 🎯 Resumo executivo

**Hoje cobrimos** (com Camada A + 1 coletor + curadoria manual):
- Tickets Sympla/Eventim/Ingresse/etc. (via spiders Scrapy)
- Eventos culturais municipais (SP Cultura)
- Cadastro manual + CSV import

**Falta cobrir** (em ordem de impacto):
1. **Esportes** (jogos no Allianz/Morumbi/Itaquerão = pico massivo) → api-football $19/mês
2. **Centros de evento** (CCXP, BGS, Bienal, Hospitalar, Bett — todos via SP Expo / Anhembi) → Firecrawl $16/mês cobre os ~10 sites principais
3. **Conferências B2B** (Eventbrite, SymplaAPI) → grátis
4. **Catch-all** (SerpAPI) → $50/mês

**Recomendação**: priorizar cadastro nas contas (1) **api-football** + (4) **Firecrawl**. Esses dois sozinhos cobrem ~80% do gap. Sympla/Eventbrite/SerpAPI vêm depois.

---

## 📝 Notas técnicas

### Quando faz sentido **scraping HTML direto** vs **Firecrawl**?

- **HTML direto** (Scrapy): site simples, layout estável, sem JS pesado
  → Marcha pra Jesus, agendas universidades, calendários simples
- **Firecrawl** (LLM extraction): JS pesado, layout muda direto, anti-bot
  → SP Expo, Anhembi, sites de venue/casa de show, conferências grandes

### Quando faz sentido **API oficial**?

Sempre que a API existir e for permissiva. Mais robusta, sem risco
jurídico, sem quebra de layout. **Ordem:** API → Firecrawl → HTML direto.

### Cobertura geográfica em SP

Distribuição esperada de eventos por região depois da cobertura completa:

- **Centro / Av. Paulista / Higienópolis**: 35% (eventos culturais, teatros, MASP, etc.)
- **Barra Funda**: 15% (Allianz, Audio, Memorial)
- **Vila Olímpia / Itaim**: 10% (auditórios corporate, WTC)
- **Vila Mariana / Liberdade**: 10% (Sesc, USP)
- **Itaquera**: 5% (Neo Química Arena)
- **Anhembi / Vila Guilherme / Santana**: 15% (Anhembi, Expo Center Norte)
- **Morumbi / Pinheiros**: 10% (Morumbi, Vibra, Tokio Marine)
- **Outros**: 5%

Nenhuma região fica órfã com cobertura completa. Hoje (sem F6.2 Plus
ativo) provavelmente Itaquera/Anhembi/Morumbi estão cegos.

---

*Última atualização: 25/04/2026.*
