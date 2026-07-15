# Postmortem — <título curto>

**Data do incidente:** YYYY-MM-DD  
**Severidade:** SEV-1 / SEV-2 / SEV-3  
**Status:** draft / reviewed / closed  
**Incident commander:** <owner>  
**Serviços afetados:** <lista>  
**Início / detecção / mitigação / fim:** <timestamps BRT e UTC>

> Postmortems Urban AI são blameless: explicam condições do sistema e decisões, não culpam pessoas. Não incluir tokens, payloads pessoais, e-mails de clientes ou credenciais.

## Resumo executivo

<O que aconteceu, impacto e duração em linguagem direta.>

## Impacto

- usuários/listings afetados: <número ou método de estimativa>;
- indisponibilidade/degradação: <duração e SLI>;
- dados/financeiro/LGPD: <impacto confirmado, potencial ou nenhum>;
- error budget consumido: <percentual>.

## Linha do tempo

| Horário | Evento/evidência | Decisão/owner |
|---|---|---|
| HH:MM | <alerta ou sintoma> | <ação> |

## Detecção

- primeiro sinal: <monitor, cliente, log, teste>;
- alerta esperado funcionou? <sim/não e por quê>;
- tempo até detectar: <MTTD>.

## Causa raiz e fatores contribuintes

<Explicar cadeia causal, incluindo dependências e guardrails ausentes. Distinguir causa confirmada de hipótese.>

## Resolução e recuperação

<Mitigação aplicada, validações, rollback/restore e tempo até recuperar - MTTR.>

## O que funcionou

- <controle, pessoa/processo ou ferramenta>.

## O que não funcionou

- <lacuna observável, sem atribuição pessoal>.

## Ações

| ID | Ação | Tipo | Owner | Prazo | Teste/evidência | Status |
|---|---|---|---|---|---|---|
| PM-01 | <ação concreta> | prevenção/detecção/mitigação | <owner> | YYYY-MM-DD | <gate> | aberta |

## Follow-up obrigatório

- [ ] alertas e runbooks atualizados;
- [ ] testes de regressão/fault injection adicionados;
- [ ] risco LGPD/ANPD avaliado quando aplicável;
- [ ] SLO/error budget recalculado;
- [ ] ação de longo prazo priorizada e acompanhada;
- [ ] revisão final aprovada por Engenharia + owner operacional.
