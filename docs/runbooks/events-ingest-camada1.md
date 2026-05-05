# Runbook — F6.2 Plus Camada 1: ingestão de eventos via APIs oficiais

**Owner:** Gustavo (manual de credenciais) + Claude (código dos coletores)
**Status:** Backend pronto · **Fase A (spiders Scrapy) também pronta** ·
Coletores de API novos (api-football/Sympla/Eventbrite) pendentes de credencial

---

## O que está pronto agora

✅ **Fase A — atualização dos 7 spiders Scrapy existentes**:
   `UrbanIngestPipeline` registrada em `settings.py` faz POST ao
   `/events/ingest` em paralelo às pipelines S3 (bronze layer mantido).
   Auto-desabilita silenciosamente se as envs `URBAN_COLLECTOR_*` não
   estiverem setadas (dev local sem backend continua OK).

✅ **Geocoding lazy** — eventos sem lat/lng são aceitos quando
   `enderecoCompleto` presente. Backend marca `pendingGeocode=true,
   ativo=false`. Cron a cada 30 min (`EventsGeocoderService`) processa
   em batches de 30 via Google Maps. Endpoint admin
   `POST /events/geocoder/run?limit=N` dispara imediato.

✅ **Venue map hardcoded** (`venue_map.py`) — 25+ locais conhecidos de SP
   (Allianz, Morumbi, Itaquera, São Paulo Expo, Anhembi, etc.) com
   lat/lng, capacidade e tipo. Spider reconhece o nome no endereço/local
   e preenche tudo de graça (sem ir no geocoder).

✅ Schema do `event` expandido com colunas de procedência:
   `source`, `sourceId`, `dedupHash` (UNIQUE), `venueCapacity`, `venueType`,
   `expectedAttendance`, `crawledUrl`, **`pendingGeocode`**

✅ Migration idempotente `1746000000000-AddEventCoverageFields` — roda
   seguro em base que já tem ou não tem essas colunas

✅ Endpoint **`POST /events/ingest`** (admin-only, throttled 60/min):
   - Recebe array de `events` no body
   - Calcula `dedupHash = sha256(nome|YYYY-MM-DD|lat~3,lng~3)` server-side
   - **UPSERT conservador**: cria novo OU atualiza só campos vazios da row
     existente, **sem sobrescrever** `relevancia`/`raioImpactoKm`/etc. já
     calculados pela IA
   - Retorna agregado por fonte: `{ total, created, updated, skipped, bySource }`
   - Limite: 500 eventos por batch

✅ 14 testes unitários (`events-ingest.service.spec.ts`):
   dedup determinístico, normalização nome/lat/lng, validação, UPSERT
   conservador, agregação por fonte, limite de batch

✅ 109 testes backend total (era 95, +14)

---

## O que **VOCÊ precisa fazer manualmente** (passo a passo)

### Passo 1 — Cadastrar conta na **api-football.com** (5 min)

**Por que:** API que dá calendário oficial dos jogos do Allianz Parque,
Morumbi, Neo Química Arena, Pacaembu (quando reabrir). Mais alto ROI por
hora de trabalho — 1 jogo do Palmeiras lota toda a região.

**Como:**
1. https://www.api-football.com/ → **Sign Up** (grátis pra começar)
2. Confirmar email
3. Dashboard → ver o **API Key** (string longa, tipo `abc123def456...`)
4. **Plano Free** dá 100 requests/dia — suficiente pro PoC
5. Quando confortável, upgrade pro **Basic ($19/mês)** — 7.5k req/dia
6. **Copiar a API Key** e guardar (vamos setar como env var no Railway
   no próximo passo)

**Setar no Railway backend** (aba Variables):
```
API_FOOTBALL_KEY = <sua key>
```

**No app Python (próximo PR):** vou ler essa env via `os.environ`.

---

### Passo 2 — Cadastrar conta na **Sympla** (developer) (10 min)

**Por que:** Sympla API oficial substitui o spider atual. Mais robusto
(layout deles muda direto) e cobre cursos/conferências B2B.

**Como:**
1. https://developers.sympla.com.br
2. **"Cadastre-se como desenvolvedor"** (precisa CPF + email)
3. Após aprovação (geralmente automático em minutos), você ganha um
   **API Token** no painel
4. Plano gratuito tem rate limit (mas é generoso pra ingestão diária)

**Setar no Railway backend:**
```
SYMPLA_API_TOKEN = <token>
```

---

### Passo 3 — Cadastrar **Eventbrite Developer** (10 min)

**Por que:** Conferências profissionais, workshops, eventos B2B
internacionais que rolam em SP (Web Summit Rio etc.).

**Como:**
1. https://www.eventbrite.com/platform/api → **Get Started**
2. Login com sua conta Eventbrite (criar uma se não tem)
3. Account Settings → **Developer Links** → **API keys**
4. Criar nova **Private Token**
5. Plano gratuito: 1.000 chamadas/hora — mais que suficiente

**Setar no Railway backend:**
```
EVENTBRITE_PRIVATE_TOKEN = <token>
```

---

### Passo 4 — (Opcional) Prefeitura de SP — São Paulo Aberta

**Por que:** Eventos culturais municipais, feiras, atrações em parques
e equipamentos públicos. Pega o que ninguém mais cobre.

