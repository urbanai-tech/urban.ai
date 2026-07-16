# Auditoria de conclusão — plano mestre Scorecard 10/10

**Agente:** Caio Código — QA sênior e revisão de código  
**Data da evidência:** 2026-07-15  
**Branch auditada:** `codex/scorecard-10-10-20260715`  
**Plano normativo:** `docs/plano-mestre-scorecard-10-10-2026-07-15.md`  
**Registro de execução tratado apenas como alegação:** `docs/scorecard-10-10-execution-status.md`

## 1. Veredito executivo

O plano **não está concluído e o sistema ainda não pode ser certificado como 10/10**. Há uma base local substancialmente melhor: 533 testes backend verdes, testes Python verdes, gates estáticos de segurança/LGPD/autorização/observabilidade/cron/migrations, build e verificações frontend, tokens de design, orçamento de bundle, novos testes E2E e contratos locais de Stripe/Stays. Isso sustenta avanço técnico real, mas não satisfaz os critérios objetivos do próprio plano.

Os bloqueios principais são:

1. o worktree possui centenas de alterações não commitadas e nunca foi validado pela CI remota; a CI verde observada pertence ao SHA `303d71a8`, anterior a esta onda;
2. nenhum domínio crítico do backend atinge 90% simultaneamente em linhas, branches, funções e statements;
3. a CI atual não impõe cobertura, `lint` frontend, testes Node locais frontend, Ruff/mypy Python, cron estrito, rollback/upgrade de migrations, Redis, matriz de browsers, performance, DAST ou integrações reais;
4. segurança histórica SEC-01/SEC-02 continua aberta: o auditor encontrou 11 referências de objetos sensíveis no histórico;
5. readiness, DNS canônico, staging, status page e acesso Railway continuam bloqueados externamente;
6. modularização backend/frontend, ports/adapters, design system, documentação C4/owners, UX medida, acessibilidade formal, dados/ML, beta e certificação comercial estão parciais ou sem evidência;
7. as alegações `concluído` do tracker usam frequentemente “código local + teste parcial” como sinônimo de requisito integral, embora a coluna de próximos passos reconheça o trabalho faltante.

**Classificação usada:**

- **Comprovado:** critério integral reproduzido nesta auditoria.
- **Parcial:** implementação útil existe, mas o aceite do plano não foi integralmente provado.
- **Não comprovado:** não há evidência suficiente ou o gate não existe.
- **Bloqueio externo:** depende de credencial, provedor, DNS, dados ou decisão humana fora do worktree.
- **Regredido/contraditório:** evidência atual contradiz a alegação do tracker.

## 2. Evidência reproduzida

| Área | Evidência atual | Resultado |
|---|---|---|
| Backend Jest + cobertura | `npx jest --coverage --coverageReporters=json-summary --coverageReporters=json --runInBand --silent` | 75/75 suítes e 533/533 testes; 44,68% statements, 39,24% branches, 44,10% functions, 46,06% lines |
| Segurança HEAD | scanner self-test + scan do HEAD | 12/12 detectores; 1.746 arquivos; zero achado no snapshot atual |
| Histórico sensível | auditor path-only, sem ler conteúdo | 11 referências a dump, SQL, PDF/texto de e-mail e `credentials.py`; SEC-01/02 abertas |
| Docs | auditor de links | 476 arquivos e 169 links aprovados na execução atual |
| Backend gates | LGPD, authz, observabilidade, cron, migrations e OpenAPI | gates estáticos verdes; limites detalhados abaixo |
| Resiliência/DR | gate estático + self-tests | 65/65 contratos; não equivale a restore real |
| KNN legado | auditor de consumidores | zero consumidor em 888 arquivos; retirada operacional ainda não provada |
| Frontend local | lint, typecheck, tokens, design audit, bundle, testes Node focados | verdes na rodada observada |
| Pipeline | pytest, Ruff, format e mypy source-only | 55 testes; Ruff tem 1 `PLR0913` em `raw_data_pipeline/config/logging_config.py:122`; mypy do source verde |
| Web scraping | pytest, Ruff/format e mypy source-only | 109 testes; source verde |
| Produção Railway | `/health/live` e `/health` | liveness 200; readiness 503 por token ausente |
| Staging Railway | `/health/live` e `/health` | liveness 200; readiness 401 sem token |
| DNS | resolução e HTTP públicos | `myurbanai.com` 200; `api`, `status`, `staging` e `staging-api` indisponíveis/NXDOMAIN; `app` resolve mas respondeu `000` na sonda |
| Acesso operacional | `railway whoami` | `Unauthorized. Please run railway login again.` |
| Gate enterprise | dry-run/live | `Ready groups: 0/4`; live: pass 0, fail 0, skip 4, planned 2 |
| CI remota | GitHub Actions | verde somente no SHA comprometido `303d71a8`; não cobre o worktree atual |

