# Runbook - Deduplicacao e identidade de eventos

**Owner:** Backend/Ops
**Status:** dry-run operacional; merge real pendente de contrato do servico de identidade

Este runbook cobre a operacao segura da camada de deduplicacao/identidade de eventos. A primeira entrega e intencionalmente conservadora: analisar eventos recentes/futuros, gerar candidatos provaveis de duplicata e produzir evidencia para revisao humana antes de qualquer escrita.

## Objetivo

- Encontrar eventos duplicados entre fontes diferentes ou importacoes repetidas.
- Medir o tamanho do problema antes de ligar merge automatico.
- Priorizar grupos de alta confianca para limpeza assistida.
- Criar uma rotina repetivel de dry-run, revisao, aplicacao futura e rollback logico.

## Fases

1. **Observacao:** rodar dry-run em staging/local com janela curta e revisar CSV.
2. **Calibracao:** ajustar limites de score/distancia ate a taxa de falso positivo ficar aceitavel.
3. **Revisao humana:** validar grupos high-confidence, principalmente eventos de mesmo dia em venues grandes.
4. **Aplicacao assistida:** somente depois de existir contrato de merge no backend. Hoje `--apply` recusa escrita por seguranca.
5. **Monitoramento continuo:** acompanhar volume de duplicatas por fonte e queda esperada apos ajustes na ingestao.

## Criterios atuais do dry-run

O script usa helpers locais para nao depender de servicos em edicao paralela:

- mesma data calendario de `dataInicio`;
- mesma cidade/UF para reduzir comparacoes indevidas;
- nome normalizado parecido, removendo acentos, pontuacao e termos genericos;
- endereco/venue normalizado parecido;
- coordenadas proximas quando `latitude`/`longitude` existem;
- leve bonus quando as fontes sao diferentes, porque duplicata cross-source e o caso de maior valor operacional.

Classificacao:

| Nivel | Uso esperado |
|---|---|
| `high` | Candidato forte para revisao e futuro merge assistido. |
| `medium` | Sinal para calibracao; nao aplicar sem revisao. |

## Como rodar dry-run

```bash
cd urban-ai-backend-main
npx ts-node -r tsconfig-paths/register scripts/event-dedup-backfill.ts
```

Com CSV para auditoria:

```bash
cd urban-ai-backend-main
npx ts-node -r tsconfig-paths/register scripts/event-dedup-backfill.ts \
  --csv ../docs/evidence/event-dedup-dry-run.csv
```

Janela menor para calibracao:

```bash
cd urban-ai-backend-main
npx ts-node -r tsconfig-paths/register scripts/event-dedup-backfill.ts \
  --lookback-days 7 \
  --lookahead-days 90 \
  --limit 3000 \
  --csv ../docs/evidence/event-dedup-dry-run.csv
```

Opcoes principais:

| Opcao | Default | Descricao |
|---|---:|---|
| `--lookback-days` | `30` | Inclui eventos recentes dos ultimos N dias. |
| `--lookahead-days` | `365` | Inclui eventos futuros nos proximos N dias. |
| `--limit` | `10000` | Limite de eventos lidos. |
| `--csv` | - | Grava pares candidatos para revisao. |
| `--include-inactive` | `false` | Inclui eventos inativos. |
| `--min-score` | `0.72` | Piso de candidato suspeito. |
| `--high-score` | `0.86` | Piso de alta confianca. |
| `--geo-high-meters` | `250` | Distancia forte para coordenadas. |
| `--geo-medium-meters` | `750` | Distancia maxima media para coordenadas. |
| `--apply` | bloqueado | Reservado; hoje recusa escrita. |

## Como interpretar o resumo

- **Total events analyzed:** tamanho da amostra lida no periodo.
- **Suspect groups:** componentes conectados de pares suspeitos. Um grupo com 3 eventos pode ter 2 ou 3 pares.
- **High-confidence candidate pairs:** pares com score alto ou nome/geo muito fortes.
- **Medium-confidence candidate pairs:** pares plausiveis que precisam de revisao mais cuidadosa.
- **Sources involved:** distribuicao por `source`; ajuda a identificar coletores ruidosos.
- **Possible duplicate savings:** soma de `grupo.size - 1`; estimativa de quantos registros poderiam ser economizados se cada grupo virasse uma identidade canonica.

No CSV, revise principalmente:

- `distance_meters` baixo com nomes muito parecidos;
- `left_source` diferente de `right_source`;
- `same_dedup_hash` em `reasons`;
- nomes parecidos mas enderecos vagos, que devem permanecer em revisao manual.

## Quando aplicar

Nao aplicar automaticamente ainda. Antes de habilitar qualquer escrita:

1. Ter entidade/campos de identidade canonica aprovados por migration.
2. Ter servico de merge idempotente e testado.
3. Definir regra de sobrevivencia: qual evento fica canonico, quais campos podem preencher vazios, e quais campos nunca podem sobrescrever curadoria/IA.
4. Exigir backup recente e evidencias de dry-run anexadas.
5. Rodar primeiro em staging com uma lista pequena de grupos high-confidence.

O `--apply` existe apenas como ponto de integracao futuro e hoje falha de proposito para impedir merge sem contrato.

## Rollback logico

Quando o merge real for implementado, ele deve registrar:

- id canonico escolhido;
- ids absorvidos;
- campos alterados;
- valores anteriores;
- operador/job;
- timestamp;
- motivo e score.

Rollback recomendado:

1. Pausar jobs de ingestao/eventos para evitar novas escritas concorrentes.
2. Usar o log de merge para restaurar `ativo`, identidade canonica e campos alterados.
3. Reprocessar o dry-run no mesmo periodo para confirmar que o grupo voltou ao estado esperado.
4. Reativar jobs e acompanhar metricas por 24h.

Sem log de merge, rollback deve ser tratado como restauracao de backup/snapshot, nao como edicao manual ad hoc.

## Metricas operacionais

Acompanhar por dia e por fonte:

- eventos ingeridos;
- eventos com `dedupHash` preenchido;
- conflitos de `dedupHash`/upsert;
- candidatos high/medium no dry-run;
- grupos suspeitos;
- possiveis economias de duplicata;
- taxa de duplicata por `source`;
- falsos positivos encontrados na revisao humana;
- tempo de revisao por 100 candidatos.

Sinais de alerta:

- aumento brusco de candidatos de uma unica fonte;
- muitos grupos medium com endereco vazio;
- eventos de venues grandes sem coordenadas;
- `sourceId` ausente em fontes oficiais.

## Integracao esperada com a camada definitiva

O script deve continuar servindo como auditoria, mas a escrita deve morar no servico de identidade/dedup do backend. A integracao esperada e:

1. reutilizar ou alinhar os normalizadores de nome/data/geo;
2. substituir heuristicas locais por chamadas ao servico quando ele estiver estavel;
3. manter modo read-only para auditoria recorrente;
4. fazer `--apply` chamar um metodo idempotente de merge, nunca SQL manual dentro do script.

## Checklist de execucao

- Confirmar `DATABASE_URL` apontando para ambiente correto.
- Rodar dry-run sem `--csv` e checar volume.
- Rodar com `--csv` e salvar evidencia em `docs/evidence/`.
- Revisar top 20 grupos high-confidence.
- Ajustar thresholds se houver falso positivo evidente.
- Registrar metricas no ticket/release notes.
- Nao usar `--apply` ate o servico de merge estar aprovado.
