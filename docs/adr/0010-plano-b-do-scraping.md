# ADR 0010 — Plano B do scraping: dados informados pelo anfitrião

**Status:** Aceito (26/10/2026) — item D5 do roadmap.

## Contexto

O produto depende de dados do Airbnb obtidos por scraping (navegador headless, HTML público, GraphQL interno) e por APIs pagas no RapidAPI. Isso quebra por motivos fora do nosso controle: bloqueio anti-bot, cota/fatura do RapidAPI, mudança de hash do GraphQL, instabilidade. Antes desta mudança, parte dos caminhos falhava de forma barulhenta (erro 400/502 ao usuário) e parte de forma **silenciosa** (zeros gravados por cima de dados bons). O anfitrião, que sabe a própria diária e o tamanho do imóvel, ficava sem saída.

Objetivo: quando a fonte falha, o anfitrião ainda recebe valor — informando ele mesmo o essencial — sem que a Urban AI prometa mais do que sabe.

## Mapa de dependências do Airbnb

| Dado / necessidade | Onde é obtido hoje | Fonte | O que acontece quando falha | Substituível por input do anfitrião? |
|---|---|---|---|---|
| **Metadados do anúncio** (título, foto, quartos, camas, banheiros, hóspedes, tipo, rating, reviews, bairro) | `PropriedadeService.scrapeAirbnbListing` (HTML público); usado em onboarding (`ConnectService.createMultipleAddresses*`), `quick-info`, re-scraping mensal (`refreshAllProperties`) | HTML público do Airbnb | **Falha silenciosa**: o método nunca lança, devolve snapshot "vazio" (`Imóvel <id>`, tipo `Desconhecido`, contagens 0, sem coordenadas). Antes desta ADR o onboarding e o re-scraping **gravavam esses zeros** por cima dos dados. No onboarding a ausência de lat/long vira erro 400 ao final | **Sim** (quartos, camas, banheiros, hóspedes, tipo) via `PUT /propriedades/:id/host-baseline`. Título/foto/rating/reviews não são necessários ao cálculo |
| **Coordenadas / endereço** (lat, long, cidade, UF, CEP) | `scrapeAirbnbListing` no onboarding; `GoogleMaps` só geocodifica (não é Airbnb) | HTML público | Onboarding recusa o imóvel (400 "Não foi possível obter latitude/longitude…"); o imóvel não é criado | **Parcial / não nesta entrega**: exigiria geocodificar endereço digitado (Google Geocoding já existe em `src/maps`). Fica como pergunta de produto |
| **Lista de imóveis do perfil do anfitrião** (`hostId`, import por perfil) | `scrapeHostListings` (GraphQL `ContextualPublicProfileQuery`) → fallback `.com` → fallback navegador; `getPropertyHostId` (HTML → headless) | GraphQL interno + headless | GraphQL/headless falham → lista vazia (`[]`) e a UI mostra "Nenhum imóvel encontrado". O anfitrião ainda pode colar o link de cada anúncio | **Já substituído** pelo fluxo "colar link do anúncio"; o perfil é conveniência |
| **Diária atual (preço base)** | `AirbnbService.getFirstAvailablePrice` / `getPriceForDateWindow` (headless primeiro, RapidAPI `airbnb-search` como fallback; bloqueio sistêmico não faz retry); `ConnectService.resolveListingBasePrice` no onboarding | Headless + RapidAPI | Onboarding: preço não obtido → imóvel fica "Diária base pendente" e o front abre o formulário de diária (já existia). Pricing (`getPricingBaseQuote`): usa a diária **armazenada** quando existe; sem ela cai no Airbnb ao vivo e, se falhar, `missing_airbnb_price` (nada é gerado, sem aviso ao anfitrião). **Cron diário**: comparava com a diária ao vivo; se a leitura falhava, a recomendação era descartada (`failed++`) | **Sim** — é o caso central. `manualDailyPrice` já existia (`PATCH pricing-inputs`); agora com marcador `host_input`, data, piso e fim de semana |
| **Diária mínima / fim de semana** | Não existiam | — | — | **Sim** (novo): mínima vira piso da sugestão; fim de semana é só registrada |
| **Disponibilidade / ocupação** | Nunca vem do Airbnb: `occupancy_history` é declarada pelo anfitrião (`origin=manual`) ou pela Stays | Anfitrião / Stays | Não depende do Airbnb | Já é input do anfitrião |
| **Comparáveis (comps)** | `PropriedadeService.criarAlertaAirbnb` / `buscarAlertPorId` (RapidAPI `airbnb-income-prediction`), com fallback `buildDirectScrapingComps` (imóveis próximos já cadastrados + preço armazenado/ao vivo) | RapidAPI + base própria | Sem RapidAPI: usa comps diretos da base própria (até 5 vizinhos ≤ 10 km); sem nenhum, `missing_comps` e nada é gerado | **Não** (comps são do mercado). Melhora com a base própria crescendo (`DatasetCollectorService`) |
| **Preço de referência do comp** | `getFirstAvailablePrice(maxObj.listingID)` com fallback para `avg_booked_daily_rate_ltm` do próprio comp | Headless/RapidAPI | Já degrada para o valor médio do comp | Não se aplica |
| **Observações de preço para o dataset** | `DatasetCollectorService` → `AirbnbService.getPriceForDateWindow`; só grava se o imóvel não tem `manualDailyPrice` | Headless/RapidAPI | Observação é pulada com aviso | Não é necessário |
| **Telemetria de falhas** | `AirbnbPricingAttemptLogService` (`/admin`) registra tentativas (sucesso, bloqueio, timeout…) | Interna | Alimenta o painel de qualidade do admin; **não** altera o que o anfitrião vê | n/a |
| **Credenciais** | `RAPIDAPI_KEY`, `AIRBNB_GRAPHQL_HASH`, `AIRBNB_WEB_API_KEY` (novo), `AIRBNB_ROOM_INFO_URL`, `AIRBNB_PRICE_SCRAPER_URL` | Ambiente | Chave do RapidAPI ausente: aviso no boot e as chamadas falham; chave web do Airbnb ausente: GraphQL pulado, usa headless | n/a |