### Limitação temporal da evidência

O worktree foi alterado em paralelo durante a auditoria. O log de RapidAPI foi corrigido em `urban-ai-backend-main/src/airbnb/airbnb.service.ts:81-86` para não imprimir fragmento de chave, e os `test.skip` explícitos foram removidos. A suíte integral de 533 testes e a rodada E2E anterior foram executadas antes de parte dessas mudanças. Portanto, correção presente no arquivo não significa regressão integral reexecutada.

## 3. Achados prioritários

### P0 — certificação remota inexistente para o artefato auditado

**Estado:** não comprovado.  
**Causa raiz:** a entrega está em worktree altamente modificado, sem commit/PR e sem execução dos workflows sobre este conteúdo.  
**Risco:** resultados locais podem depender de ambiente, arquivos não versionados ou mudanças concorrentes; o SHA verde não representa a versão candidata.  
**Correção:** estabilizar o escopo, revisar alterações/deleções, criar commit/PR e executar todos os gates obrigatórios no mesmo SHA.  
**Aceite:** SHA único com CI integral verde, artefatos de cobertura/E2E anexados e nenhuma mudança posterior sem nova execução.

### P0 — incidente histórico SEC-01/SEC-02 permanece aberto

**Estado:** não comprovado.  
**Evidência:** o scanner do HEAD está verde, mas o auditor path-only encontrou 11 referências históricas potencialmente sensíveis. O aceite do plano exige `git rev-list --objects --all` limpo, rotação/tratamento de usuários e sessões, clones antigos invalidados e decisão ANPD registrada (`plano`, linhas 61-63).  
**Causa raiz:** contenção do snapshot atual foi confundida com erradicação do histórico e resposta formal ao incidente.  
**Correção:** inventariar conteúdo com acesso restrito, avaliar exposição, rotacionar segredos/sessões, coordenar rewrite de todas as refs/forks/caches e registrar decisão LGPD/ANPD.  
**Aceite:** busca em todas as refs sem blobs, evidência de rotação/invalidação, ata da resposta e scan remoto pós-rewrite.

### P0 — readiness, DNS e acesso operacional impedem certificação

**Estado:** bloqueio externo confirmado.  
**Evidência:** produção `/health` 503 por token não configurado; staging 401 sem token; `api.myurbanai.com`, status e staging não resolvem; Railway CLI não autenticado. `Urban-front-main/.env.example:12-15` e `urban-ai-backend-main/.env.example:38` ainda apontam para Railway, enquanto `urban-ai-backend-main/.env.example:45` declara `api.myurbanai.com`.  
**Causa raiz:** configuração externa e documentação/configuração local divergentes.  
**Correção:** owner autentica Railway/Cloudflare, configura secrets, DNS, CORS, monitores e hostname único; alinhar exemplos e docs.  
**Aceite:** readiness autenticado 200 em produção/staging, DNS propagado, smoke ponta a ponta, status page pública e monitor externo verde.

### P1 — cobertura crítica está muito abaixo do critério 90%

**Estado:** regredido em relação à ambição do plano; sem threshold.  
**Evidência:** `urban-ai-backend-main/package.json:18` oferece `test:cov`, mas a configuração Jest não contém `coverageThreshold`; a CI executa Jest sem cobertura em `.github/workflows/ci.yml:69-70`.  
**Causa raiz:** quantidade de testes foi usada como proxy de risco, com mocks em fronteiras controller/service e pouco exercício de branches/falhas.  
**Correção:** testes orientados por fluxo e falha, integração com DB/Redis e thresholds progressivos por arquivo/domínio, sem excluir arquivos críticos.  
**Aceite:** todos os quatro indicadores >=90% nos módulos críticos, mutation score acordado e threshold bloqueante na CI.

### P1 — CI não executa o conjunto anunciado pelo plano

**Estado:** parcial.  
**Evidência atual em `.github/workflows/ci.yml`:**

- linha 88 usa `npm run audit:cron`, não `audit:cron:strict`;
- linhas 69-70 executam Jest sem cobertura/threshold;
- frontend, linhas 179-184, executa design audit, typecheck e build, mas não `lint`, `npm audit` nem os testes Node locais;
- Python, linhas 194-232, executa apenas pytest, sem Ruff, format ou mypy;
- migrations, linha 160-161, validam somente banco novo; não há upgrade de baseline nem rollback;
- não há serviço Redis, load/k6, Lighthouse/Web Vitals, ZAP/DAST, visual regression ou matriz real de browsers;
- o job E2E listado em linhas 327-349 omite `authenticated-smoke.spec.ts`, `authenticated-mobile-smoke.spec.ts`, `a11y-authenticated.spec.ts` e `public-responsive-keyboard.spec.ts`;
- `Urban-front-main/playwright.config.ts:34-36` declara apenas Chromium.

