# Plano de QA e Integracao - Event Radar v0

Data: 2026-05-22
Owner: Tais Integracao
Base: `docs/contracts/event-radar-contract-v0.md`

## Escopo testavel

O objetivo e garantir que as frentes paralelas cheguem na integracao final com contrato previsivel, estados de UI verificaveis e release reversivel.

Status desta rodada: QA de release esta em **78%**. A suite Event Radar segue descoberta pelo Playwright, o spec nao possui mais `test.skip` condicional, as fixtures Playwright foram alinhadas ao formato que o front normaliza hoje e agora existe um runner reproduzivel para o gate real. O gate de release segue bloqueado ate o Next responder de forma limpa em local/staging e o E2E executar sem HTTP 5xx.

## Artefatos criados

- Contrato: `docs/contracts/event-radar-contract-v0.md`
- Fixtures JSON: `docs/contracts/event-radar-fixtures-v0.json`
- Fixtures Playwright: `Urban-front-main/e2e/fixtures/event-radar.fixture.ts`
- E2E inicial: `Urban-front-main/e2e/event-radar.spec.ts`
- Runner de release gate: `Urban-front-main/scripts/event-radar-release-gate.mjs`
- Spec backend de contrato: `urban-ai-backend-main/src/evento/event-radar-contract.spec.ts`
- Checklist de release: `docs/contracts/event-radar-release-checklist-v0.md`

## Matriz de testes

| Area | Caso | Tipo | Status |
|---|---|---|---|
| Host catalogo | Lista eventos por cidade, mostra fonte/link oficial e badges | E2E mockado | Sem skip condicional; falha se `/events` estiver 404 |
| Host catalogo | Empty state quando `items=[]` | E2E pendente | Depende de copy/estado final da Maya |
| Host detalhe | Mostra link oficial, source/crawled URL, interpretacao e drivers | E2E mockado | Sem skip condicional; cobre curva em `absorptionScenarios` |
| Host radar | Mostra KPIs, eventos relevantes e imoveis impactados | E2E mockado | Sem skip condicional; cobre KPIs e melhor oportunidade |
| Host radar | Error state para `INSUFFICIENT_SIGNAL`/500 | E2E pendente | Depende de estado visual final |
| Host simulacao | Envia `POST /host/events/:eventId/simulate-pricing` e mostra cenarios | E2E pendente | Depende de CTA final |
| Admin radar | Mostra KPIs de demanda e blind spots | E2E mockado | Sem skip condicional; fixture inclui radar, heatmap e blind spots no contrato consumido pelo front |
| Admin detalhe | Mostra dados brutos, dedup/source e auditoria | E2E pendente | Depende da tela do Otto |
| Backend contrato | Campos obrigatorios, enums, ranges e centavos | Jest | Verde nesta rodada: 1 suite, 5 testes |
| Backend endpoints | Controllers retornam envelopes reais | Jest/e2e | Coberto em specs de service na rodada integrada anterior; falta staging/DB real |
| Engine | Price absorption curve com 4 cenarios e guardrails | Jest | Verde na rodada integrada anterior |

## Evidencias desta rodada

| Check | Resultado |
|---|---|
| Parse de `docs/contracts/event-radar-fixtures-v0.json` | OK: 2 eventos, 2 grupos de impacto, 1 curva |
| Playwright `event-radar.spec.ts --list` | OK: 4 testes descobertos, sem `test.skip` no spec |
| `node scripts/event-radar-release-gate.mjs --list` | OK: 4 testes descobertos pelo runner novo |
| Jest `event-radar-contract.spec.ts --runInBand` | OK: 1 suite, 5 testes |
| Tentativa de app local via runner | Runner endurecido: limpa `.next`, preflighta rotas e escreve artefatos Playwright fora do OneDrive por padrao |
| Tentativa independente em 3041 | Next ficou `Ready`; `/events`, `/events/evt-gp-sp-2026`, `/event-radar` e `/admin/event-radar` responderam HTTP 200 |
| Browser Playwright direto | Chromium abriu `/events` com HTTP 200 |
| Bloqueio residual do `@playwright/test` | Travou em `clear output`/`apply rebaselines` ao limpar `test-results` dentro do OneDrive; runner agora usa `C:\tmp\urban-ai-event-radar-playwright` por padrao |
| Diagnostico do ambiente local | Logs existentes indicam `.next` corrompido/concorrente: `Cannot find module './6141.js'`, `vendor-chunks/@chakra-ui.js` ausente e `EPERM` em cache webpack |
| Front typecheck | Verde na rodada integrada anterior |

## Como rodar

Front, com dev server ja ativo:

```bash
cd Urban-front-main
npm run test:e2e -- e2e/event-radar.spec.ts
```

Gate automatizado recomendado:

```bash
cd Urban-front-main
npm run test:e2e:event-radar:list
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

Contra staging ou um dev server ja responsivo:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com
```

Backend:

```bash
cd urban-ai-backend-main
npm test -- event-radar-contract.spec.ts --runInBand
```

## Criterios de aceite para integracao final

- `event-radar.spec.ts` roda sem skips em ambiente de staging com a flag ligada.
- `event-radar.spec.ts` nao contem skips condicionais; rota ausente deve falhar o gate.
- `scripts/event-radar-release-gate.mjs` inicia o Next sozinho ou roda contra `--base-url`, registra logs e falha se qualquer rota retornar 404/5xx.
- `scripts/event-radar-release-gate.mjs` grava artefatos Playwright fora do OneDrive por padrao para evitar lock no `clear output`.
- `event-radar-contract.spec.ts` passa junto da suite backend.
- Todas as respostas de inteligencia possuem `generatedAt`, `modelVersion`, `metricVersion`, `confidence` e drivers.
- `officialUrl` ou `crawledUrl` aparece no detalhe host/admin quando disponivel.
- UI mostra diferenca entre receita estimada e receita confirmada.
- Simulacao de preco mostra probabilidade e risco; nao promete ocupacao.
- Estados loading, empty e error aparecem em host e admin.
- Flag consegue desligar a experiencia sem quebrar `/near-events` e `/admin/events`.

## Checklist objetivo para P0 chegar a ~85%

- [ ] Recompute backend grava snapshots e impactos em DB real.
- [ ] `pricing_decision_snapshot` fica consultavel para auditar recomendacao de preco.
- [x] Spec Event Radar sem `test.skip` condicional.
- [x] Runner reproduzivel para release gate local/staging.
- [ ] Playwright executa os 4 testes de Event Radar contra app local/staging responsivo.
- [ ] QA manual captura evidencias desktop e mobile das quatro rotas principais.
- [ ] Feature flag front/backend tem smoke ligado e desligado.
- [ ] Heatmap evita mostrar evento sem coordenada como ponto real.
- [ ] Copy da UI explicita probabilidade/risco, sem prometer ocupacao.

## Pendencias por frente

### Lia Contratos

- Confirmar envelopes reais dos endpoints host/admin.
- Decidir se `EventCatalogItem` sera montado por DTO novo ou adaptador em service.
- Criar specs de controller/service assim que endpoints existirem.

### Nico Engine

- Confirmar range e arredondamento de `bookingProbability`, `expectedRevenueCents` e multiplicadores.
- Criar unit specs para evento pequeno, megaevento, baixa confianca, sem comparaveis e guardrail alto.
- Definir codigos de guardrail usados em `simulate-pricing`.

### Maya Host

- Confirmar rotas finais: `/events`, `/event-radar` e detalhe em `/events/:eventId`.
- Expor textos/roles estaveis para E2E: headings de catalogo, radar, fonte, link oficial e imoveis impactados.
- Implementar empty/error states com mensagens especificas.

### Otto Admin

- Confirmar rota final: `/admin/event-radar` ou aba em `/admin/events`.
- Expor marcador de tela `Radar de Demanda` para ativar E2E sem skip.
- Mostrar blind spots com severidade e proxima acao.

### Tais Integracao

- Atualizar fixtures quando DTO real divergir do contrato v0.
- Manter fixtures Playwright no formato normalizado pelo front enquanto backend e contrato v0 convergem.
- Rodar execucao completa assim que houver dev server/staging disponivel.
- Consolidar relatorio de integracao antes do release.
# Plano QA 100% - Event Radar

## Criterio de aceite final

O aceite final do Event Radar exige uma execucao unica e reproduzivel do release gate com browser real:

```powershell
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 300000 --request-timeout-ms 120000
```

## Cobertura minima da execucao

- Catalogo de eventos do host em `/events`.
- Detalhe de evento em `/events/evt-gp-sp-2026`.
- Radar host em `/event-radar`.
- Radar admin em `/admin/event-radar`.

## Condicoes de sucesso

- 4 testes descobertos.
- 0 testes pulados.
- 4 testes aprovados.
- Preflight HTTP aprovado nas 4 rotas.
- Artefatos gravados fora do OneDrive.
- Sem listener residual novo apos a execucao.

## Estado atual

O plano esta tecnicamente pronto para a execucao final. As evidencias anteriores provam que as rotas respondem e que o bloqueio local foi ambiental. O unico passo que separa o plano de 100% e a execucao final 4/4 do gate.
