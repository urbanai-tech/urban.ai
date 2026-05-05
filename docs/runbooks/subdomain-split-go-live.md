# Runbook — Go-live do subdomain split (F8.3)

**Owner:** Gustavo · **Status:** Código pronto, aguardando você fazer o
manual · **Origem:** Opção B do plano de subdomain split

---

## Estado atual

✅ **Tudo que é código está em `origin/main`** (commits `bda45cd`, `99ff20a`,
`7af44dc`, `49a2eba`).

✅ **Continua funcionando 100% como hoje** enquanto você não fizer os passos
manuais abaixo. Nada quebra de imediato.

🔜 **Quando você fizer o manual**, o split acontece sem novo deploy de código
— é tudo DNS + envs.

---

## O que precisa ser feito manualmente

Tempo total estimado: **~45 minutos** (~24h de espera de propagação DNS).

### 1. DNS — adicionar `app.myurbanai.com` (5 min)

**Onde:** painel do seu registrador de domínio (Registro.br, GoDaddy, Cloudflare,
ou onde quer que `myurbanai.com` esteja registrado).

**O que fazer:**
1. Logar no painel
2. Ir em "Zonas DNS" / "DNS Records" / "Editar Zona"
3. Adicionar registro:
   - **Tipo:** `CNAME`
   - **Nome / Host:** `app`
   - **Valor / Aponta para:** `cname.vercel-dns.com`
     (ou o que o Vercel pedir no passo 2 — eles podem dar instrução específica)
   - **TTL:** `3600` (ou "Automático")
4. Salvar

**Verificar:**
```bash
dig app.myurbanai.com +short
# Deve retornar algum IP do Vercel ou o CNAME que você setou
```

⚠️ **Propagação:** pode levar 5min a 24h. Geralmente em 30min já está OK.

---

### 2. Vercel — adicionar `app.myurbanai.com` ao projeto (5 min)

**Onde:** dashboard do Vercel onde o front Urban-front-main está hospedado.

**O que fazer:**
1. Logar em https://vercel.com/dashboard
2. Clicar no projeto da Urban AI (front)
3. Settings → Domains
4. Confirmar que `myurbanai.com` já está listado (provavelmente sim)
5. Clicar **"Add Domain"**
6. Digitar `app.myurbanai.com`
7. Vercel pode pedir verificação adicional ou avisar "DNS configurado, aguardando"
8. Aguardar status virar verde (✓)

**Não precisa criar projeto novo.** Mesmo deploy serve os dois domínios — o
middleware decide o que mostrar.

**Verificar:**
- Acessar `https://app.myurbanai.com/` no browser
- Deve mostrar a tela de **login** (a `(home)/page.tsx`)
- Acessar `https://myurbanai.com/`
- Deve mostrar a **landing institucional nova** (a `(public)/landing/page.tsx`)

Se mostrou conteúdo trocado ou erro, o middleware tem bug — me avise.

---

### 3. Railway backend — atualizar 3 env vars (10 min)

**Onde:** https://railway.app/dashboard → projeto Urban AI → serviço
backend (`urban-ai-backend-main`) → aba **Variables**.

**Setar / atualizar estas 3 variáveis:**

| Variável | Valor | Já existia? |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://myurbanai.com,https://www.myurbanai.com,https://app.myurbanai.com` | Sim — atualizar (era só `https://app.myurbanai.com`) |
| `COOKIE_DOMAIN` | `.myurbanai.com` | Não — adicionar nova |
| `MARKETING_BASE_URL` | `https://myurbanai.com` | Não — adicionar nova |

**Reiniciar o serviço** depois das mudanças (Railway costuma fazer auto-restart
ao salvar env, mas confirme).

**Verificar:**
- Login no app (`app.myurbanai.com/`) deve continuar funcionando
- Após login, navegar pra `myurbanai.com/sobre` — sessão deve permanecer
  válida (cookie compartilhado entre subdomínios)
