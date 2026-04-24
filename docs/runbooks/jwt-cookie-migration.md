# Runbook — Migração de JWT: localStorage → httpOnly cookie + refresh rotation

**Contexto:** F5C.2 item #10 (auditoria `avaliacao-projeto-2026-04-16.md`). Até 24/04/2026 o backend assinava JWT com segredo hardcoded `"mysecretkey"` e o front armazenava em `localStorage`. Em paralelo, a auditoria mencionou rotação do JWT_SECRET via Railway MCP (128 chars), mas o código nunca leu essa env — qualquer um que visse o repo podia assinar JWTs válidos.

A Fase 1 (backend) está entregue. A Fase 2 (frontend) depende de staging e fica adiada.

---

## Fase 1 — Backend (✅ entregue em 24/04/2026)

Mudanças no `urban-ai-backend-main`:

- **JWT_SECRET**: agora lido de `process.env.JWT_SECRET` em **dois** lugares (`auth.module.ts`, `jwt.strategy.ts`). Se o env var estiver ausente, o backend **falha a inicializar** em vez de cair no fallback "mysecretkey". Acesso token passa para **15 min** (antes era 12h).
- **Refresh token rotation**: nova entity `RefreshToken` (`src/entities/refresh-token.entity.ts`) persiste somente o hash SHA-256 do token bruto. TTL de 7 dias, uma linha por par emitido, com `revokedAt` marcando uso consumido.
- **AuthService**:
  - `issueTokens(user, meta?)` — gera access JWT + refresh token aleatório (`crypto.randomBytes(48)`), grava hash no DB, retorna ambos.
  - `rotateRefreshToken(raw, meta?)` — valida, revoga a linha antiga, emite novo par. **Detecção de roubo**: se o refresh bruto já tiver sido usado (linha revogada), revoga TODOS os refresh tokens ativos do usuário.
  - `revokeRefreshToken(raw)` — logout de uma sessão específica.
  - `revokeAllRefreshTokensForUser(userId)` — logout de todas as sessões.
- **JwtStrategy**: aceita o token via cookie `urbanai_access_token` **E** via header `Authorization: Bearer ...`. Cookie tem precedência. Isso é o que permite retrocompat durante a migração do front.
- **Endpoints novos no `/auth`**:
  - `POST /auth/refresh` — lê cookie `urbanai_refresh_token`, rotaciona, seta cookies novos. Throttled a 20/min.
  - `POST /auth/logout` — revoga o refresh atual e limpa os cookies. Retorna 204.
- **Endpoints existentes**: `login` e `google` continuam retornando `accessToken` no body (retrocompat) **E** setam os cookies httpOnly. Em prod `Secure=true` + `SameSite=lax`; em dev local `Secure=false` (http).
- **cookie-parser** registrado no `main.ts`.
- **Entity `RefreshToken`** vai ser criada automaticamente no próximo deploy em Railway (ainda rodando com `synchronize` controlado — ver `migrations-cutover.md`).

### Env vars novas/críticas

```
JWT_SECRET=<valor rotacionado; gerar com crypto.randomBytes(64).toString('hex')>
JWT_EXPIRES_IN=15m   # opcional; default 15m
```

`JWT_SECRET` **tem que estar setado** ou o backend não sobe.

---

## Fase 2 — Frontend (pendente, ~4–6h, exige staging)

### Objetivo

Eliminar `localStorage.getItem('accessToken')` do frontend e deixar o cookie httpOnly cuidar sozinho. Ganho: imune a XSS (JWT não é acessível via JS), refresh automático quando expira.

### Arquivos a modificar

1. **`Urban-front-main/src/app/service/api.ts`** — axios instance global
   - `withCredentials: true` em todas as requests para mandar cookies cross-origin
   - Remover o `Authorization: Bearer ${token}` no request interceptor
   - No response interceptor, ao receber 401:
     a. Tentar uma vez `POST /auth/refresh`
     b. Se sucesso, refazer a request original
     c. Se falhar, aí sim redirecionar para login
   - Cuidado com o padrão "fila de requests pendentes" para não acontecer thundering herd no refresh

2. **`Urban-front-main/src/app/context/AuthContext.tsx`**
   - `login()` — parar de guardar `accessToken` no localStorage (o cookie já vem setado pela resposta)
   - `logout()` — chamar `POST /auth/logout` em vez de só limpar localStorage
   - `isAuthenticated` — deixar de depender do token local; usar uma chamada GET `/auth/me` no bootstrap

3. **`Urban-front-main/src/app/(home)/page.tsx`** (login page) e outros lugares que chamam `localStorage.setItem('accessToken', ...)`:
   - Remover as chamadas. A resposta do login vai setar os cookies automaticamente.

4. **Interceptors em `componentes/GlobalPaywallModal.tsx`, `context/PaymentCheckGuard.tsx`** — qualquer lugar que lê `localStorage.getItem('accessToken')` para decidir UI deve usar um estado de auth do AuthContext.

### Smoke test após migrar (no staging)

- [ ] Login com senha funciona; cookie `urbanai_access_token` aparece nas devtools → Application → Cookies, flag `HttpOnly=true`, `Secure=true`
- [ ] Recarregar página mantém sessão
- [ ] Em aba separada, requisição com accessToken expirado dispara `POST /auth/refresh` transparentemente e a request original continua
- [ ] Logout limpa ambos os cookies e invalida o refresh no DB
- [ ] Usar refresh revogado (manualmente via DBeaver: marcar `revokedAt`) derruba todas as sessões do mesmo usuário no próximo `/refresh`

### Rollout

Fase 1 já é compatível com o front atual (que continua mandando Bearer). Quando a Fase 2 for ao ar:

1. Deploy backend primeiro (sem mudança funcional, já está em prod).
2. Deploy frontend com a mudança **em staging**. Smoke test completo.
3. Deploy em prod; monitorar Sentry por `UnauthorizedException` + erros 401.
4. Após 2 semanas sem regressão, remover o fallback de `Authorization: Bearer` do `JwtStrategy` (deixar cookie como única fonte).

### Riscos

- **SameSite=lax** pode bloquear certos fluxos cross-domain (landing em `urbanai.com.br` chamando API em `app.myurbanai.com`). Se der problema, considerar `SameSite=none` + `Secure` obrigatório.
- **CORS com credenciais** exige origin específica (nunca `*`). O backend já está configurado com whitelist (F5C.2 item #14, commit `2430ffb`).
- **Refresh storm**: se o front disparar muitas requisições em paralelo com access expirado, todas vão fazer `/refresh` ao mesmo tempo. Mitigar com fila no interceptor.

---

## Acompanhar

- Chamadas a `localStorage.getItem('accessToken')` no front — meta: zero.
  ```bash
  grep -rn "localStorage.*accessToken" Urban-front-main/src | wc -l
  ```
- Chamadas a `Authorization.*Bearer` no front — meta: zero (o backend lê do cookie).

---

*Última atualização: 24/04/2026 — Fase 1 entregue, Fase 2 aguarda staging provisionado.*
