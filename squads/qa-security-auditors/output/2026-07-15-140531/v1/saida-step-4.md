# Ulisses UX — auditoria de conclusão UI/UX, acessibilidade e mapa visual

**Data:** 2026-07-15  
**Branch auditada:** `codex/scorecard-10-10-20260715`  
**Escopo:** frontend Next.js, design system, responsividade, estados, PWA, performance percebida, acessibilidade e `docs/urban-ai-system-map-2026-07-15.html`.

## Veredito

O trabalho local melhorou materialmente a base, mas **não comprova 10/10** em Frontend, Design system, UX desktop, UX mobile ou Acessibilidade. Há gates locais realmente verdes, porém parte deles mede um subconjunto mais estreito que o critério do plano mestre. Também foram encontrados defeitos concretos ainda resolvíveis localmente.

| Requisito do plano mestre | Classificação | Evidência autoritativa |
|---|---|---|
| Frontend: gates, bundle, runtime e componentização | **incompleto** | shared gzip passa; lint/typecheck passam; ainda há 13 módulos >1.000 linhas, ausência de Web Vitals p75 e budget não bloqueia rotas individuais |
| Design system: fonte única, catálogo, documentação, zero hex/spacing e 3 breakpoints | **contradito** | tokens estão sincronizados, mas há 208 hex, 275 `rgb/rgba`, 3.110 inline styles e 20 breakpoints fora do CSS gerado; não há catálogo executável/Storybook |
| UX desktop: sucesso ≥95% e SUS ≥80 | **externo + incompleto** | não existe estudo moderado, amostra, SUS ou telemetria de sucesso no worktree; error recovery local é parcial |
| UX mobile: zero overflow/overlap, alvos ≥44 px, jornadas 390/430/768 e PWA/push | **contradito + incompleto** | componentes canônicos têm botões de 28/32/36/40 px; apenas subconjuntos de rotas/viewports foram medidos; push/install real não foi exercitado |
| Acessibilidade: WCAG 2.2 AA, Axe, teclado, zoom, leitor e VPAT | **contradito + incompleto** | Axe local cobre subconjunto; checklist é WCAG 2.1 e continua desmarcado; não há zoom/leitor/VPAT; 8 cenários autenticados seguem gated |
| Estados loading/empty/error/permission/offline | **incompleto** | boundaries e vários estados de domínio existem; diálogos e loading genérico ainda falham em foco e feedback contextual |
| Mapa visual HTML: 100% visual, responsivo, atual/alvo/owner/status/evidência | **contradito** | cobre 78 `page.tsx` e não tem overflow, mas esconde o alvo no mobile, tem 36/60 violações sérias de contraste e afirma cobertura não executada de zoom/leitor |

## Evidências comprovadas

- `npm run lint` e `npm run typecheck`: exit code 0 no worktree atual.
- `npm run design:audit`: exit code 0; `tokens.json` e `design-tokens.css` estão sincronizados.
- `npm run design:tokens:test`: 4/4 testes verdes.
- `npm run bundle:report`: shared **103,0 KiB gzip**, abaixo do teto de 180 KiB.
- `npm run error-boundary:unit:test`: 4/4 testes verdes.
- `npm run pwa:lifecycle:test`: 4/4 testes verdes para registro, atualização, reload único e invalidação de cache.
- `npx playwright test --list`: 93 cenários, todos apenas no projeto Chromium (`Urban-front-main/playwright.config.ts:34-36`).
- O mapa HTML tem 13 seções, 78/78 caminhos de `page.tsx` representados e zero overflow horizontal em 390, 430, 768 e 1440 px.
- A correção geométrica do footer é exercitada em 390/430/767 e a bottom-nav é ocultada em 768 (`Urban-front-main/e2e/readonly-gates.spec.ts:106-133`).
- Fallback de imagem trata ausência, erro de rede e timeout de 8 s no componente (`Urban-front-main/src/app/componentes/ui/event-intelligence/EventImage.tsx:19-35`); o E2E cobre HTTP 404 e `blockedbyclient` (`Urban-front-main/e2e/event-radar.spec.ts:40-53`).
- Error boundaries recuperáveis existem para público, host, admin e global (`Urban-front-main/src/app/(public)/error.tsx`, `src/app/error.tsx`, `src/app/admin/error.tsx`, `src/app/global-error.tsx`).