- Inspetor do browser → Application → Cookies → ver se `urbanai_access_token`
  está com `Domain: .myurbanai.com`

---

### 4. Vercel front — atualizar 2 env vars públicas (5 min)

**Onde:** dashboard do Vercel → projeto front → Settings → Environment Variables.

**Setar / confirmar:**

| Variável | Valor | Comentário |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.myurbanai.com` | Linkagem do site público pro app |
| `NEXT_PUBLIC_MARKETING_URL` | `https://myurbanai.com` | Linkagem reversa, ainda não usada mas reserva |
| `NEXTAUTH_URL` | `https://app.myurbanai.com` | Importante — antes era `myurbanai.com` |

⚠️ Mudar `NEXT_PUBLIC_*` exige **redeploy do front** para o novo valor entrar
no bundle. Vercel oferece um botão "Redeploy" no menu Deployments → clicar.
`NEXTAUTH_URL` é server-side e pega no próximo restart automaticamente.

---

### 5. Atualizar callbacks de OAuth / webhooks externos (15 min)

**Verifique cada um destes — só atualize se estiverem listados algum desses
domínios antigos:**

#### Stripe Dashboard
- https://dashboard.stripe.com → Developers → Webhooks
- Endpoint do webhook deve apontar pra `https://api.myurbanai.com/payments/webhook`
  (ou seja, **api**.myurbanai.com — não muda)
- Se estiver apontando pra `https://urban-ai-back-production.up.railway.app/...`,
  pode atualizar pra domínio definitivo agora
- Em Settings → Branding / Customer Portal → o domínio do customer portal
  pode estar como `myurbanai.com/account` — atualizar pra `app.myurbanai.com/my-plan`
- **Success / Cancel URL do Checkout** (configurado no env do backend, não no
  Dashboard): backend hoje usa `SUCCESS_URL` e `CANCEL_URL` — confirmar que
  apontam pra `https://app.myurbanai.com/...`

#### Google Cloud
- console.cloud.google.com → seu projeto → APIs & Services → Credentials
- Se você tem **OAuth Client ID** (login com Google, etc.), os "Authorized
  redirect URIs" precisam incluir `https://app.myurbanai.com/...`
- API Keys (Maps, Gemini) não usam redirect URI — não muda

#### Stays
- Se você já fez setup OAuth com a Stays, o `redirect_uri` registrado precisa
  ser `https://app.myurbanai.com/stays/oauth/callback` (ou rota equivalente)
- Como ainda está em fase de credenciamento, provavelmente não tem nada — só
  configurar com o subdomain `app.` quando for cadastrar

#### Mailersend
- Não tem callback. Domínio verificado é `myurbanai.com` (apex) — funciona
  pros dois subs.

#### Sentry
- Settings → Projects → seu projeto → Client Keys → "Allowed Domains"
- Adicionar `myurbanai.com` E `app.myurbanai.com` (ou `*.myurbanai.com`)

---

### 6. (Opcional) Google Search Console (10 min)

Pra rastrear SEO da landing pública:

1. https://search.google.com/search-console
2. Adicionar **2 properties**:
   - `myurbanai.com` (domain property)
   - `app.myurbanai.com` (URL prefix property)
3. Verificar via DNS TXT record (ou meta tag, ou outro)
4. Fazer upload do `sitemap.xml` na property `myurbanai.com`
   (URL: `https://myurbanai.com/sitemap.xml`)
5. **Não fazer upload de sitemap em `app.myurbanai.com`** — não queremos
   indexar o app

---

## Como testar que tudo deu certo (smoke test)

Depois de fazer 1-5, faça este teste em **navegador anônimo** (sem cookies
antigos):

1. **`myurbanai.com/`** → deve mostrar a landing institucional dark
2. **`myurbanai.com/precos`** → tabela de planos pública
3. **`myurbanai.com/sobre`**, `/termos`, `/privacidade`, `/contato`, `/lancamento` → todas servem
4. **`myurbanai.com/dashboard`** → deve **redirecionar 301** para
   `app.myurbanai.com/dashboard` → cair no login
