# ADR 0013 — Calendário de São Paulo para todo "dia" do produto

**Status:** Aceito (26/10/2026) — registra o que já vigora; aplicação ainda incompleta (ver Consequências).

## Contexto

Instantes são gravados em UTC. Um jogo às 21:30 em São Paulo é `00:30Z` do dia seguinte: agrupar, filtrar ou exibir pelo dia UTC coloca o evento, a recomendação ou a auto-aplicação no dia errado. Datas vindas dos coletores chegam em três formas (sem fuso, com offset, só data).

## Opções consideradas

1. **Dia UTC em todo lugar.** Simples e errado para o anfitrião.
2. **Dia do fuso do servidor (`setHours(0,0,0,0)`).** Em produção o servidor roda em UTC; reproduz o problema 1.
3. **Convenção única: dia de calendário em `America/Sao_Paulo`** (escolhida).

## Decisão

- `urban-ai-backend-main/src/common/sp-date.ts` é o ponto único: `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'` (sem dependência externa) e utilitários como `toSaoPauloDateKey`, `todaySaoPauloDateKey` e `saoPauloDayBounds`.
- Regras de entrada: datetime **sem** offset = relógio de São Paulo; **com** offset = instante absoluto; data pura `YYYY-MM-DD` = evento de dia inteiro em São Paulo. Detalhe em [`runbooks/datas-e-fuso-horario.md`](../runbooks/datas-e-fuso-horario.md).
- Para SQL, `saoPauloDaySql(coluna)` usa `CONVERT_TZ(coluna, @@session.time_zone, '-03:00')`: **offset fixo** de −03:00, correto porque o Brasil não tem horário de verão desde 2019. Para filtro por faixa prefira `saoPauloDayBounds`.
- Armazenamento continua em UTC (`datetime`, driver em UTC).

## Consequências

- (+) O "dia" que o anfitrião vê é o mesmo em tela, e-mail, agrupamento e auto-aplicação.
- (−) O `-03:00` fixo no SQL quebra para datas anteriores a 2019 ou se o Brasil voltar ao horário de verão; o lado JS (`Intl`) continua correto nesses casos.
- (−) A adoção é parcial: `saoPauloDaySql` só é usado em `admin/admin.service.ts`, e `HostPanelsService.startOfToday()` (cota diária do Ask Urban) usa `setHours(0,0,0,0)` no fuso do servidor. Auditar os demais usos de "hoje" é trabalho aberto.
