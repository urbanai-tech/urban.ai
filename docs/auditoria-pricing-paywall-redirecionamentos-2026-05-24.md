# Auditoria de Pricing, Paywall e Redirecionamentos

Data: 2026-05-24  
Escopo: telas e fluxos de precificacao, paywall, checkout, plano atual, aliases e redirecionamentos.

Atualizacao pos-implementacao: os achados abaixo registram o estado auditado antes da correcao. Nesta mesma rodada foram corrigidos os fluxos principais: checkout self-service por quantidade, alias `/plans/v2`, `/price`, `/onboarding/payment/price`, paywall global, onboarding, `/my-plan`, contato comercial e faixas 1-3 / 4-500 / 501+.

## Resumo executivo

A causa raiz dos relatos de usuarios parece ser a existencia de varias fontes de verdade para preco, ciclo, limite de imoveis, trial e rota de conversao.

Hoje o produto mostra precos em pelo menos quatro lugares diferentes:

- pagina publica `/precos`, com matriz hardcoded;
- landing publica, com precos resumidos;
- `/plans`, autenticada, puxando planos do backend e usando a matriz F6.5;
- paywalls legados no onboarding e no modal global, ainda no modelo mensal/anual.

Essas superficies nao contam a mesma historia. O usuario pode ver `Starter R$ 149/mensal` em `/precos`, `Starter R$ 97` na landing, receber recomendacao diferente por quantidade de imoveis no onboarding/paywall, ser redirecionado de `/price` para `/painel`, e encontrar uma CTA de consultor com WhatsApp placeholder.

## Mapa das telas auditadas

| Rota/superficie | Estado atual | Risco |
| --- | --- | --- |
| `/precos` | Pricing publico hardcoded com 4 ciclos. | Diverge do backend/admin/landing; WhatsApp placeholder. |
| `/landing` | Mostra `R$ 97` e `R$ 67` como precos resumidos. | Nao deixa claro que sao equivalentes anuais; conflita com mensal publico. |
| `/plans` | Checkout pos-login oficial com `PricingCalculatorV2`. | Protegida por auth; depende de planos/Stripe corretos no backend. |
| `/plans/v2` | Alias client-side para `/plans`. | Pode nao redirecionar antes do `AuthGuard`; links antigos ficam em tela vazia. |
| `/price` | Rota legada que redireciona para `/painel`. | Quem espera pricing cai no painel. |
| `/onboarding` passo 5 | Paywall interno mensal/anual. | Nao usa a matriz oficial de 4 ciclos. |
| `/onboarding/payment/price` | Rota legada que redireciona para `/onboarding`. | Quem esperava etapa de pagamento volta ao inicio. |
| `GlobalPaywallModal` | Paywall modal global mensal/anual. | Mostra planos inativos, precos legados e CTA quebrada. |
| `/my-plan` | Plano atual e portal de billing dentro de `HostShell`. | Usuario sem assinatura ativa pode ficar preso atras do proprio paywall. |

## Achados criticos

### P0 - Precos oficiais divergem entre publico, landing, backend e testes

Evidencias:

- `/precos` hardcodeia `Starter` como `149 / 129 / 109 / 97` e `Profissional` como `99 / 85 / 72 / 67` em `Urban-front-main/src/app/(public)/precos/page.tsx:31`.
- A landing mostra `R$ 97` e `R$ 67` em `Urban-front-main/src/app/(public)/landing/page.tsx:738` e `Urban-front-main/src/app/(public)/landing/page.tsx:750`, sem deixar claro no card que e o equivalente anual.
- O backend semeia valores diferentes: `Starter priceMonthly 97`, `priceAnnualNew 58`; `Profissional priceMonthly 197`, `priceAnnualNew 118` em `urban-ai-backend-main/src/plans/plans.service.ts:38` e `urban-ai-backend-main/src/plans/plans.service.ts:74`.
- Os testes financeiros esperam a matriz publica `149 / 129 / 109 / 97` e `99 / 85 / 72 / 67` em `urban-ai-backend-main/src/admin/finance.service.spec.ts:63`.
- O JSON-LD publico anuncia `Starter 149` e `Profissional 99` em `Urban-front-main/src/app/(public)/precos/page.tsx:71`, enquanto o SEO compartilhado anuncia `Starter 97` e `Profissional 67` como ciclo anual em `Urban-front-main/src/app/lib/seo.tsx:161`.

Impacto:

O usuario nao consegue saber qual preco e real. Marketing, checkout, SEO e backend podem prometer/cobrar numeros diferentes. Isso tambem aumenta risco de chargeback e suporte manual.

Recomendacao:

Escolher uma matriz canonica e remover hardcodes. O ideal e uma unica fonte de verdade para plano/ciclo/limite/preco, consumida por `/precos`, `/landing`, `/plans`, onboarding e paywall.

### P0 - Paywalls internos usam modelo antigo mensal/anual

Evidencias:

- `/plans` e o unico fluxo que usa a matriz F6.5 de 4 ciclos via `PricingCalculatorV2` em `Urban-front-main/src/app/plans/page.tsx:10` e `Urban-front-main/src/app/componentes/PricingCalculatorV2.tsx:15`.
- O onboarding passo 5 calcula apenas `annual` ou `monthly` em `Urban-front-main/src/app/onboarding/page.tsx:1476`.
- O onboarding renderiza `plan.priceAnnual` ou `plan.price` em `Urban-front-main/src/app/onboarding/page.tsx:2285`.
- O modal global tambem envia apenas `annual` ou `monthly` em `Urban-front-main/src/app/componentes/GlobalPaywallModal.tsx:72` e renderiza `plan.priceAnnual` ou `plan.price` em `Urban-front-main/src/app/componentes/GlobalPaywallModal.tsx:169`.

Impacto:

Um usuario que ve 4 ciclos em `/precos` ou `/plans` pode cair num paywall que so oferece 2 ciclos, com campos legados. Isso e uma das inconsistencias mais visiveis da jornada.

Recomendacao:

Extrair um componente unico de selecao de plano/ciclo usado por `/plans`, onboarding e `GlobalPaywallModal`, ou reaproveitar `PricingCalculatorV2` com variacoes de contexto.

### P0 - `/price` redireciona para `/painel`, nao para pricing

Evidencias:

- `Urban-front-main/src/app/price/page.tsx:7` executa `redirect("/painel")`.
- `Urban-front-main/src/middleware.ts:59` trata `/price` como prefixo de app, nao como rota publica.
- Em teste local, `/price` terminou em `/painel`.

Impacto:

Qualquer link antigo, digitacao intuitiva ou campanha usando `/price` joga o usuario para dentro do app, sem explicacao. Para usuario deslogado, isso pode parecer tela quebrada.

Recomendacao:

Trocar o destino para `/precos` no host publico ou para `/plans` apenas quando autenticado e com intencao explicita de checkout.

### P0 - CTA de consultor usa WhatsApp placeholder

Evidencias:

- `/precos` usa `https://wa.me/seunumerodevendas` em `Urban-front-main/src/app/(public)/precos/page.tsx:220`.
- `GlobalPaywallModal` usa o mesmo placeholder em `Urban-front-main/src/app/componentes/GlobalPaywallModal.tsx:65`.
- O onboarding usa o mesmo placeholder em `Urban-front-main/src/app/onboarding/page.tsx:2319`.
- O checklist de go-live ja registra o problema em `docs/go-live-manual-checklist.md:308`.

Impacto:

O plano Escala e qualquer caminho "falar com consultor" parecem falsos ou quebrados no momento de maior intencao de compra.

Recomendacao:

Centralizar a URL comercial em env/config publica validada e bloquear deploy se o valor estiver com placeholder.

## Achados altos

### P1 - Limite de imoveis do Profissional e conflitante

Evidencias:

- `/precos` comunica `Profissional` para `4 a 19 imoveis` em `Urban-front-main/src/app/(public)/precos/page.tsx:164`.
- O backend define `propertyLimit: 10` para `Profissional` em `urban-ai-backend-main/src/plans/plans.service.ts:92`.
- O onboarding recomenda `Profissional` so ate 10 imoveis em `Urban-front-main/src/app/onboarding/page.tsx:2202`.
- O modal global tambem recomenda `Profissional` so ate 10 em `Urban-front-main/src/app/componentes/GlobalPaywallModal.tsx:50`.

Impacto:

Um host com 11 a 19 imoveis pode comprar/esperar Profissional pela pagina publica, mas ser empurrado para Escala no paywall ou bater quota no backend.

Recomendacao:

Decidir oficialmente se Profissional vai ate 10 ou 19 imoveis e atualizar publico, backend, paywalls, seed, admin e testes juntos.

### P1 - `/plans/v2` e alias client-side atras de `AuthGuard`

Evidencias:

- `Urban-front-main/src/app/plans/v2/page.tsx:20` faz `router.replace(...)` no client.
- `Urban-front-main/src/app/plans/layout.tsx:14` envolve a arvore em `AuthGuard`.
- Comentarios ainda citam `/plans/v2?upsell=1` em `Urban-front-main/src/app/componentes/ListingsQuotaGuard.tsx:18`.
- Em teste local, `/plans/v2?upsell=1` permaneceu nessa URL com conteudo vazio/cookie banner, sem completar o redirect.