## Achados priorizados

### [P1][CONTRADITO] O mapa visual falha WCAG AA e oculta informação obrigatória no mobile

**Heurísticas:** H1 visibilidade do estado; H4 consistência; H7 flexibilidade; WCAG 1.4.3.

Execução de Axe no arquivo final encontrou:

- tema escuro: **36 nós com `color-contrast`, impacto `serious`**;
- tema claro: **60 nós com `color-contrast`, impacto `serious`**.

Exemplos medidos: texto branco sobre `#E8500A` = 3,76:1; branco sobre `#42D392` = 1,91:1; branco sobre `#68A8FF` = 2,43:1. Os seletores atingidos incluem tabs ativas, swatches, pirâmide de testes, labels de dispositivo e IDs de issues.

Além disso, `docs/urban-ai-system-map-2026-07-15.html:63` aplica `.score-target{display:none}` abaixo de 900 px. Assim, o alvo 10, exigido pela governança do score, desaparece justamente no mobile. A mesma mídia oculta toda a sidebar/busca sem oferecer navegação móvel equivalente. O HTML afirma que Acessibilidade está “resolvido” em `:223` e lista “zoom” e “leitor de tela” como cobertura em `:206`, mas essas evidências não existem.

**Correção local necessária:** ajustar pares foreground/background; tornar o alvo textual sempre visível; fornecer navegação/índice móvel; adicionar o próprio HTML a um gate Axe light/dark em 390/1440 e validar tabs/filtros com `aria-pressed` ou semântica equivalente.

### [P1][CONTRADITO] Diálogos críticos não controlam foco

**Heurísticas:** H3 controle e liberdade; H5 prevenção de erro; H9 recuperação; WCAG 2.1.1, 2.1.2, 2.4.3.

`AppConfirmDialog` escuta apenas Escape e bloqueia scroll (`Urban-front-main/src/app/componentes/ui/AppConfirmDialog.tsx:49-60`); não move o foco ao abrir, não o contém no modal e não o devolve ao trigger. O mesmo padrão aparece em:

- `src/app/admin/_components/AdminConfirmDialog.tsx:48-59`;
- `src/app/admin/_components/AdminDrawer.tsx:35-47`;
- `src/app/componentes/ui/AskUrbanUpgradeModal.tsx:26-38`;
- preferências de cookies em `src/app/componentes/CookieConsent.tsx:115-215`, que nem sequer trata Escape.

Esses componentes são usados em exclusão de usuário/imóvel, reset de enrichment, alteração de papel, billing e bulk pricing. `aria-modal="true"` não cria focus trap por si só. A busca em `e2e/` e `scripts/` não encontrou teste de foco inicial, Tab/Shift+Tab, Escape e retorno ao trigger para esses diálogos.

**Correção local necessária:** criar um utilitário React pequeno e compartilhado para captura/restauração de foco e contenção de Tab, sem adicionar biblioteca; cobrir cada primitivo com Playwright/component test.

### [P1][INCOMPLETO] O gate de acessibilidade autenticada não roda no release gate

**Heurísticas:** H4 consistência; H7 flexibilidade; WCAG 2.2 AA.

`a11y-authenticated.spec.ts` possui 5 rotas host e 3 admin, mas usa `test.skip` sem credenciais (`Urban-front-main/e2e/a11y-authenticated.spec.ts:17-21` e `:44-48`). O job autenticado já carrega todas as credenciais necessárias, porém executa apenas `authenticated-smoke.spec.ts` e `authenticated-mobile-smoke.spec.ts` (`.github/workflows/release-gate.yml:177-199`). Logo, os 8 cenários Axe reais nunca entram nesse gate.

