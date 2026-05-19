# Runbook - smoke Brevo transacional

Data: 2026-05-17

Escopo: validar dominio, remetente e entrega dos e-mails transacionais sem
registrar API keys, tokens ou conteudo sensivel em evidencia.

## Pre-condicoes

- Ambiente controlado, preferencialmente staging.
- Dominio/remetente Urban AI aprovado na Brevo.
- `BREVO_API_KEY` configurada no provedor de deploy.
- `EMAIL_SENDER` usando dominio `myurbanai.com` ou subdominio aprovado.
- `EMAIL_SENDER_NAME` configurado como nome publico do remetente.
- Caixa de teste acessivel pelo responsavel do smoke.

`BREVO_API_BASE_URL` deve ficar vazio na maioria dos ambientes; o backend usa
`https://api.brevo.com/v3` por padrao.

## Passo a passo

1. Abra o painel Brevo e confirme remetente/dominio verificado, DKIM e SPF ativos.
2. Confirme no ambiente alvo que as variaveis existem sem revelar valores.
3. Dispare um fluxo real de reset de senha para uma conta de teste.
4. Abra o e-mail recebido e valide remetente, assunto, link e expiracao esperada.
5. Dispare confirmacao/codigo quando aplicavel ao ambiente.
6. Confirme no painel Brevo status entregue, sem bounce/reject.
7. Abra o link do e-mail e confirme que aponta para o app correto.
8. Registre evidencia com data, ambiente, remetente, template e status, sem API key.

## Criterios de aceite

- Dominio/remetente Brevo verificado com DKIM/SPF.
- E-mail transacional chega na caixa de teste.
- Link aponta para o frontend correto ou para fallback operacional aceito.
- Nenhuma API key, token ou segredo aparece em logs/evidencias.
- Bounce/reject/spam nao aparecem no smoke.

## Registro de evidencia

```text
Smoke Brevo
Data/hora:
Ambiente:
Responsavel:
Dominio verificado? sim/nao
DKIM/SPF ok? sim/nao
EMAIL_SENDER:
Template testado:
Entrega: ok/bloqueado
Link abriu app correto? sim/nao
Resultado: aprovado/bloqueado
Pendencias:
```
