# Runbook — Datas de eventos e fuso horário (America/Sao_Paulo)

Owner: engenharia de dados/backend · Última revisão: 2026-10-24

## Problema (D3)

O API-Football devolve horários em UTC. O coletor descartava o offset (`strftime`) e enviava
um datetime "naive"; o backend lia esse texto no fuso do processo (UTC em produção) e vários
pontos derivavam o dia com `toISOString().slice(0, 10)` (dia UTC). Resultado: um jogo às
21:30 BRT era gravado/derivado como 00:30 do **dia seguinte**, desalinhando evento, preço,
recomendação e auto-aplicação (e gerando `dedupHash` diferente entre fontes).

## Convenção

| Entrada (`dataInicio`/`dataFim`) | Interpretação no backend | Armazenado |
|---|---|---|
| ISO com offset (`...-03:00`, `...Z`) | instante absoluto | UTC |
| ISO **sem** offset (`2026-05-10 21:30:00`) | horário de relógio de **America/Sao_Paulo** | UTC (`00:30Z` do dia seguinte) |
| `YYYY-MM-DD` | evento de **dia inteiro** em São Paulo: início 00:00 BRT; `dataFim` = 23:59:59.999 BRT | UTC |
| `dataFim` ausente | = `dataInicio` (ou fim do dia, se o início for data pura) | UTC |

- **Dia de calendário** de evento, preço, recomendação e auto-aplicação = dia em São Paulo,
  via `src/common/sp-date.ts` (`toSaoPauloDateKey`, `todaySaoPauloDateKey`, `toDayKey`,
  `saoPauloDayBounds`, `parseEventDateTime`, `normalizeEventDates`). Sem dependência nova
  (`Intl.DateTimeFormat` com `timeZone`).
- **`dedupHash`** = `sha256(nome|dia-de-SP|geo)`; fontes que mandam UTC, offset BRT ou horário
  local caem no mesmo hash.
- Coletores/spiders (webscraping) emitem ISO com offset de São Paulo; ver o README do webscraping.
- `event_sources.rawPayload` guarda o texto **original** recebido (base do backfill).

`toISOString().slice(0, 10)` continua correto — e deve ser mantido — onde o valor é um
carimbo UTC para log/ID/tag ou onde a data é só um dia puro `YYYY-MM-DD` que faz ida e volta
por `new Date('YYYY-MM-DDT00:00:00Z')` (aritmética de calendário, validação de formato).

## Conexão MySQL: `DB_TIMEZONE` (opt-in)

Colunas `datetime` não guardam fuso; o driver (mysql2) converte `Date` <-> texto usando o
`timezone` da conexão, cujo default é `local` (= TZ do processo Node). Em produção (container
Railway) o processo roda em UTC, então o comportamento já é "UTC". Adicionamos a variável
**opcional** `DB_TIMEZONE` (lida em `app.module.ts` e `data-source.ts`):

- **Não definida** (padrão): nada muda.
- `DB_TIMEZONE=Z`: fixa UTC explicitamente, independente do TZ do processo. **Recomendado**
  depois de confirmar que o processo de produção já roda em UTC (`node -e "console.log(new Date().getTimezoneOffset())"`
  no container deve imprimir `0`).

Por que não ligamos por padrão: se algum ambiente rodar com TZ ≠ UTC, fixar `Z` reinterpretaria
todas as linhas existentes (deslocamento silencioso das datas de eventos, preços e snapshots).
Migrations não são afetadas (nenhuma coluna mudou), e o script de backfill usa o mesmo
`data-source.ts`.

## Backfill de eventos existentes

Script: `urban-ai-backend-main/scripts/backfill-event-dates-sp.ts` — **dry-run por padrão**.

Ele relê o payload original em `event_sources.rawPayload`, recalcula início/fim pela regra
acima e classifica cada evento:

- `day_shift` — o **dia de São Paulo muda** (ex.: evento de madrugada gravado como horário de
  parede em UTC). É o que quebra preço/recomendação; é o escopo padrão do `--apply`.
- `instant_shift` — só o horário muda (ex.: 21:30 gravado como 21:30Z em vez de 00:30Z); o dia
  de SP permanece. Entra no `--apply` só com `--scope=instant`.
- `unchanged`, `no_raw_payload`, `unparseable` — nunca alterados.

Fontes cujo texto legado sem offset era UTC (hoje só `api-football`) são lidas como UTC
(`--utc-naive-sources`).

```bash
cd urban-ai-backend-main
# 1) relatório (nada é gravado) + CSV para revisão
DATABASE_URL=mysql://... npm run backfill:event-dates -- --csv=eventos-fuso.csv
# 2) backup (ver backup-restore.md) e, só então, aplicar o escopo padrão (day)
DATABASE_URL=mysql://... npm run backfill:event-dates -- --apply
# opcional: também corrigir deslocamentos só de horário
DATABASE_URL=mysql://... npm run backfill:event-dates -- --apply --scope=instant
```

Flags: `--source=<fonte>`, `--include-past`, `--limit=<n>`, `--utc-naive-sources=a,b`, `--csv=<arquivo>`.
Por padrão examina só eventos de ontem em diante.

Limitações: atualiza apenas `dataInicio`/`dataFim`; **não** recalcula `dedupHash` (o hash antigo
segue único; reingestões de outras fontes casam por identidade fuzzy). Depois de aplicar,
rode a recomputação da inteligência de eventos
([event-intelligence-recompute-idempotency.md](./event-intelligence-recompute-idempotency.md))
para as datas-alvo dos eventos corrigidos.

## Validação

- Backend: `npx jest src/common/sp-date src/evento` (helper, ingest offset/naive/data pura, hash entre fontes).
- Webscraping: `python -m uv run pytest tests/test_event_datetime.py`.
- Conferência manual: enviar um evento `2026-05-11T00:30:00Z` e outro `2026-05-10 21:30:00` ao
  `/eventos/ingest` — o segundo deve voltar `updated` (mesmo `dedupHash`).
