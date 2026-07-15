# Plano de unificacao do pricing self-service por imoveis

Data: 2026-05-24  
Escopo: plano de produto e operacao para unificar pricing self-service por quantidade de imoveis, ciclos de cobranca, Billing/Pricing Center, telas host/paywall, redirects, testes e rollout.  
Status: implementacao inicial aplicada nesta rodada; ainda falta evoluir publicacao/versionamento do admin e sync operacional de Stripe.

## Objetivo

Eliminar a duplicidade entre pagina publica, checkout autenticado, onboarding, paywall global, admin e Stripe. O usuario deve encontrar a mesma regra comercial em todas as superficies: escolhe quantidade de imoveis, escolhe ciclo, recebe faixa/plano automaticamente e assina com quota coerente no produto.

Este plano substitui a dispersao atual por uma unica fonte operacional de verdade para:

- plano aplicavel;
- quantidade contratada de imoveis;
- ciclo de cobranca;
- preco por imovel;
- desconto de ciclo;
- Price ID Stripe;
- mensagens de upgrade, downgrade, trial/cortesia e contato comercial.

## Principios

- O preco e por imovel ativo/contratado, nao por usuario.
- A recomendacao de plano e automatica pela quantidade informada ou detectada.
- O usuario pode ajustar quantidade antes do checkout e depois pelo Billing Center.
- Todas as telas exibem a mesma matriz canonica, com diferenca apenas de contexto e profundidade.
- Stripe cobra o mesmo plano, ciclo e quantidade que a UI mostra.
- Admin nao deve permitir publicar preco visual sem Price ID valido para a cobranca correspondente.
- Links antigos devem levar o usuario para a nova experiencia sem perder contexto.

## Modelo comercial canonico

### Dimensoes de cobranca

| Dimensao | Regra |
|---|---|
| Quantidade | Numero de imoveis contratados para uso ativo no Urban AI. Minimo 1. |
| Ciclo | Mensal, trimestral, semestral ou anual. |
| Plano/faixa | Calculado automaticamente a partir da quantidade. |
| Unidade economica | Preco por imovel por mes, com desconto conforme ciclo. |
| Total cobrado | Preco unitario do ciclo x quantidade contratada x duracao do ciclo, conforme modelagem Stripe. |
| Quota | `listingsContratados` deve ser igual a quantidade paga. |

### Faixas automaticas

A matriz abaixo define o contrato de produto. Os valores exatos podem ser preenchidos pelo time comercial no Admin, mas as faixas devem ser consistentes em todas as telas.

| Faixa | Quantidade | Tipo de venda | Experiencia |
|---|---:|---|---|
| Starter | 1 a 3 imoveis | Self-service | Checkout direto. |
| Profissional | 4 a 500 imoveis | Self-service | Checkout direto, com economia por ciclo. |
| Escala | 501+ imoveis | Assistida | CTA comercial, opcionalmente com checkout enterprise no futuro. |

Decisao de produto: Profissional deve cobrir ate 500 imoveis em self-service, para suportar o caso "compre 50 imoveis" com seletor de quantidade. Escala fica reservado para 501+ imoveis, contratos customizados ou onboarding assistido.

### Ciclos

| Ciclo | Uso esperado | Copy padrao |
|---|---|---|
| Mensal | Baixo atrito e validacao inicial. | "Pague mes a mes." |
| Trimestral | Compromisso leve com desconto moderado. | "Economia no ciclo trimestral." |
| Semestral | Melhor previsibilidade para hosts em operacao. | "Mais previsibilidade e menor custo mensal equivalente." |
| Anual | Melhor preco mensal equivalente. | "Melhor valor por imovel." |

As telas podem mostrar "mensal equivalente", mas checkout e recibo precisam deixar claro o ciclo real cobrado.

### Regras de quantidade

