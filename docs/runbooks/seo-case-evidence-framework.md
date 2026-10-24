# Framework de evidencias e cases SEO/SGO/GEO

Data: 2026-05-19

Este documento define como a Urban AI deve criar, validar e publicar evidencias ou estudos de caso para paginas publicas de SEO/SGO/GEO sem inventar dado quantitativo e sem prometer resultado.

## Principio

Uma pagina pode ter um slot publico de estudo de caso em validacao. Metricas, percentuais, ROI, ocupacao, receita, comparaveis ou depoimentos so podem ser publicados depois que a fonte, o periodo, a amostra, o consentimento e a revisao estiverem registrados.

Quando qualquer requisito estiver pendente, a copy publica deve dizer `em validacao`.

## Status permitidos

| Status | Uso publico | Regra |
|---|---|---|
| `em_validacao` | Permitido | Pode aparecer como slot sem metrica. Deve declarar fonte, periodo e amostra como pendentes ou em formacao. |
| `validado_interno` | Restrito | Evidencia existe, mas ainda nao foi aprovada para marketing, legal ou privacidade. Nao publicar numero. |
| `aprovado_publicacao` | Permitido | Pode publicar metrica ou aprendizado se todos os gates estiverem completos. |
| `arquivado` | Nao recomendado | Nao usar em pagina publica, exceto se houver motivo editorial claro. |

## Campos obrigatorios

Todo case candidato deve ter:

| Campo | Requisito |
|---|---|
| `id` | Identificador estavel do case candidato. |
| `pagina` | URL ou hub SEO/GEO relacionado. |
| `hipotese` | O que o case tenta validar, sem prometer resultado. |
| `fonte` | Sistema, documento, log, ticket, fonte publica ou entrevista que sustenta o caso. |
| `periodo` | Janela analisada, com inicio e fim. Se ainda nao existe, usar `em definicao`. |
| `amostra` | Unidades analisadas: imoveis, recomendacoes, eventos, tickets ou snapshots. |
| `status` | Um dos status permitidos. |
| `evidencias` | Links internos para registros, screenshots, relatorios ou exports anonimizados. |
| `consentimento` | Confirmacao de uso publico quando envolver cliente, logo, depoimento ou dado operacional. |
| `privacidade` | Confirmacao de que nao ha PII, segredo, token, endereco completo ou dado sensivel exposto. |
| `revisor` | Pessoa responsavel por aprovar metodologia/copy antes da publicacao. |
| `ultima_atualizacao` | Data da revisao mais recente. |

## Gates para publicar metrica

Uma metrica so pode sair de `em_validacao` quando:

- a fonte for reproduzivel ou auditavel;
- o periodo estiver fechado;
- a amostra estiver descrita sem ambiguidade;
- dados de teste estiverem separados de dados reais;
- o impacto atribuido a Urban AI estiver separado de fatores externos;
- houver consentimento para qualquer uso publico de cliente, marca, depoimento ou numero;
- a copy passar por revisao para remover promessa de resultado garantido;
- a pagina declarar limitacoes quando houver incerteza.

## Requisitos por tipo de case

### Precificacao por recomendacao

- `AnalisePreco` ou registro equivalente com motivo da recomendacao.
- Decisao do usuario: aceitou, rejeitou, ajustou manualmente ou ignorou.
- Preco aplicado, quando existir.
- Snapshot associado ou motivo claro de ausencia.
- Resultado observado separado de fatores externos, como evento, sazonalidade, concorrencia e disponibilidade.

### Eventos e Sao Paulo/Grande SP

- Fonte publica ou operacional do evento.
- Data, local e tipo de evento.
- Criterio de acesso ou micro-regiao.
- Motivo da recomendacao ou motivo de descarte.
- Registro de que o evento nao foi tratado como impacto automatico para toda a cidade.

### Integracao Stays

- Consentimento de integracao.
- Limites configurados.
- Registro de envio, rejeicao, pausa ou rollback.
- Status final da aplicacao.
- Nenhum token, payload sensivel ou dado de hospede na evidencia publica.

### Planilha versus IA

- Regra manual ou planilha original fornecida pelo usuario.
- Sinal externo observado pela Urban AI.
- Decisao final tomada pelo usuario.
- Separacao explicita entre apoio a decisao e resultado comercial.

### LGPD e governanca

- Ticket ou registro de solicitacao.
- Classificacao do pedido.
- Prazo e responsavel.
- Evidencia de resposta.
- Dados pessoais anonimizados ou omitidos no material publico.

## Template de case candidato

```text
Case candidato SEO/GEO
ID:
Pagina:
Hipotese:
Status: em_validacao
Fonte:
Periodo:
Amostra:
Contexto:
Decisao ou evento observado:
O que a Urban AI influenciou:
O que nao pode ser atribuido a Urban AI:
Metricas candidatas:
Limitacoes:
Evidencias internas:
Consentimento publico: sim/nao/nao aplicavel
Privacidade revisada: sim/nao
Revisor:
Ultima atualizacao:
Decisao: manter em validacao/validar internamente/aprovar publicacao/arquivar
```

## Copy publica segura

Use:

- `Status: em validacao`
- `Amostra em formacao`
- `Periodo em definicao`
- `Sem metrica publica ate revisao de fonte, periodo e amostra`
- `Recomendacao como apoio a decisao, sem garantia de resultado`

Evite:

- percentuais sem amostra aprovada;
- aumento de receita como promessa;
- ROI sem metodologia;
- comparacao absoluta contra planilha ou concorrente;
- depoimento sem consentimento;
- inferir causa a partir de correlacao.

## Relacao com runbooks existentes

Este framework complementa:

- `docs/runbooks/beta-fechado-assistido.md`
- `docs/runbooks/dataset-ground-truth-smoke.md`
- `docs/runbooks/stays-beta-private-smoke.md`
- `docs/runbooks/suporte-lgpd-beta-pago.md`

O marco de 100% SEO/SGO/GEO continua bloqueado ate existirem cases quantitativos auditaveis aprovados para publicacao.
