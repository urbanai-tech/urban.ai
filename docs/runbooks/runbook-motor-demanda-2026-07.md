# Runbook — ativar o motor de demanda (venues + histórico) em produção

> O que rodar e conferir **depois do deploy** desta branch (`fix/audit-remediation-2026-07`)
> para ligar o teto de capacidade de venue (3c), a âncora histórica (3b) e o
> baseline sazonal (3d). Ordem importa.

## 0. Pré-requisitos

- [ ] Deploy da branch no Railway (backend).
- [ ] (Opcional, só para o refresh automático de festivais) setar `FIRECRAWL_API_KEY`
      no ambiente do Railway. **Sem a chave o seed curado já funciona**; a chave só
      liga o `refreshFromFirecrawl()` que reatualiza o público a cada nova edição.
- [ ] Token de admin para chamar os endpoints `/admin/jobs/*`.

## 1. Migrações (cria a tabela âncora + colunas)

```bash
# no serviço backend (Railway shell ou deploy hook)
npm run migration:run
```

Deve aplicar:
- `EventHistoricalMultiplier1783700000000` → cria `event_historical_multiplier`
  (+ índice único `IDX_ehm_canonicalName`) e adiciona `events.historicalAttendance`.

**Conferir:**
```sql
SHOW TABLES LIKE 'event_historical_multiplier';
SHOW COLUMNS FROM events LIKE 'historicalAttendance';
SHOW COLUMNS FROM events LIKE 'venueCapacity';   -- já existia
```
As três devem existir.

## 2. Backfill de capacidade de venue (3c)

```bash
curl -X POST https://<backend>/admin/jobs/venue-capacity/run \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Roda `VenueCapacityService.backfillAll()` sobre **toda** a base de eventos, casando
cada evento a um venue conhecido (nome/alias/geo) e populando `venueCapacity`
(+ `venueType` quando vazio).

**Conferir:**
```sql
-- quantos eventos ganharam capacidade
SELECT COUNT(*) FROM events WHERE venueCapacity IS NOT NULL;
-- amostra por venue (sanidade dos valores)
SELECT venueCapacity, COUNT(*) FROM events
 WHERE venueCapacity IS NOT NULL GROUP BY venueCapacity ORDER BY 2 DESC LIMIT 20;
```
Esperado: eventos em Allianz/Neo Química/Morumbi/Espaço Unimed/etc. com a capacidade
correta. Eventos sem venue conhecido continuam NULL (ok — caem no fallback do score).

## 3. Âncora histórica + seed de festivais (3b)

```bash
curl -X POST https://<backend>/admin/jobs/event-historical/run \
  -H "Authorization: Bearer <ADMIN_TOKEN>"
```
Roda, em ordem: `seedCuratedAnchors` (CCXP/Lolla/The Town, key-free) →
`importFromWikidata` (P1110) → `refreshFromFirecrawl` (só se a chave estiver setada) →
`recomputeFeedbackAnchors` (ocupação/multiplicador reais) → `applyAnchorsAll`
(copia o público histórico para `events.historicalAttendance`).

**Conferir:**
```sql
-- âncoras populadas (seed + wikidata + feedback)
SELECT canonicalName, displayName, realAttendance, realOccupancy, realMultiplier,
       sampleSize, source, lastYear
  FROM event_historical_multiplier ORDER BY realAttendance DESC;
-- eventos que herdaram público histórico
SELECT COUNT(*) FROM events WHERE historicalAttendance IS NOT NULL;
-- um recorrente específico deve casar (ex.: CCXP)
SELECT nome, normalizedName, historicalAttendance FROM events
 WHERE normalizedName LIKE 'ccxp%' LIMIT 5;
```
Esperado: pelo menos as 3 âncoras de seed (ccxp, lollapalooza brasil, the town) com
`realAttendance` > 0; eventos "CCXP 2026" etc. com `historicalAttendance` preenchido.

## 4. Conferir o efeito no score

Rodar uma análise de preço num imóvel perto de um evento grande (ex.: show no
Allianz, ou CCXP no SP Expo) e checar os `drivers` do `eventDemandScore`:
- driver **"Público esperado"** deve ter `value` vindo de `venueCapacity` ou
  `historicalAttendance` (não mais `missing`);
- driver **"Sazonalidade"** aparece se a data cai em feriado/alta temporada;
- `dataQualityFlags` deve conter `attendance_from_venueCapacity` /
  `attendance_from_historicalAttendance` (confiança ajustada, sem fingir precisão).

## 5. Crons (rodam sozinhos depois)

Não precisa reexecutar manualmente; ficam agendados (BRT):
- `04:30` — `VenueCapacityService.scheduledBackfill` (venues de eventos novos).
- `04:45` — `EventHistoricalService.scheduledApply` (aplica âncora em eventos novos).
- `Dom 06:00` — `EventHistoricalService.scheduledImport` (seed + wikidata + refresh +
  feedback + apply).

## 6. Rollback (se precisar)

```bash
npm run migration:revert   # remove a coluna historicalAttendance + a tabela âncora
```
Os jobs são idempotentes e não destrutivos; parar de chamá-los basta. O
`venueCapacity`/`historicalAttendance` são colunas aditivas — nada é sobrescrito
com destruição de dado.

---

## Notas de honestidade

- **Wikidata não cobre os festivais BR** (CCXP/Lolla/The Town) — por isso o seed
  curado (números reais extraídos da Wikipedia via Firecrawl, com fonte em
  `sp-recurring-events.ts`). O `importFromWikidata` traz sobretudo esportes/eventos
  únicos, que não atrapalham (só casam se um evento futuro tiver o mesmo nome).
- **Público de venue é TETO, não realidade** — `resolveAttendance` aplica
  sell-through 0.7 e marca a fonte, então o score não finge que todo evento lota.
- **A fonte que vence no fim é o feedback loop** (`recomputeFeedbackAnchors`): à
  medida que análises acumulam resultado real, ocupação/multiplicador reais
  sobrescrevem o seed/wikidata por evento canônico.
