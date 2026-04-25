# Runbook — Aquisição de Dataset Histórico para o Motor de Pricing

**Contexto:** F6.1 Tier 2 do roadmap. O motor existe (Tier 0), foi refatorado em strategy plugável (ADR 0008), mas ainda roda com 3 imóveis mock. Para subir aos Tiers 1+ precisamos de **dados reais**: ≥200 imóveis SP × 12 meses de histórico (preço/noite, ocupação, ADR).

A pesquisa de 24/04/2026 mapeou 10 fontes; este runbook lista as que **valem a ação imediata** com instrução passo-a-passo.

---

## ⚠️ Correção importante (24/04/2026)

A premissa anterior do roadmap era que **InsideAirbnb** (`insideairbnb.com`) cobriria SP diretamente. **Confirmado que não cobre.** O portal "Get the Data" lista apenas Rio de Janeiro para o Brasil hoje. Mas:

- **Existe espelho via Base dos Dados (BigQuery)** com SP histórico parcial — viável.
- **Pode-se solicitar SP** via formulário de "data request" do InsideAirbnb. Custo zero, lead time variável.

**Plano revisado:** AirROI grátis (UI + API leve) + Base dos Dados via BigQuery + IBGE/OTE para enriquecer. Se time/orçamento permitir, somar Airbtics (US$ 29/mês) por velocidade de entrega.

---

## Top 3 fontes — comece por essas

### 1. AirROI — São Paulo data portal

- **URL:** https://www.airroi.com/data-portal/markets/so-paulo-brazil
- **Custo:** Free tier (UI) + API pay-as-you-go (~US$ 0.01/call). Há um limite mensal generoso na free tier.
- **Cobertura:** ~28.184 listings SP (out/2025), ADR ~US$58, ocupação ~40,7%.
- **Formato:** Dashboard web + REST API documentada. Export CSV é pago.
- **Licença:** ToS próprios — uso interno OK, **revenda não permitida**.
- **Frequência:** atualização contínua/mensal.

**Como começar:**

1. Criar conta em https://www.airroi.com (sign up grátis).
2. Acessar o data portal de SP e baixar o snapshot inicial pela UI (CSV pequeno).
3. Pegar API key em https://www.airroi.com/api → setar `AIRROI_API_KEY` no Railway (env var nova, a adicionar no `.env.example` quando for ativar).
4. Implementar um script `scripts/import-airroi-sp.ts` que puxa listings via API e popula uma tabela nova `external_listings` no MySQL para feature enrichment.

**Robustez:** Alta. **Tempo até primeiros dados úteis:** 1 dia.

### 2. Base dos Dados — espelho do Inside Airbnb

- **URL:** https://basedosdados.org/dataset/inside-airbnb
- **Custo:** Grátis (BigQuery free tier de 1 TB de query/mês cobre folgado o uso).
- **Cobertura:** SP histórico parcial; precisa conferir os meses cobertos no momento.
- **Formato:** SQL via BigQuery, ou export CSV/Parquet via Python/R.
- **Licença:** CC BY 4.0 — uso comercial OK com atribuição.
- **Frequência:** segue InsideAirbnb upstream (irregular para SP).

**Como começar:**

1. Criar projeto GCP grátis: https://console.cloud.google.com.
2. Habilitar BigQuery API.
3. Query inicial:
   ```sql
   SELECT *
   FROM `basedosdados.mundo_inside_airbnb.listing`
   WHERE city = 'sao paulo'
   LIMIT 1000;
   ```
4. Exportar para `gs://urbanai-data-lake/inside-airbnb/sp/` ou diretamente para CSV local.
5. Carregar em uma tabela MySQL `historical_listings` para o pipeline Prefect consumir.

**Robustez:** Média (gap recente em SP). **Tempo até dados úteis:** 2 dias se nunca usou GCP, 2 horas se já tem o setup.

### 3. InsideAirbnb — solicitar SP por data request

- **URL:** https://insideairbnb.com/data-requests/
- **Custo:** Grátis.
- **Licença:** CC BY 4.0.
- **Cobertura:** se aprovado, dataset canônico (listings + calendar + reviews CSV.GZ).

**Como começar:** preencher o formulário hoje mesmo. Lead time desconhecido (resposta humana), então não bloqueia o plano — é um free hit em paralelo.

---

## Fontes complementares (incluir após a base do Top 3)

| Fonte | Quando usar | Como |
|---|---|---|
| **Airbtics** US$ 29/mês | Acelerar Tier 2 com dataset limpo + API estável | https://airbtics.com/pricing/ — assinar Analytics |
| **IBGE PNAD Contínua Turismo** | Features de demanda turística por UF (anual) | https://www.ibge.gov.br/estatisticas/multidominio/turismo/17270-pnad-continua.html |
| **Observatório de Turismo SP** | Ocupação hoteleira agregada SP capital | https://www.observatoriodoturismo.com.br/ |
| **FOHB Panorama Hotelaria 2025** | Benchmark ADR/RevPAR hotelaria nacional | https://fohb.com.br/wp-content/uploads/2024/05/Panorama-da-Hotelaria-Brasileira-2025-HotelInvest-FOHB.pdf |
| **Kaggle datasets SP-Airbnb** | POC inicial barato (datasets soltos) | Buscar "São Paulo Airbnb" no Kaggle |
| **Comunidade Superhost SP** | Dataset proprietário em troca de acesso ao Urban AI | grupos de Facebook + WhatsApp + Airbnb Community SP |
| **Stays Modelo 1 (trade)** | Dataset agregado anonimizado por bairro × mês | parceria comercial — `docs/outreach/stays-one-pager.md` |

## ❌ Fontes a evitar

- **AirDNA** (US$ 34–125/mês) — caro e ToS proíbe revenda.
- **Scraping direto Airbnb.com** — proibido pelo ToS, risco jurídico e PR alto.

---

## Cronograma proposto (alinhado com F6.1 Tier 2 do roadmap)

| Semana | Ação |
|---|---|
| **5** | Criar conta AirROI + abrir data request InsideAirbnb + criar projeto GCP + setar BigQuery |
| **6** | Importar 1k listings AirROI + 1k Base dos Dados; popular `external_listings` |
| **6** | Pipeline Prefect novo `import-external-airbnb-sp` (semanal) que mantém o cache fresco |
| **6–7** | Treinar XGBoost shadow contra esse dataset; medir MAPE inicial |
| **7–8** | Avaliar se Airbtics pago acelera; decidir |
| **7–8** | Continuar conversa Stays para Modelo 1 trade (ver `docs/outreach/stays-contato-comercial.md`) |
| **8–9** | Recrutar 20–30 voluntários Superhost SP via comunidade |

---

## LGPD

Datasets externos contêm dados públicos do Airbnb (preços anunciados, agregados anônimos). Nenhum dos itens do Top 3 expõe PII de anfitriões. **Nada disso entra na base de produção** — fica em tabelas separadas (`external_listings`, `historical_listings`) marcadas como "uso analítico interno". Atualizar `docs/lgpd/politica-privacidade-interna.md` §1.3 quando os imports começarem.

---

*Última atualização: 24/04/2026 · Pesquisa de fontes feita pelo agente em 24/04/2026 · Confirma que InsideAirbnb não cobre SP no portal direto*
