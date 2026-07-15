# Plano mestre — Urban AI 10/10

**Data-base:** 2026-07-15  
**Horizonte:** 24 semanas  
**Objetivo:** elevar todas as dimensões do scorecard a um padrão mensurável de excelência, corrigindo bugs, riscos, dívidas, lacunas de teste e bloqueios operacionais.

> “10/10” não significa ausência eterna de bugs. Significa que cada dimensão atende critérios objetivos, possui evidência atual, owner, SLO e processo de regressão.

---

## 1. Resultado esperado

Ao final do plano, o Urban AI deve ser capaz de:

1. coletar e qualificar demanda com proveniência e frescor;
2. gerar decisões de preço explicáveis e calibradas;
3. aplicar ou reverter preços com segurança;
4. capturar outcomes e comprovar ROI;
5. oferecer uma experiência rápida, acessível e consistente em desktop/mobile;
6. operar com SLOs, alertas, restore e incident response exercitados;
7. cobrar e suportar clientes reais sem dependência de conhecimento tácito;
8. provar tudo acima por testes e evidências automatizadas.

## 2. Premissas de capacidade

Estimativa para uma equipe com 2 frontend, 2 backend, 1 QA/automação, 1 data/ML, 0,5 design/produto e 0,5 DevOps/segurança. Com metade da capacidade, considerar 36–48 semanas.

## 3. Scorecard: definição de 10/10

| Dimensão | Atual | Critério objetivo de 10/10 |
|---|---:|---|
| Arquitetura | 8,2 | C4/ADRs atuais; domínios com owners; nenhum arquivo crítico >1.000 linhas sem plano; jobs críticos desacoplados; APIs versionadas e contratos testados. |
| Backend/API | 8,4 | 100% dos caminhos críticos com integração/contrato; cobertura crítica ≥90%; fresh/upgrade/rollback de migrations; zero P0/P1 aberto. |
| Dados e IA | 6,3 | outcome capture ≥80%; datasets versionados; drift monitorado; backtest por coorte; MAPE dentro do gate acordado; promoção de modelo reversível. |
| Frontend | 7,8 | todos os gates verdes; shared JS ≤180 kB; Web Vitals bons p75; zero erro runtime conhecido; páginas críticas componentizadas. |
| Design system | 7,4 | tokens.json como fonte; catálogo vivo; 100% de componentes críticos documentados; zero hex/spacing não autorizado; 3 breakpoints canônicos. |
| UX desktop | 7,8 | sucesso ≥95% nas tarefas críticas; SUS ≥80; erros recuperáveis; IA/impacto/próxima ação claros. |
| UX mobile | 7,0 | zero overflow/overlap; alvos primários ≥44 px; tarefas críticas completas em 390/430/768; PWA/update/push testados. |
| Acessibilidade | 7,1 | WCAG 2.2 AA; zero serious/critical no axe; teclado/zoom/leitor de tela validados; VPAT/checklist atual. |
| Operação | 5,8 | SLO ≥99,9%; readiness funcional; status page; alertas com owner; RPO/RTO provados; restore e rollback exercitados. |
| Prontidão comercial | 6,4 | billing real; 2 ciclos sem incidente; suporte/LGPD/SLA; cases auditados; margem por listing conhecida; copy baseada em evidência. |

## 4. Fases e marcos

| Fase | Semanas | Meta | Score global esperado |
|---|---:|---|---:|
| F0 — contenção | 1–2 | zerar P0/P1 operacionais e falsos gates | 7,6 |
| F1 — fundação de qualidade | 3–6 | CI, observabilidade, testes críticos e docs | 8,2 |
| F2 — arquitetura e experiência | 7–12 | modularização, DS, performance, mobile e a11y | 8,8 |
| F3 — dados e beta assistido | 13–18 | outcomes, calibração e cases | 9,3 |
| F4 — certificação | 19–24 | escala, resiliência, comercial e evidência final | 10,0 |

### 4.1 Estado executado em 2026-07-15

O plano já produziu uma baseline local de release candidate, sem alterar os critérios de 10/10:

- backend: 92 suítes/896 testes, lint/build/audit verdes, 61/61 bodies com DTO runtime e cobertura certificada ≥90% em Auth, Stays, health/cron/jobs, backtesting e resolução de preços Stripe;
- frontend: 97/97 E2E Chromium contra o artefato standalone, zero skips, build de 76 rotas, unitários/lint/typecheck verdes e shared bundle em 103,0 KiB gzip;
- segurança: mass assignment no registro, corrida de refresh token, mutação cross-tenant, SSRF de importação Airbnb/Web Push, enumeração/código de e-mail e fragmentos de secret em logs corrigidos com regressão automatizada;
- hardening web: headers defensivos ativos e CSP em `Report-Only`, aguardando observação antes de enforcement;
- acessibilidade e design: Axe público/autenticado/admin, desktop/mobile e teclado verdes; foco/touch/loading corrigidos; gate não regressivo de dívida visual e catálogo de 12 componentes;
- dados: pipeline e coletores com pytest, Ruff, format e mypy verdes; qualidade fail-closed e proveniência testadas;
- operação real: permanece não certificada enquanto readiness, Railway, DNS, restore real, sandboxes, beta humano, jurídico e janela de SLO não forem comprovados.

O registro auditável e os comandos de evidência ficam em `scorecard-10-10-execution-status.md`. O mapa navegável fica em `urban-ai-system-map-2026-07-15.html`.

---

## 5. F0 — contenção imediata

### 5.1 Segurança e LGPD

| ID | Tarefa | Aceite |
|---|---|---|
| SEC-01 | concluir resposta ao incidente de blobs sensíveis | repo/branches/forks/cache avaliados; usuários/sessões/secrets tratados; decisão ANPD registrada |
| SEC-02 | reescrever histórico com procedimento coordenado | blobs não aparecem em `git rev-list --objects --all`; clones antigos invalidados |
| SEC-03 | secret scanning obrigatório | gitleaks/trufflehog no pre-commit e CI; zero segredo ativo |
| SEC-04 | fechar matriz LGPD | retenção, consentimento server-side, self-service de titular e cascade/anonymization testados |

### 5.2 Operação

| ID | Tarefa | Aceite |
|---|---|---|
| OPS-01 | configurar `HEALTH_READINESS_TOKEN` | `/health` autenticado retorna 200 e integra gates |
| OPS-02 | domínio canônico da API | um hostname `api.*`; frontend, Railway, CORS, docs e monitores alinhados |
| OPS-03 | publicar status page | DNS resolve, componentes e incidentes são visíveis; link do footer passa E2E |
| OPS-04 | concluir staging DNS/Cloudflare | `staging` e `staging-api` resolvem e passam smoke/readiness |
| OPS-05 | restaurar acesso operacional | Railway/Cloudflare autenticados por owner, com procedimento no cofre/handoff |

### 5.3 Bugs imediatos

| ID | Correção | Teste obrigatório |
|---|---|---|
| BUG-01 | rodapé host acima da bottom-nav | screenshot + bounding boxes em 390/430/768 e safe area |
| BUG-02 | fallback de imagem de evento | component test + E2E com 404/timeout/CSP |
| BUG-03 | cookie banner sem cobrir ações | visual regression público/admin/mobile |
| BUG-04 | remover imports mortos do onboarding | lint sem warnings |
| BUG-05 | corrigir asserts com acentos | E2E por role com regex Unicode ou nome exato |
| BUG-06 | mockar sessão no teste de tema admin | persistência após reload, light/dark/system |
| BUG-07 | manter a suíte local sem testes pulados | 97/97 E2E com fixtures determinísticas; CI falha se `test.skip`/`test.fixme` reaparecer |
| BUG-08 | bloquear mass assignment no cadastro | DTO allowlist, `forbidNonWhitelisted` e teste tentando elevar role/status |
| BUG-09 | eliminar corrida na rotação de refresh | update condicional transacional e teste concorrente de reuso |
| BUG-10 | impedir mutação cross-tenant de propriedade | lookup owner-scoped antes de quota/provider e regressão com dois usuários |
| BUG-11 | bloquear SSRF no resolvedor Airbnb | allowlist, DNS/IP por redirect, limites de tempo/tamanho e testes de redes privadas |

---

## 6. F1 — qualidade, observabilidade e documentação

### 6.1 Pirâmide de testes