Impacto:

Links antigos podem ficar presos antes do alias rodar. Isso e especialmente ruim para emails de upsell, quota ou reativacao.

Recomendacao:

Mover o redirect para middleware/server component fora do layout protegido, ou remover a rota antiga e padronizar todos os links para `/plans`.

### P1 - `/onboarding/payment/price` volta para o inicio do onboarding

Evidencias:

- `Urban-front-main/src/app/onboarding/payment/price/page.tsx:7` faz `redirect("/onboarding")`.
- Em teste local, a rota terminou no passo inicial "Bem-vindo ao Urban AI", nao na etapa de pagamento.

Impacto:

Usuario vindo de link antigo de pagamento perde contexto e pode achar que o fluxo reiniciou.

Recomendacao:

Redirecionar para um estado de onboarding com passo de plano preservado, ou para `/plans?source=onboarding`, mantendo query params relevantes.

### P1 - Modal global pode mostrar planos inativos

Evidencias:

- `/plans` filtra `plans.filter((p) => p.isActive)` em `Urban-front-main/src/app/plans/page.tsx:57`.
- `GlobalPaywallModal` renderiza `plans.map(...)` sem filtro em `Urban-front-main/src/app/componentes/GlobalPaywallModal.tsx:143`.
- O admin permite editar `isActive` em `Urban-front-main/src/app/admin/pricing-config/page.tsx:239`.

Impacto:

Um plano desligado no admin pode sumir de `/plans`, mas continuar aparecendo no paywall global.

Recomendacao:

Aplicar o mesmo filtro de planos ativos em todos os consumidores de `getPlans()`.

### P1 - Admin altera display, mas nao garante cobranca Stripe igual

Evidencias:

- O admin diz que mudancas refletem imediatamente em `/plans` em `Urban-front-main/src/app/admin/pricing-config/page.tsx:108`.
- A propria tela alerta que editar display sem atualizar Stripe causa mismatch em `Urban-front-main/src/app/admin/pricing-config/page.tsx:139`.
- O backend escolhe Stripe Price ID por plano/ciclo em `urban-ai-backend-main/src/payments/stripe-price-id.resolver.ts:16`.

Impacto:

Mesmo quando `/plans` esta "certo" visualmente, o Stripe pode cobrar outro valor se os Price IDs nao foram atualizados.

Recomendacao:

Bloquear ou sinalizar checkout quando o sync check estiver inconsistente. Alternativamente, criar/atualizar Prices automaticamente via fluxo admin controlado.

### P1 - `my-plan` pode ficar atras do paywall que deveria ajudar a resolver

Evidencias:

- `my-plan` usa `HostShell` em `Urban-front-main/src/app/my-plan/layout.tsx:4`.
- `HostShell` aplica `PaymentCheckGuard` em `Urban-front-main/src/app/componentes/HostShell.tsx:21`.
- `PaymentCheckGuard` abre `GlobalPaywallModal` quando a assinatura nao esta `active` ou `trialing` em `Urban-front-main/src/app/context/PaymentCheckGuard.tsx:30`.
- A propria pagina tem estado "Nenhuma assinatura encontrada" em `Urban-front-main/src/app/my-plan/page.tsx:128`.

Impacto:

Usuario sem assinatura ativa precisa justamente de `/my-plan` para entender estado, portal, reativacao ou erro, mas pode receber o modal global por cima.

Recomendacao:

Tratar `/my-plan` como excecao do guard, ou criar um estado de billing dedicado que nao bloqueie a pagina de gerenciamento.

## Achados medios

### P2 - Trial, alpha, cortesia e teste gratis usam narrativas diferentes

Evidencias:

- `/precos` fala em "7 a 14 dias gratuitos sem cartao" em `Urban-front-main/src/app/(public)/precos/page.tsx:291`.
- A landing diz "100% gratuito" e "voce so ve preco no convite" em `Urban-front-main/src/app/(public)/landing/page.tsx:1112`.
- Os termos dizem que a primeira mensalidade pode ser cortesia, mas "nao configura promocao ou oferta de teste gratuito" em `Urban-front-main/src/app/(public)/legalContent.ts:231`.
- O backend suporta `plan === 'trial'` em `urban-ai-backend-main/src/payments/payments.service.ts:269` e usa `TRIAL_PERIOD_DAYS` em `urban-ai-backend-main/src/payments/payments.service.ts:285`.
- O componente de assinatura rotula `trialing` como `alpha` em `Urban-front-main/src/app/componentes/Subscription.tsx:43`.