**Aceite:** pipeline obrigatório por PR, idêntico ao conjunto publicado, com cobertura, lint/audit, qualidade Python, MySQL+Redis, migration upgrade/down/up, Chromium/Firefox/WebKit e gates de performance/segurança.

### P1 — log de chave RapidAPI foi corrigido, mas o detector era insuficiente

**Estado:** correção presente; regressão ainda não certificada.  
**Evidência:** durante Jest, a versão anterior registrava os quatro primeiros e últimos caracteres da chave de teste. O arquivo atual registra apenas `RAPIDAPI_KEY configured` em `airbnb.service.ts:81-86`. O gate de observabilidade havia aprovado a versão que vazava fragmento.  
**Causa raiz:** política de redaction focada em payload/campos comuns, sem detector de logs que derivam de secrets.  
**Correção:** teste unitário do logger e detector estático para chave, token, secret e credenciais mascaradas parcialmente.  
**Aceite:** nenhum valor ou fragmento de secret em logs; teste negativo e gate self-test falham deliberadamente para padrão vulnerável.

### P1 — OpenAPI crítico cobre somente uma amostra

**Estado:** parcial.  
**Evidência:** `urban-ai-backend-main/src/openapi/openapi-compatibility.contract.spec.ts:41-49` monta só seis controllers; o tracker declara 12 operações e quatro schemas.  
**Causa raiz:** snapshot inicial foi promovido a conclusão de compatibilidade.  
**Correção:** gerar contrato da aplicação integral, classificar todos os endpoints críticos, versionar schemas transitivos e política de depreciação.  
**Aceite:** 100% dos caminhos críticos com diff breaking bloqueante, compatibilidade backward e changelog/versionamento.

### P1 — modularização backend e ports/adapters estão incompletos

**Estado:** parcial.  
**Evidência:** `admin.controller.ts` ainda possui 428 linhas e 33 rotas; apenas billing (9) e quality (15) foram extraídos, faltando concluir contextos executivos, eventos e suporte. Há 15 arquivos-fonte >1.000 linhas, incluindo `admin.service.ts` 2.592, `propriedade.service.ts` 2.308, `event-intelligence.service.ts` 2.105 e `host-panels.service.ts` 1.636. Não foram encontrados ports/adapters explícitos para Stripe, Stays, Maps, Gemini, Airbnb e coletores.  
**Causa raiz:** pequenas extrações foram marcadas como itens F2 concluídos, embora o tracker reconheça “continuar decomposição”.  
**Correção:** mapa de bounded contexts, contratos de use case, interfaces de provider, adapters, owners e milestones de redução de acoplamento.  
**Aceite:** controllers finos, serviços coesos, providers substituíveis por contrato e testes de arquitetura impedindo dependência invertida.

### P1 — design system é fundação de tokens, não sistema concluído

**Estado:** parcial.  
**Evidência:** `tokens.json` e geração determinística existem; porém o auditor em `Urban-front-main/scripts/design-system-audit.mjs:155-169` falha apenas imports proibidos e trata classes residuais/diálogos nativos como warning. Varredura encontrou aproximadamente 3.110 `style={{` e 208 cores hex fora de tokens/CSS gerado. `docs/product/DESIGN-SYSTEM.md` admite dívida e não há Storybook/stories executável.  
**Causa raiz:** criação do token source foi confundida com adoção, catálogo e governança.  
**Correção:** migrar estilos/cores/spacing, transformar warnings em gates graduais, catálogo executável, estados/variantes/a11y e regressão visual.  
**Aceite:** zero literal não autorizado, componentes documentados/testados e baseline visual por tema/breakpoint.

### P1 — qualidade Python declarada como verde não corresponde ao escopo configurado

**Estado:** parcial/contraditório.  
**Evidência:** mypy source-only passa. Contudo `urban-pipeline-main/pyproject.toml:71-82` e `urban-webscraping-main/pyproject.toml:109-120` incluem `tests/` no escopo padrão e o mypy padrão falha em muitos testes não tipados. No pipeline, Ruff sobre `.` encontra cerca de 159 erros em scripts experimentais/debug; o task intencional restringe-se a source+tests (`pyproject.toml:37`).  
**Causa raiz:** comandos focados foram reportados sem explicitar exclusões e a CI não executa nenhum deles.  
**Correção:** decidir o escopo oficial, mover/retirar scripts experimentais, tipar ou excluir tests de modo explícito e adicionar os comandos exatos à CI.  
**Aceite:** uma configuração canônica, reproduzida local/CI, zero erro ou waivers registrados com owner/data.

### P1 — DR, billing e Stays ainda são simulações locais

