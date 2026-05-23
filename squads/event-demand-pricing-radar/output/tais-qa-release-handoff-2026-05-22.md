# Handoff QA Release - Event Demand Pricing Radar

Data: 2026-05-22
Agente: Tais Integracao
Escopo: consolidar percentuais, aceite objetivo, evidencias de QA e lacunas para a proxima rodada multiagente.

## Leitura executiva

O P0 esta em aproximadamente **69%**. A entrega ja tem contrato v0, entidades, endpoints, motor v0, telas host/admin e testes basicos. O salto para **~85%** depende menos de novas telas e mais de hardening: persistencia real, auditoria de decisao, Playwright sem skips, validacao visual e feature flags.

Beta interno faz sentido. Release controlado para hosts ainda nao.

## Percentual por entrega

| Entrega | Status | Percentual | Evidencia | Lacuna de aceite |
|---|---|---:|---|---|
| Contrato v0 Radar/Eventos | pronto | 100% | `docs/contracts/event-radar-contract-v0.md`, fixtures, contract spec | Revisao formal multiagente/versionamento futuro |
| Entidades/migrations de inteligencia | alto | 85% | entidades e migration criadas | Rodar migration e validar DB real |
| Endpoints Host/Admin | alto | 82% | rotas host/admin com contrato estavel | Recompute real e staging |
| Price Absorption Curve v0 | alto | 80% | 4 cenarios, probabilidade, receita, specs | Calibracao por outcomes reais |
| Event Demand Forecast v0 | medio-alto | 75% | calculo runtime conectado ao service | Persistencia batch e potencial de receita |
| Eventos na Cidade Host | medio | 72% | `/events` e detalhe | QA visual live, empty/error, polish |
| Radar de Eventos Host | medio | 68% | `/event-radar` com impactos/curva | Heatmap real, Playwright sem skip |
| Radar de Demanda Admin | medio | 67% | `/admin/event-radar`, KPIs, blind spots | Reprocessamento real, QA operacional |
| QA/E2E/Release | medio | 62% | fixtures, checklist, Playwright list, Jest contrato | Rodar E2E de verdade e smoke manual |
| Heatmap de demanda | baixo | 45% | payload/celulas existem | Visual/agregacao rica e eventos sem geo |
| `pricing_decision_snapshot` auditavel | baixo | 35% | entidade existe | Ligar decisao -> recomendacao -> outcome |

## Faixas de aceite

| Faixa | Entra aqui | Decisao QA |
|---|---|---|
| 100% | Contrato v0 | Aceito como base; so muda com versao nova |
| 80% | Entidades, endpoints, motor de absorcao | Aceito para beta tecnico; nao para release sem staging |
| 60% | Telas host/admin, forecast runtime, QA/E2E | Aceito como beta interno com risco documentado |
| 40% | Heatmap rico, snapshot auditavel | Nao bloquear beta interno, mas bloqueia narrativa de inteligencia auditavel |

## Checklist para subir de ~69% para ~85%

- [ ] Backend grava `EventIntelligenceSnapshot` em `POST /admin/events/:eventId/recompute-intelligence`.
- [ ] Backend grava `EventPropertyImpact` gerado por `AnalisePreco` + motor v0.
- [ ] `pricing_decision_snapshot` registra evento, imovel, cenario recomendado, multiplicador, probabilidade, drivers e guardrails.
- [ ] Playwright `event-radar.spec.ts` roda sem skips em app local ou staging.
- [ ] QA visual desktop/mobile cobre `/events`, `/events/[eventId]`, `/event-radar` e `/admin/event-radar`.
- [ ] Feature flags `EVENT_RADAR_ENABLED` e `NEXT_PUBLIC_EVENT_RADAR_ENABLED` sao exercitadas em ligado/desligado.
- [ ] Heatmap diferencia ponto real, celula agregada e evento sem coordenada.
- [ ] UI evita prometer reserva: toda recomendacao extrema mostra probabilidade, risco e revisao.

## Evidencias desta rodada

| Check | Resultado |
|---|---|
| Fixture JSON | OK: 2 eventos, 2 grupos de impacto e 1 curva |
| Playwright list | OK: 4 testes descobertos em `event-radar.spec.ts` |
| Backend contract spec | OK: 1 suite, 5 testes |

## Comandos rodados

```powershell
node .\node_modules\@playwright\test\cli.js test e2e/event-radar.spec.ts --list
```

```powershell
$json = Get-Content -Raw docs/contracts/event-radar-fixtures-v0.json | ConvertFrom-Json
```

```powershell
node node_modules\jest\bin\jest.js event-radar-contract.spec.ts --runInBand
```

## Arquivos alterados nesta rodada QA

- `docs/status-entregas-radar-eventos-2026-05-22.md`
- `docs/contracts/event-radar-release-checklist-v0.md`
- `docs/contracts/event-radar-qa-test-plan-v0.md`
- `squads/event-demand-pricing-radar/output/tais-qa-release-handoff-2026-05-22.md`

## Lacunas remanescentes

- E2E ainda esta em modo contract-first com skips condicionais; precisa rodar sem skip para release.
- Nao houve smoke visual em browser nesta rodada.
- Persistencia de snapshots/impactos/decisoes ainda e o maior bloqueio de confianca.
- Feature flags estao documentadas, mas nao validadas no codigo.
- Heatmap ainda precisa provar valor visual e regra para eventos sem coordenada.

## Recomendacao de proxima rodada multiagente

1. Backend Intelligence: persistir snapshots/impactos e fazer recompute retornar writes reais.
2. Pricing Audit: ligar `pricing_decision_snapshot` ao fluxo de simulacao/recomendacao.
3. Host Experience: remover skips do E2E com markers estaveis e validar empty/error.
4. Admin Experience: validar blind spots, recompute e operacao em `/admin/event-radar`.
5. QA Release: rodar Playwright sem skip, capturar evidencias visual/mobile e fechar feature flag.
