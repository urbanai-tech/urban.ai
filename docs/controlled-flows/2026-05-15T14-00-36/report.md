# Relatorio de Fluxos Controlados - Alpha/Host

Data: 2026-05-15
Ambiente: producao
App/API: https://app.myurbanai.com / https://urbanai-production-85fd.up.railway.app
Usuario: gustavo8gouveia@hotmail.com

## Resumo executivo

| Frente | Resultado | Evidencia |
|---|---|---|
| Login/auth | OK | Login autenticado retornou token e permitiu chamadas admin/host. |
| Imoveis/quota | OK | 9 imoveis ativos; quota alpha 30; `podeAdicionar=true`. |
| Preco base manual | OK | Uma propriedade foi alterada de R$ 150 para R$ 151 e revertida para R$ 150. Historico subiu de 1 para 3 entradas. |
| Reprocessamento alpha | OK | Job `alpha-pricing-reprocess` concluiu com sucesso: 1 usuario, 9 propriedades, 9 processadas, 0 falhas. |
| Recomendacoes | OK | Reprocess gerou/atualizou recomendacoes para as propriedades; primeira recomendacao validada no fluxo controlado. |
| Aceite/aplicacao/resultado | OK | Recomendacao `a5efc50c-36a4-4886-bfa8-9147d5c20d64` aceita, aplicada manualmente a R$ 171 e marcada com resultado `unknown`. |
| ROI host | OK | `/roi/me` passou a refletir 1 recomendacao aceita/aplicada e ganho projetado de R$ 21,00. |
| Billing/quota | OK | `/payments/listings-quota` retornou `contratados=30`, `ativos=9`, `podeAdicionar=true`. |
| Assinatura alpha | OK | `/payments/getSubscription` retornou plano alpha trialing com quantidade 30 e valor R$ 0. |
| Stripe sync | Parcial | Stripe key configurada; sync check mostrou 8 ciclos, 4 OK e 4 missing. |
| Stripe checkout | OK sem cobranca | Criacao de checkout session mensal/profissional retornou `cs_test_...`; nenhum pagamento foi aberto/concluido. |
| Stays | Bloqueado esperado | Admin health indica beta privado: faltam `STAYS_API_BASE_URL` e `STAYS_TOKEN_ENCRYPTION_KEY`; listings Stays = 0. |

## Detalhes do reprocessamento alpha

- Job: `alpha-pricing-reprocess`
- Status: `success`
- Duracao aproximada: 183,5s
- Usuarios: 1
- Propriedades: 9
- Processadas: 9
- Falhas: 0
- Eventos futuros considerados por propriedade: 98
- Para propriedades em Perdizes/Pinheiros, houve criacao/atualizacao de recomendacoes com filtros de qualidade.

## Recomendacao aplicada no smoke

- ID: `a5efc50c-36a4-4886-bfa8-9147d5c20d64`
- Imovel: Apartamento em Perdizes
- Evento: Brasil Brau 2026
- Data do evento: 2026-06-09
- Fonte: Firecrawl
- Preco atual: R$ 150
- Preco sugerido/aplicado: R$ 171
- Lift: R$ 21 / 14%
- Status final: `applied_manual`
- Resultado real: `unknown`
- Receita real/noites: ainda nao informado

## Gaps que continuam

1. Stripe ainda nao esta completo para beta pago: 4 de 8 price cycles estao missing no sync check.
2. Stays nao pode executar push/rollback porque esta corretamente bloqueado em beta privado e sem listings/sandbox.
3. O smoke registrou aplicacao controlada, mas ainda nao prova reserva real; precisamos substituir `unknown` por `booked/not_booked` quando Gustavo observar o resultado.
4. O endpoint de recomendacao retorna dados sensiveis demais nas respostas internas; vale sanitizar entidades relacionadas antes de expor objetos completos em PATCHs.

## Veredito

Os fluxos controlados principais do alpha estao operacionais: preco base com historico, reprocessamento, recomendacao, aceite, aplicacao e ROI. O produto esta pronto para acompanhamento alpha real com Gustavo, desde que Stripe pago e Stays automatico continuem tratados como gates separados.
