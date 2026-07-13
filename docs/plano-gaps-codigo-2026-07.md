# Plano passo a passo dos gaps de código — verificado no código (06/07/2026)

> Cada item foi **verificado no código** antes de planejar (o padrão da sessão foi
> "metade já estava feita"). Anotado o que JÁ existe vs o que falta.
> Esforço: P ≤ 4h · M 1-2 dias · G 3-5 dias.

---

## 1. Ligar `metroDistance` real no classifier · **P · dev back**

**Verificado:** `knn-classifier.ts:76` lê `property.metroDistance` e `property.amenitiesCount`. Quem monta esse objeto é `propriedade.service.ts:2519-2522` (`minhaPropParaIA`), que hoje passa **`metroDistance: 0.5` fixo** e `amenitiesCount: propertyDetails?.bedrooms` (proxy). O `address` (com o campo `metroDistance` que criei no IA-1) e o `list` (com `amenitiesCount`) **estão disponíveis no escopo**. Também os comps de treino (`treinamentoLocal`, linha 2510-2516) usam `metroDistance: 0.8` fixo.

**Passos:**
1. Em `minhaPropParaIA` (2519-2522): trocar
   `metroDistance: 0.5` → `metroDistance: address.metroDistance ?? 0.5`
   `amenitiesCount: propertyDetails?.bedrooms ?? 1` → `amenitiesCount: address?.list?.amenitiesCount ?? propertyDetails?.bedrooms ?? 1`.
2. Rodar o cron de feature engineering (IA-1) antes, para popular `address.metro_distance_km` (senão cai no fallback 0.5 — comportamento atual, sem regressão).
3. (Opcional, ganho médio) para os comps de treino: como comps vêm do Airbnb GraphQL sem metroDistance, calcular via `nearestStationKm(comp.lat, comp.lng)` (função pura que já existe em `feature-engineering.service`) — reutilizar, não fixar 0.8.
4. **Verificar:** análise de preço de um imóvel com `metro_distance_km` populado retorna categoria/preço **diferente** do fallback.

**Aceite:** o valor lido pelo classifier vem de `address.metroDistance` quando existe; fallback preserva o comportamento atual. Teste unitário mockando address com/sem metroDistance.

---

## 2. Coordenadas reais das estações (GTFS) · **P-M · dev back**

**Verificado:** `knn-engine/data/sp-metro-stations.ts` — conjunto SEED aproximado (~30 estações) que eu criei, com header alertando para trocar. O **algoritmo** (`haversineKm`/`nearestStationKm`) é definitivo; só a tabela de coordenadas é aproximada e esparsa (superestima a distância).

**Passos:**
1. Baixar o dataset oficial: **GTFS do Metrô-SP/CPTM** (arquivo `stops.txt` tem `stop_name, stop_lat, stop_lon`) ou o shapefile "Estações" do **GeoSampa**. Cobrir Metrô (linhas 1-5,15) + CPTM (7-13) — ~150 estações.
2. Converter para o formato `MetroStation[]` (`{name, lat, lng}`) e substituir o conteúdo de `sp-metro-stations.ts` (manter a interface). Remover o aviso do header.
3. Adicionar um teste: contar estações (≥ 90) e validar bbox SP de todas.
4. **Verificar:** `nearestStationKm` para um ponto conhecido (ex.: Av. Paulista) retorna a estação correta (Trianon-Masp/Brigadeiro) com distância plausível (< 0.5 km).

**Aceite:** dataset completo (Metrô+CPTM), todas em SP, teste de sanidade passando. (O algoritmo não muda.)

---

## 3. Qualidade da "definição de demanda" de eventos · **G · dev back** (o de maior impacto)

**Verificado:** `event-pricing-intelligence.service` pondera relevância 30% (Gemini), público 25%, venue 15%, raio 10%, leadTime 10%, fonte 10%. `expectedAttendance` **já existe como campo e já é usado** (`cron.service:114`, `admin.service:2749`) — mas populado em ~15% dos eventos. **NÃO existe** tabela de histórico de eventos recorrentes nem baseline de ocupação.

