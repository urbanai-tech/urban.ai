# Mini-checklist final — Go-live subdomain split (DNS via Cloudflare)

**Owner:** Gustavo · **Status:** DNS em propagação · **Data:** 25/04/2026

> Versão consolidada. Ao terminar este checklist, `myurbanai.com` serve a
> landing institucional pública e `app.myurbanai.com` serve o app
> autenticado. Sessão é compartilhada entre os dois (cookie domain
> `.myurbanai.com`).

---

## 1. Cloudflare — conferir depois da propagação

Quando o status do site na Cloudflare virar **"Active"** com selo verde:

- [ ] **SSL/TLS → Overview → Modo = "Full (Strict)"**
      (Não usar Flexible ou Off — vulnerável a MITM)

- [ ] **Cada DNS record em modo "DNS only" (cinza)** — confirmação:
      a) `myurbanai.com` (apex) — apontando pro Railway front
      b) `www.myurbanai.com` — apontando pro Railway front (ou redirect pro apex)
      c) `app.myurbanai.com` — apontando pro Railway front
      d) `api.myurbanai.com` — apontando pro Railway backend (se já tinha)
      e) MX, TXT (SPF/DKIM/DMARC) — todos preservados

- [ ] **Conferir e-mail funciona** — solicitar reset de senha pra você mesmo,
      confirmar que chega (testa MX/SPF/DKIM)

- [ ] (Opcional) Search Console — adicionar 2 properties (apex e app) e
      submeter `https://myurbanai.com/sitemap.xml` apenas no apex

⚠️ **NÃO** ligue laranja (proxy) ainda em nada. Cinza preserva comportamento
atual; laranja vem como otimização futura, caso a caso.

---

## 2. Railway — frontend (`Urban-front-main`)

Aba **Settings → Networking** (Custom Domains):

- [x] `app.myurbanai.com` (porta 8080) — **já configurado** ✅
- [ ] `myurbanai.com` (porta 8080) — adicionar via "+ Custom Domain"
- [ ] `www.myurbanai.com` (porta 8080) — adicionar via "+ Custom Domain"

Status de cada um deve virar **"Active"** + SSL emitido após ~5–10min do
DNS estar resolvendo.

Aba **Variables**:

- [ ] `NEXT_PUBLIC_APP_URL` = `https://app.myurbanai.com`
- [ ] `NEXT_PUBLIC_MARKETING_URL` = `https://myurbanai.com`
- [ ] `NEXTAUTH_URL` = `https://app.myurbanai.com`

⚠️ Salvar essas dispara redeploy automático (NEXT_PUBLIC_* entra em build
time). Aguardar build verde.

---

## 3. Railway — backend (`urban-ai-backend-main`)

Aba **Variables**:

- [ ] `CORS_ALLOWED_ORIGINS` = `https://myurbanai.com,https://www.myurbanai.com,https://app.myurbanai.com`
- [ ] `COOKIE_DOMAIN` = `.myurbanai.com` *(começa com PONTO — crítico pra cookie ser compartilhado entre subdomínios)*
- [ ] `MARKETING_BASE_URL` = `https://myurbanai.com`

Salvar dispara restart automático. Conferir nos Deployments que reiniciou
sozinho — se não, clicar **"Redeploy"** manualmente.

---

## 4. Conferir callbacks externos

Geralmente nada precisa mexer, mas vale dar uma olhada:

- [ ] **Stripe Dashboard** → Customer Portal URL (se tiver) → atualizar pra
      `https://app.myurbanai.com/my-plan`
      Webhook segue apontando pra api.* — não muda agora
- [ ] **Google Cloud OAuth Client** (se usar) → adicionar
      `https://app.myurbanai.com/...` em Authorized redirect URIs
- [ ] **Sentry** → Project Settings → Allowed Domains → adicionar
      `*.myurbanai.com` (ou os 2 explicitamente)
- ❌ **Mailersend, Maps API, Gemini API** — não usam redirect URI, não mexer

---

## 5. Smoke test final (em navegador anônimo)

Tudo no anônimo pra não confundir com cookies antigos:

- [ ] **`https://myurbanai.com/`** → landing dark institucional nova
- [ ] **`https://myurbanai.com/precos`** → tabela de planos pública
- [ ] **`https://myurbanai.com/sobre`**, `/termos`, `/privacidade`,
      `/contato`, `/lancamento` → todas servem
- [ ] **`https://myurbanai.com/dashboard`** → 301 redirect para
      `https://app.myurbanai.com/dashboard` → cair no login
- [ ] **`https://app.myurbanai.com/`** → tela de login
- [ ] **`https://app.myurbanai.com/sobre`** → 301 redirect para
      `https://myurbanai.com/sobre`
- [ ] **Login em `app.`** → funciona
- [ ] **Após logado, abrir nova aba em `myurbanai.com/sobre`** → sessão
      persiste (não pede login)
      → testa o `COOKIE_DOMAIN=.myurbanai.com`
- [ ] **`https://myurbanai.com/robots.txt`** → mostra `Allow: /` + lista de
      disallows + `Sitemap:` URL
- [ ] **`https://app.myurbanai.com/robots.txt`** → `Disallow: /`
- [ ] **`https://myurbanai.com/sitemap.xml`** → XML com 7 URLs
- [ ] **`https://app.myurbanai.com/sitemap.xml`** → XML vazio

13/13 → migração concluída. ✅

---

## 6. Ativar pré-lançamento (quando quiser)

Independente do split, pra colocar `/create` em modo waitlist (em vez de
signup tradicional):

- Railway backend → Variables → setar `PRELAUNCH_MODE=true` → restart
- Frontend pega o flag dinamicamente via `GET /public-config` — sem rebuild

Pra desligar (no go-live oficial): `PRELAUNCH_MODE=false` ou apagar a var.

Detalhes em `docs/runbooks/prelaunch-mode.md`.

---

## 7. Troubleshooting comum

| Sintoma | Causa provável | Solução |
|---|---|---|
| `app.myurbanai.com` carrega mas dá erro de SSL | Railway ainda emitindo cert Let's Encrypt | Aguardar 5–10min |
| `myurbanai.com/` mostra login (não landing) | Front Railway com deploy antigo do middleware | Redeploy forçado no front |
| `myurbanai.com/dashboard` não redireciona | Idem (middleware antigo) | Redeploy forçado |
| CORS error no console | `CORS_ALLOWED_ORIGINS` no backend errado/incompleto | Conferir os 3 valores; redeploy backend |
| Sessão cai entre subdomínios | `COOKIE_DOMAIN` sem ponto, ou backend não reiniciou | Garantir `.myurbanai.com` (com ponto inicial) + restart |
| E-mail parou de chegar/sair | Cloudflare scan não pegou MX/SPF/DKIM | Adicionar manualmente esses records lá |
| Cloudflare status "Pending nameserver update" há horas | Hostinger pode ter cacheado nameservers antigos | Conferir em dnschecker.org/#NS/myurbanai.com |

---

## 8. Reverter (em caso de catástrofe)

1. **Hostinger** → Domínios → Alterar nameservers → voltar pros 2 originais
   (anotados no snapshot pré-Cloudflare)
2. **Railway backend** → remover `COOKIE_DOMAIN`
3. **Railway front** → remover `NEXT_PUBLIC_APP_URL` e `NEXT_PUBLIC_MARKETING_URL`
4. (Se necessário) `git revert 49a2eba` (chunk 4 do middleware) → push →
   Railway redeploya automático

Volta ao estado anterior do split.

---

## 9. Estado de cada serviço pós go-live

| Serviço | Onde | Domínio |
|---|---|---|
| Frontend Next.js | Railway | `myurbanai.com`, `www.myurbanai.com`, `app.myurbanai.com` |
| Backend NestJS | Railway | `api.myurbanai.com` (já configurado) |
| Banco MySQL | Railway (interno) | DATABASE_URL |
| Redis BullMQ | Upstash | UPSTASH_REDIS_URL |
| DNS | Cloudflare | nameservers cloudflare |
| Domínio (registrar) | Hostinger | renovação anual continua aqui |
| Email (transacional) | Mailersend | DKIM/SPF mantidos |

---

*Última atualização: 25/04/2026 — depois da decisão de migrar DNS pra Cloudflare.*