5. **`myurbanai.com/admin`** → deve redirecionar 301 idem
6. **`app.myurbanai.com/`** → tela de login
7. **`app.myurbanai.com/sobre`** → deve **redirecionar 301** para
   `myurbanai.com/sobre`
8. Fazer login em `app.myurbanai.com/` → deve funcionar normalmente
9. Após logado, clicar em link "Sobre" no header (se tiver) ou digitar
   `myurbanai.com/sobre` em outra aba → sessão **persiste** (não pede login
   de novo) — esse é o teste do `COOKIE_DOMAIN=.myurbanai.com`
10. **`myurbanai.com/robots.txt`** → mostra `Allow: /` + disallows + sitemap
11. **`app.myurbanai.com/robots.txt`** → mostra `Disallow: /`
12. **`myurbanai.com/sitemap.xml`** → XML com 7 URLs
13. **`app.myurbanai.com/sitemap.xml`** → vazio

Se 1-13 todos OK, está concluído.

---

## Troubleshooting comum

### "app.myurbanai.com não carrega"
- Verificar DNS propagou (`dig app.myurbanai.com`)
- Verificar Vercel adicionou domain (Settings → Domains, status verde)
- Limpar cache DNS local: `ipconfig /flushdns` no Windows

### "Login funciona em app. mas perdeu sessão ao ir pra myurbanai.com/sobre"
- `COOKIE_DOMAIN=.myurbanai.com` não foi setado no Railway, ou backend não
  reiniciou
- Inspetor do browser → Application → Cookies → ver se `Domain` do cookie
  começa com `.` (ponto)

### "myurbanai.com/ mostra o login em vez da landing"
- O middleware não está rodando, ou o rewrite falhou
- Verificar que `Urban-front-main/src/middleware.ts` está no commit `49a2eba`
  ou posterior
- Verificar deploy do Vercel é mais recente que esse commit

### "myurbanai.com/dashboard NÃO redireciona — mostra o dashboard direto"
- Ou o middleware está em log-only ainda (não está, conferi), ou
- O Vercel está rodando deploy antigo — fazer "Redeploy" forçado

### "Cors error no console do browser"
- `CORS_ALLOWED_ORIGINS` no Railway não inclui o origin atual
- Conferir que tem os 3: `https://myurbanai.com,https://www.myurbanai.com,https://app.myurbanai.com`
- Reiniciar backend após mudar

### "NEXTAUTH error"
- `NEXTAUTH_URL` no Vercel front continuou apontando pra apex
- Atualizar pra `https://app.myurbanai.com` e redeployar

---

## Reverter (em caso de catástrofe)

Se algo der muito errado e você precisar voltar pro estado anterior:

1. Railway → remover `COOKIE_DOMAIN` (volta pro comportamento sem domain)
2. Vercel front → remover `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_MARKETING_URL`
3. `git revert 49a2eba` (chunk 4) — devolve middleware pro modo log-only
4. `git push origin main`

A partir daí o sistema volta a funcionar como antes do split, em um único
domínio sem redirect.

---

## O que mudou em código (resumo das 4 entregas)

| Commit | Escopo | O que entregou |
|---|---|---|
| `bda45cd` | Estrutura | Route group `(public)` + Header/FooterPublic + middleware log-only |
| `99ff20a` | Landing | `/landing` (institucional principal) + `/precos` (pricing pública) |
| `7af44dc` | Backend | Cookie `domain=.myurbanai.com` em prod + CORS allowlist expandida |
| `49a2eba` | Ativação | Middleware com redirects 301 + robots/sitemap host-aware |

Total: ~1.500 linhas adicionadas, build verde, 95 testes backend OK.

---

*Última atualização: 25/04/2026.*
