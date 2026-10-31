# ADR 0026 — Cobertura de eventos auditada: lista de referência, consenso entre agentes, recall e precisão

**Status:** Aceito (31/10/2026). Decisões do dono: lista validada por IAs/agentes entre si (operação humana só revisa conflitos) e página pública de cobertura.

## Contexto

A cobertura era medida contra uma meta numérica (100 eventos em 30 dias), não contra a realidade. Sem uma "verdade de campo" ninguém sabe que fração dos eventos relevantes de SP o radar enxerga, e a promessa "evento por evento" ficava sem prova.

## Decisão

1. **Lista de referência** (`event_reference`, `event_reference_votes`): nome, venue, data/hora, cidade, categoria, porte, evidências (URL), status `candidato | aprovado | rejeitado | conflito`, votos e quem/quando aprovou. Import por CSV no admin (curadoria humana, aprovada por padrão; reimportar não duplica: `fingerprint` = nome normalizado + dia + venue).
2. **Curadoria por agentes** (cron diário 03:10 SP + botão): para cada venue da configuração (semente em `event-reference.config.ts`, substituível por `EVENT_REFERENCE_VENUES_FILE`), coleta os próximos 90 dias em Tavily, Google Events (SerpAPI), página oficial (Firecrawl) e nos eventos já ingeridos; o Gemini extrai JSON estrito (`parseExtractionResponse`).
3. **Consenso:** um validador é uma fonte independente (`web:<domínio>`, `db:<coletor>`); várias páginas do mesmo site contam uma vez. Aprova sozinho com **>= 2 validadores independentes** em nome + data + venue, **sendo ao menos um externo** (o banco sozinho não aprova, para o recall não ser circular), sem divergência de data com outra referência do mesmo evento, e sem rejeição do juiz. Divergência ou rejeição do juiz vira `conflito`. Com `ANTHROPIC_API_KEY`, um segundo modelo (`claude-sonnet-5-5`) atua como juiz independente nas referências prestes a ser aprovadas; ele nunca aprova sozinho. Sem chaves, tudo vira `candidato` com aviso. Decisão humana e rejeição nunca são sobrescritas pela curadoria.
4. **Custo:** tetos por execução (`EVENT_REFERENCE_MAX_*`), cache por provedor + URL/consulta + dia (`event_reference_fetch_cache`), rotação de venues por dia se houver teto de venues.
5. **Casamento e métricas** (cron 05:30 SP + botão): referência aprovada x `events` por nome normalizado (similaridade de tokens do `EventIdentityService`), dia de São Paulo +-1 e venue canônico/raio. **Recall** = aprovadas encontradas / aprovadas, em duas janelas (`past30`: últimos 30 dias já realizados; `next90`), por total, porte, categoria e venue. **Precisão** = amostra determinística de eventos do banco nos venues da lista confirmados por referência aprovada ou por validador externo (refutados = casam com referência rejeitada), na janela `next90`. Snapshot diário idempotente em `event_coverage_snapshots`. Alerta (Sentry + e-mail do zero-yield) quando o recall `past30` cai abaixo de `EVENT_COVERAGE_RECALL_FLOOR_PCT` (padrão 70, 0 desliga) com amostra mínima.
6. **Página pública** `/cobertura-de-eventos` + `GET /public/event-coverage` (aberto, limitado por IP, cache de 10 min + Cache-Control): só agregados. O percentual dos grandes eventos só é publicado com **4 semanas de medição** e amostra mínima; antes disso o texto diz que ainda está medindo.

## Consequências

- Admin: `/admin/event-coverage/reference` (fila de conflitos, lista, CSV, curadoria, métricas e série).
- Migration `1793700000000` (4 tabelas, reversível). Dois crons novos (`event-reference-curation` liga sozinho só com Gemini + um provedor; `event-coverage-match-metrics`).
- Limite conhecido: o recall mede contra o que os provedores conseguem listar; eventos sem divulgação pública não entram. As URLs oficiais da semente são ponto de partida e devem ser conferidas pela operação.
- Alvo da proposta (não é gate): recall >= 90% nos grandes, >= 70% no total, precisão >= 95%, 4 semanas seguidas.
