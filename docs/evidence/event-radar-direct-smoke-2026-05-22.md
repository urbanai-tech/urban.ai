# Evidencia - Direct Playwright Smoke Event Radar

Data: 2026-05-22
Frente: Direct Playwright Smoke
Escopo: `/events`, `/events/evt-gp-sp-2026`, `/event-radar`, `/admin/event-radar`

## Objetivo

Criar um fallback objetivo para validar Event Radar em browser real sem usar o runner `@playwright/test`, porque o bloqueio anterior ocorreu nos passos internos `clear output`/`apply rebaselines` ao tocar artefatos dentro do OneDrive.

## Artefato criado

- `Urban-front-main/scripts/event-radar-direct-smoke.mjs`
- Script npm: `test:e2e:event-radar:direct`

## Como funciona

O smoke direto:

- usa `chromium` da biblioteca `playwright`;
- nao sobe servidor local;
- nao limpa `.next`;
- nao usa `Urban-front-main/test-results`;
- grava relatorio fora do OneDrive por padrao em `C:\tmp\urban-ai-event-radar-direct-smoke`;
- valida desktop e mobile por padrao;
- instala mocks de auth, assinatura, propriedades, catalogo host, detalhe host, radar host, heatmap admin e blind spots admin;
- verifica que `e2e/event-radar.spec.ts` continua sem `test.skip`/`describe.skip`;
- falha se qualquer uma das quatro rotas retornar 404 ou 5xx;
- valida textos principais, evento, imovel impactado, preco/probabilidade e link oficial.

## Comandos

Contra servidor local ja ativo:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3041
```

Contra staging:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com
```

Somente desktop:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url https://staging.myurbanai.com --viewport desktop
```

## Criterio de aceite

Este fallback fecha o smoke funcional quando:

- o comando termina com exit code `0`;
- o relatorio JSON em `C:\tmp\urban-ai-event-radar-direct-smoke` registra `status: "passed"`;
- as quatro rotas aparecem com status menor que 500;
- as viewports desktop e mobile passam;
- nenhum `pageerror` e capturado.

## Limite conhecido

Este script nao substitui o gate oficial de regressao `@playwright/test` em CI. Ele existe para destravar a evidencia funcional local/staging quando o runner oficial fica bloqueado por output/cache em pasta sincronizada.

# Atualizacao 2026-05-23 - Smoke desktop/mobile verde

## Resultado principal

O smoke direto foi executado com um Next temporario em `http://127.0.0.1:3043` e terminou com exit code `0`.

Comando operacional usado:

```powershell
cd Urban-front-main
npm run test:e2e:event-radar:direct -- --base-url http://127.0.0.1:3043
```

Resultado:

- Desktop `/events`: HTTP 200, 3 asserts.
- Desktop `/events/evt-gp-sp-2026`: HTTP 200, 4 asserts.
- Desktop `/event-radar`: HTTP 200, 3 asserts.
- Desktop `/admin/event-radar`: HTTP 200, 4 asserts.
- Mobile `/events`: HTTP 200, 3 asserts.
- Mobile `/events/evt-gp-sp-2026`: HTTP 200, 4 asserts.
- Mobile `/event-radar`: HTTP 200, 3 asserts.
- Mobile `/admin/event-radar`: HTTP 200, 4 asserts.

Evidencia JSON:

```text
C:\tmp\urban-ai-event-radar-direct-smoke\event-radar-direct-smoke.json
```

Screenshots gerados:

```text
C:\tmp\urban-ai-event-radar-direct-smoke\desktop-01-events.png
C:\tmp\urban-ai-event-radar-direct-smoke\desktop-02-events-evt-gp-sp-2026.png
C:\tmp\urban-ai-event-radar-direct-smoke\desktop-03-event-radar.png
C:\tmp\urban-ai-event-radar-direct-smoke\desktop-04-admin-event-radar.png
C:\tmp\urban-ai-event-radar-direct-smoke\mobile-01-events.png
C:\tmp\urban-ai-event-radar-direct-smoke\mobile-02-events-evt-gp-sp-2026.png
C:\tmp\urban-ai-event-radar-direct-smoke\mobile-03-event-radar.png
C:\tmp\urban-ai-event-radar-direct-smoke\mobile-04-admin-event-radar.png
```

## Ajuste aplicado no smoke

A primeira tentativa do smoke direto falhou no helper `waitForVisibleText`, que usava `getByText(...).first()` e capturava o `<option>` oculto `Studio Vila Mariana` dentro do filtro do radar host.

O helper foi endurecido para procurar qualquer ocorrencia visivel do texto esperado antes de falhar. Isso preserva a intencao do smoke e evita falso negativo em UI responsiva com duplicacao legitima de conteudo.
