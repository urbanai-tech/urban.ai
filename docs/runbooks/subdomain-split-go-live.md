# Runbook — Go-live do subdomain split (F8.3)

**Owner:** Gustavo · **Status:** Código pronto, aguardando você fazer o
manual · **Origem:** Opção B do plano de subdomain split

**Stack confirmada:**
- **Frontend Next.js** → Railway
- **Backend NestJS** → Railway
- **DNS / Domínio `myurbanai.com`** → Hostinger

---

## Estado atual

✅ **Tudo que é código está em `origin/main`** (commits `bda45cd`, `99ff20a`,
`7af44dc`, `49a2eba`, `f2d1273`).

✅ **Continua funcionando 100% como hoje** enquanto você não fizer os passos
manuais abaixo. Nada quebra de imediato.

🔜 **Quando você fizer o manual**, o split acontece sem novo deploy de código
— é tudo DNS + envs.

---

## O que precisa ser feito manualmente

Tempo total estimado: **~40 minutos** (~30min de espera de propagação DNS).

### 1. Railway frontend — adicionar `app.myurbanai.com` (5 min)

**Onde:** https://railway.app/dashboard → projeto **Urban AI** → serviço
**front** (`Urban-front-main`).

**O que fazer:**
1. Logar no Railway
2. Clicar no serviço do front
3. Aba **Settings**
4. Seção **Domains** (ou **Networking** → **Custom Domain**)
5. Confirmar que `myurbanai.com` já está listado lá (tem que estar — é o
   domínio atual). Se não estiver, vamos adicionar os dois agora
6. Clicar **"+ Custom Domain"** ou **"Add Domain"**
7. Digitar `app.myurbanai.com`
8. Railway vai mostrar um **CNAME target** tipo
   `urban-front-main-production.up.railway.app` ou
   `<algumacoisa>.railway.app` ou um valor `gtm-...railway.com`
9. **Anotar esse valor** — é o que você vai colar na Hostinger
10. Status vai aparecer "Pending DNS" / "Awaiting CNAME" — normal, ainda
    não setamos no DNS

**Não precisa criar projeto / serviço novo.** Mesmo container do front
serve os dois domínios — o middleware decide o que mostrar baseado no host.

---

### 2. Hostinger — adicionar registro CNAME (5 min)

**Onde:** https://hpanel.hostinger.com → **Domínios** →
clicar em `myurbanai.com` → **DNS / Nameservers**.

**O que fazer:**
1. Logar no hPanel da Hostinger
2. Menu lateral → **Domínios** → encontrar `myurbanai.com` → **Gerenciar**
3. Aba **DNS / Nameservers** (ou **Zona DNS**)
4. Confirmar que já existe registro pra `myurbanai.com` apontando pro Railway
   (provavelmente um `A` pra IP do Railway ou um `CNAME` pra
   `<algo>.up.railway.app`)
5. Clicar **"+ Adicionar registro"** ou **"Adicionar novo"**
6. Preencher:
   - **Tipo:** `CNAME`
   - **Nome / Host:** `app`
     ⚠️ Hostinger às vezes pede só o subdomínio (`app`), às vezes o nome
     completo (`app.myurbanai.com`). Use só `app` — ela completa sozinha.
   - **Aponta para / Conteúdo / Target:** **valor que o Railway deu no passo 1**
     (algo como `urban-front-main-production.up.railway.app.`)
     ⚠️ Se a Hostinger exigir ponto no final do CNAME, mantenha; se não,
     remova. Geralmente ela aceita os dois jeitos.
   - **TTL:** `14400` (default Hostinger) ou `3600` se preferir mais rápido
7. **Salvar**

**Verificar (após 5–30 min de propagação):**
```bash
nslookup app.myurbanai.com
# Ou online: https://dnschecker.org/#CNAME/app.myurbanai.com
# Deve resolver para o target do Railway
```

⚠️ **Propagação típica na Hostinger:** 15min a 4h. Geralmente 30min está OK.

**Voltar no Railway depois da propagação:**
- Railway detecta o CNAME e troca status pra **"Active"** + emite SSL
  Let's Encrypt automaticamente
- Pode levar 1–10 minutos depois do DNS estar OK

---

### 3. Railway backend — atualizar 3 env vars (10 min)

**Onde:** Railway dashboard → projeto Urban AI → serviço **backend**
(`urban-ai-backend-main`) → aba **Variables**.

**Setar / atualizar estas 3 variáveis:**

| Variável | Valor | Já existia? |
|---|---|---|
| `CORS_ALLOWED_ORIGINS` | `https://myurbanai.com,https://www.myurbanai.com,https://app.myurbanai.com` | Sim — atualizar (era só `https://app.myurbanai.com`) |
| `COOKIE_DOMAIN` | `.myurbanai.com` | Não — adicionar nova |
| `MARKETING_BASE_URL` | `https://myurbanai.com` | Não — adicionar nova |