Três frentes (ordem de valor/esforço):

**3a. Feedback retroativo (já quase pronto) — P**
- O `PricingFeedbackService` (que criei) já recalcula MAPE. Ligar a saída dele na calibração dos pesos/multiplicadores (hoje só loga/alerta). Esforço menor; ganho: os pesos deixam de ser chute.

**3b. Histórico de eventos recorrentes — M**
- Criar entity `EventHistoricalMultiplier` (`canonicalName`, `year`, `realMultiplier`, `realOccupancy`, `avgDemandScore`).
- No enrichment, tentar match do evento novo com o histórico por `normalizedName` (já existe `EventIdentityService`). Se match ≥ 90%, usar o `realMultiplier` histórico como **âncora** (ex.: CCXP 2025 herda o multiplicador que funcionou em 2022-2024).
- Popular via o próprio feedback loop (3a) ao longo do tempo.

**3c. Attendance real (cobertura) — M**
- Trocar spiders por **APIs oficiais Sympla/Eventbrite** (trazem `expectedAttendance`/inscritos) — os coletores já têm o schema; falta plugar as chaves + o campo.
- Refinar o prompt do Gemini com pisos/tetos ("evento < 100 pessoas → relevância ≤ 20") para reduzir o chute nos 85% sem attendance real.

**3d. Baseline de ocupação — M** (começar simples)
- Tabela/seed de **feriados + alta temporada SP** (grátis). Fator: `demandScore_ajustado = demandScore × (1 + baselineFactor)`. Evita subestimar evento que cai no Carnaval/Réveillon.
- Depois (pago): dados STR/AirROI.

**Aceite:** o `eventDemandScore` deixa de ter ~55% do peso em chute do Gemini — attendance real em > 40% dos eventos, eventos recorrentes ancorados no histórico, baseline aplicado.

---

## 4. Ponte tempo-até-valor · **P-M · dev full-stack**

**Verificado — já existe grande parte!** `propriedade.service.ts:90` define `PublicPropertySetupStatus` (`state: preparing|ready|error`, `currentStep: map|events|suggestions|ready`, `steps[]` com labels "Preparar mapa → Procurar eventos perto → Preparar sugestões"). O `/properties` **já usa** (mostra "Estamos preparando...", `setupStatus.publicLabel`, `isPropertyReady`). O que falta: **o `/painel` (onde o host novo cai após login) não surfaça isso** — ele mostra zeros.

**Passos:**
1. No `/painel/page.tsx`: quando **nenhum** imóvel está `ready` (todos `preparing`), em vez de mostrar os KPIs zerados como estado final, mostrar um card no topo reusando o `setupStatus` — "Estamos preparando suas recomendações. Isso leva alguns minutos." + o stepper (map→events→suggestions) que já existe.
2. Estimar/mostrar o tempo (usar o cron cadence: geocoding 30min, enrichment 1h → "algumas horas na primeira vez").
3. Manter os KPIs zerados abaixo, mas secundários, não como se fosse o estado final.
4. **Verificar (com o app rodando):** host novo (sem análises) cai no painel e vê o estado "preparando", não um painel de zeros que parece quebrado.

**Aceite:** o `/painel` reusa o `setupStatus` existente para guiar o host novo. (Não recria nada — só surfaça o que já existe.)

---

## 5. A11y (axe) nas rotas autenticadas/admin · **M · dev front**

**Verificado:** `e2e/a11y.spec.ts` cobre `/`, `/lancamento`, `/plans` (públicas), via `@axe-core/playwright`, com skip gracioso se o pacote não estiver instalado. Não cobre autenticadas nem admin.

