# Runbook - Stays beta privado

Data: 2026-05-15
Escopo: validar Stays como beta privado antes de permitir qualquer aplicacao automatica de preco em conta real.

## Principio de release

Stays nao deve aparecer como automacao pronta enquanto qualquer item abaixo estiver pendente:

- credencial sandbox ou conta real aprovada;
- `STAYS_API_BASE_URL` definido por ambiente;
- `STAYS_TOKEN_ENCRYPTION_KEY` configurada antes de token real;
- consentimento rastreavel do anfitriao;
- connect, sync, push manual, push automatico e rollback testados;
- evidencia de `PriceUpdate` para sucesso, rejeicao e rollback.

Se algo falhar, manter o produto em modo recomendacao manual e tratar Stays como beta privado.

Nota operacional: o backend esta em fail-closed. Sem `STAYS_API_BASE_URL`, o conector nao chama a API Stays; sem `STAYS_TOKEN_ENCRYPTION_KEY`, `POST /stays/connect` bloqueia antes de validar ou persistir token real.

## Pre-condicoes

- Ambiente controlado: staging ou sandbox Stays.
- Conta Stays de teste com Open API habilitada.
- Usuario Urban AI beta allowlisted.
- Pelo menos 1 listing Stays sem risco comercial real.
- Pelo menos 1 imovel Urban AI mapeavel ao listing Stays.
- Recomendacao recente aprovada pelo produto.
- Admin com acesso a `/admin/stays` e logs.

## Passo a passo

1. Abra `/admin/dashboard` e registre:
   - `stays.apiBaseConfigured`;
   - `stays.tokenEncryptionConfigured`;
   - `stays.betaPrivate`;
   - contas/listings Stays;
   - PriceUpdates recentes.
2. Confirme que `STAYS_TOKEN_ENCRYPTION_KEY` esta presente antes de colar qualquer token real.
3. Conecte a conta em `/settings/integrations` usando `clientId` e `accessToken` de sandbox.
4. Confirme que o backend valida credencial e cria `StaysAccount` ativa.
5. Confirme que o token salvo tem prefixo criptografado `enc:v1:` no banco; nunca registrar o token em print/log.
6. Rode sync de listings pela UI.
7. Confirme que ao menos 1 `StaysListing` foi criado e pode ser associado a um imovel Urban AI.
8. Revise consentimento exibido ao usuario e registre versao/data quando o mecanismo estiver disponivel.
9. Com uma recomendacao aprovada, faca push manual de preco para o listing sandbox.
10. Confirme `PriceUpdate.status='success'`, `origin='user_accepted'` ou equivalente, preco e data corretos.
11. Rode rollback do `PriceUpdate` bem-sucedido.
12. Confirme novo `PriceUpdate.origin='rollback'` apontando para o update original.
13. Se o modo automatico estiver habilitado apenas para teste, rode um push auto controlado em um unico listing.
14. Desligue o modo automatico ao final do smoke, salvo se o beta privado ja tiver aprovacao explicita.
15. Registre evidencia no release gate.

## Criterios de aceite

O smoke passa quando:

- credenciais sao validadas sem expor segredo;
- token fica criptografado em repouso;
- sync cria/lista listings coerentes;
- push manual gera `PriceUpdate.success`;
- rollback gera `PriceUpdate.rollback` associado ao original;
- modo automatico, se testado, respeita allowlist, consentimento e guardrails;
- dashboard admin mostra saude da Stays sem falso "pronto".

O smoke bloqueia Stays quando:

- token real seria salvo sem `STAYS_TOKEN_ENCRYPTION_KEY`;
- UI vende "automatico" para usuario fora da allowlist;
- push funciona, mas rollback nao;
- `PriceUpdate` nao guarda origem/status suficientes para auditoria;
- consentimento nao fica rastreavel antes de automacao real;
- falhas da Stays aparecem como sucesso no painel.

## Triage rapido

| Sintoma | Provavel causa | Acao |
|---|---|---|
| `apiBaseConfigured=false` | Env ausente | Manter beta privado e configurar sandbox antes do teste. |
| `tokenEncryptionConfigured=false` | Segredo ausente | Nao conectar token real; configurar segredo e redeploy. |
| Connect bloqueado antes do ping | `STAYS_API_BASE_URL` ou `STAYS_TOKEN_ENCRYPTION_KEY` ausente | Configurar envs e redeploy; nao usar fallback para prod. |
| Connect falha | Token invalido ou API fora | Validar no painel Stays e checar `/admin/stays`. |
| Sync retorna zero listings | Conta sem Open API/listings ou filtro errado | Confirmar conta sandbox e permissao. |
| Push rejected | Guardrail, data, listing inativo ou regra Stays | Registrar motivo e manter recomendacao manual. |
| Rollback falha | Falta preco anterior ou endpoint indisponivel | Bloquear automacao e corrigir antes de beta. |
| Admin mostra pronto sem envs | Readiness incorreto | Bloquear release e corrigir alerta. |

## Registro de evidencia

```text
Smoke Stays beta privado
Data/hora:
Ambiente:
Responsavel:
Conta/listing Stays:
Usuario Urban AI:
apiBaseConfigured:
tokenEncryptionConfigured:
Token criptografado? sim/nao
Sync listings: criados/atualizados:
Imovel mapeado:
Push manual PriceUpdate id/status:
Rollback PriceUpdate id/status:
Push automatico testado? sim/nao
Consentimento registrado? sim/nao
Resultado: aprovado/bloqueado
Pendencias:
```

## Saida esperada

Para continuar como beta privado:

- Stays pode ficar visivel apenas para usuarios allowlisted;
- recomendacao manual continua sendo o modo seguro padrao;
- modo automatico so fica ativo por listing depois de consentimento e rollback testados;
- qualquer falha volta para modo manual, sem perda de recomendacao.

Para sair de beta privado:

- smoke passa em sandbox e em uma conta real assistida;
- consentimento versionado esta persistido;
- suporte tem trilha de auditoria por `PriceUpdate`;
- existem alertas para falha de sync/push/rollback;
- termos e politica de privacidade citam a integracao de forma revisada.