- Quantidade inicial vem do onboarding quando o usuario seleciona/importa imoveis.
- Se o usuario ja tem imoveis cadastrados, a quantidade sugerida e `max(ativos, 1)`.
- Se o usuario altera a quantidade manualmente, a faixa/plano recalcula imediatamente.
- Se quantidade passa de 500 para 501+, o fluxo muda de checkout direto para contato comercial.
- Reduzir quantidade abaixo dos imoveis ativos exige resolver excedentes antes de confirmar downgrade.
- Cadastro do imovel N+1 deve ser bloqueado com mensagem de upgrade quando excede a quota.

## Fonte de verdade

Criar um contrato operacional unico para planos e precos, consumido por todas as superficies. O contrato deve conter:

- `planKey`: `starter`, `profissional`, `escala`;
- `displayName`;
- `minListings`;
- `maxListings` ou `null` para ilimitado/assistido;
- `isSelfService`;
- `isActive`;
- `billingCycles`: mensal, trimestral, semestral, anual;
- preco unitario por ciclo;
- preco mensal equivalente por ciclo;
- `stripePriceId` por plano/ciclo;
- copy curta de beneficios;
- texto de CTA;
- URL de contato comercial;
- flags de trial/cortesia quando aplicavel.

Regra de governanca: uma alteracao so pode ser publicada quando todos os consumidores conseguirem ler a mesma versao e o sync de Stripe estiver valido.

Endpoints canonicos implementados/planejados:

- `GET /plans`: lista as faixas ativas com precos, limites, ciclos e badges.
- `GET /plans/quote?quantity=50&billingCycle=annual`: calcula no backend a faixa aplicada, preco por imovel, total mensal equivalente e total cobrado no ciclo.
- `POST /payments/create-checkout-session`: recebe `quantity` e `billingCycle`; quando `plan` vem como `auto`, resolve a faixa no backend antes de abrir Stripe.

## Admin Billing/Pricing Center

### Objetivo

Unificar configuracao comercial, verificacao Stripe, suporte a assinaturas e diagnostico de quota em um centro admin. A tela atual de pricing deve evoluir para um Billing/Pricing Center, com abas ou secoes claras.

### Secoes recomendadas

| Secao | Responsabilidade |
|---|---|
| Matriz comercial | Editar faixas, ciclos, precos unitarios, descontos, beneficios e status ativo. |
| Stripe sync | Validar Price IDs, modo test/live, produto, moeda, intervalo e valor esperado. |
| Publicacao | Rascunho, pre-visualizacao e publicar versao canonica. |
| Assinaturas | Ver cliente, plano, ciclo, quantidade, status, proxima cobranca e divergencias. |
| Quotas | Comparar imoveis ativos, contratados e excedentes por usuario. |
| Incidentes | Links para runbooks de billing, Price ID invalido e release gate. |

### Guardrails admin

- Nao permitir publicar preco self-service sem Price ID valido.
- Alertar quando o valor do Price ID divergir do preco admin.
- Bloquear ciclo ativo sem Price ID.
- Exigir justificativa para mudancas de preco ja publicadas.
- Registrar autor, data, versao anterior e nova versao.
- Diferenciar configuracao de teste e producao.
- Mostrar status "draft", "ready", "published" e "blocked".

## Telas host e paywall

### Superficies que devem usar a mesma matriz

| Superficie | Papel no funil | Comportamento esperado |
|---|---|---|
| `/precos` | Publica, descoberta | Mostra matriz canonica, simulador por quantidade e ciclo, CTA coerente. |
| Landing publica | Educacao e conversao | Mostra preco resumido a partir da matriz, com ciclo explicitado. |
| `/plans` | Checkout autenticado | Experiencia principal de selecao de quantidade/ciclo e assinatura. |
| Onboarding | Conversao apos cadastro de imoveis | Reusa seletor canonico com quantidade pre-preenchida. |
| `GlobalPaywallModal` | Bloqueio/upsell contextual | Mostra estado resumido e leva para `/plans` com contexto. |
| `/my-plan` | Gestao de assinatura | Permite ver, ajustar, cancelar, reativar e abrir portal de billing. |

### Experiencia host

