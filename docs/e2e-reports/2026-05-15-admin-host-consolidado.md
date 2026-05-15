# Relatorio Consolidado E2E - Admin e Anfitriao

Data: 2026-05-15
Ambiente: producao
App: https://app.myurbanai.com
API: https://urbanai-production-85fd.up.railway.app
Usuario: gustavo8gouveia@hotmail.com

## 1. Preparacao executada

- Usuario Gustavo foi promovido de `host` para `admin` em producao, mantendo `ativo=1`.
- Login autenticado validado com sucesso.
- Endpoints admin basicos passaram a responder `200` apos a promocao: `/admin/overview`, `/admin/users`, `/admin/alpha/dashboard`.
- Auditor E2E criado em `Urban-front-main/scripts/e2e-product-audit.js`.
- Relatorios brutos gerados:
  - Admin: `docs/e2e-reports/2026-05-15T13-01-21/report.md`
  - Anfitriao: `docs/e2e-reports/2026-05-15T13-03-42/report.md`

## 2. Plano E2E completo

### 2.1 Admin

Objetivo: validar a estrutura interna de operacao Urban AI sem depender de SQL/manual.

Cobertura read-only executada:

- Navegacao UI: `/admin`, `/admin/dashboard`, `/admin/users`, `/admin/alpha`, `/admin/roi`, `/admin/audit-logs`, `/admin/contacts`, `/admin/waitlist`, `/admin/events`, `/admin/events/new`, `/admin/events/import`, `/admin/collectors-health`, `/admin/jobs`, `/admin/coverage`, `/admin/finance`, `/admin/pricing-config`, `/admin/stays`, `/admin/funnel`, `/admin/quality`.
- APIs criticas: overview/dashboard, users, alpha, ROI, audit logs, contatos, waitlist, eventos, collectors health, jobs, coverage, finance, plans config, Stripe sync, Stays health, funnel, pricing quality e occupancy coverage.

Cobertura mutante planejada para staging ou fixture isolada:

- Alterar role/status de usuario teste e validar audit log.
- Criar/editar custo financeiro teste e validar audit log.
- Convidar entrada de waitlist teste e aceitar magic link.
- Rodar reprocessamento alpha para usuario allowlisted.
- Rodar job de snapshot/geocoder com limites baixos.
- Criar/importar evento teste e validar dedup/geocode/scope.

### 2.2 Anfitriao

Objetivo: validar jornada real do usuario com imoveis cadastrados e recomendacao/ROI.

Cobertura read-only executada:

- Login, post-login, dashboard, onboarding, onboarding de preco, plans, plans/v2, my-plan, my-roi, settings/integrations e event-log.
- APIs criticas: propriedades dropdown, subscription, ROI do usuario e Stays listings.

Cobertura mutante planejada para staging ou fixture isolada:

- Atualizar diaria base e receita media mensal de um imovel teste.
- Reprocessar recomendacao e validar card/historico.
- Aceitar/aplicar sugestao manual e registrar resultado real.
- Confirmar que `PriceSnapshot` e ROI refletem a decisao.
- Testar upgrade/downgrade/cancelamento de plano em Stripe test mode.
- Conectar/desconectar Stays sandbox quando credenciais reais existirem.

## 3. Resultado por modulo

| Modulo | Entrega funcional estimada | UI | APIs | Leitura |
|---|---:|---:|---:|---|
| Admin | 87% | 85% | 91% | Quase operavel; bloqueado por 2 endpoints 500 ligados a tabela ausente. |
| Anfitriao | 59% estrito | 37% | 100% | APIs principais estao vivas, mas UI tem 1 crash real e varios erros de console por prefetch/CORS. |

Observacao: a nota do anfitriao esta em modo estrito porque qualquer erro de console rebaixa a rota. Se isolar a familia repetida de CORS/RSC dos links publicos, o modulo sobe operacionalmente, mas ainda fica bloqueado por `/my-plan`.

## 4. Achados por severidade

### P0 - corrigir antes de ampliar alpha/beta

1. **Admin dashboard e Stays health quebram por tabela ausente**
   - Sintoma: `/admin/dashboard-summary` retorna `500`.
   - Sintoma: `/admin/stays/health` retorna `500`.
   - Impacto UI: `/admin`, `/admin/dashboard` e `/admin/stays` exibem erro.
   - Evidencia Railway: `Table 'railway.price_updates' doesn't exist`.
   - Causa provavel: entity `PriceUpdate` existe, mas a migration/tabela `price_updates` nao foi aplicada/criada em producao.
   - Acao recomendada: criar migration idempotente `price_updates` ou aplicar migration pendente; depois reexecutar admin E2E.

