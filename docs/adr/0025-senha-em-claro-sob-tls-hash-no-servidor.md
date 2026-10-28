# ADR 0025 — Senha em claro sob TLS, hash só no servidor (esquema v2 com migração transparente)

**Status:** Aceito (28/10/2026). Fecha o achado de auditoria "Hash SHA-256 no cliente".

## Contexto

O front calculava `sha256hex(senha)` no navegador (`crypto.subtle`, bytes UTF-8, hex minúsculo) e o backend guardava `bcrypt(12)` desse hex. Com isso o **digest era a própria credencial** (pass-the-hash): quem o obtivesse de um log, HAR, analytics ou extensão entrava na conta sem saber a senha. E o digest não protegia nada além do TLS. O seed local (#62) e os scripts de staging partiam do mesmo digest.

## Decisão

1. **O cliente envia a senha em texto puro**, só sob TLS (login, cadastro, convite da waitlist, reset, troca de e-mail, exclusão de conta). Nenhum hash no navegador.
2. **Esquema v2 no servidor** (`src/auth/password-hashing.ts`): `pw:v2:` + `bcrypt(12)` de `base64(HMAC-SHA256("urban-ai/password/v2", senha))`.
   - O pré-hash no servidor resolve o limite de 72 bytes do bcrypt: a entrada do bcrypt tem sempre 44 bytes ASCII, sem NUL. Nenhuma senha é truncada nem recusada; a política continua 8–128 caracteres.
   - A chave do HMAC é uma constante de separação de domínio, **não** um segredo: não há pepper a guardar ou rotacionar. Um pepper secreto seria um v3 futuro.
3. **Marcador por prefixo, sem migration de schema.** O esquema viaja junto com o hash, na mesma coluna (`varchar(255)`; o v2 ocupa 66). Escolhido em vez de uma coluna `passwordScheme` porque:
   - não há como o hash e o marcador ficarem dessincronizados (qualquer escrita que esqueça a coluna criaria uma linha inconsistente);
   - não há ordem de deploy (migration antes do código), nem migration a reverter;
   - um hash sem prefixo é, por definição, legado, e o caminho legado continua seguro depois da janela (item 5).
4. **Migração transparente, sem reset forçado.** Linhas legadas continuam válidas:
   - `bcrypt(sha256hex(senha))`: o servidor calcula o sha256 da senha recebida em claro e compara;
   - `bcrypt(senha)` (senha definida pelo admin pela tela antiga): compara direto;
   - `sha256hex(senha)` puro (contas muito antigas): compara com `timingSafeEqual`.
   Ao entrar com a senha em claro, a linha é regravada em v2 (melhor esforço; falha ao regravar não derruba o login).
5. **Janela de compatibilidade para bundle antigo em cache.** Até `2026-11-30T03:00:00Z` (constante `LEGACY_CLIENT_HASH_DEFAULT_UNTIL`; a variável `AUTH_LEGACY_CLIENT_HASH_UNTIL` aceita outra data ISO ou `off`):
   - um hex de 64 caracteres é aceito como credencial **só em linha legada**, sem regravar (não temos a senha em claro). Linha v2 **nunca** aceita o hex;
   - em cadastro, convite ou reset feitos pelo bundle antigo, o hex é gravado no formato legado `bcrypt(hex)`, para que o próximo login com a senha em claro funcione e migre a linha.
   Depois da data, um hex de 64 é tratado como uma senha qualquer: o pass-the-hash acaba para todas as contas, migradas ou não. Valor inválido na variável fecha a janela (falha segura).

## Trade-offs

- Durante a janela, contas **ainda não migradas** continuam aceitando o digest vazado, como já acontecia antes. A janela não piora a situação anterior e cada login com o front novo fecha a conta daquele usuário na hora. Para fechar antes, `AUTH_LEGACY_CLIENT_HASH_UNTIL=off`.
- Um usuário já migrado que use uma aba antiga recebe "Credenciais inválidas" até recarregar a página.
- Quem escolher, durante a janela, uma senha que seja exatamente 64 caracteres hex fica no formato legado. Depois da janela precisará redefinir a senha. Caso extremamente improvável.
- **Rollback do backend** para uma versão anterior deixa sem login quem já foi migrado para v2 (o código antigo não reconhece o prefixo) até redefinir a senha. Preferir corrigir para frente.
- Login de linha legada custa até três comparações bcrypt. Some com a migração.

## Consequências

- Logs: falhas de cadastro, reset e regravação logam só a mensagem do erro (o erro do driver traz os parâmetros do SQL). No front, os erros de reset, perfil e exclusão logam só status e mensagem (`safeErrorSummary`): o objeto do axios carrega o corpo com a senha.
- `seed:dev` grava v2 com a senha documentada no `CONTRIBUTING.md`. O `curl` de login manda a senha em claro.
- `staging-auth-fixtures.js` e `provision-staging-smoke-users.js` usam `scripts/password-hash-v2.js`, espelho CommonJS testado por paridade em `password-hashing.spec.ts`. Linhas legadas de fixture são regravadas em v2 na próxima execução.
- Sem migration de banco.