**Estado:** parcial.  
**Evidência:** gates estruturais e mocks cobrem contratos úteis, mas não houve restore real, Stripe sandbox/Test Clock, webhook assinado/replay concorrente, sandbox Stays ou prova multi-réplica com MySQL/Redis.  
**Causa raiz:** self-tests de scripts e mocks foram apresentados como certificação operacional.  
**Correção:** executar ensaios reais controlados em staging/DB temporário, com artefatos, logs, métricas e rollback.  
**Aceite:** RPO/RTO medidos, restore validado, billing temporal/retry/idempotência distribuída e push/rollback Stays ponta a ponta.

### P2 — ADRs e documentação canônica apresentam drift

**Estado:** parcial.  
**Evidência:** `docs/adr/0001-backend-nestjs-monolito.md:11` e `docs/adr/0006-secrets-vault-strategy.md:7,55` ainda citam Mailersend; backend e `.env.example` usam Brevo. Não foi encontrado C4 formal nem ownership completo por domínio.  
**Correção:** revisar ADRs, registrar substituição do provider, adicionar C4 contexto/containers/componentes, ownership/RACI e freshness gate.  
**Aceite:** docs canônicas sem contradição e owner/data de revisão em cada domínio.

## 4. Cobertura dos módulos críticos

Fonte: `urban-ai-backend-main/coverage/coverage-summary.json` e `coverage-final.json`, gerados pela suíte completa. Percentuais na ordem **linhas / branches / funções / statements**.

### 4.1 Cobertura agregada por domínio

| Domínio crítico | Arquivos | L | B | F | S | Threshold >=90 nos 4? |
|---|---:|---:|---:|---:|---:|---|
| Auth | 6 | 67,58 | 55,22 | 67,82 | 65,92 | Não |
| Stripe/payments | 4 | 82,23 | 64,05 | 82,56 | 80,87 | Não |
| Stays | 4 | 73,11 | 62,36 | 68,42 | 70,96 | Não |
| Pricing/guardrails | 10 | 80,18 | 69,11 | 86,59 | 78,82 | Não |
| Health/readiness | 2 | 88,32 | 67,47 | 97,14 | 85,53 | Não |
| Cron/lock infra | 4 | 75,46 | 63,78 | 78,18 | 74,14 | Não |
| Lock de recompute de eventos | 1 | 55,70 | 42,06 | 57,84 | 54,89 | Não |

**Conclusão honesta:** nenhum domínio crítico pode receber hoje threshold global >=90% nos quatro indicadores. Aplicar apenas threshold de linhas esconderia lacunas severas de branches, justamente onde residem autorização, retries, locks, fallback e idempotência.

### 4.2 Cobertura por arquivo crítico

| Arquivo/componente | L | B | F | S | Diagnóstico |
|---|---:|---:|---:|---:|---|
| `auth.controller` | 65,78 | 58,91 | 58,82 | 65,29 | fluxos/erros de endpoint incompletos |
| `auth.service` | 70,12 | 62,38 | 76,31 | 69,47 | branches de autenticação incompletos |
| `jwt-auth.guard` | 91,66 | 36,36 | 100 | 76,47 | linhas altas mascaram decisões não testadas |
| `jwt.strategy` | 93,75 | 60,41 | 85,71 | 87,17 | branches/principal incompletos |
| `roles.guard` | 56,25 | 40,81 | 75 | 55,26 | risco direto de autorização |
| `payments.controller` | 70,93 | 58,06 | 54,54 | 69,23 | contrato HTTP parcial |
| `payments.service` | 80,11 | 60,98 | 88,63 | 79,30 | temporal/retry/falhas parciais |
| `stripe-price-id.resolver` | 100 | 100 | 100 | 100 | pode aceitar 90% |
| `stripe-sync.service` | 97,05 | 71,23 | 100 | 93,67 | branch gap impede threshold completo |
| `stays.controller` | 0 | 0 | 0 | 0 | JWT/principal/mapeamento não provados |
| `stays.service` | 78,32 | 71,69 | 77,77 | 77,11 | fluxo central parcial |
| `stays-connector` | 73,11 | 57,75 | 60,86 | 69,29 | retries/falhas incompletos |
| `stays-auto-apply` | 79,28 | 70,80 | 92,30 | 78,37 | concorrência/rollback parcial |
| `pricing-calculate` | 62,16 | 67,52 | 85 | 61,97 | motor principal insuficiente |
| `pricing-guardrail` | 90,24 | 61,22 | 100 | 84,78 | branches de proteção insuficientes |
| `pricing-engine` | 94,59 | 67,79 | 80 | 88,37 | estratégias/branches insuficientes |
| `event-pricing-intelligence` | 83,77 | 77,70 | 98,21 | 83,36 | caminhos de score/outcome incompletos |
| `pricing-outcome-learning` | 85,21 | 62,64 | 91,66 | 84,37 | aprendizagem/falhas incompletas |
| `backtesting` | 100 | 100 | 100 | 100 | pode aceitar 90%, mas dataset real segue faltando |
| estratégia `adaptive` | 82,05 | 58,33 | 69,23 | 79,06 | incompleto |
| estratégia `rule` | 68,42 | 51,51 | 40 | 64 | incompleto |
| estratégia `shadow` | 81,81 | 48,83 | 75 | 78 | incompleto |
| estratégia `xgboost` | 50 | 33,33 | 20 | 48 | crítico para alegações ML |
| `pricing-bootstrap` | 0 | 0 | 0 | 0 | sem prova |
| `pricing-feedback` | 0 | 0 | 0 | 0 | sem prova |
| `strategy factory` | 0 | 0 | 0 | 0 | seleção de estratégia sem prova |
| `health.controller` | 96,15 | 66,66 | 100 | 87,87 | branches de respostas incompletos |
| `health.service` | 86,48 | 67,74 | 96,42 | 84,87 | degradações incompletas |
| `cron.controller` | 80 | 67,39 | 70,58 | 77,61 | operações admin parciais |
| `cron.service` | 63,12 | 58,82 | 68,18 | 62,56 | agendamento/falhas parciais |
| `scheduled-job-runner` | 98,27 | 68 | 100 | 93,84 | locks têm branches não exercitados |
| `event-intelligence.service` | 55,70 | 42,05 | 57,84 | 54,89 | lock/recompute e serviço central frágeis |

