# Handoff - Tais Integracao / Release Gate

Data: 2026-05-22
Frente: Tais Integracao / Release Gate
Squad: `event-demand-pricing-radar`

## Resumo

Transformei o E2E do Event Radar em um gate mais automatizavel. O spec continua sem skips, os 4 testes seguem descobertos pelo Playwright e agora existe um runner dedicado que consegue rodar em dois modos:

- subir `next dev` local em porta definida e rodar Playwright;
- rodar contra um `--base-url` ja existente, como staging.

O E2E real ainda nao ficou verde no ambiente local atual. A falha agora esta diagnosticada como bloqueio ambiental/cache `.next`/processos concorrentes, nao como ausencia de spec ou skip.

## Arquivos alterados

- `Urban-front-main/scripts/event-radar-release-gate.mjs`
- `Urban-front-main/package.json`
- `docs/contracts/event-radar-qa-test-plan-v0.md`
- `docs/contracts/event-radar-release-checklist-v0.md`
- `docs/release/runbooks/event-radar-release-gate-runbook-2026-05-22.md`
- `squads/event-demand-pricing-radar/output/2026-05-22-150612/tais-release-gate-handoff.md`

## Comandos adicionados

Via npm:

```bash
cd Urban-front-main
npm run test:e2e:event-radar:list
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 180000
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com
```

Fallback direto via Node:

```bash
cd Urban-front-main
node scripts/event-radar-release-gate.mjs --list
node scripts/event-radar-release-gate.mjs --port 3041 --timeout-ms 180000
node scripts/event-radar-release-gate.mjs --no-server --base-url https://staging.myurbanai.com
```

## Validacoes executadas

| Check | Resultado |
|---|---|
| `node -e "JSON.parse(...package.json...)"` | OK |
| `node scripts/event-radar-release-gate.mjs --list` | OK: 4 testes descobertos |
| `rg "test.skip|describe.skip|.skip(" Urban-front-main/e2e/event-radar.spec.ts` | OK: sem ocorrencias |
| `node --check scripts/event-radar-release-gate.mjs` | OK |
| `node node_modules/eslint/bin/eslint.js scripts/event-radar-release-gate.mjs` | OK |
| `node scripts/event-radar-release-gate.mjs --port 3047 --timeout-ms 120000` | Bloqueado: Next ficou em `Starting...`; `/events` nao respondeu |
| `node scripts/event-radar-release-gate.mjs --no-server --base-url http://127.0.0.1:3007` | Executou browser real; 4/4 testes falharam por HTTP 500 |

## Diagnostico

O gate local esta bloqueado por ambiente/processo:

- `node` no sandbox retornou `Acesso negado`; os comandos precisaram de permissao elevada.
- `Start-Process` falhou no PowerShell por duplicidade `Path/PATH`.
- Havia listeners antigos em `3007`.
- O Next existente em `3007` respondeu com HTTP 500 nas quatro rotas do Event Radar.
- Logs existentes apontam `.next` inconsistente:
  - `Cannot find module './6141.js'`
  - `.next/server/vendor-chunks/@chakra-ui.js` ausente
  - `EPERM` ao renomear arquivos em `.next/cache/webpack`
- Uma nova tentativa na porta `3047` ficou parada em `Starting...` por 120s e nao chegou a compilar `/events`.

Leitura: nao vale promover release local com a workspace atual enquanto existirem processos Next concorrentes e cache `.next` travado/corrompido. O proximo gate deve rodar em CI/staging limpo ou em workspace local sem servidores antigos.

## Riscos

- Se rodar varios `next dev` na mesma workspace, o cache `.next` pode continuar gerando HTTP 500 falso.
- Como o spec falha corretamente em 5xx, a suite esta sensivel o bastante para bloquear release, mas ainda precisa de ambiente responsivo para virar evidencia positiva.
- Staging ainda precisa confirmar feature flags, auth e chamadas reais/mocks contratados.

## Proximos passos

1. Fechar processos Next antigos da workspace antes de novo gate local.
2. Rodar fora de pasta sincronizada pelo OneDrive, ou pausar sincronizacao durante o gate.
3. Limpar `.next` somente apos fechar processos Next.
4. Rodar:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --port 3041 --timeout-ms 180000
```

5. Preferir staging quando disponivel:

```bash
cd Urban-front-main
npm run test:e2e:event-radar -- --no-server --base-url https://staging.myurbanai.com
```

## Criterio de aceite

Release gate aprovado quando:

- 4/4 testes de `event-radar.spec.ts` passam.
- Sem skips no spec.
- Nenhuma rota retorna 404/5xx.
- Logs nao mostram `MODULE_NOT_FOUND`, `EPERM`, cache `.next` quebrado ou redirect loop.
- Evidencias ficam em `Urban-front-main/test-results/`.
