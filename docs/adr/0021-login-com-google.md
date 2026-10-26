# ADR 0021 — Login com Google: concluir a ponte no front ou remover o código morto

**Status:** Proposto (26/10/2026) — **decisão em aberto**. Decide: Produto/Engenharia (Gustavo).

## Contexto — o que existe hoje

- **Backend**: `POST /auth/google` (`auth.controller.ts`) recebe um `idToken` (aceita `idToken`, `credential` ou `token`), valida no `tokeninfo` do Google (audiência contra `GOOGLE_CLIENT_ID`, emissor, `HTTP_TIMEOUT_MS.fast`), cria ou localiza o usuário e **já emite os cookies httpOnly** (`setAuthCookies`, [ADR 0012](./0012-sessao-cookie-httponly-refresh-rotativo.md)). Contas Google ficam com senha marcada `google_*` e nunca autenticam por senha; exclusão de conta pede o e-mail em vez da senha.
- **Front**: existe a rota `Urban-front-main/src/app/api/auth/[...nextauth]/route.ts` com `GoogleProvider`, o `SessionProvider` e `useSession` no `AuthContext`, mas **nenhuma tela chama `signIn`** nem tem botão "Entrar com Google" (busca por `signIn(`, `google` em `login/` e componentes não encontra uso). Ou seja, o fluxo está implementado nas duas pontas e **desconectado no meio**: o backend não precisa de nova "ponte de cookie" (já a faz); falta o front obter o `id_token` e chamá-lo.
- Há custos de manter: variáveis `GOOGLE_CLIENT_ID/SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`; duas sessões (NextAuth e cookies próprios) que podem divergir; tela de erro `/auth/error`.

## Opções consideradas

1. **Concluir**: botão no login/cadastro que obtém o `id_token` do Google (Google Identity Services direto, ou NextAuth repassando o `id_token` ao `POST /auth/google`) e deixa a sessão exclusivamente nos cookies do backend. Reduz atrito de cadastro; exige consent screen publicado, teste de conta existente com o mesmo e-mail (vínculo vs. duplicidade) e fluxo de onboarding pós-login.
2. **Remover**: apagar a rota NextAuth, `SessionProvider`, as variáveis e o endpoint, mantendo só e-mail e senha. Menos superfície de ataque e de configuração.
3. **Manter como está.** Pior dos mundos: código e variáveis sem uso.

## Recomendação

**Opção 1, em versão enxuta**, se o funil de cadastro tiver abandono relevante na etapa de senha; caso contrário, **opção 2**. Em ambos os casos, eliminar o estado atual. Se concluir: usar Google Identity Services e chamar `POST /auth/google` direto (dispensa NextAuth e a segunda sessão), cobrir com E2E o vínculo por e-mail já existente, e revisar a política de privacidade (escopos mínimos `email` e `profile`, conforme [`lgpd/dpa-checklist.md`](../lgpd/dpa-checklist.md)).

## Consequências

- (+) Opção 1: menos fricção de cadastro; reaproveita o backend pronto. Opção 2: menos código e segredos.
- (−) Opção 1 traz risco de conta duplicada/sequestro por e-mail não verificado (o backend valida o e-mail do token; manter o teste). Opção 2 remove uma opção que usuários esperam.
- (−) Enquanto não decidido, `NEXTAUTH_*` e `GOOGLE_*` continuam como variáveis "condicionais" na matriz de ambiente sem uso real.