| Camada | Meta | Ferramenta/abordagem |
|---|---:|---|
| Unit frontend | funções/hooks/componentes críticos | Vitest + Testing Library |
| Component visual | estados e interações | Storybook test runner ou Playwright CT |
| Unit backend | regras de domínio | Jest; ≥90% nos módulos críticos |
| Integration backend | DB/Redis/filas | MySQL/Redis efêmeros em CI |
| Contract | OpenAPI e providers | schema diff + Pact/fixtures versionadas |
| E2E | jornadas críticas | Playwright com fixtures determinísticas |
| Visual | 3 viewports × 3 temas/superfícies | screenshots com baselines aprovados |
| A11y | público, host e admin | axe + teclado + auditoria manual |
| Performance | web/API/jobs | Lighthouse/Web Vitals + k6 |
| Security | SAST/DAST/deps/secrets | CodeQL, ZAP, npm/pip audit, gitleaks |
| Resilience | falhas de provedores | fault injection controlada |
| Data/ML | schema, qualidade, drift, backtest | suites determinísticas e datasets congelados |

### 6.2 CI proposto

**PR rápido (<10 min):** lint, typecheck, unit, design audit, secret scan, migration audit, E2E smoke e links de docs.

**PR completo:** build, integration, contract, Playwright crítico, axe e visual diff.

**Nightly:** suíte completa, browsers/dispositivos, DAST, load smoke, collectors canary, drift/data quality.

**Semanal:** soak, restore dry-run, replay de webhooks, backtest e custos.

**Pré-release:** staging real, migrations, rollback, Stripe/Stays sandbox, PWA, performance, a11y e aprovação humana.

### 6.3 Observabilidade

- Sentry com release, environment, correlationId e source maps.
- Métricas RED para APIs; USE para infra; filas e crons por SLA.
- Alertas de webhook Stripe, collector stale, geocoder/enrichment em lote, Redis, DB, backup e ausência de cron.
- Logs estruturados, sem PII, com sampling e retenção.
- Dashboard de SLO e error budget.

### 6.4 Documentação

- Aplicar `DOCUMENTATION-GOVERNANCE.md`.
- Gate de links, arquivos canônicos e dados sensíveis.
- Gerar OpenAPI/ERD/C4 a partir do código quando possível.
- Atualizar mapa visual em cada release maior.

---

## 7. F2 — arquitetura, frontend e design system

### 7.1 Arquitetura/backend

1. Dividir `admin.controller` por contexto: exec, events, quality, billing e support.
2. Extrair use cases de `admin.service`, `propriedade.service`, `event-intelligence.service` e `host-panels.service`.
3. Definir ports/adapters para Stripe, Stays, Maps, Gemini, Airbnb e coletores.
4. Isolar crons críticos em workers/deployments idempotentes com lock distribuído.
5. Versionar API externa e publicar política de depreciação.
6. Arquivar `urban-ai-knn-main` após provar ausência de tráfego/dependência.
7. Padronizar nomes de domínio sem renomear tudo em big bang.

### 7.2 Frontend

1. Bundle analyzer e orçamento por rota; shared JS ≤180 kB.
2. Dynamic import de mapas, player, gráficos e drawers pesados.
3. Extrair data hooks, view models e seções de páginas >1.000 linhas.
4. Error boundaries por domínio e taxonomia de erro recuperável.
5. Consolidar rotas canônicas/aliases (`plans/v2`, `price`, nomes painel/dashboard).
6. Testar service worker update, cache invalidation e versão de assets.

### 7.3 Design system

1. `tokens.json` com primitivos e semânticos.
2. Gerar CSS variables e documentação.
3. Storybook/catálogo com componentes, estados, contraste e viewports.
4. Breakpoints únicos: 767, 1180 e desktop.
5. Migrar 3.132 inline styles por prioridade; não exigir big bang.
6. Hex e spacing fora de allowlist falham CI.
7. Padrões oficiais para loading, empty, error, offline e permission denied.

### 7.4 UX desktop/mobile

- Testes moderados de tarefa com hosts casuais, profissionais e administradoras.
- Home do admin orientada a tarefas, impacto, owner e próxima ação.
- Busca/comando/favoritos no admin.
- Onboarding com progresso, SLA da recomendação e recuperação de import.
- Tabelas viram cards/detalhes no mobile quando o conteúdo não cabe semanticamente.
- Touch targets primários ≥44 px e safe areas reais iOS/Android.

