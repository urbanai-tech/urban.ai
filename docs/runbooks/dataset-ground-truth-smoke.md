# Runbook - ground truth e snapshots do dataset

Data: 2026-05-14
Escopo: confirmar que uma recomendacao aceita vira dado utilizavel para qualidade/ROI, com preco aplicado registrado e `PriceSnapshot` gerado.

## Quando rodar

Rode este smoke:

- depois do smoke de recomendacao nova passar;
- antes de liberar M2/beta fechado para novos anfitrioes;
- depois de mudancas em `AnalisePreco`, `PriceSnapshot`, dashboard, dataset collector ou jobs admin;
- semanalmente durante beta fechado, para garantir que o dataset proprio esta crescendo.

## Pre-condicoes

- Pelo menos 1 `AnalisePreco` recente e aprovada pelo produto.
- Usuario dono do imovel ou admin assistindo o fluxo.
- Preco aplicado real ou simulado de forma controlada para o beta.
- `/admin/jobs` disponivel para rodar snapshot manual quando necessario.
- `/admin/dashboard` carregando indicadores de dataset/pricing.
- Nao usar dados inventados em ambiente de producao sem marcar claramente como teste.

## Passo a passo

1. Abra `/admin/dashboard` e registre os indicadores de dataset:
   - snapshots totais;
   - snapshots recentes;
   - preco aplicado capturado;
   - bloqueios/readiness exibidos no painel.
2. Escolha uma recomendacao recente gerada pelo runbook `docs/runbooks/recomendacao-nova-smoke.md`.
3. No dashboard do usuario, aceite ou rejeite a recomendacao conforme a decisao real do anfitriao.
4. Se a sugestao foi aceita, registre o preco realmente aplicado na UI. Se precisar validar via API, use o fluxo autenticado de `PATCH /sugestoes-preco/:id/aplicado`.
5. Confirme que a `AnalisePreco` ficou com:
   - status/aceite coerente;
   - `precoAplicado` preenchido;
   - `aplicadoEm` ou timestamp equivalente preenchido;
   - propriedade/listing associado.
6. Abra `/admin/jobs` e rode o snapshot manual de dataset para o escopo controlado.
7. Confirme que o resultado do job nao mascara erro: deve mostrar criados, atualizados, pulados e motivo dos skips.
8. Verifique que existe `PriceSnapshot` relacionado ao imovel/listing, com preco base e, quando aplicavel, `appliedPriceCents`.
9. Volte ao `/admin/dashboard` e confira se o indicador de preco aplicado/snapshot mudou de forma explicavel.
10. Registre a evidencia no release gate.

## Criterios de aceite

O smoke passa quando:

- pelo menos 1 recomendacao aceita tem preco aplicado registrado;
- o preco aplicado chega a `AnalisePreco` e/ou `PriceSnapshot`;
- o snapshot manual retorna sucesso real ou motivo de skip acionavel;
- o dashboard admin reflete a mudanca;
- nenhum dado de teste fica misturado como caso real sem identificacao.

O smoke bloqueia F4/M2 quando:

- usuario consegue aceitar sugestao, mas nao consegue registrar preco aplicado;
- `PriceSnapshot` continua zerado apos snapshot manual com imovel elegivel;
- job retorna sucesso sem criar/atualizar e sem motivo de skip;
- nao ha como ligar snapshot, imovel, recomendacao e preco aplicado;
- os dados capturados nao permitem comparar recomendado vs. aplicado.

## Janela de 7 dias

Depois do primeiro smoke passar, acompanhe diariamente:

| Dia | Evidencia minima | Decisao |
|---|---|---|
| D0 | 1 preco aplicado + snapshot manual | Libera beta assistido inicial se F2/F3 tambem passaram. |
| D1-D3 | Snapshots diarios crescendo ou motivo de skip documentado | Ajustar crawler/dataset antes de ampliar beta. |
| D4-D7 | Amostra suficiente para leitura de qualidade inicial | Preparar relatorio semanal de beta. |

## Triage rapido

| Sintoma | Provavel causa | Acao |
|---|---|---|
| `PriceSnapshot` nao cresce | Cron parado, job manual falhando ou listing sem preco base | Rodar snapshot manual em `/admin/jobs` e revisar motivo de skip. |
| `appliedPriceCents` vazio | Preco aplicado nao chegou ao fluxo de dataset | Conferir `PATCH /sugestoes-preco/:id/aplicado` e vinculo com listing. |
| Snapshot sem listing | `AnalisePreco` sem propriedade/listing associado | Corrigir associacao antes de usar como case. |
| Dashboard mostra zero, mas DB tem dados | Agregacao/admin desatualizado | Bloquear release e revisar query do dashboard. |
| Preco aplicado irreal | Teste misturado com dado real | Marcar como teste ou descartar da amostra de ROI. |

## Registro de evidencia

```text
Smoke de ground truth/dataset
Data/hora:
Ambiente:
Responsavel:
Usuario/imovel:
AnalisePreco id:
Preco recomendado:
Preco aplicado:
Aplicado em:
Snapshot manual rodado? sim/nao
PriceSnapshot id:
appliedPriceCents presente? sim/nao
Dashboard antes:
Dashboard depois:
Resultado: aprovado/bloqueado
Pendencias:
```

## Saida esperada para M2/M3

Para M2:

- pelo menos 1 beta tester ativo com preco aplicado registrado;
- snapshots manuais ou automaticos funcionando;
- leitura clara de recomendado vs. aplicado.

Para M3:

- 7 dias consecutivos de snapshots;
- amostra minima por imovel ativo do beta;
- relatorio semanal com aceite, preco aplicado, ocupacao quando houver e principais bloqueios;
- metodologia de case aprovada antes de qualquer promessa publica de ROI.