Os únicos arquivos de risco material que honestamente suportam threshold >=90% nos quatro indicadores são `backtesting` e `stripe-price-id.resolver`. Um decorator trivial também aparece coberto, mas não deve ser usado para sustentar “cobertura crítica”.

### 4.3 Casos prioritários para elevar cobertura

1. `stays.controller.ts:23-145`: autenticação, owner/principal, validação, status HTTP e propagação de erro.
2. `event-intelligence.service.ts:1063-1114`: lock adquirido/negado, exceção, release, concorrência e recuperação.
3. Auth: token ausente/inválido/expirado, usuário removido/inativo, role mismatch, refresh replay e rate limit.
4. Payments: assinatura inválida, duplicata, evento fora de ordem, falha após persistência, retry, proration e concorrência.
5. Pricing: limites, NaN/overflow, dados faltantes/stale, todas as estratégias, shadow/fallback, versão de modelo e feedback.
6. Health/cron: dependência degradada, timeout, token inválido, lock multi-instância e retry após crash.

## 5. Matriz de conclusão do plano

### 5.1 Resultado esperado e dimensões do scorecard

| Critério | Estado | Evidência/lacuna para 10/10 |
|---|---|---|
| Segurança e LGPD | Parcial | HEAD e gates locais verdes; histórico, retenção, exportação, anonimização, subprocessadores e drill real abertos |
| Confiabilidade operacional | Não comprovado | readiness/DNS/status/staging/acesso e janelas SLO reais ausentes |
| Qualidade de código | Parcial | testes numerosos, mas cobertura baixa, Python scope divergente e arquivos gigantes |
| Arquitetura | Parcial | extrações úteis; bounded contexts, ports/adapters, C4 e owners incompletos |
| Frontend/UI | Parcial | build/tokens/bundle e correções; dívida de estilos, visual regression e matriz de browsers abertas |
| UX/jornadas | Não comprovado | não há estudo moderado, tempos reais, SUS/task success e atritos medidos por coorte |
| Dados/IA | Parcial | validações e testes sintéticos; datasets versionados, cards, drift e validação real ausentes |
| Performance | Parcial | bundle melhorado; sem Web Vitals reais, load/stress e profiling de backend |
| Acessibilidade | Parcial | Axe automatizado WCAG 2.1 em cenários; sem WCAG 2.2 formal, leitor de tela/manual, VPAT e browsers reais |
| Comercial/go-live | Não comprovado | beta, KYC, billing real, DPAs, SLA, unit economics e cases externos ausentes |

### 5.2 F0 — contenção

| ID | Estado | Observação de aceite |
|---|---|---|
| SEC-01 | Não comprovado | resposta formal ao incidente e decisão ANPD não anexadas |
| SEC-02 | Não comprovado | 11 referências históricas ainda encontradas; rewrite não realizado |
| SEC-03 | Parcial | scanner/Gitleaks/CodeQL em código; hook e checks obrigatórios remotos ainda precisam ser provados no SHA final |
| SEC-04 | Parcial | gates LGPD úteis; exportação, anonimização, retenção e drill DB/jurídico faltam |
| OPS-01 | Bloqueio externo | readiness token ausente em produção |
| OPS-02 | Bloqueio externo + dívida local | API DNS ausente e configuração/docs divergentes; item não aparece no registro principal do tracker |
| OPS-03 | Bloqueio externo | status DNS/provedor ausentes |
| OPS-04 | Bloqueio externo | staging/staging-api não resolvem |
| OPS-05 | Bloqueio externo | Railway CLI sem autenticação |
| BUG-01 | Parcial | bounding boxes 390/430/767 existem; faltam screenshot baseline e safe-area real, e o plano pede 768 |
| BUG-02 | Parcial | E2E 404 e timeout no componente; faltam component test para timeout/CSP e matriz integral |
| BUG-03 | Parcial | bounding boxes host/admin; faltam visual regression público/admin/mobile, temas e screenshots |
| BUG-04 | Comprovado local | lint local sem warnings; ainda não está na CI |
| BUG-05 | Parcial | asserts Unicode presentes; precisa integrar/reexecutar E2E no SHA final |
| BUG-06 | Comprovado local | light/dark/system e persistência após reload cobertos; CI precisa executar o arquivo |
| BUG-07 | Parcial | skips explícitos removidos no worktree; CI ainda omite quatro specs e rodada final após alterações não ocorreu |