A cobertura local substituta mede somente `/my-plan` e `/admin` em 390/1440, mais dois skip links (`Urban-front-main/e2e/a11y-local-fixtures.spec.ts:85-133`). O checklist oficial continua “WCAG 2.1 AA”, declara que Axe cobre apenas 30–50% e mantém os itens manuais desmarcados, inclusive zoom e leitor (`docs/runbooks/wcag-audit-checklist.md:1-3`, `:26-78`). Não há VPAT no repositório.

**Correção local necessária:** incluir `a11y-authenticated.spec.ts` no job já credential-gated; ampliar fixtures para as jornadas críticas; atualizar o checklist para WCAG 2.2; manter zoom/leitor como pendência humana até evidência real.

### [P1][CONTRADITO] Meta interna de touch target ≥44 px não é garantida pelos componentes canônicos

**Heurísticas:** H5 prevenção de erro; H7 eficiência; WCAG 2.5.8 e meta interna do plano.

`AppButton` define `sm=32`, `md=40`, `lg=48` e usa `md` como padrão (`Urban-front-main/src/app/componentes/ui/AppButton.tsx:36-40`, `:71-75`). `AdminButton` define `sm=28`, `md=36`, `lg=44` e também usa `md` (`src/app/admin/_components/AdminButton.tsx:34-38`, `:69-74`). Close buttons e controles chegam a 28/32 px em `AppToast`, `AdminDrawer`, `AskUrbanDrawer`, calendário e cards.

Portanto o design system não consegue sustentar a alegação “alvos primários ≥44 px” sem auditoria contextual de cada ação. O mapa visual também renderiza tabs/filtros com 40–42 px em 390/430/768.

**Correção local necessária:** separar tamanho visual do hit area, aplicar `min-inline-size/min-block-size:44px` às ações primárias e controles icon-only em viewport touch, e criar gate geométrico que varra os controles visíveis das jornadas críticas.

### [P1][CONTRADITO] O design-system gate não mede os critérios que afirma fechar

**Heurísticas:** H4 consistência; H8 minimalismo estrutural.

O lado comprovado é real: `tokens.json` tem os três breakpoints canônicos em `Urban-front-main/src/app/componentes/ui/tokens.json:110-113`, e os 4 testes de geração/drift passam.

Entretanto, a varredura do código atual, excluindo o CSS gerado, encontrou:

- **208** ocorrências de hex;
- **275** ocorrências `rgb/rgba`;
- **3.110** `style={{...}}`;
- **20** breakpoints distintos: 420, 620, 640, 700, 720, 760, 767, 768, 820, 899, 900, 901, 920, 980, 1020, 1023, 1024, 1050, 1100 e 1180;
- relação de unidades: **2.742 `px`**, 4 `rem` e 13 `em`.

`design-system-audit.mjs` bloqueia dependências/imports proibidos, mas não procura hex, spacing ou breakpoints. Diálogos nativos e utilitários residuais são apenas warnings (`Urban-front-main/scripts/design-system-audit.mjs:155-169`), e o script imprime OK se não houver erro de dependência (`:171-172`). Não existe Storybook/Chromatic/catálogo executável em `package.json` ou nos workflows. O documento canônico ainda marca camada de rebrand como proposta e lista hex/fonte/`!important` como dívidas (`docs/product/DESIGN-SYSTEM.md:64-107`, `:123-128`).

**Correção local necessária:** tornar o audit aderente ao critério: allowlist explícita para cores, baseline decrescente de inline style, allowlist de breakpoints e inventário executável dos componentes/estados. Não é necessário introduzir biblioteca grande; uma rota interna estática + Playwright já satisfaz catálogo vivo e regressão.

### [P2][INCOMPLETO] Bundle compartilhado passa, mas orçamento por rota e Web Vitals não existem

**Heurísticas:** H1 visibilidade; H7 eficiência.

`npm run bundle:report` mediu:

- shared: **103,0 KiB gzip** — comprovadamente aprovado;
- `/(home)/page`: **205,9 KiB gzip**;
- `/create/page`: **219,5 KiB gzip**;
- `/onboarding/page`: **258,7 KiB gzip**;
- `/properties/page`: **215,9 KiB gzip**.

O check só compara `report.shared.gzipBytes` a 180 KiB (`Urban-front-main/scripts/bundle-budget.mjs:65-70`); as rotas são apenas impressas (`:79-83`). Não há Lighthouse/LHCI/Web Vitals em script ou workflow, e a própria auditoria registra Web Vitals ausentes (`docs/auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md:533`). Assim, o critério “Web Vitals bons p75” permanece externo e o item “orçamento por rota” permanece localmente incompleto.

### [P2][INCOMPLETO] Aceites de BUG-01/02/03 são mais amplos que os testes atuais

**Heurísticas:** H1 visibilidade; H5 prevenção; H9 recuperação.

- **BUG-01:** a geometria é testada em 390/430/767, não 768, e não há screenshot baseline nem simulação explícita de safe-area (`readonly-gates.spec.ts:106-133`).
- **BUG-02:** o E2E cobre 404 e `blockedbyclient`, mas não há component test com relógio controlado para timeout nem cenário CSP explícito (`event-radar.spec.ts:40-53`; `EventImage.tsx:27-32`).
- **BUG-03:** o gate cobre host 390 e admin 1280, mas não público/mobile/admin na matriz visual pedida (`readonly-gates.spec.ts:136-186`).
- Playwright está configurado para screenshot apenas em falha (`Urban-front-main/playwright.config.ts:28-33`); não há visual diff/baselines em CI.

As correções de código parecem válidas, mas os IDs não atendem integralmente ao aceite declarado no plano mestre.

### [P2][INCOMPLETO] PWA update/cache está coberto; install/push/deep link e aparelhos não

**Heurísticas:** H1 visibilidade; H3 controle; H9 recuperação.

Os 4 testes unitários de lifecycle e os 3 E2E de `pwa-mobile.spec.ts` comprovam manifest, assets, presença do service worker, strings de cache e ausência de overflow em seis rotas públicas a 390 px (`Urban-front-main/e2e/pwa-mobile.spec.ts:3-94`). Eles não disparam `beforeinstallprompt`, instalação, `PushManager.subscribe`, permissão negada, push, notification click, token expirado ou background. Não há projeto WebKit/Firefox e nenhum dispositivo real.

**Local:** adicionar mocks unitários/Playwright de permissão, subscribe/unsubscribe, payload e notification click.  
**Externo:** instalação e push em Android/iOS/Safari, background e atualização de versão real.

### [P2][INCOMPLETO] Loading de ação perde contexto em componentes canônicos

**Heurísticas:** H1 visibilidade do status; H6 reconhecimento.

`AppButton` substitui o conteúdo por `loadingLabel ?? "…"` (`Urban-front-main/src/app/componentes/ui/AppButton.tsx:108-113`). `AdminButton` nem oferece `loadingLabel` e sempre troca por `"…"` (`src/app/admin/_components/AdminButton.tsx:105-110`). Em ações demoradas, o nome acessível vira apenas reticências; o usuário não sabe se está salvando, testando, importando ou excluindo. Há várias chamadas `loading={...}` no admin e no host sem teste do nome acessível durante a operação.

**Correção local necessária:** preservar o label original no nome acessível e exibir texto contextual; aplicar `aria-busy` e impedir duplo submit; testar antes/durante/depois, inclusive falha e retry.

### [P2][EXTERNO] Sucesso de tarefa e SUS não foram medidos

**Heurísticas:** todas as 10 dependem de validação com usuário real para fechar UX 10/10.

Busca por `SUS`, estudo moderado, task success e amostra não encontrou evidência de pesquisa. A auditoria declara que os tempos humanos são estimados e que a média real não está instrumentada (`docs/auditoria-360-arquitetura-produto-ui-ux-2026-07-15.md:511-533`). Logo, “sucesso ≥95%” e “SUS ≥80” não podem subir por teste sintético.