---

## 8. F3 — dados, IA e beta assistido

### 8.1 Qualidade de dados

| Controle | Meta |
|---|---|
| schema contracts | 100% das fontes e snapshots |
| provenance | fonte, coletadoEm, versão e confiança em todo sinal |
| frescor | SLO por fonte; stale detectado automaticamente |
| dedup | precision/recall com gold dataset |
| geocoding | taxa de sucesso e erro por cidade/provedor |
| attendance/venue | cobertura e origem mensuradas |
| outcomes | ≥80% na coorte beta |

### 8.2 Validação de modelo

- Split temporal, nunca aleatório quando houver risco de leakage.
- Backtest por cidade, tipo de listing, faixa de preço e presença de evento.
- Baseline simples obrigatório; modelo precisa superá-lo.
- MAPE, MAE, coverage de intervalos e impacto financeiro.
- Drift de features/predição/outcome.
- Shadow mode antes de promoção.
- Model card, dataset card, versão e rollback.
- Guardrails continuam soberanos mesmo após melhora de modelo.

### 8.3 Beta assistido

- 5–10 hosts escolhidos por cobertura e disponibilidade de outcome.
- Onboarding acompanhado; TTFV <48 h em ≥90%.
- Reunião semanal de decisões aceitas/rejeitadas.
- Outcome capture ≥80%.
- Cases com metodologia, amostra e limitações.
- Nenhuma promessa percentual sem evidência.

---

## 9. F4 — certificação operacional e comercial

### 9.1 Testes de integração real

**Stripe:** test clocks, checkout mensal/anual, quantity, upgrade/downgrade, cancelamento, retry, webhook duplicado/fora de ordem, portal, charge failure e reconciliação.

**Stays:** token/consentimento, listagem, preview, guardrail, push idempotente, retry, timeout, rate limit, rollback, kill-switch e auditoria.

**Maps/Gemini/Airbnb:** credencial inválida, quota, latência, resposta parcial, captcha, hash expirada, fallback e custo.

**E-mail/push:** bounce, spam complaint, unsubscribe, VAPID, Android/iOS, permissão negada, token expirado e deduplicação.

### 9.2 Resiliência e DR

- Load: p50/p95/p99 com metas por endpoint.
- Stress: encontrar ponto de quebra e recuperação.
- Soak: 8–24 h para vazamento/conexões/filas.
- Spike: login, evento grande e jobs simultâneos.
- Chaos: Redis/DB/provedor indisponível, container reiniciado e cron duplicado.
- Backup diário com checksum/restore verification.
- Restore real em staging vazio com RPO/RTO medidos.
- Rollback de deploy, migration e preço Stays exercitados.

### 9.3 Comercial

- KYC e Price IDs reais.
- Dois ciclos de billing sem incidente.
- DPAs e inventário de subprocessadores.
- SLA/suporte/escalonamento.
- Unit economics por listing e coorte.
- Copy pública reconciliada com capabilities e cases.

---

## 10. Matriz completa de testes pendentes

“Pendente” aqui significa necessário para a certificação total. Parte relevante já roda localmente; a classificação abaixo impede misturar mocks determinísticos com prova de produção.