Impacto:

O usuario pode entender que existe teste gratis, cortesia, alpha ou convite pago como conceitos diferentes, quando o produto parece tratar tudo no mesmo funil.

Recomendacao:

Definir uma unica politica comercial: waitlist, convite, trial, cortesia alpha e cobranca. Depois alinhar landing, `/precos`, termos, email e UI interna.

### P2 - Copy de Pix/boleto nao bate com Checkout

Evidencias:

- `/precos` promete "cartao, debito, Pix e boleto" em `Urban-front-main/src/app/(public)/precos/page.tsx:295`.
- O backend cria Checkout com `payment_method_types: ['card']` em `urban-ai-backend-main/src/payments/payments.service.ts:303`.

Impacto:

Usuario que espera Pix/boleto pode nao encontrar essa opcao no Checkout.

Recomendacao:

Ou habilitar os metodos de pagamento prometidos no Stripe, ou trocar a copy publica para cartao enquanto Pix/boleto nao estiverem ativos.

### P2 - CTA "Ja tem convite? Entrar" aponta para cadastro/waitlist

Evidencias:

- `SIGNUP_URL` em `/precos` aponta para `${APP_URL}/create` em `Urban-front-main/src/app/(public)/precos/page.tsx:27`.
- O texto do botao e "Ja tem convite? Entrar" em `Urban-front-main/src/app/(public)/precos/page.tsx:380`.

Impacto:

O texto sugere login/aceite de convite, mas o destino e cadastro. Em modo pre-lancamento, isso pode virar waitlist.

Recomendacao:

Separar claramente: "Entrar" -> `/login`; "Aceitar convite" -> rota de convite; "Entrar na lista" -> `/create`.

### P2 - SEO estruturado repete conflito de preco

Evidencias:

- `/precos` injeta ofertas `149` e `99` em `Urban-front-main/src/app/(public)/precos/page.tsx:71`.
- `pricingJsonLd()` injeta `97` e `67` em `Urban-front-main/src/app/lib/seo.tsx:161`.

Impacto:

Mesmo que o usuario nao veja, buscadores e previews podem receber precos conflitantes.

Recomendacao:

Gerar JSON-LD da mesma matriz canonica e explicitar o ciclo (`mensal`, `anual equivalente`, etc.).

## Evidencia de runtime local

Testes manuais em dev local:

- `/precos`: renderizou matriz `Starter 149/129/109/97`, `Profissional 99/85/72/67` e CTA Escala com `wa.me/seunumerodevendas`.
- `/plans`: retornou pagina protegida; em navegador sem sessao, conteudo principal ficou vazio enquanto o guard/autenticacao resolvia.
- `/plans/v2?upsell=1`: permaneceu na URL antiga e nao mostrou pricing.
- `/price`: redirecionou para `/painel`.
- `/onboarding/payment/price`: redirecionou para `/onboarding`, passo inicial.

## Fila recomendada de correcao

1. Definir a matriz comercial canonica: precos, ciclos, descontos, limites e nomes.
2. Centralizar fonte de verdade de planos e consumir em `/precos`, landing, `/plans`, onboarding e modal global.
3. Corrigir `/price` para `/precos` ou remover da navegacao publica.
4. Transformar `/plans/v2` em redirect server-side/middleware antes do `AuthGuard`.
5. Atualizar onboarding e `GlobalPaywallModal` para o mesmo seletor de plano de `/plans`.
6. Trocar `wa.me/seunumerodevendas` por contato real centralizado em config.
7. Alinhar Profissional 10 vs 19 imoveis em backend, publico e recomendadores.
8. Resolver politica de trial/cortesia/alpha e atualizar copy, termos, emails e UI.
9. Alinhar meios de pagamento prometidos com `payment_method_types` do Stripe.
10. Liberar `/my-plan` como rota de gerenciamento mesmo sem assinatura ativa.
11. Adicionar smoke E2E para `/precos`, `/plans`, `/plans/v2`, `/price`, `/onboarding/payment/price`, `GlobalPaywallModal` e `/my-plan` cobrindo URL final, preco exibido e CTA.

## Decisao pendente

A decisao mais importante antes de corrigir codigo e escolher qual matriz e verdadeira:

- Modelo A: matriz publica atual (`Starter 149/129/109/97`, `Profissional 99/85/72/67`);
- Modelo B: seed backend atual (`Starter 97/82/73/58`, `Profissional 197/167/148/118`);
- Modelo C: nova matriz revisada.

Sem essa decisao, qualquer ajuste de tela pode apenas trocar uma inconsistencia por outra.