2. **Pagina do plano do anfitriao quebra**
   - Rota: `/my-plan`.
   - Sintoma: `Internal Server Error` na UI.
   - Erro JS: `Cannot read properties of undefined (reading 'amount')`.
   - Causa provavel: componente `SubscriptionCards` assume `subscription.plan.amount`, mas o payload real de `/payments/getSubscription` pode vir sem `plan`/`amount`.
   - Acao recomendada: normalizar payload no backend ou tornar a UI defensiva com fallback para planos F6.5/metadata.

### P1 - corrigir para experiencia limpa e E2E confiavel

3. **CORS/RSC em links publicos dentro do app autenticado**
   - Rotas afetadas: `/post-login`, `/dashboard`, `/plans`, `/plans/v2`, `/my-roi`, `/event-log`.
   - Sintoma: Next tenta buscar RSC em `app.myurbanai.com/sobre|contato|privacidade`, middleware redireciona para `myurbanai.com`, e o browser bloqueia por CORS.
   - Impacto: a tela geralmente carrega, mas o console fica vermelho, prefetch degrada e o E2E acusa falhas.
   - Acao recomendada: em links do app para paginas publicas, usar URL absoluta `https://myurbanai.com/...` com `prefetch={false}` ou `<a>` simples; evitar `next/link` relativo para rotas que o middleware redireciona cross-origin.

### P2 - melhorias de confiabilidade

4. **Relatorios E2E ainda nao rodam em CI/staging**
   - Acao recomendada: adicionar job manual/CI com `E2E_BASE_URL`, `E2E_API_URL`, `E2E_EMAIL`, `E2E_PASSWORD`.

5. **Ausencia de `data-testid` nas telas principais**
   - Impacto: testes dependem de texto/estrutura visual.
   - Acao recomendada: adicionar ids estaveis para login, cards de recomendacao, admin KPIs e tabelas.

6. **Fluxos mutantes ainda nao executados**
   - Motivo: evitar alterar producao sem fixtures/rollback.
   - Acao recomendada: criar staging ou usuario fixture para validar convites, custos, import CSV, jobs, pricing input, sugestao aplicada e billing.

## 5. Gaps funcionais por frente

| Frente | Status funcional | Gap principal | Proximo teste |
|---|---:|---|---|
| Admin core | 87% | `price_updates` ausente quebra dashboard/stays | Reexecutar admin E2E apos migration. |
| Alpha ops | 90%+ | Precisa validar acao mutante de reprocessamento com evidencia | POST `/admin/alpha/reprocess` em fixture/alpha real. |
| ROI admin/usuario | 80%+ | APIs OK; falta conferir numeros contra dados reais | Comparar `/my-roi` e `/admin/roi` com SQL/planilha. |
| Eventos/admin | 80%+ | UI/API carregam; qualidade de base ainda depende dos coletores | Rodar coletores e validar `created24h/future`. |
| Billing/plano | 45% | `/my-plan` quebra; smoke Stripe ainda pendente | Corrigir UI/payload e rodar checkout/webhook/quota. |
| Stays | 35% | Admin Stays quebra por `price_updates`; usuario ve listings vazio | Criar tabela, manter beta privado e testar sandbox. |
| Host dashboard | 70% visual, 100% API basica | Console CORS/RSC polui navegacao | Corrigir links publicos no app. |

## 6. Recomendacao de ordem de correcao

1. Criar/aplicar migration da tabela `price_updates`.
2. Corrigir `/my-plan` para payloads sem `plan.amount`.
3. Corrigir links publicos no app autenticado para eliminar CORS/RSC.
4. Reexecutar auditor E2E admin e anfitriao.
5. Rodar fluxos mutantes controlados: alpha reprocess, pricing input, sugestao aplicada, ROI e Stripe test mode.
6. Promover o auditor para CI/staging como release gate.

## 7. Criterio para considerar modulo pronto

- **Admin pronto para operacao diaria:** >= 95% no auditor, zero P0, zero endpoint admin 500, audit log validado em pelo menos 3 mutacoes.
- **Anfitriao pronto para alpha ampliado:** >= 90% no auditor, dashboard/my-plan/my-roi sem erro visual ou console P1, recomendacao aceita/aplicada com historico e ROI.
- **Beta pago pronto:** admin e anfitriao >= 95%, Stripe smoke completo, 3-5 evidencias reais de ROI e suporte/LGPD operando.