## Opções consideradas

1. **Trocar de provedor de scraping/API.** Mantém a dependência: o próximo bloqueio repete o problema.
2. **Cache agressivo da última leitura.** Ajuda, mas não resolve imóvel novo nem leitura que nunca funcionou.
3. **Entrada do anfitrião como fonte de primeira classe, com origem e data explícitas** (escolhida), reaproveitando as colunas de `list` que já existiam (`manualDailyPrice`, `pricingInputSource`, `pricingInputsUpdatedAt`) e a tabela `pricing_input_history`.

## Decisão

- **Modelo de dados** (migration aditiva `1793000000000-AddHostInputBaselineToList`): em `list`, `minDailyPrice`, `weekendDailyPrice`, `hostInputUpdatedAt`, `essentialsSource` (`airbnb` | `host_input`) e `essentialsUpdatedAt`. A diária segue em `manualDailyPrice`, com `pricingInputSource='host_input'` (o valor legado `manual` continua válido e é tratado como informado pelo anfitrião).
- **Escolha do baseline** (`src/pricing/baseline-price.util.ts`, função pura `selectBaselinePrice`, janela de frescor de 14 dias):
  1. só o anfitrião informou → vale o dele;
  2. só o Airbnb → vale a leitura, marcada `stale` quando fora da janela;
  3. os dois → a leitura do Airbnb só vence se estiver **fresca e mais nova** que a informação do anfitrião; leitura velha nunca derruba o valor do anfitrião.
  `resolveUsableBaseDailyPrice` (usada pelo pipeline de recomendação) delega a essa função.
- **Endpoints** (ownership por `address.user.id`, 404 para imóvel alheio; política de assinatura `free`, pois o onboarding é pré-pagamento): `GET /propriedades/:id/baseline` e `PUT /propriedades/:id/host-baseline`. O `PATCH pricing-inputs` antigo continua e também carimba `hostInputUpdatedAt`.
- **Essenciais do anfitrião não são sobrescritos** por releitura do Airbnb (`essentialsSource='host_input'`), e uma leitura vazia (snapshot de falha) **não grava mais zeros** em nenhum caminho (onboarding, legado, re-scraping mensal).
- **Piso**: `minDailyPrice` entra como limite inferior da sugestão (`PricingCalculateService.calcular`, parâmetro `precoMinimo`).
- **Cron diário**: sem leitura ao vivo, usa a diária com que a própria sugestão foi calculada (`seuPrecoAtual`) em vez de descartar a recomendação.
- **Front**: tela do imóvel ganha o cartão "Origem da diária base" com selo (informada por você / lida do Airbnb / desatualizada / sem diária) e o formulário "Preencher manualmente"; abre sozinho quando não há diária. Cópia honesta: o que é usado hoje (diária e piso) e o que só é registrado (fim de semana).
- **Chave do Airbnb fora do código**: a chave pública do cliente web do Airbnb (`x-airbnb-api-key`, usada na consulta GraphQL do perfil) estava literal em `propriedade.service.ts`. Passou a vir de `AIRBNB_WEB_API_KEY`; sem ela, o backend registra erro claro e usa o fallback por navegador. Não restam chaves de RapidAPI ou similares no código (backend, front, webscraping, pipeline). A chave antiga continua no histórico do git — é uma chave pública do site, não um segredo da Urban AI.

## Consequências

- (+) Imóvel com leitura do Airbnb quebrada ainda gera recomendação a partir do que o anfitrião informou; a origem fica visível na tela e auditável (histórico com `source='host_input'`).
- (+) Fim de dois bugs silenciosos: zeros gravados por scraping vazio e recomendações do cron perdidas por falha de leitura.
- (−) O valor do anfitrião envelhece: a Urban AI não sabe se ele mudou o preço no Airbnb. Hoje não há lembrete para reconfirmar (pergunta de produto).
- (−) A regra "leitura fresca e mais nova do Airbnb vence o valor do anfitrião" pode contrariar um anfitrião que de propósito pratica preço diferente do anúncio; só ocorre quando uma nova leitura é gravada (re-onboarding), pois o coletor de dataset já não sobrescreve `manualDailyPrice`.
- (−) Onboarding de imóvel cuja leitura falhou por completo (sem coordenadas) continua sem caminho manual: exige geocodificar endereço digitado.
- (−) A diária de fim de semana é guardada mas ainda não influencia a sugestão.
