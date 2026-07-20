# Railway production staged changes — 2026-07-20

## Resultado

A inspeção foi estritamente read-only. O projeto de frontend possuía **duas mudanças pendentes** no ambiente de produção, ambas classificadas pelo Railway como `Service Domain`. Aplicar o conjunto provocaria um novo deployment do frontend.

Nenhuma mudança foi aplicada ou descartada.

## Escopo inspecionado

- projeto Railway: `17fbf94b-8436-4443-82c7-7b04bebaada8`;
- ambiente production: `7d496609-831f-4773-92dd-55536a1bc6b7`;
- serviço Frontend: `ec54cbd2-7764-47fc-841e-3328fed56e7e`;
- quantidade de alterações pendentes: 2;
- tipo das duas alterações: `Service Domain`.

## Limitação observada

O diálogo exibiu os novos valores de forma truncada, começando por `urbanai-production…` e `www…`, sem permitir confirmar os hostnames completos com segurança. Os valores atuais foram apresentados em branco no comparativo. Por isso, a inspeção não é evidência suficiente para autorizar o redeploy.

## Decisão segura

Manter o conjunto pendente até que os hostnames completos sejam reconciliados com a matriz canônica de produção (`myurbanai.com`, `app.myurbanai.com` e qualquer alias `www` formalmente aprovado). Antes de aplicar:

1. confirmar os dois valores completos no Railway;
2. provar que nenhum domínio canônico será removido ou deslocado;
3. revisar CNAME/TXT correspondentes sem recriar registros existentes;
4. preparar smoke HTTP/TLS e rollback;
5. aplicar em janela controlada, pois a ação redeploya o frontend.

## Segurança

Nenhum token, variável, TXT ou dado pessoal foi copiado para esta evidência.
