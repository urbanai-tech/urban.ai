# Runbook - fallback manual de eventos

Data: 2026-05-14
Escopo: popular eventos futuros de Sao Paulo/Grande SP quando coletores automaticos ainda nao atingiram o gate de beta.

## Quando ativar

Ative este fallback quando qualquer condicao abaixo acontecer:

- `/admin/dashboard` mostrar menos de 100 eventos futuros nos proximos 30 dias.
- `/admin/collectors-health` mostrar fontes criticas degradadas ou sem `lastSeen < 48h`.
- O beta fechado precisa iniciar antes das chaves externas estarem aprovadas.
- Um operador identificar eventos relevantes que os coletores ainda nao capturam.

## Meta de prontidao

| Gate | Meta minima | Leitura |
|---|---:|---|
| Fallback beta | 100 eventos futuros SP/30d | Suficiente para beta assistido enquanto APIs amadurecem. |
| Alvo M2 | 200 eventos futuros SP/30d | Cobertura mais confortavel para recomendacoes recorrentes. |
| Qualidade minima | 80% com endereco ou lat/lng | Evita backlog grande de geocoder. |
| Fonte rastreavel | 100% com `sourceLabel` | Permite auditar qual planilha alimentou o banco. |

## Fontes sugeridas

Use apenas fontes que possam ser consultadas publicamente e cite a origem no `sourceLabel` ou nas notas do lote.

| Fonte | Tipo de evento | Source label sugerido |
|---|---|---|
| SPTuris / agenda municipal | Eventos culturais e turismo | `csv-spturis-2026q2` |
| Sao Paulo Expo / Expo Center Norte / Anhembi | Congressos e feiras | `csv-venues-2026q2` |
| Allianz Parque / Morumbi / Neo Quimica Arena | Shows e esportes | `csv-estadios-2026q2` |
| Sympla / Eventbrite / Ticketmaster | Shows, congressos, festivais | `csv-ticketing-2026q2` |
| ABRH / Sebrae / entidades setoriais | Eventos B2B | `csv-b2b-2026q2` |

## Campos minimos

O CSV deve usar o template de `/admin/events/import`. A primeira linha e cabecalho.

Campos obrigatorios:

- `nome`
- `dataInicio`

Campos fortemente recomendados:

- `dataFim`
- `enderecoCompleto`
- `cidade`
- `estado`
- `latitude`
- `longitude`
- `categoria`
- `venueType`
- `venueCapacity`
- `expectedAttendance`
- `linkSiteOficial`
- `descricao`

## Passo a passo

1. Abra `/admin/dashboard` e confirme `events.next30d`.
2. Se `next30d < 100`, abra `/admin/events/import`.
3. Baixe o template CSV.
4. Preencha eventos futuros, priorizando os proximos 30 dias.
5. Use um `sourceLabel` rastreavel, por exemplo `csv-spturis-2026q2`.
6. Importe o CSV.
7. Revise `invalidRows` e corrija linhas rejeitadas.
8. Se houver eventos sem latitude/longitude, abra `/admin/jobs` e rode o geocoder.
9. Volte ao `/admin/dashboard` e confirme se o alerta de fallback reduziu.
10. Registre evidencia no release gate: data, sourceLabel, linhas importadas, criados, atualizados e `events.next30d` final.

## Criterios para aceitar o lote

Aceite o lote quando:

- Pelo menos 90% das linhas forem validas.
- A soma `created + updated` aproximar o dashboard da meta de 100 eventos futuros.
- Eventos principais tiverem endereco ou lat/lng.
- Eventos com grande impacto tiverem `expectedAttendance`, `venueCapacity` ou categoria clara.
- O source label identificar a origem do lote.

Bloqueie ou revise o lote quando:

- Datas estiverem no passado.
- Fonte misturar cidades fora da cobertura sem motivo claro.
- Muitos eventos vierem sem local.
- O CSV tiver duplicatas obvias com nomes/datas levemente diferentes.
- A origem nao puder ser auditada.

## Registro de evidencia

Use este formato no registro de release:

```text
Fallback manual de eventos
Data:
Responsavel:
Source label:
Arquivo/lote:
Linhas CSV:
Invalidas:
Criados:
Atualizados:
Skipados:
events.next30d antes:
events.next30d depois:
Geocoder rodado? sim/nao
Observacoes:
```

## Proximo passo apos o fallback

O fallback manual nao substitui coletores. Depois que o beta estiver rodando:

- comparar sources manuais contra coletores automaticos;
- promover fontes recorrentes para coletor dedicado;
- remover duplicatas;
- acompanhar `created24h`, `lastSeen` e `next30d` por 7 dias.
