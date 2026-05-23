# Checklist de Release - Event Radar v0

Data: 2026-05-22
Owner: Tais Integracao
Release recomendado: gradual, atras de feature flag

## Pre-release

- [x] Contrato v0 criado e validado por fixture/contract spec.
- [ ] Contrato v0 revisado formalmente por Lia, Nico, Maya, Otto e Tais.
- [ ] Flag `EVENT_RADAR_ENABLED` criada no backend.
- [ ] Flag `NEXT_PUBLIC_EVENT_RADAR_ENABLED` criada no front.
- [x] Endpoint host de catalogo responde com `EventCatalogResponse` em contrato/service.
- [x] Endpoint host de radar responde com `HostEventRadarResponse` em contrato/service.
- [x] Endpoint host de detalhe responde com `EventDetailResponse` em contrato/service.
- [x] Endpoint admin de inteligencia responde com `AdminEventIntelligenceResponse` em contrato/service.
- [x] Endpoint admin de blind spots responde com `AdminBlindSpotsResponse` em contrato/service.
- [ ] Cada snapshot persistido inclui `generatedAt`, `modelVersion`, `metricVersion`, `jobRunId` e `confidence`.
- [x] Valores monetarios trafegam em centavos no contrato e fixtures.
- [ ] UI diferencia estimativa, projecao e receita confirmada.
- [ ] `officialUrl` ou `crawledUrl` aparece no detalhe quando disponivel.
- [ ] E2E `event-radar.spec.ts` passa sem skips no staging com flag ligada.
- [x] E2E `event-radar.spec.ts` nao contem mais skips condicionais no codigo.
- [x] Playwright descobre os 4 testes de `event-radar.spec.ts`.
- [x] Runner `test:e2e:event-radar` existe para subir Next local ou rodar contra `--base-url`.
- [x] Jest `event-radar-contract.spec.ts` passa.
- [x] Specs de scoring/curva do Nico passam na rodada integrada anterior.
- [x] Specs de endpoints/service da Lia passam na rodada integrada anterior.
- [ ] QA manual validou desktop e mobile para catalogo, radar host e admin.

## Status percentual de aceite

| Faixa | Entregas nesta faixa | Regra de promocao |
|---|---|---|
| 100% | Contrato v0, fixture JSON, spec de contrato backend | So muda com contrato versionado |
| 80% | Endpoints Host/Admin, entidades/migrations, motor de absorcao | Promover para 100% apos DB/staging/recompute real |
| 60% | Telas Host/Admin, QA/E2E, forecast runtime | Promover para 80% apos Playwright sem skip e QA visual |
| 40% | Heatmap rico e `pricing_decision_snapshot` auditavel | Promover para 60% apos persistir decisao e outcome inicial |
| P0 geral | **~84% tecnico / ~82% release controlado** | Meta proxima: **~88%** com Next local/staging limpo, E2E verde e evidencia visual |

## Gates para subir P0 de ~69% para ~85%

- [ ] `POST /admin/events/:eventId/recompute-intelligence` grava snapshot real e retorna `writes` verificaveis.
- [ ] `EventPropertyImpact` e gerado/persistido a partir de `AnalisePreco` + motor v0.
- [ ] `pricing_decision_snapshot` registra cenario, multiplicador, probabilidade, drivers, guardrails e status da decisao.
- [x] `event-radar.spec.ts` remove skips condicionais e falha rota 404 como gate real.
- [x] Comando reproduzivel de release gate criado: `npm run test:e2e:event-radar -- --port 3041 --timeout-ms 180000`.
- [ ] `event-radar.spec.ts` executa contra app local/staging responsivo.
- [ ] Smoke visual desktop/mobile cobre `/events`, `/events/[eventId]`, `/event-radar` e `/admin/event-radar`.
- [ ] Feature flags backend/front sao exercitadas em ligado/desligado sem quebrar rotas antigas.
- [ ] Heatmap explicita diferenca entre demanda agregada, ponto real e evento sem coordenada.

## Smoke manual