### 5.3 F1 — qualidade, observabilidade e documentação

| Requisito | Estado | Lacuna objetiva |
|---|---|---|
| Unit tests >=90% críticos | Não comprovado | nenhum domínio crítico >=90 nos quatro indicadores |
| Integração MySQL/Redis | Parcial | MySQL fresh migration; sem Redis e sem principais fluxos integrados |
| Contract tests | Parcial | OpenAPI de 12 operações; providers externos não têm cobertura integral |
| E2E jornadas críticas | Parcial | boa base local, mas arquivos omitidos da CI e sem ambiente real |
| Visual regression | Não comprovado | nenhum baseline/aprovação de screenshot |
| A11y automatizada/manual | Parcial | Axe sério/crítico; manual, leitor de tela e WCAG 2.2 faltam |
| Performance/load | Não comprovado | budgets estáticos; sem execução de k6/Lighthouse/Web Vitals no release |
| Segurança dinâmica | Não comprovado | CodeQL/scanners estáticos; sem DAST/ZAP/pentest |
| Observabilidade | Parcial | Sentry/request-id/redaction local; integração real, alertas e dashboards não provados |
| SLO/SLI | Parcial | probe existe; sem janela real ou monitor externo; critério exige 99,9% e p95 |
| Documentação consolidada | Parcial | arquivos canônicos e HTML existem; drift de ADR, C4/owners e evidência de atualização faltam |
| Dívida legada | Parcial | muitos docs movidos/deletados sem validação final do conteúdo/links no SHA publicado |

### 5.4 F2 — arquitetura, frontend, design system e UX

| Frente | Estado | Lacuna objetiva |
|---|---|---|
| Admin por contextos | Parcial | billing/quality extraídos; executivo/eventos/suporte não concluídos |
| Serviços monolíticos | Parcial | 15 arquivos >1.000 linhas, sem owners/marcos completos |
| Ports/adapters providers | Não comprovado | interfaces/adapters explícitos não encontrados |
| Cron workers isolados | Parcial | decorators continuam em services; locks locais/MySQL não equivalem a workers/deploys isolados |
| OpenAPI/versionamento | Parcial | 12 operações críticas apenas |
| Modelo de dados/migrations | Parcial | auditor estrutural; sem upgrade/rollback real e constraints/indexes avaliados por carga |
| Resiliência backend | Parcial | testes locais; Redis/multi-réplica/provider faults reais faltam |
| Modularização frontend | Parcial | reduções reais; ainda há `admin.ts` ~1.423, onboarding ~1.334 e várias páginas/componentes >1.000 linhas |
| Error boundaries/PWA | Parcial | código/testes locais; aparelhos, offline/update/push em Safari/Firefox faltam |
| Performance frontend | Parcial | bundle abaixo do budget; sem métricas reais por rota/dispositivo |
| Mobile/responsivo | Parcial | Chromium e breakpoints focados; matriz iOS/Android/tablet/browsers faltante |
| Tokens/schema/geração | Comprovado local | drift gate e testes passam |
| Adoção de tokens/componentes | Parcial | estilos inline/hex residuais e warnings não bloqueantes |
| Catálogo DS | Não comprovado | sem Storybook/stories/testes visuais executáveis |
| Temas/estados/a11y DS | Parcial | temas testados; catálogo integral de estados/variants não provado |
| Jornadas/tempo de fluxo | Não comprovado | não há instrumentação/teste com usuários e tempos médios por tarefa |

### 5.5 F3 — dados, IA e beta assistido