**Reiniciar o serviço** depois das mudanças (Railway costuma fazer
auto-restart ao salvar env, mas verifique no log que reiniciou).

---

### 4. Railway frontend — atualizar 3 env vars (5 min)

**Onde:** Railway dashboard → serviço **front** → aba **Variables**.

| Variável | Valor | Comentário |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://app.myurbanai.com` | Linkagem do site público pro app |
| `NEXT_PUBLIC_MARKETING_URL` | `https://myurbanai.com` | Reserva, ainda não muito usada |
| `NEXTAUTH_URL` | `https://app.myurbanai.com` | **Importante** — antes era `myurbanai.com` |

⚠️ **Variáveis `NEXT_PUBLIC_*` entram no bundle em build-time.** No Railway,
salvar a env **dispara redeploy automático** do serviço front. Aguardar o
build verde antes de testar.

---

### 5. Atualizar callbacks de OAuth / webhooks externos (15 min)

**Verifique cada um destes — só mexa se estiver listado domínio antigo:**

#### Stripe Dashboard
- https://dashboard.stripe.com → **Developers** → **Webhooks**
- Endpoint do webhook deve apontar para o backend, ex.:
  `https://urban-ai-back-production.up.railway.app/payments/webhook`
  → quando você ativar `api.myurbanai.com` (futuro), atualizar pra
  `https://api.myurbanai.com/payments/webhook`. **Por agora, não muda.**
- Em **Settings → Customer Portal** → Branding, se tiver URL
  configurada apontando pra `myurbanai.com/account`, atualizar pra
  `app.myurbanai.com/my-plan`
- **Success / Cancel URL do Checkout** vivem nas envs do backend
  (`SUCCESS_URL`, `CANCEL_URL`). Confirmar que apontam pra
  `https://app.myurbanai.com/...`. No `.env.example` já estão certos.

#### Google Cloud (se usar OAuth client)
- https://console.cloud.google.com → seu projeto → **APIs & Services →
  Credentials**
- Se você tem **OAuth 2.0 Client ID** ativo (login com Google, etc.),
  os "Authorized redirect URIs" precisam incluir
  `https://app.myurbanai.com/...` (rota específica do callback)
- API Keys (Maps, Gemini) **não usam redirect URI** — não precisa mexer.

#### Stays
- Se você ainda não fez setup OAuth (estava em fase de credenciamento),
  configurar com `redirect_uri` =
  `https://app.myurbanai.com/stays/oauth/callback` (ou rota equivalente
  que o backend usar)

#### Mailersend
- Não tem callback. Domínio verificado é `myurbanai.com` (apex) — funciona
  pros dois subdomínios. **Não muda.**

#### Sentry
- https://sentry.io → seu projeto → **Settings → Client Keys (DSN)** ou
  **Settings → Project → Allowed Domains** (varia conforme versão)
- Adicionar **`*.myurbanai.com`** (ou os dois explicitamente:
  `myurbanai.com` e `app.myurbanai.com`)

---

### 6. (Opcional) Google Search Console (10 min)

Pra começar a rastrear SEO da landing pública:

1. https://search.google.com/search-console
2. Adicionar **2 properties**:
   - `myurbanai.com` (escolher "Domain property" — verifica via DNS TXT)
   - `app.myurbanai.com` (escolher "URL prefix property")
3. Verificação:
   - Pra Domain property: Hostinger → DNS → adicionar registro `TXT` que
     o Google fornecer (`google-site-verification=...`)
   - Pra URL prefix: pode usar meta tag, mas mais fácil também via DNS TXT
4. Submeter o sitemap **só na property `myurbanai.com`**:
   - URL: `https://myurbanai.com/sitemap.xml`
5. **Não submeter sitemap em `app.myurbanai.com`** — o `robots.ts` já
   bloqueia indexação lá

---

## Como testar que tudo deu certo (smoke test)

Depois de fazer 1-5, faça este teste em **navegador anônimo** (sem cookies
antigos):

1. **`https://myurbanai.com/`** → deve mostrar a **landing institucional dark**
2. **`https://myurbanai.com/precos`** → tabela de planos pública
3. **`https://myurbanai.com/sobre`**, `/termos`, `/privacidade`, `/contato`,
   `/lancamento` → todas servem
4. **`https://myurbanai.com/dashboard`** → deve **redirecionar 301** para
   `https://app.myurbanai.com/dashboard` → cair no login