- [ ] Host acessa `/events` e ve eventos da cidade.
- [ ] Host filtra por periodo/categoria.
- [ ] Host abre detalhe e ve fonte/link oficial.
- [ ] Host acessa `/event-radar` e ve KPIs de oportunidade.
- [ ] Host ve pelo menos um imovel impactado com faixa de preco.
- [ ] Host abre simulacao e entende probabilidade, risco e guardrail.
- [ ] Admin acessa radar de demanda.
- [ ] Admin ve KPIs, lista priorizada e blind spots.
- [ ] Admin consegue identificar evento sem coordenada ou sem recomendacao.
- [ ] Empty state e error state aparecem sem quebrar navegacao.

## Evidencia automatizada da rodada final

- `node scripts/event-radar-release-gate.mjs --list`: OK, 4 testes descobertos.
- `rg "test.skip|describe.skip|.skip(" e2e/event-radar.spec.ts`: OK, sem ocorrencias.
- `node scripts/event-radar-release-gate.mjs --port 3047 --timeout-ms 120000`: bloqueado, Next ficou em `Starting...` e `/events` nao respondeu.
- `node scripts/event-radar-release-gate.mjs --no-server --base-url http://127.0.0.1:3007`: executou browser real, mas as 4 rotas retornaram HTTP 500.
- Logs locais apontam falha ambiental/cache `.next`: `Cannot find module './6141.js'`, `vendor-chunks/@chakra-ui.js` ausente e `EPERM` em cache webpack.

## Rollout

1. Ligar backend em staging com jobs de snapshot em lote pequeno.
2. Ligar front em staging apenas para usuarios internos.
3. Rodar E2E e smoke manual.
4. Liberar para admins internos.
5. Liberar para hosts beta com ate 10% da base.
6. Acompanhar logs, Sentry, taxa de erro dos endpoints e feedback de preco.
7. Expandir para 50% se nao houver regressao em 48h.
8. Expandir para 100% apos confirmacao de metricas.

## Rollback

- Desligar `NEXT_PUBLIC_EVENT_RADAR_ENABLED` para ocultar UI nova.
- Desligar `EVENT_RADAR_ENABLED` para bloquear recomputes/simulacoes.
- Manter `/near-events`, `/dashboard` e `/admin/events` sem depender dos endpoints novos.
- Preservar snapshots ja gerados para auditoria; nao apagar dados em rollback.
- Registrar motivo do rollback em runbook/release notes.

## Gates de risco

- [ ] Nenhuma recomendacao extrema e exibida sem risco e probabilidade.
- [ ] Nenhum preco acima do guardrail do host aparece como aplicavel sem revisao.
- [ ] Eventos com baixa confianca nao recebem CTA de aplicacao direta.
- [ ] Eventos sem coordenada nao entram em heatmap como ponto real.
- [ ] Erros de backend nao causam loop de redirect ou tela branca no front.
- [ ] Admin consegue diferenciar source stale, missing geo e falta de recomendacao.
# Checklist 100% - Event Radar Playwright

Esta secao define o fechamento objetivo do release gate do Event Radar.

## Ja comprovado

- [x] Spec do Event Radar sem `test.skip` conhecido.
- [x] Listagem do Playwright encontra 4 testes.
- [x] Rotas principais ja responderam HTTP 200 em tentativa limpa: `/events`, `/events/evt-gp-sp-2026`, `/event-radar`, `/admin/event-radar`.
- [x] Causa raiz do bloqueio local isolada para concorrencia/cache/artefatos no OneDrive.
- [x] Runner endurecido para limpar `.next`, fazer preflight, diagnosticar cache webpack e gravar artefatos fora do OneDrive.
- [x] Caminho padrao de artefatos definido fora do OneDrive: `C:\tmp\urban-ai-event-radar-playwright`.

## Obrigatorio para marcar 100%

- [ ] Executar `node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000`.
- [ ] Confirmar exit code 0.
- [ ] Confirmar 4/4 testes Playwright passando em browser real.
- [ ] Registrar base URL, porta e caminho dos artefatos.
- [ ] Anexar ou referenciar evidencia final no documento `docs/evidence/event-radar-playwright-fix-2026-05-22.md`.

Enquanto esses cinco itens obrigatorios nao forem concluídos, o status correto e "pronto para execucao final", nao 100%.