**Passos:**
1. Criar um helper de login e2e (Playwright): `POST /auth/login` com `E2E_AUTH_EMAIL/PASSWORD` (já referenciados no README) para obter os cookies httpOnly, ou preencher o form de login.
2. Novo bloco `test.describe('A11y - rotas autenticadas')` cobrindo `/painel`, `/properties`, `/my-roi`, `/onboarding`, `/settings/integrations`.
3. Bloco `A11y - admin` cobrindo `/admin`, `/admin/finance`, `/admin/events`.
4. Rodar axe com o mesmo filtro (critical/serious WCAG AA). Gated em `vars.E2E_BASE_URL` + credenciais (como o smoke atual).
5. **Verificar:** a suite roda no CI (ou local com login) e reporta violações reais.

**Aceite:** axe cobre as principais rotas autenticadas + admin; violações critical/serious falham o gate. (Nota: a validação de contraste que fiz manualmente deu 0 ruins — o axe deve confirmar e pegar o resto: labels, roles, foco.)

---

## 6. Menores

**6a. Eventos multi-dia — M · dev back.**
Verificado: ingest usa `dedupHash = sha256(nome|date|geo)` e o schema tem `dataFim`. Um festival de 3 dias vira 3 linhas se o coletor emitir 3 datas. Passos: (1) coletores emitem **1 evento com `dataInicio`→`dataFim`** (span), não N diários; (2) a query de pricing por data casar eventos onde `target BETWEEN dataInicio AND dataFim` (verificar se já faz — provável que só compare `dataInicio`); (3) dedup considerar o span. **Aceite:** CCXP aparece como 1 evento cobrindo os N dias.

**6b. Alerta externo de staleness de coletor — P · dev back/devops.**
Verificado: o `/health` já expõe `checks.crons.jobs[].hoursAgo` (que adicionei). Falta só a **regra externa**: (1) cron/monitor que lê o `/health` e alerta se um coletor conhecido tem `hoursAgo > 6/24h`, ou (2) Sentry alert rule sobre o `captureMessage` de staleness. **Aceite:** um coletor parado > 24h dispara alerta sem alguém abrir o admin.

**6c. UptimeRobot apontado para URL 404 — P · owner/devops.**
Verificado: `app.myurbanai.com/health` retorna 404; o health real está em `urbanai-production-85fd.up.railway.app/health`. Passo: reapontar o monitor UptimeRobot para o domínio Railway (ou expor `/health` no domínio do app). **Não é código** — é config do monitor. **Aceite:** o monitor bate num /health que responde 200.

**6d. FOUT (flash de fonte) — P · dev front.**
Verificado: `globals.css` importa as fontes via `@import url(...&display=swap)` — o `swap` causa o flash do Bebas. Passos: migrar para **`next/font/google`** (Next 15 self-hospeda + elimina FOUT) OU adicionar `<link rel="preload">` do woff2 do Bebas no `layout.tsx` + `font-display: optional`. **Verificar:** medir que o Bebas está `loaded` antes do primeiro paint (sem shift). **Aceite:** sem flash de fonte no load (o "fantasma" das screenshots some de vez).

---

## Resumo de esforço

| Gap | Esforço | Já existia? |
|---|---|---|
| 1. metroDistance no classifier | P | Coluna sim, ligação não |
| 2. GTFS metrô | P-M | Algoritmo sim, dados aproximados |
| 3. Qualidade de demanda | G | Campos sim, histórico/baseline não |
| 4. Ponte tempo-até-valor | P-M | setupStatus + UI /properties sim; falta no /painel |
| 5. A11y autenticadas | M | Público sim, autenticado não |
| 6a. Multi-dia | M | dataFim sim, uso não confirmado |
| 6b. Staleness alert | P | Dados no /health sim, regra não |
| 6c. UptimeRobot URL | P (owner) | — |
| 6d. FOUT | P | — |

**Sequência sugerida:** 1 → 6d → 6b → 4 → 2 → 5 → 6a → 3 (o 3 é o maior e o de maior impacto na qualidade da recomendação, mas depende de dados/chaves).
