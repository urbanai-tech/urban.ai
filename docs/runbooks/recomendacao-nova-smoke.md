# Runbook - smoke de recomendacao nova

Data: 2026-05-14
Escopo: provar, em ambiente controlado, que o motor consegue criar ou atualizar pelo menos uma `AnalisePreco` com data atual antes de liberar M2/beta fechado.

## Quando rodar

Rode este smoke antes de promover qualquer release que dependa de recomendacoes novas, e sempre que uma das condicoes abaixo acontecer:

- `pricing.last24h` estiver zerado no `/admin/dashboard`.
- `events.next30d` tiver sido populado por coletor ou fallback manual.
- Uma mudanca tocar eventos, geocoder, propriedade, `AnalisePreco`, pricing ou dashboard.
- O beta fechado precisar validar valor com um anfitriao real.

## Pre-condicoes

Antes de reprocessar:

- Ambiente controlado definido: staging, prod assistido ou base local com dump aprovado.
- Usuario admin autenticado.
- Pelo menos 1 imovel ativo com endereco/cidade/UF coerentes e preco base preenchido.
- Eventos futuros na regiao do imovel. Para beta, use a meta operacional de 100 eventos SP/30d; se estiver abaixo, siga `docs/runbooks/eventos-fallback-manual.md` primeiro.
- Nenhum job massivo rodando ao mesmo tempo.
- Responsavel de produto disponivel para aprovar se a recomendacao faz sentido.

## Escolha do imovel

Priorize um imovel que:

- esteja em Sao Paulo ou regiao ja coberta;
- tenha coordenadas ou endereco completo;
- tenha preco diario atual conhecido;
- tenha evento futuro proximo nos proximos 30 dias;
- possa ser usado como amostra sem impacto comercial indevido.

Se existir cohort alpha, use o fluxo admin atual de `/admin/alpha` e `POST /admin/alpha/reprocess` para reprocessar o usuario alpha. Caso contrario, use o job/endereco operacional equivalente ja disponivel no ambiente e limite a execucao a um imovel ou usuario.

## Passo a passo

1. Abra `/admin/dashboard` e registre:
   - `events.next30d`;
   - `pricing.last24h`;
   - `pricing.last30d`;
   - `pricing.futureRecommendations`;
   - `pricing.activeWithFuturePricing / pricing.activeAddresses`;
   - `pricing.coveragePercent`.
2. Confirme que ha evento futuro relevante para a regiao do imovel escolhido.
3. Abra `/admin/alpha` ou o job controlado equivalente.
4. Rode o reprocessamento apenas para o usuario/imovel definido.
5. Registre o retorno do job: criadas, atualizadas, puladas e motivos de falha.
6. Reabra `/admin/dashboard` e confirme se `pricing.last24h` aumentou ou se a cobertura mudou de forma explicavel.
7. No dashboard do usuario ou na consulta admin, localize a recomendacao gerada/atualizada.
8. Verifique os campos minimos da `AnalisePreco`:
   - `criadoEm` ou `createdAt` com data de hoje;
   - evento futuro associado;
   - preco atual e preco sugerido preenchidos;
   - motivo/razao visivel para operador ou usuario;
   - variacao dentro do guardrail esperado.
9. Se o produto aprovar a recomendacao, registre aceite/rejeicao/aplicacao conforme o fluxo disponivel.
10. Anexe evidencias no registro de release.

## Criterios de aceite

O smoke passa quando:

- pelo menos 1 `AnalisePreco` e criada ou atualizada com data de hoje;
- o evento associado esta no futuro;
- o motivo da recomendacao aparece no dashboard ou card de usuario;
- o preco sugerido nao viola guardrails obvios;
- o dashboard admin reflete a execucao sem falso sucesso;
- se houver falha, o motivo fica claro e acionavel.

O smoke nao passa quando:

- o job retorna sucesso sem criar, atualizar ou explicar skips;
- a recomendacao aponta evento passado;
- `criadoEm` permanece antigo apos reprocessamento;
- nao ha motivo/explicacao visivel;
- a cobertura continua baixa sem plano de eventos, geocoder ou dados de imovel.

## Triage rapido

| Sintoma | Provavel causa | Acao |
|---|---|---|
| `events.next30d < 100` | Poucos eventos futuros | Rodar fallback manual de eventos antes do smoke. |
| Sem match para o imovel | Endereco/cidade/coords incompletos | Rodar geocoder em `/admin/jobs` e revisar cadastro do imovel. |
| Job cria zero e atualiza zero | Filtro muito restrito ou imovel sem preco base | Conferir ativo, preco diario, cidade/UF e evento proximo. |
| Atualiza, mas `criadoEm` fica antigo | Recalculo nao toca timestamp | Bloquear M2 e corrigir D3. |
| Recomendacao sem motivo | Campo de razao nao propagado para dashboard/card | Bloquear D7 antes de beta com usuarios. |
| Sugestao fora de guardrail | Motor sem limite ou dado de preco ruim | Bloquear release e revisar estrategia/inputs. |

## Registro de evidencia

Use este bloco no release gate:

```text
Smoke de recomendacao nova
Data/hora:
Ambiente:
Responsavel:
Usuario/imovel testado:
Endpoint ou tela usada:
events.next30d antes/depois:
pricing.last24h antes/depois:
pricing.coveragePercent antes/depois:
AnalisePreco id:
criadoEm/createdAt:
Evento associado:
Preco atual:
Preco sugerido:
Motivo visivel? sim/nao
Guardrail ok? sim/nao
Resultado: aprovado/bloqueado
Pendencias:
```

## Saida esperada para M2

Para considerar F3 madura para beta fechado:

- este smoke deve passar pelo menos uma vez no ambiente que alimentara o beta;
- `pricing.coveragePercent` deve chegar a 70% ou mais dos imoveis ativos em regioes cobertas;
- recomendacoes novas precisam aparecer diariamente ou por job manual controlado;
- falhas comuns devem virar alerta, job admin ou tarefa explicita no roadmap.