| Área | Cenários mínimos |
|---|---|
| Auth | signup, Google, confirmação, reset, refresh, logout, revogação, roles, brute force, sessão concorrente |
| Onboarding | URL válida/inválida/short/private, captcha, múltiplos listings, fallback manual, quota, mobile, retomada |
| Pricing | regras, estratégias, limites, datas, timezone, arredondamento, idempotência, snapshot, explicação, rejeição |
| Eventos | ingest auth, dedup exato/fuzzy/multi-dia, geocode, coverage, histórico, venue, sazonalidade, stale |
| Portfólio | ownership, seleção em lote, simulação, partial failure, undo/rollback, concorrência |
| Stays | connect, consent, preview, push, retry, duplicate, rollback, auto-apply gates e kill-switch |
| Billing | planos/ciclos/quantidade, webhook, retry/out-of-order, cancelamento, portal, quota e reconciliação |
| ROI | confirmado/projetado/perdido, moeda, timezone, outcome ausente, amostra e confiança |
| Admin | todas as 28 rotas, roles, readonly, mutações, confirmação, auditoria, paginação e export |
| PWA | install, offline, update, cache, push, deep link, iOS/Android e background |
| UI | 390/430/768/1024/1440; light/dark/system; locale pt/en/es; zoom 200%; reduced motion |
| A11y | axe, teclado, foco, headings, labels, live regions, contraste, leitor de tela |
| Performance | LCP/INP/CLS, bundle, API p95, jobs, DB queries, load/stress/soak |
| Security | authz/IDOR, injection, XSS, CSRF, SSRF, rate limit, webhook signature, secrets, headers |
| Data/ML | schema, missing/outliers, leakage, drift, backtest, shadow, fairness por região/faixa e rollback |
| DR/Ops | fresh migrations, upgrade, rollback, backup, restore, failover, alert delivery e runbooks |

### 10.1 Cobertura já automatizada e testes ainda necessários

| Classe | Coberta localmente | Ainda necessária antes de 10/10 |
|---|---|---|
| Auth/authorization | cadastro, confirmação/reset, login/logout, refresh/reuso concorrente, roles, owner scope, allowlist pública e throttle estrutural | Google/OAuth real, dois hosts + admin em staging, 401/403/404/429 e sessão concorrente multi-réplica |
| Frontend/jornadas | 97 E2E Chromium com fixtures; público, host, admin, onboarding, billing, eventos, pricing, PWA, responsive, tema, a11y, foco/touch/loading e read-only gates | Firefox/WebKit, dispositivos reais 390/430/768, visual baselines aprovadas, zoom 200% e leitor de tela |
| Backend crítico | 896 testes; 61/61 bodies com DTO runtime; cobertura ≥90% em Auth, Stays, health/cron/jobs e 100% em backtesting/Stripe resolver | integração MySQL/Redis multi-réplica, migrations fresh/upgrade/rollback e carga/soak |
| Provedores | contratos locais, retries, idempotência, kill switches e falha fechada | Stripe Test Clock/webhooks assinados; Stays/Airbnb/Maps em sandbox; indisponibilidade e rate limit reais |
| Segurança | secret/dependency/SAST gates, SSRF, IDOR regressions, headers e CSP Report-Only | DAST em staging, CSP enforcement após observação, rotação de credenciais e reescrita histórica coordenada |
| Dados/ML | 164 testes Python, schema/proveniência/ordem temporal, backtesting determinístico | dataset versionado real, leakage/drift/fairness, backtest por coorte, shadow e rollback de modelo |
| Operação/DR | 65 contratos locais e self-tests de backup/restore | restore real em DB temporário, failover, alerta entregue, RPO/RTO medidos e 14 dias de SLO |
| Produto/UX | jornadas e tempos estimados documentados; ausência de overflow/overlap automatizada | 5–10 hosts, sucesso ≥95%, SUS ≥80, TTFV/outcomes e dois ciclos comerciais sem incidente |

## 11. Definition of Done global

Uma tarefa só fecha quando possui:

1. código e documentação atualizados;
2. teste proporcional ao risco;
3. observabilidade e erro recuperável;
4. segurança/LGPD revisadas;
5. desktop/mobile/a11y quando houver UI;
6. rollout/rollback definidos;
7. evidência anexada;
8. owner e SLO pós-release.

## 12. Dependências humanas/externas

Não podem ser mascaradas como “engenharia concluída”:

- decisão jurídica/ANPD do incidente;
- acesso válido a Railway e Cloudflare;
- DNS staging/status/API;
- KYC e configuração Stripe;
- parceria/credenciais Stays;
- credenciais e budgets de Maps, Gemini, Firecrawl e fontes;
- seleção de hosts e disciplina de outcomes;
- DPAs, suporte e orçamento.

## 13. Governança do score

- Review quinzenal com evidências.
- Nota só sobe quando o critério de aceite passa.
- Nota cai se regressão material ou SLO estourar sem plano.
- O HTML visual deve mostrar atual, alvo, owner, status e evidência.
- Certificação 10/10 exige duas semanas consecutivas sem P0/P1 e todos os gates de release verdes.
