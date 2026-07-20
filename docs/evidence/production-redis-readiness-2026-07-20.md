# Evidência — Redis e readiness de produção

**Data:** 2026-07-20
**Owner:** Engenharia + Operação
**Status:** aprovado
**Escopo:** provisionamento do Redis persistente, configuração segura do backend e validação dos contratos de health em produção.

## Resultado

| Controle | Resultado observado |
|---|---|
| Serviço Redis | `Redis-P9x7` em `SUCCESS` |
| Réplicas | 1 configurada, 1 ativa, 0 crashed/exited |
| Persistência | volume `redis-volume-021V`, 50.000 MB, montado em `/data`, estado `Ready` |
| Backend | redeploy `b9dc39e0-0a79-4b16-b383-a0b9e3c883f9` em `SUCCESS` |
| Liveness | `GET /health/live` → HTTP 200 |
| Readiness sem credencial | `GET /health` → HTTP 401 |
| Readiness autorizada | `GET /health` com Bearer do secret store → HTTP 200, `status=ok` |
| Banco | `checks.db.status=ok` |
| Redis | `checks.redis.status=ok`; latência observada de 30 ms |
| Logs do backend | zero ocorrência de `ENOTFOUND`, `ECONNREFUSED`, `WRONGPASS`, `ETIMEDOUT` ou falha de health Redis no deployment validado |
| Logs do Redis | zero ocorrência rastreada de autenticação, corrupção, panic ou falta de memória |

## Segurança

- Nenhum valor de token ou senha foi incluído nesta evidência.
- Uma credencial Redis criada durante a configuração apareceu em saída diagnóstica restrita; ela foi imediatamente substituída por uma senha criptograficamente aleatória.
- O backend foi atualizado para referenciar a credencial rotacionada; a senha anterior ficou inválida antes da validação final.
- O readiness permanece fail-closed: chamadas sem autorização não revelam o estado das dependências.

## Dependências restantes

1. configurar monitor externo com o token mantido exclusivamente no secret store;
2. publicar DNS/status page;
3. acumular a janela de SLO exigida pelo scorecard;
4. exercitar falha controlada, recuperação e concorrência multi-réplica em staging.
