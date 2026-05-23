# QA Release Gate - Event Radar

Data: 2026-05-23
Agente: Tais Integracao
Frente: QA/E2E/Release Gate

## Resumo executivo

O gate de browser do Event Radar foi fechado com evidencia real: o runner oficial Playwright passou com **4/4 testes verdes** e o smoke direto passou em **desktop e mobile** cobrindo `/events`, `/events/evt-gp-sp-2026`, `/event-radar` e `/admin/event-radar`.

Leitura recomendada:

- Event Radar browser gate contract-first: **100% comprovado localmente**.
- QA/E2E/Release desta frente: **98% recomendado**, porque o gate oficial e o smoke visual passaram, mas staging/DB real e estabilidade de disco/cache local ainda nao foram validados.
- Release controlado do produto completo: **92-94%**, mantendo ressalva para migrations/DB real, recompute em staging e outcomes de pricing.
- Roadmap total P0-P2: **~55%**, porque P2 segue dependente de dados reais de aceite, reserva, receita e calibracao.

## Validacoes executadas

### Gate oficial - listagem

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:list
```

Resultado: **4 testes em 1 arquivo**.

### Gate oficial - servidor existente

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url http://127.0.0.1:3041 --request-timeout-ms 120000
```

Resultado:

- Preflight `/events`: HTTP 200.
- Preflight `/events/evt-gp-sp-2026`: HTTP 200.
- Preflight `/event-radar`: HTTP 200.
- Preflight `/admin/event-radar`: HTTP 200.
- Playwright: **4 passed** em 37,4s.
- Artefatos: `C:\tmp\urban-ai-event-radar-playwright`.

### Gate oficial - Next local pelo runner

```powershell
cd Urban-front-main
npm run test:e2e:event-radar -- --keep-next-cache --timeout-ms 300000 --request-timeout-ms 120000
```

Resultado:

- Health check `/favicon.ico`: HTTP 200.
- Preflight das quatro rotas: HTTP 200.
- Playwright: **4 passed** em 33,3s.
- Logs: `Urban-front-main/test-results/event-radar-release-gate/next-dev-3041-2026-05-23T10-47-37-583Z.*.log`.

### Smoke direto desktop/mobile

Executado com Next temporario em `http://127.0.0.1:3043`.

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3043
```

Resultado:

- Desktop: 4 rotas HTTP 200, 14 asserts.
- Mobile: 4 rotas HTTP 200, 14 asserts.
- JSON: `C:\tmp\urban-ai-event-radar-direct-smoke\event-radar-direct-smoke.json`.
- Screenshots: `C:\tmp\urban-ai-event-radar-direct-smoke\desktop-*.png` e `C:\tmp\urban-ai-event-radar-direct-smoke\mobile-*.png`.

### Checks direcionados

```powershell
cd Urban-front-main
node --check scripts\event-radar-release-gate.mjs
node --check scripts\event-radar-direct-smoke.mjs
node node_modules\eslint\bin\eslint.js scripts\event-radar-release-gate.mjs scripts\event-radar-direct-smoke.mjs e2e\event-radar.spec.ts
rg "test\.skip|describe\.skip|\.skip\(" e2e\event-radar.spec.ts
```

Resultado:

- `node --check`: OK para os dois scripts.
- ESLint direcionado: OK, sem erros/warnings apos limpeza.
- Busca por skips: sem ocorrencias.

## Ajustes aplicados

- `Urban-front-main/e2e/event-radar.spec.ts`: assercoes de imovel impactado passaram a usar linhas/blocos visiveis em vez de texto solto que podia bater em `<option>` oculto ou conteudo responsivo duplicado.
- `Urban-front-main/scripts/event-radar-direct-smoke.mjs`: helper de texto agora procura qualquer ocorrencia visivel antes de falhar, evitando falso negativo em telas responsivas.
- `Urban-front-main/scripts/event-radar-release-gate.mjs`: removeu warnings de lint, detecta encerramento precoce do Next no health check e inclui `ENOSPC`/falta de espaco no diagnostico de cache/disco.
- `docs/evidence/event-radar-playwright-fix-2026-05-22.md`: evidencia 2026-05-23 do gate oficial e erros ambientais.
- `docs/evidence/event-radar-direct-smoke-2026-05-22.md`: evidencia 2026-05-23 do smoke desktop/mobile.
- `docs/release/runbooks/event-radar-release-gate-runbook-2026-05-22.md`: comandos verdes, erros ambientais e hardening novo.

## Erros e bloqueios ambientais registrados

- Sandbox bloqueou `node.exe` com `Acesso negado`; `npm` nao estava disponivel sem permissao elevada.
- `--port 3041` falhou quando a porta ja estava em uso.
- Gate local com limpeza padrao falhou em `.next` com `ENOTEMPTY`.
- Smoke direto contra `3041` falhou com `ERR_CONNECTION_REFUSED` quando o servidor existente ja tinha parado.
- Tentativa local posterior falhou com `EPERM: operation not permitted, open '.next\trace'`.
- Tentativa diagnostica posterior falhou com `ENOSPC: no space left on device, write`, gerando abort em `/events/evt-gp-sp-2026` e HTTP 500 em `/event-radar` e `/admin/event-radar`.

## Recomendacao

Pode considerar o **gate browser Event Radar fechado** para a frente QA local/contract-first. Para release controlado, ainda recomendo manter o rollout atras de flag e exigir:

- repeticao do gate contra staging;
- smoke de migrations/DB real e recompute admin;
- liberacao de espaco/limpeza de processos Next na maquina local ou CI;
- captura de outcomes reais de pricing antes de promover P2/aprendizado.
