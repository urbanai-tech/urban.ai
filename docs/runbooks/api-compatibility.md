# Política de compatibilidade e depreciação da API

**Owner:** Backend + Produto  
**Status:** vigente  
**Última validação:** 2026-07-15  
**Contrato atual:** `1.0.0`

## Decisão

As URLs atuais da API são estáveis e permanecem **sem prefixo global de versão**. Não será aplicado `setGlobalPrefix('v1')`, `enableVersioning()` nem redirecionamento em massa: isso quebraria frontend, integrações e automações existentes.

A versão `1.0.0` identifica o **contrato OpenAPI**, não um novo caminho HTTP. Quando Swagger estiver habilitado, o documento publica:

- `info.version = 1.0.0`;
- `x-urban-ai-api-compatibility.strategy = stable-unprefixed`;
- `urlPrefix = null`;
- referência para esta política.

## SemVer do contrato

| Mudança | Versão | Regra |
|---|---|---|
| Texto, exemplo ou descrição sem alterar estrutura | patch | Pode ser publicado após testes. |
| Novo endpoint, status ou campo opcional | minor | Deve ser aditivo e manter consumidores existentes. |
| Remoção/renome, campo antes opcional tornado obrigatório, tipo alterado, status removido ou segurança relaxada | major | Não pode substituir silenciosamente a URL atual. Exige rota/operação paralela ou negociação explícita e janela de migração. |

`operationId` é tratado como contrato porque pode ser consumido por SDKs gerados.

## Depreciação

Uma operação só pode ser removida depois de:

1. marcar `deprecated: true` no OpenAPI;
2. documentar substituta e owner;
3. anunciar `Deprecation`, `Sunset` e `Link` nas respostas quando a depreciação chegar ao runtime;
4. manter no mínimo 90 dias e duas releases estáveis;
5. medir tráfego e comprovar ausência de consumidor relevante;
6. aprovar a remoção como mudança major e atualizar baseline, frontend e integrações no mesmo plano.

Enquanto esses itens não forem comprovados, a rota histórica permanece funcional.

## Gate determinístico

```bash
cd urban-ai-backend-main
npm run contract:openapi
```

O teste cria uma aplicação Nest isolada, sem banco ou rede, gera o OpenAPI real dos controllers e compara 12 operações críticas com [`contracts/openapi-critical.v1.json`](../../urban-ai-backend-main/contracts/openapi-critical.v1.json). O snapshot inclui:

- método e path;
- `operationId`;
- parâmetros e obrigatoriedade;
- request bodies;
- status e schemas de resposta;
- requisitos de segurança;
- schemas transitivos referenciados.

O gate também falha se surgir prefixo global `/vN` nas rotas avaliadas ou se os metadados de compatibilidade divergirem.

## Atualização intencional da baseline

1. Rode `npm run contract:openapi` e leia o diff do Jest.
2. Classifique a mudança pela tabela SemVer.
3. Para mudança aditiva, atualize `API_CONTRACT_VERSION` e a fixture no mesmo PR.
4. Para breaking change, preserve a operação atual, implemente a transição/depreciação e só então crie um novo contrato major.
5. Rode contrato, typecheck, build e testes dos domínios afetados.

Nunca aceite a nova fixture apenas para “deixar o CI verde”; o diff é a evidência de revisão.