| Requisito | Estado | Lacuna objetiva |
|---|---|---|
| Proveniência/qualidade pré-DB | Parcial | validações Python locais; contrato ponta a ponta até backend e fontes reais incompleto |
| Deduplicação gold dataset | Não comprovado | não há dataset versionado nem precision/recall por fonte/coorte |
| Completude/freshness | Parcial | código/health existem; SLO real e alertas por fonte não provados |
| Outcome capture >=80% | Não comprovado | código existe; não há amostra real nem cobertura medida |
| Backtest temporal/coortes | Não comprovado | cálculo básico unitário; sem split temporal, cidades/coortes, baseline e leakage checks |
| Modelo/dataset cards | Não comprovado | artefatos não encontrados |
| Drift/model monitoring | Não comprovado | sem janela real de features/outcomes/model version |
| MAPE/calibração | Parcial | fórmula/testes locais; sem dataset de produção e intervalo de confiança |
| Beta assistido | Bloqueio externo | PRD indica pré-go-live; faltam usuários, resultados, entrevistas e casos |
| Recomendações explicáveis | Parcial | UI/lógica existem; compreensão, confiança e impacto real não medidos |

### 5.6 F4 — certificação operacional e comercial

| Requisito | Estado | Lacuna objetiva |
|---|---|---|
| Stripe real | Não comprovado | sandbox/Test Clock, proration, retry assinado e concorrência distribuída ausentes |
| Stays real | Não comprovado | sandbox push/rollback/idempotência multi-réplica ausentes |
| Maps/Gemini/Airbnb | Parcial | mocks e alguns fallbacks; matriz de falhas/quota/timeout real incompleta |
| E-mail/push | Não comprovado | provider e aparelhos reais não validados |
| Restore/DR | Não comprovado | gate estático; restore real e RPO/RTO medidos ausentes |
| Carga/escala | Não comprovado | scripts não substituem relatório de execução em ambiente representativo |
| Chaos/failover | Não comprovado | não há ensaio de dependências/DB/Redis/provider |
| KYC/DPA/SLA | Bloqueio externo | jurídico/comercial e subprocessadores precisam de aprovação |
| Billing ciclos completos | Não comprovado | nenhuma janela temporal real fechada |
| Unit economics/cases | Bloqueio externo | requer dados de operação e clientes reais |

### 5.7 Matriz de testes pendentes do plano

| Área | Situação | Próximo teste obrigatório |
|---|---|---|
| Auth/RBAC/LGPD | Parcial | integração DB, refresh replay, ownership horizontal, export/anonymize/delete e retenção |
| Billing/Stripe | Parcial local | Test Clock, retries assinados, concorrência, proration, ledger/dead-letter |
| Stays | Parcial local | sandbox, multi-réplica, rollback, kill switch e observabilidade real |
| Eventos/pricing | Parcial | dados reais, dedup gold, temporal backtest, drift, extremos e estratégias |
| Crons | Parcial | MySQL/Redis multi-instância, atraso, crash e recuperação |
| Migrations | Parcial | baseline de versão anterior -> up -> down -> up com dados preservados |
| Frontend jornadas | Parcial | todos os specs no CI, ambientes autenticados e navegadores/dispositivos reais |
| Visual/UI | Não comprovado | screenshots aprovados em temas e breakpoints |
| A11y | Parcial | WCAG 2.2, NVDA/VoiceOver, teclado manual e relatório de conformidade |
| Performance | Não comprovado | k6 + profiling + Lighthouse/Web Vitals por rota, orçamento e regressão |
| Segurança | Parcial | DAST, dependency policies, abuse/rate limit, SSRF e pentest focal |
| Observabilidade | Parcial | eventos Sentry reais, alertas, correlação e runbook exercitado |
| Backup/DR | Parcial estático | restore off-site real, corrupção parcial e medição RPO/RTO |
| Providers | Parcial | timeout, quota, 429/5xx, payload inválido, breaker e fallback por provider |
| Dados/ML | Parcial | datasets/cards/versionamento, temporal/coorte, bias/drift e outcomes reais |
| Comercial | Não comprovado | trial-to-paid, invoice/refund/cancel, suporte e evidência com clientes |

## 6. Dívida estrutural medida

Arquivos-fonte >1.000 linhas observados:

- backend: `admin.service.ts` 2.592; `propriedade.service.ts` 2.308; `event-intelligence.service.ts` 2.105; `host-panels.service.ts` 1.636; `event-pricing-intelligence.service.ts` 1.242; `dataset-collector.service.ts` 1.185;
- frontend: `src/app/service/api/admin.ts` 1.423; onboarding 1.334; `PortfolioCalendar` 1.172; properties 1.118; landing 1.077; `SideBar` 1.065; property detail 1.048; `EventDemandHeatmapPlaceholder` 1.044; portfolio 1.013.

O tracker registra algumas reduções, mas “continuar incrementalmente” não fecha a dívida sem owner, métrica-alvo, milestone e testes de arquitetura. A prioridade deve ser por risco e change frequency, não por contagem de linhas isolada.

Riscos de performance estáticos a medir, sem afirmar bug de produção:

- `admin.service.ts:529-536` filtra o conjunto de runs por job, potencialmente O(jobs × runs);
- `event-intelligence.service.ts:1826-1827` possui iteração aninhada items × impacts.