**Como:**
1. http://catalogo.dados.sp.gov.br
2. Procurar conjunto de dados de eventos culturais
3. Pode ser CSV / API REST sem autenticação (varia por dataset)

Esse passo é **best-effort** — vou avaliar a qualidade quando começar
a Camada 1. Não é bloqueante.

---

### Passo 5 — Criar usuário admin "técnico" pro coletor autenticar (5 min)

O endpoint `/events/ingest` é admin-only. Os coletores Python precisam
de um JWT pra bater nele. Solução:

1. Criar conta normal pelo `/create` na URL nova
2. No DB do Railway, marcar essa conta como `role = 'admin'`:
   ```sql
   UPDATE users
   SET role = 'admin'
   WHERE email = 'collector@urban.ai';
   ```
3. Fazer login HTTP `POST /auth/login` com essa conta → pegar o
   `accessToken` retornado
4. Setar no Railway dos coletores:
   ```
   URBAN_API_BASE = https://api.myurbanai.com
   URBAN_COLLECTOR_TOKEN = <accessToken>
   ```

⚠️ **Nota:** o accessToken JWT expira em 15 min hoje. Pra coletor
automatizado, melhor usar refresh token rotation ou criar um
**API Key permanent** dedicado (não temos hoje — vai entrar como
melhoria na próxima rodada).

**Workaround temporário:** o cron Python faz login antes de cada batch
diário, pega o token novo, usa pra enviar, descarta. Não é elegante mas
funciona enquanto não criamos API Key.

---

## Como bater no endpoint manualmente (smoke test)

Depois de criar o usuário admin (passo 5):

```bash
# 1. Login
TOKEN=$(curl -s -X POST https://api.myurbanai.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"collector@urban.ai","password":"<senha>"}' \
  | jq -r '.accessToken')

# 2. Ingest evento de teste
curl -X POST https://api.myurbanai.com/events/ingest \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "events": [{
      "nome": "Palmeiras x Santos",
      "dataInicio": "2026-05-10T16:00:00Z",
      "latitude": -23.5275,
      "longitude": -46.6783,
      "enderecoCompleto": "Allianz Parque - SP",
      "cidade": "São Paulo",
      "estado": "SP",
      "categoria": "esporte",
      "source": "api-football",
      "sourceId": "fixture-12345",
      "venueCapacity": 43000,
      "venueType": "stadium",
      "expectedAttendance": 38000
    }]
  }'

# Resposta esperada:
# {
#   "total": 1,
#   "created": 1,
#   "updated": 0,
#   "skipped": 0,
#   "bySource": { "api-football": { "created": 1, "updated": 0, "skipped": 0 } },
#   "results": [{ "status": "created", "id": "...", "dedupHash": "..." }]
# }
```

Rodar 2x → segundo retorna `updated`. Com lat/lng diferente em < 100m →
ainda dedupa. Com data diferente → cria novo.

---

## Schema completo do payload

```ts
interface IngestEventInput {
  // Obrigatórios
  nome: string;                  // Nome do evento
  dataInicio: string | Date;     // ISO 8601
  latitude: number;              // [-90, 90]
  longitude: number;             // [-180, 180]
  source: string;                // Procedência: 'api-football' | 'sympla-api' | etc.

  // Recomendados
  dataFim?: string | Date | null;
  enderecoCompleto?: string;
  cidade?: string;
  estado?: string;               // UF, 2 chars (default 'SP')

  // Opcionais
  descricao?: string | null;
  categoria?: string | null;
  linkSiteOficial?: string | null;
  imagemUrl?: string | null;

  // F6.2 Plus
  sourceId?: string | null;          // ID externo na fonte
  venueCapacity?: number | null;     // Capacidade física do venue
  venueType?: string | null;         // 'stadium' | 'convention_center' | 'theater' | 'bar' | 'church' | 'outdoor' | 'other'
  expectedAttendance?: number | null; // Público esperado deste evento
  crawledUrl?: string | null;
}
```

---

## Próximos PRs (eu)

Quando você tiver pelo menos a **API_FOOTBALL_KEY** setada, eu sigo com:

1. **Coletor Python `urban-pipeline-main/collectors/api_football.py`** —
   busca fixtures dos 4 venues SP (Allianz, Morumbi, Itaquera, Pacaembu),
   normaliza pro schema do `/events/ingest`, posta com retry exponencial
2. **Pipeline Prefect** que dispara diário 04:00 BRT, com observability
3. **Coletor Sympla API** (substitui spider Scrapy)
4. **Coletor Eventbrite**
5. **Firecrawl genérico** (Camada 2) com 1 PoC: anhembi.com.br

Cada coletor é independente. Pode ir liberando na ordem que conseguir
as keys.

---

## Como ver o que está entrando

No painel admin: `/admin/events` mostra:
- Total de eventos
- Distribuição por categoria
- Top relevância

Quando os coletores começarem a rodar, vai aparecer rapidamente:
- `source = 'api-football'` (jogos)
- `source = 'sympla-api'` (cursos/conferências)
- `source = 'eventbrite-api'` (eventos B2B)
- `source = 'scraper-*'` (legados — vão ser desligados após Camada 1
  estabilizar)

Próxima evolução do painel admin: tela específica de "saúde dos
coletores" com volume diário por source, dedup rate, falhas.

---

*Última atualização: 25/04/2026.*