5. **`https://myurbanai.com/admin`** → deve redirecionar 301 idem
6. **`https://app.myurbanai.com/`** → tela de **login**
7. **`https://app.myurbanai.com/sobre`** → deve **redirecionar 301** para
   `https://myurbanai.com/sobre`
8. **Login em `app.myurbanai.com/`** → deve funcionar normalmente
9. **Após logado**, abrir nova aba e ir em `myurbanai.com/sobre` → sessão
   **persiste** (não pede login de novo) — esse é o teste do
   `COOKIE_DOMAIN=.myurbanai.com`
10. **`https://myurbanai.com/robots.txt`** → mostra `Allow: /` + lista de
    disallows + `Sitemap:` URL
11. **`https://app.myurbanai.com/robots.txt`** → mostra `Disallow: /`
12. **`https://myurbanai.com/sitemap.xml`** → XML com 7 URLs
13. **`https://app.myurbanai.com/sitemap.xml`** → XML vazio

Se 1-13 todos OK, está concluído.

---

## Troubleshooting comum

### "app.myurbanai.com não carrega ainda" (404 / DNS_PROBE)
- Propagação DNS ainda não completou
- Conferir: https://dnschecker.org/#CNAME/app.myurbanai.com
- Aguardar 30min–2h
- No Railway, status do domain deve ser **"Active"** com SSL emitido

### "Login funciona em app. mas perdeu sessão ao ir pra myurbanai.com/sobre"
- `COOKIE_DOMAIN=.myurbanai.com` não foi setado no Railway, ou backend não
  reiniciou
- Inspetor do browser → **Application → Cookies** → ver se `Domain` do
  cookie começa com `.` (ponto) — `.myurbanai.com`

### "myurbanai.com/ mostra o login em vez da landing"
- Railway está rodando deploy antigo. Forçar **Redeploy** no serviço front:
  Railway → serviço front → menu `⋯` → **Redeploy**
- Confirmar que o deploy ativo é igual ou posterior ao commit `49a2eba`

### "myurbanai.com/dashboard NÃO redireciona — abre o dashboard direto"
- Mesmo problema acima, deploy antigo do middleware
- **Redeploy** forçado

### "CORS error no console do browser"
- `CORS_ALLOWED_ORIGINS` no Railway backend não inclui o origin atual
- Conferir que tem os 3:
  `https://myurbanai.com,https://www.myurbanai.com,https://app.myurbanai.com`
- Reiniciar backend após mudar (Deployments → Redeploy)

### "NextAuth: Untrusted Host"
- `NEXTAUTH_URL` no Railway front continuou apontando pra apex
- Atualizar pra `https://app.myurbanai.com` e aguardar redeploy

### "Hostinger não aceita o CNAME"
- Verifique se já existe um registro `CNAME` ou `A` para `app` — se
  existir, **edite** em vez de adicionar novo (Hostinger não permite dois
  registros com mesmo nome)
- Se está tendo erro tipo "registro inválido", tire o ponto final do
  target ou adicione, dependendo do que ela aceita

### "Railway: status do domain ficou 'Awaiting DNS' por mais de 1h"
- Confirmar via `dnschecker.org` que o CNAME está propagado globalmente
- Se sim, no Railway clicar **"Refresh"** ao lado do domínio
- Se ainda assim falhar, **remover o domínio no Railway e adicionar
  novamente** (recria o pedido de SSL)

---

## Reverter (em caso de catástrofe)

Se algo der muito errado e você precisar voltar pro estado anterior:

1. **Railway backend:** remover `COOKIE_DOMAIN`
2. **Railway front:** remover `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_MARKETING_URL`
3. **Reverter middleware** para log-only:
   ```bash
   git revert 49a2eba
   git push origin main
   ```
   Railway detecta o push e redeploya automaticamente.
4. (Opcional) Hostinger: pode deixar o CNAME `app` lá — não atrapalha.
   Próxima tentativa não precisa mexer.

A partir daí o sistema volta a funcionar como antes do split, em um único
domínio sem redirect.

---

## O que mudou em código (resumo das 5 entregas)

| Commit | Escopo | O que entregou |
|---|---|---|
| `bda45cd` | Estrutura | Route group `(public)` + Header/FooterPublic + middleware log-only |
| `99ff20a` | Landing | `/landing` (institucional principal) + `/precos` (pricing pública) |
| `7af44dc` | Backend | Cookie `domain=.myurbanai.com` em prod + CORS allowlist expandida |
| `49a2eba` | Ativação | Middleware com redirects 301 + robots/sitemap host-aware |
| `f2d1273` | Docs | Este runbook |

Total: ~1.500 linhas adicionadas, build verde, 95 testes backend OK.

---

*Última atualização: 25/04/2026.*