Sem logs Railway autenticados e carga representativa, esses pontos são hipóteses para profiling, não causas confirmadas.

## 7. Plano de correção e certificação

### Onda A — impedir falso verde

1. congelar o worktree, revisar deleções/movimentos, criar PR e executar CI no mesmo SHA;
2. tornar cron strict, lint/audit/testes frontend e Ruff/mypy Python obrigatórios;
3. publicar cobertura JSON/HTML e thresholds progressivos por domínio crítico;
4. incluir todos os specs E2E locais e matriz Chromium/Firefox/WebKit;
5. corrigir o detector de secrets em logs e reexecutar a suíte integral;
6. concluir SEC-01/02 de forma coordenada antes de qualquer release.

### Onda B — fechar operação e integrações críticas

1. owner autentica Railway/Cloudflare, configura readiness e DNS/status/staging;
2. alinhar hostname canônico em env examples, CORS, frontend, docs e monitor;
3. executar migration upgrade/down/up com MySQL e concorrência/locks com Redis/MySQL;
4. executar Stripe Test Clock e Stays sandbox com retries, idempotência e rollback;
5. realizar restore real off-site e medir RPO/RTO;
6. anexar evidência do mesmo release candidate.

### Onda C — elevar cobertura e arquitetura

1. começar por `stays.controller`, roles/auth, event recompute lock e payments;
2. impor 70 -> 80 -> 90% nos quatro indicadores, por arquivo/domínio, sem reduzir baseline;
3. extrair use cases e ports/adapters de providers; concluir contextos admin;
4. reduzir arquivos críticos com testes de caracterização e arquitetura;
5. expandir OpenAPI de 12 para 100% dos caminhos críticos.

### Onda D — experiência, dados e certificação 10/10

1. Storybook/catálogo, migração de tokens e visual regression por tema/dispositivo;
2. WCAG 2.2 manual + leitor de tela e matriz real de browsers/aparelhos;
3. testes moderados de jornadas com task success, tempo, erro e SUS por persona;
4. Web Vitals reais, k6, profiling e DAST;
5. datasets/model cards, temporal backtest, drift e outcomes >=80%;
6. beta assistido, billing completo, DPAs/SLA, unit economics e cases;
7. duas semanas sem P0/P1 e todos os gates de release verdes, conforme `plano` linha 303.

## 8. Definition of Done de reauditoria

Uma linha só pode mudar para **Comprovado** quando contiver:

1. implementação no SHA candidato;
2. teste proporcional ao risco, com casos positivos, negativos, borda, concorrência e falha quando aplicáveis;
3. gate bloqueante na CI do mesmo SHA;
4. artefato/log/relatório reproduzível;
5. owner e runbook para operação;
6. observabilidade e rollback;
7. validação externa quando o comportamento depende de provider, DNS, browser, aparelho, usuário ou dado real;
8. nenhuma pendência descrita na própria coluna “próximo passo”.

## 9. Resumo estruturado para o executor

```yaml
report:
  task: analise-logs-code
  status: failed
  verdict: "plano 10/10 parcialmente implementado; certificacao nao autorizada"
  evidence_quality: mixed
  remote_candidate_ci: absent
  critical_domain_coverage_ge_90_all_metrics: 0
  external_ready_groups: "0/4"
  blockers:
    - SEC-01/SEC-02 historico sensivel
    - readiness/DNS/status/staging/acesso Railway
    - CI nao executada sobre o worktree
    - cobertura critica sem threshold e abaixo de 90
    - integracoes reais/DR/beta/comercial nao comprovados
issues:
  - priority: P0
    area: release
    root_cause: "worktree sem SHA/CI remota correspondente"
  - priority: P0
    area: security
    root_cause: "scanner HEAD nao remove objetos historicos nem conclui resposta ao incidente"
  - priority: P0
    area: operations
    root_cause: "secrets, DNS e acessos externos incompletos"
  - priority: P1
    area: testing
    root_cause: "contagem de testes usada como proxy de cobertura de risco"
  - priority: P1
    area: architecture
    root_cause: "extracoes parciais promovidas a conclusao dos bounded contexts"
  - priority: P1
    area: design-system
    root_cause: "tokens confundidos com adocao e governanca completas"
decision:
  release_10_10: no_go
  safe_next_step: "estabilizar SHA, fechar falso verde da CI e resolver P0 antes da certificacao"
```

## 10. Conclusão

O estado atual merece ser reconhecido como **fundação técnica local relevante**, não como fechamento do plano. O tracker é útil como diário de execução, mas deve trocar `concluído` por `parcial local` sempre que ainda enumera validação real, expansão de cobertura, integração externa ou decomposição restante. A próxima reauditoria deve partir de um SHA imutável e exigir evidência no mesmo artefato, evitando que “teste local passou”, “gate estático passou” ou “código existe” substituam o critério integral de 10/10.
