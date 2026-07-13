# Datasets para treino da IA + prontidão multi-cidade

> Objetivo: (a) acelerar o cold-start do motor de pricing (hoje treina só com os
> ~80 imóveis dos próprios usuários) e (b) deixar o sistema pronto para novas
> cidades — cada dataset abaixo é gratuito e machine-accessible, e generaliza por
> cidade. A IA continua sendo alimentada pelo **nosso** dado (feedback loop) por
> cima destes; os públicos são bootstrap, não substituem o moat.

Legenda de esforço: P ≤ 4h · M 1-2 dias · G 3-5 dias.

## 1. Inside Airbnb — comps reais de listings (o acelerador nº 1)

- **O que é:** snapshots trimestrais de anúncios reais do Airbnb por cidade.
  `listings.csv` (preço, lat/lng, quartos, banheiros, tipo, reviews, amenities),
  `calendar.csv` (preço + disponibilidade **por dia** = proxy de ocupação),
  `reviews.csv`.
- **Cidades BR:** Rio de Janeiro, **São Paulo**, Florianópolis, Salvador (os 4
  maiores mercados STR do país). → **multi-cidade de graça.**
- **Uso no motor:** `listings` vira **comps de treino do KNN** (milhares vs.
  os ~80 atuais); `calendar` semeia o **baseline de ocupação** por região/mês.
- **Licença:** CC BY 4.0 (atribuir).
- **Esforço:** M — importador `import-inside-airbnb.ts` (feito nesta leva).
- **Ressalva honesta:** snapshot (não tempo real); "indisponível" ≠ "reservado"
  (host pode bloquear) → proxy ruidoso de ocupação, não verdade.
- Fonte: https://insideairbnb.com/get-the-data/

## 2. ANAC — demanda aérea por aeroporto (proxy de turismo por cidade)

- **O que é:** microdados mensais de passageiros por origem-destino/aeroporto, CSV.
- **Uso:** sinal de **sazonalidade de demanda turística por cidade** (ex.: pico de
  chegadas em GRU/CGH/SDU) → refina o baseline sazonal (hoje só feriados/estação)
  e dá uma feature de "aquecimento" da cidade por mês. Essencial para novas cidades
  (cada uma tem sua curva).
- **Licença:** dados abertos gov.br.
- **Esforço:** M — baixar + agregar por aeroporto/mês; mapear aeroporto→cidade.
- Fonte: https://www.gov.br/anac/pt-br/acesso-a-informacao/dados-abertos

## 3. IBGE — features de cidade (população, renda) via API REST grátis

- **O que é:** API REST pública (sem chave) `servicodados.ibge.gov.br/api` +
  Base dos Dados (BigQuery) — população, renda média, PIB per capita por município.
- **Uso:** **features de nível de cidade** para o modelo generalizar entre cidades
  (uma diária "premium" em Floripa ≠ em SP). Normaliza preço/demanda por poder
  aquisitivo local. Chave de junção: código IBGE de 7 dígitos do município.
- **Licença:** dados abertos.
- **Esforço:** P (API REST) a M (Base dos Dados/BigQuery, precisa de projeto).
- Fontes: https://servicodados.ibge.gov.br/api/docs/ · https://basedosdados.org/

## 4. Wikidata — capacidade de venues + público de eventos (generaliza sp-venues)

- **O que é:** SPARQL (CC0) — P1083 (capacidade), P1110 (público), P625 (geo).
- **Uso:** o que já fizemos para SP (`sp-venues.ts`, âncoras), **por cidade**:
  trocar `wd:Q174` (SP) pelo QID da nova cidade e regerar. Venues + eventos
  recorrentes de qualquer capital saem daqui.
- **Esforço:** P por cidade (query parametrizada).
- Fonte: https://query.wikidata.org/

## 5. OpenStreetMap / Overpass — transporte (generaliza sp-metro-stations)

- **O que é:** estações de metrô/trem/BRT por bbox, com coordenadas (ODbL).
- **Uso:** o `metroDistance` de qualquer cidade — trocar o bbox e o filtro de rede.
  Já usamos para as 101 estações de SP.
- **Esforço:** P por cidade.
- Fonte: Overpass API.

## 6. Já no sistema (não precisa buscar)

- **Feriados/sazonalidade** (`sp-seasonality.ts`) — feriados nacionais valem para
  todo o Brasil; só os municipais/estaduais mudam por cidade.
- **Coleta de eventos** (SpCultura, Firecrawl, ingest) — replicável por cidade.
- **Feedback loop** — o dado que vence no fim, agnóstico de cidade.

---

## Arquitetura multi-cidade (o que cada nova cidade precisa)

Para incorporar a **cidade X**, o checklist vira mecânico:

| Feature | Fonte | Como |
|---|---|---|
| Comps de treino | Inside Airbnb (cidade X) | rodar `import-inside-airbnb.ts --city X` |
| metroDistance | OSM/Overpass | regenerar `stations` com o bbox de X |
| Capacidade de venue | Wikidata P1083 | trocar QID da cidade |
| Público de eventos | Wikidata P1110 + Firecrawl | idem + coletores locais |
| Baseline de demanda | ANAC (aeroporto de X) + feriados estaduais | agregar |
| Normalização de cidade | IBGE (renda/pop de X) | API REST |

> **Estratégia de dado:** estes públicos dão a **largada** (semanas → imediato);
> a partir daí, o **feedback loop** com o nosso dado real de reserva refina e
> vira a fonte dominante por cidade. É o caminho do Tier 0 (regras) → Tier 1+
> (modelo treinado) sem esperar acumular do zero.

## Ordem de valor sugerida

1. **Inside Airbnb SP** (feito o importador) — maior salto de cold-start.
2. **ANAC + feriados estaduais** — baseline de demanda por cidade.
3. **IBGE** — normalização entre cidades (só relevante ao abrir a 2ª cidade).
4. **Wikidata/OSM por cidade** — mecânico, sob demanda ao abrir cada cidade.