1. Usuario informa ou importa quantidade de imoveis.
2. UI calcula faixa automaticamente.
3. Usuario escolhe ciclo.
4. UI mostra:
   - plano recomendado;
   - quantidade contratada;
   - preco por imovel;
   - total do ciclo;
   - economia versus mensal quando houver;
   - quota resultante.
5. Usuario confirma e segue para Stripe Checkout.
6. Apos webhook, `/my-plan` mostra plano, ciclo, quantidade e status.

### Paywall

O paywall nao deve manter logica propria de plano ou preco. Ele deve receber apenas o contexto:

- motivo do bloqueio: sem assinatura, trial encerrado, quota excedida, plano inativo ou billing pendente;
- quantidade atual de imoveis;
- quantidade necessaria;
- destino recomendado.

Comportamentos:

- Sem assinatura: CTA para `/plans?source=paywall`.
- Quota excedida: CTA para `/plans?source=quota&quantity=<necessaria>`.
- Trial/cortesia encerrada: CTA para `/plans?source=trial-ended`.
- Billing pendente: CTA para `/my-plan?source=billing-issue`.
- 501+ imoveis: CTA de contato comercial com contexto preenchido.

## Redirects e aliases

### Regra geral

Todo link antigo deve cair em uma rota nova com intencao preservada. Redirects devem acontecer antes de guards client-side sempre que possivel.

| Origem | Destino esperado | Observacao |
|---|---|---|
| `/price` | `/precos` se publico; `/plans` apenas quando a origem exigir checkout autenticado. | Nao deve mandar para `/painel`. |
| `/plans/v2` | `/plans` preservando query params. | Redirect server-side ou middleware antes do AuthGuard. |
| `/onboarding/payment/price` | `/plans?source=onboarding` ou onboarding no passo de planos. | Nao deve reiniciar o onboarding sem contexto. |
| Links de upsell antigos | `/plans?source=upsell` com query preservada. | Evitar tela vazia em usuario deslogado. |
| CTA comercial Escala | URL comercial real, centralizada em configuracao. | Nunca usar placeholder. |

### Parametros padrao

| Parametro | Uso |
|---|---|
| `source` | Origem do fluxo: public, onboarding, paywall, quota, my-plan, upsell. |
| `quantity` | Quantidade sugerida de imoveis. |
| `cycle` | Ciclo sugerido quando houver. |
| `plan` | Plano sugerido, derivado da quantidade. |
| `returnTo` | Rota para voltar apos checkout/cancelamento. |

## Testes

### Unitarios e contrato

- Calculo de faixa por quantidade: 1, 3, 4, 50, 500, 501.
- Calculo de total por ciclo e quantidade.
- Normalizacao de quantidade invalida, zero, vazia ou decimal.
- Selecao de Price ID por plano/ciclo.
- Bloqueio de publicacao admin quando Price ID falta ou diverge.
- Filtro de planos ativos em todos os consumidores.

### Integracao backend

- Criar checkout com plano, ciclo e quantidade corretos.
- Webhook persiste status, ciclo e `listingsContratados`.
- `/payments/listings-quota` reflete assinatura ativa.
- Cadastro N+1 falha com `LISTINGS_QUOTA_EXCEEDED` antes de criar dado parcial.
- Cancelamento ou falha de pagamento atualiza estado de billing.
- Downgrade com imoveis excedentes exige resolucao antes de aplicar quota menor.

### E2E frontend

- `/precos` mostra mesma matriz que `/plans`.
- Landing nao exibe preco conflitante.
- `/plans` recalcula faixa ao mudar quantidade.
- Onboarding abre o pricing com quantidade pre-preenchida.
- Paywall de quota leva para `/plans` com quantidade necessaria.
- `/my-plan` fica acessivel mesmo quando assinatura esta ausente, cancelada ou com pagamento pendente.
- `/price`, `/plans/v2` e `/onboarding/payment/price` redirecionam para destinos corretos.
- CTA Escala usa contato comercial real.

### Smoke Stripe e release

Antes de ativar campanha ou cobrar usuarios reais:

- rodar o sync check no Billing/Pricing Center;
- completar checkout em test mode para Starter mensal/anual e Profissional mensal/anual;
- validar Price IDs trimestral/semestral antes de divulgar esses ciclos;
- confirmar webhook, quota e cancelamento;
- registrar evidencia no release gate;
- confirmar que test/live nao estao misturados.

## Rollout

### Fase 0 - Decisao comercial

- Confirmar faixas: Starter 1-3, Profissional 4-500, Escala 501+.
- Definir precos canonicos por plano/ciclo.
- Definir politica de trial, cortesia alpha e convite.
- Confirmar meios de pagamento divulgados versus habilitados no Stripe.
- Confirmar contato comercial oficial para Escala.

### Fase 1 - Contrato e admin

- Criar versao canonica da matriz.
- Evoluir admin para Billing/Pricing Center.
- Adicionar validacao Stripe antes de publicacao.
- Registrar auditoria de alteracoes.

### Fase 2 - Superficies host

- Atualizar `/plans` como experiencia principal.
- Reusar a mesma matriz em `/precos`, landing, onboarding e paywall global.
- Liberar `/my-plan` como rota de gestao mesmo sem assinatura ativa.
- Padronizar copy de ciclo, quantidade, trial e meios de pagamento.

### Fase 3 - Redirects e compatibilidade

- Corrigir `/price`.
- Corrigir `/plans/v2`.
- Corrigir `/onboarding/payment/price`.
- Preservar query params de source, quantity, cycle e returnTo.

### Fase 4 - Testes e staging

- Rodar suites unitarias, integracao e E2E.
- Rodar smoke Stripe em staging.
- Validar evidencias de quota N+1, webhook e cancelamento.
- Conferir SEO/JSON-LD para nao publicar preco antigo.

### Fase 5 - Producao assistida

- Ativar por feature flag ou cohort pequeno.
- Monitorar checkout iniciado, checkout concluido, webhook recebido, quota excedida e tickets de suporte.
- Manter fallback para esconder ciclos nao validados.
- Revisar metricas em 24h, 72h e 7 dias.

### Fase 6 - Consolidacao

- Remover aliases legados que nao receberem trafego relevante.
- Arquivar copies antigas de preco.
- Transformar incidentes e aprendizados em runbook.
- Revisar conversao por faixa e ciclo.

## Criterios de aceite

O plano esta pronto para implementacao quando:

- existe uma matriz canonica aprovada;
- admin consegue validar Stripe antes de publicar;
- todas as superficies exibem plano/ciclo/quantidade consistentes;
- redirects antigos levam para a nova jornada sem tela vazia;
- checkout cobra a mesma quantidade mostrada na UI;
- quota ativa bate com `listingsContratados`;
- N+1 e bloqueado sem criar imovel parcial;
- `/my-plan` permite resolver billing sem ficar atras de paywall;
- testes e smoke Stripe passam em staging;
- rollout tem owner, feature flag e criterio de rollback.

## Riscos e mitigacoes

| Risco | Mitigacao |
|---|---|
| Preco visual diferente do Stripe | Publicacao bloqueada por sync check. |
| Usuario compra menos imoveis do que usa | Quantidade sugerida pelo maior valor entre ativos e selecao atual. |
| Downgrade gera excedente | Exigir arquivar/remover excedentes antes de aplicar. |
| Links antigos quebram campanhas | Redirects server-side com query preservada. |
| Escala parece self-service mas nao cobra | CTA assistida clara para 501+ ate checkout enterprise existir. |
| Trial/cortesia confunde cobranca | Uma politica unica aprovada antes do rollout. |
| Pix/boleto prometido sem estar habilitado | Copy publica bloqueada ate Stripe suportar o metodo divulgado. |

## Decisoes pendentes

- Matriz final de precos por plano e ciclo.
- Politica final de trial, cortesia alpha e convite.
- Se Escala tera somente contato comercial ou checkout assistido em curto prazo.
- Se os ciclos trimestral e semestral entram no primeiro rollout publico ou ficam ocultos ate smoke completo.
- Texto legal/comercial para mudancas de preco em assinaturas existentes.