**Dependência humana final:** sessão moderada com hosts casuais/profissionais/administradoras, roteiro versionado, amostra, taxa de sucesso, tempo, erros e SUS; telemetria de TTFV/drop-off em produção.

### [P3][INCOMPLETO] “Todos os gates verdes” não é garantido no CI do frontend

O job `frontend-test` roda design audit, typecheck e build, mas não `npm run lint` (`.github/workflows/ci.yml:165-190`). O lint local passou nesta auditoria, porém uma regressão futura pode entrar sem gate. Também não há visual diff, Lighthouse ou browsers além de Chromium.

## Matriz Nielsen resumida

| Heurística | Estado | Evidência/gap dominante |
|---|---|---|
| H1 Visibilidade do estado | parcial | toasts/boundaries existem; loading pode virar apenas `…`; Web Vitals/tempos reais ausentes |
| H2 Correspondência com mundo real | incompleto | textos de domínio são claros em várias jornadas; sucesso com hosts não foi medido |
| H3 Controle e liberdade | contradito | Escape existe, mas foco não é capturado/restaurado em dialogs/drawers |
| H4 Consistência e padrões | contradito | tokens canônicos coexistem com 20 breakpoints, 208 hex e 3.110 estilos inline |
| H5 Prevenção de erro | parcial | confirmações existem; primitives de diálogo não garantem foco e touch target |
| H6 Reconhecimento | parcial | labels/empty states existem; loading contextual não é garantido |
| H7 Flexibilidade e eficiência | incompleto | shell responsivo existe; cobertura mobile/browser/zoom e performance p75 faltam |
| H8 Estética/minimalismo | não pontuado esteticamente | dívida objetiva de consistência e densidade é medida; sem julgamento subjetivo |
| H9 Diagnóstico e recuperação | parcial | boundaries/retry passam; integrações reais, modal focus e erros por provider precisam completar |
| H10 Ajuda e documentação | parcial | docs canônicas e mapa existem; mapa contém alegações de teste não sustentadas |

## Ordem recomendada de correção local

1. Corrigir contraste, semântica e scorecard mobile do HTML; adicionar Axe light/dark ao artefato.
2. Implementar foco inicial/trap/retorno nos primitives de dialog/drawer e testes de teclado.
3. Tornar 44 px uma garantia de hit area para ações touch e medir controles nas jornadas críticas.
4. Incluir `a11y-authenticated.spec.ts` no release gate e adicionar lint ao CI.
5. Fazer o design audit medir cores, breakpoints, spacing e baseline de inline styles; publicar catálogo vivo leve.
6. Criar budgets por rota e Lighthouse/LHCI; manter Web Vitals p75 como evidência externa até produção.
7. Fechar os aceites exatos de BUG-01/02/03 com screenshots/baselines, safe areas, timeout e CSP.
8. Cobrir PWA push/install em mocks; deixar Android/iOS/Safari real no handoff final.
9. Executar estudo de tarefas, SUS, zoom 200% e leitor de tela com evidência versionada antes de certificar 10/10.

## Saída estruturada

```yaml
report: "UX/UI local melhorou, mas o scorecard 10/10 não está comprovado; há P1 de contraste no HTML, foco em diálogos, a11y autenticada fora do gate, touch targets e design-system gate estreito."
issues:
  - item: "HTML: 36 violações serious no dark, 60 no light e alvo oculto no mobile"
  - item: "Dialogs/drawers sem foco inicial, trap ou retorno ao trigger"
  - item: "8 cenários Axe autenticados continuam gated e fora do release gate"
  - item: "AppButton/AdminButton canônicos permitem 28–40 px abaixo da meta 44 px"
  - item: "208 hex, 275 rgb/rgba, 3110 inline styles e 20 breakpoints não são auditados"
  - item: "Budget por rota, Web Vitals, visual regression, PWA push e browsers reais faltam"
  - item: "SUS, sucesso de tarefa, zoom e leitor de tela dependem de evidência humana"
```
