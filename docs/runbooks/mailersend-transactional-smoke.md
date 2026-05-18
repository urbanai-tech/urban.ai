# Runbook - smoke MailerSend transacional

Data: 2026-05-17

Escopo: validar dominio, remetente e entrega dos e-mails transacionais sem
registrar API keys, tokens ou conteudo sensivel em evidencia.

## Pre-condicoes

- Ambiente controlado, preferencialmente staging.
- Dominio/remetente Urban AI aprovado no MailerSend.
- `MAILERSEND_API_KEY` configurada no provedor de deploy.
- `EMAIL_SENDER` usando dominio `myurbanai.com` ou subdominio aprovado.
- Templates necessarios configurados para reset, confirmacao e codigos.
- Caixa de teste acessivel pelo responsavel do smoke.

`MAILERSEND_DOMAIN_ID` ajuda a reconciliar o dominio validado, mas nao deve
bloquear sozinho se o painel MailerSend e o envio real confirmarem DKIM/SPF.

## Passo a passo

1. Abra o painel MailerSend e confirme dominio verificado, DKIM e SPF ativos.
2. Confirme no ambiente alvo que as variaveis existem sem revelar valores.
3. Dispare um fluxo real de reset de senha para uma conta de teste.
4. Abra o e-mail recebido e valide remetente, assunto, link e expiracao esperada.
5. Dispare confirmacao/codigo quando aplicavel ao ambiente.
6. Confirme no painel MailerSend status entregue, sem bounce/reject.
7. Abra o link do e-mail e confirme que aponta para o app correto.
8. Registre evidencia com data, ambiente, remetente, template e status, sem API key.

## Criterios de aceite

- Dominio MailerSend verificado com DKIM/SPF.
- E-mail transacional chega na caixa de teste.
- Link aponta para o frontend correto ou para fallback operacional aceito.
- Nenhuma API key, token ou segredo aparece em logs/evidencias.
- Bounce/reject/spam nao aparecem no smoke.

## Registro de evidencia

```text
Smoke MailerSend
Data/hora:
Ambiente:
Responsavel:
Dominio verificado? sim/nao
DKIM/SPF ok? sim/nao
EMAIL_SENDER:
Template testado:
Entrega: ok/bloqueado
Link abriu app correto? sim/nao
MAILERSEND_DOMAIN_ID reconciliado? sim/nao/nao aplicavel
Resultado: aprovado/bloqueado
Pendencias:
```
