# ADR 0012 — Sessão em cookie httpOnly + refresh token rotativo com detecção de reuso

**Status:** Aceito (26/10/2026) — registra o que já vigora; migração do front parcial (ver Consequências).

## Contexto

Até abril/2026 o JWT era assinado com segredo fixo no código e guardado em `localStorage` no navegador, exposto a qualquer XSS ([`runbooks/jwt-cookie-migration.md`](../runbooks/jwt-cookie-migration.md)). Era preciso uma sessão que sobrevivesse ao roubo de um token e pudesse ser encerrada no servidor.

## Opções consideradas

1. **JWT longo em `localStorage`.** Simples, mas roubável por XSS e sem revogação.
2. **Sessão opaca no servidor a cada request.** Revogação perfeita, mas uma consulta por request e novo ponto de falha.
3. **Access JWT curto + refresh opaco rotativo, ambos em cookie httpOnly** (escolhida).

## Decisão

- **Access token**: JWT de 15 min (`JWT_EXPIRES_IN`, padrão `15m` em `auth.module.ts`), cookie `urbanai_access_token`, `path=/`.
- **Refresh token**: 48 bytes aleatórios, TTL de 7 dias (`REFRESH_TOKEN_TTL_DAYS` em `auth.service.ts`), cookie `urbanai_refresh_token` com `path=/auth`. No banco fica **só o hash SHA-256** (`refresh_tokens.tokenHash`), com `ip`/`userAgent` truncados.
- **Rotação**: `POST /auth/refresh` revoga a linha atual numa transação (`UPDATE ... WHERE revokedAt IS NULL`) e emite um novo par. Se o token já estava revogado, ou a disputa entre duas requisições perde, **todas as sessões do usuário são revogadas** e a resposta é 401 ("reutilizado — sessão encerrada"). Usuário inativo também revoga tudo. Logout revoga o token atual; excluir conta revoga todos.
- `JwtStrategy` ainda aceita `Authorization: Bearer` além do cookie (cookie tem precedência), por retrocompatibilidade. Atributos do cookie (`Secure`, `SameSite`, `COOKIE_DOMAIN`) vêm de ambiente.
- O front usa `withCredentials: true` e renova via `POST /auth/refresh` (`Urban-front-main/src/app/service/api/client.ts`).

## Consequências

- (+) XSS não lê o token; roubo de refresh é detectado no primeiro reuso.
- (+) Revogação e "sair de todos os dispositivos" funcionam sem estado de sessão por request.
- (−) Duas abas renovando ao mesmo tempo podem disparar a detecção de reuso e deslogar o usuário (falso positivo aceito em favor da segurança).
- (−) Divergência conhecida: `login` e `google` ainda devolvem `accessToken` no corpo e algumas telas do front (`(home)/page.tsx`, `create/page.tsx`) ainda gravam `accessToken` em `localStorage`. A Fase 2 do runbook (remover o legado do front) não foi concluída; enquanto isso o `localStorage` é superfície de XSS sem necessidade.
- (−) `ip` e `userAgent` em `refresh_tokens` não têm prazo de retenção definido (ver [ADR 0024](./0024-retencao-de-dados-pessoais.md)).
