# Direct Playwright Smoke - Handoff

Data: 2026-05-22
Frente: Direct Playwright Smoke
Status: concluida para implementacao, pendente apenas execucao contra servidor local/staging responsivo.

## Pedido

Criar um fallback de smoke direto em Node/Playwright, fora do runner `@playwright/test`, para validar as quatro rotas do Event Radar e textos principais usando mocks/fixtures equivalentes aos do spec.

## Entrega

Criei o script:

- `Urban-front-main/scripts/event-radar-direct-smoke.mjs`

E o comando npm:

- `npm run test:e2e:event-radar:direct`

O script usa `chromium` da biblioteca `playwright` diretamente. Ele nao usa o runner `@playwright/test`, nao cria servidor, nao limpa `.next` e nao escreve em `Urban-front-main/test-results`.

## O que valida

- `e2e/event-radar.spec.ts` segue sem `test.skip`/`describe.skip`.
- `/events` retorna HTTP valido, mostra catalogo, evento principal, Interlagos, badge de impacto e link oficial.
- `/events/evt-gp-sp-2026` retorna HTTP valido, mostra interpretacao, drivers, imovel impactado e curva/preco de absorcao.
- `/event-radar` retorna HTTP valido, mostra KPIs, evento principal, imovel impactado e recomendacao de preco.
- `/admin/event-radar` retorna HTTP valido, mostra radar admin, potencial de receita, alto potencial, imoveis impactados e blind spots.
- Desktop e mobile rodam por padrao.
- `pageerror` falha a execucao.
- Em falha, salva screenshot no output externo.

## Mocks usados

Nao importei diretamente `e2e/fixtures/event-radar.fixture.ts` porque o script roda em Node ESM sem transpilar TypeScript. Em vez disso, repliquei no proprio script a mesma massa essencial do spec:

- usuario autenticado ADMIN;
- assinatura ativa;
- propriedades host;
- catalogo host;
- radar host;
- detalhe host;
- heatmap host;
- inteligencia admin;
- heatmap admin;
- blind spots admin;
- analytics/list/timeline admin para fallback.

## Comandos

Servidor local ja ativo:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
```

Staging:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com
```

Somente uma viewport:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com --viewport desktop
```

## Output

Padrao:

```text
C:\tmp\urban-ai-event-radar-direct-smoke
```

Pode ser alterado com:

```powershell
--output C:\tmp\outro-diretorio
```

## Validacoes nesta frente

Nao rodei servidor e nao pedi permissao elevada, conforme a restricao da frente.

Tentei validar apenas sintaxe com Node local sem permissao elevada. Se o sandbox bloquear `node` com `Acesso negado`, a validacao devera ser feita pela main thread ou em CI com:

```powershell
cd Urban-front-main
node --check scripts/event-radar-direct-smoke.mjs
```

## Arquivos alterados

- `Urban-front-main/scripts/event-radar-direct-smoke.mjs`
- `Urban-front-main/package.json`
- `docs/release/runbooks/event-radar-release-gate-runbook-2026-05-22.md`
- `docs/evidence/event-radar-playwright-fix-2026-05-22.md`
- `docs/evidence/event-radar-direct-smoke-2026-05-22.md`
- `squads/event-demand-pricing-radar/output/2026-05-22-playwright-100/direct-playwright-smoke.md`

## Proximo passo recomendado

Rodar contra staging ou contra o Next local ja responsivo:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
```

Se esse comando passar, temos evidencia funcional direta das quatro rotas em browser real sem depender do ciclo de output do `@playwright/test`.
