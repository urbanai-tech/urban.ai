# Runbook — Migração do DNS do `myurbanai.com` para Cloudflare

**Owner:** Gustavo · **Status:** Aberto · **Tempo total:** ~1h ativa + 1–24h de propagação

---

## Por que migrar

Hoje a zona DNS do `myurbanai.com` mora na **Hostinger** (que também é onde o
domínio está registrado). A Hostinger cumpre o básico mas:

- UI de DNS é lenta e desorganizada
- Propagação é mais demorada (15–30 min para mudanças)
- Sem features tipo proxy/CDN, WAF, analytics

Mover **só os nameservers** (não o registro do domínio) pra Cloudflare:

- ✅ **Zero custo** (plano gratuito cobre tudo que precisamos)
- ✅ Propagação ~1 min para mudanças
- ✅ UI excelente — adicionar subdomínio é 3 cliques
- ✅ DDoS protection, CDN, WAF grátis (opcional, ligando "proxy laranja")
- ✅ Analytics de tráfego sem instrumentar
- ✅ Hostinger continua sendo dona do domínio (renovação anual ainda é lá)

⚠️ **Não confunda:** isso **não** é "transferir o domínio". O `myurbanai.com`
continua registrado na Hostinger. Só estamos mudando **quem responde as
queries DNS** (de "servidores da Hostinger" para "servidores da Cloudflare").

---

## Pré-requisitos

- [ ] Acesso ao **hPanel da Hostinger** (login + 2FA se ativo)
- [ ] Decidir se quer começar grátis (recomendo) ou já no Pro ($20/mês)
- [ ] Saber a senha do email associado ao domínio (caso precise pra MX records)
- [ ] **30 minutos sem mexer em nada do projeto** (pra ter janela de revisão tranquila)

---

## Passo a passo

### 1. Inventário do que está hoje na Hostinger (5 min)

Antes de trocar qualquer coisa, **fotografar** o estado atual.

1. https://hpanel.hostinger.com → Domínios → `myurbanai.com` → **Gerenciar**
2. Aba **DNS / Nameservers** (ou Zona DNS)
3. **Tirar print da tela inteira** (todos os registros visíveis)
4. Anotar **cada registro** numa lista — tipos comuns que você provavelmente tem:

   | Tipo | Nome | Valor (target) | Para quê |
   |---|---|---|---|
   | `A` ou `CNAME` | `@` (apex) | Railway front | site principal |
   | `CNAME` | `www` | `myurbanai.com` ou Railway | redirect www |
   | `CNAME` | `api` | Railway backend | API NestJS |
   | `CNAME` | `app` | Railway front *(se já criado)* | Subdomain split |
   | `MX` | `@` | mail.hostinger.com (ou similar) | Email |
   | `TXT` | `@` | `v=spf1 include:...` | SPF email |
   | `TXT` | `default._domainkey` | `v=DKIM1; k=rsa; p=...` | DKIM (Mailersend) |
   | `TXT` | `_dmarc` | `v=DMARC1; ...` | DMARC |
   | `TXT` | `@` | `google-site-verification=...` | Search Console |
   | `NS` | `@` | `ns1.dns-parking.com`, `ns2.dns-parking.com` | nameservers atuais |

   Cada um é importante — perder qualquer um quebra um serviço diferente.

> 💡 **Dica:** copiar tudo num arquivo `dns-snapshot-pre-cloudflare.txt`
> e salvar local. Vai servir como referência durante a migração e em caso
> de rollback.

---

### 2. Criar conta na Cloudflare e adicionar o site (10 min)

1. Acessar https://www.cloudflare.com → **Sign Up** (grátis)
2. Confirmar email + ativar 2FA (recomendo, é DNS — vale segurança extra)
3. No dashboard: **"Add a Site"** ou **"Add a domain"**
4. Digitar `myurbanai.com` → **Continue**
5. Escolher **plano Free** (ainda tem upgrade depois se precisar)
6. Cloudflare faz **scan automático** dos seus registros DNS atuais
   (lê dos servidores da Hostinger e copia)
7. **REVISAR a lista que apareceu** com calma — comparar com o snapshot
   do Passo 1
   - Cada registro que faltar, **adicionar manualmente** clicando "+ Add record"
   - Em particular checar: MX (email), TXT (SPF/DKIM/DMARC), TXT de
     verificações (Google, Mailersend etc.)

**⚠️ Atenção crucial:** se o scan perdeu alguma coisa, ela vai **deixar de
funcionar** quando você trocar os nameservers. Email é o que mais quebra.

---

### 3. Configurar modo proxy de cada registro — começar **conservador** (5 min)

Ainda no dashboard do site na Cloudflare → cada registro mostra um
ícone laranja (proxied) ou cinza (DNS only) ao lado.

**🐍 Recomendação forte: começar TUDO em cinza ("DNS only").**

- **Cinza (DNS only)** — Cloudflare só resolve o nome, tráfego vai direto
  pro Railway. Comportamento idêntico à Hostinger. **Sem risco.**
- **Laranja (Proxied)** — Cloudflare interpõe seu CDN/firewall. Bom pra
  CDN/proxy/WAF, mas pode causar problemas com:
  - Webhooks (Stripe envia request pra `api.myurbanai.com/payments/webhook`,
    se Cloudflare bloqueia ou rate-limita, você perde eventos)
  - Cookies HttpOnly Secure em alguns cenários
  - WebSocket / Server-Sent Events (precisa de plano pago pra long-lived)
  - Uploads grandes (limite de 100MB no plano free)

**Setar tudo em cinza agora.** Liga laranja só depois de testar e entender
caso a caso. Para domínios de email (`@` para MX, `mail`, etc.), **sempre
deixar cinza** — tráfego de email não passa por proxy HTTP.

---

### 4. Configurar SSL/TLS para "Full (Strict)" (2 min)

Cloudflare → seu site → menu lateral **SSL/TLS** → **Overview**.

**Modo:** escolher **"Full (Strict)"**.

Por quê:
- **Off** — desativa SSL (NÃO usar)
- **Flexible** — Cloudflare ↔ usuário cifrado, Cloudflare ↔ origem **não**.
  Ruim, vulnerável a MITM (NÃO usar)
- **Full** — cifrado nos dois lados, mas aceita cert auto-assinado na origem
- **Full (Strict)** — cifrado nos dois lados E exige cert válido na origem.
  **É o modo correto** quando a origem tem cert (Railway tem, Let's Encrypt)

---

### 5. Pegar os nameservers da Cloudflare (1 min)

No painel da Cloudflare, depois do scan, ela mostra os 2 nameservers que
você precisa configurar. Algo tipo:

```
arya.ns.cloudflare.com
walt.ns.cloudflare.com
```

(Cada conta recebe um par diferente. **Copiar exatamente os 2 que aparecem
pra você** — não inventar.)

---

### 6. Trocar nameservers na Hostinger (5 min) — ⚠️ ponto de virada

A partir daqui o DNS começa a propagar pra Cloudflare. Daí em diante,
mudanças de DNS você faz na **Cloudflare**, não mais na Hostinger.

1. Hostinger hPanel → **Domínios** → `myurbanai.com` → clicar em
   **"Alterar nameservers"** ou **"Servidores de nomes"**
2. Pode ter opção "Usar servidores Hostinger" (default) e "Personalizado"
3. Escolher **"Personalizado / Custom"**
4. Apagar os nameservers atuais (`ns1.dns-parking.com`, etc.)
5. Colar os 2 da Cloudflare (`arya.ns.cloudflare.com` e `walt.ns.cloudflare.com`,
   ou os que **você** recebeu)
6. **Salvar**

⏳ Hostinger costuma confirmar imediatamente, mas a propagação global
leva 1–24h (geralmente 1–4h).

---

### 7. Aguardar Cloudflare confirmar a posse (1–24h)

Cloudflare verifica de tempos em tempos se os nameservers já apontam pra
ela. Quando confirma:

- Status do site na Cloudflare muda de "Pending nameserver update" para
  **"Active"** (com selo verde)
- Você recebe e-mail de confirmação

**Acompanhar:** dashboard Cloudflare → seu site → topo da página mostra status.
Pode forçar re-check clicando "Check nameservers".

---

### 8. Validar (10 min)

Quando Cloudflare disser **Active**, fazer smoke test:

```bash
# Confirmar nameservers
nslookup -type=ns myurbanai.com
# Deve listar os nameservers da Cloudflare, não dns-parking.com

# Conferir resolução de cada subdomínio
nslookup myurbanai.com           # site principal
nslookup app.myurbanai.com       # se já criado
nslookup api.myurbanai.com       # backend
```

Acessar no browser:
1. `https://myurbanai.com` → site abre normalmente
2. `https://app.myurbanai.com` → app abre normalmente (se subdomain split já está ativo)
3. `https://api.myurbanai.com/health` → backend responde
4. Mandar e-mail teste pra você mesmo (ex: solicitar recuperação de senha) →
   confirmar que chega (testa MX/SPF/DKIM)

Se 1–4 todos OK, migração concluída ✅

---

### 9. Adicionar `app.myurbanai.com` na Cloudflare (se ainda não fez split) (3 min)

Agora, dentro da Cloudflare, é trivial criar subdomínio:

1. Cloudflare → seu site → **DNS** → **Records**
2. **"+ Add record"**
3. Preencher:
   - **Type:** `CNAME`
   - **Name:** `app`
   - **Target:** valor que o Railway deu (`urban-front-main-production.up.railway.app`)
   - **Proxy status:** **DNS only (cinza)** — recomendo até validar
   - **TTL:** `Auto`
4. Salvar — propagação em ~1min

E continuar com os passos 3–6 do `subdomain-split-go-live.md` (Railway
adicionar custom domain, env vars, etc.).

---

## Como criar subdomínios depois (a partir daí)

Pra cada novo subdomínio (`staging.myurbanai.com`, `blog.myurbanai.com`, etc.):

1. Cloudflare → site → DNS → Add record
2. CNAME pro target (Railway, Vercel, GitHub Pages, etc.)
3. Save → ~1min e está no ar

Sem mais voltar na Hostinger. **Hostinger só vai ser tocada de novo na
renovação anual do domínio.**

---

## Reverter (caso algo dê errado)

Se algum serviço quebrar (email, etc.) e você não conseguir corrigir
rapidamente na Cloudflare:

1. Voltar na Hostinger → Domínios → `myurbanai.com` → Alterar nameservers
2. Trocar de volta pros nameservers originais (que estavam no snapshot
   do passo 1)
3. Salvar
4. Aguardar propagação reversa (1–24h)
5. Cloudflare vai mostrar status "Pending nameserver update" — fica assim
   sem efeito até você decidir tentar de novo

⚠️ **Durante a janela de propagação reversa**, alguns clientes vão resolver
DNS pelos nameservers da Cloudflare (que já não são fonte da verdade) e
outros pelos da Hostinger. Comportamento inconsistente até consolidar.

---

## Checklist mental antes de trocar nameservers

Marque ✅ antes de virar a chave (Passo 6):

- [ ] Snapshot da zona DNS atual da Hostinger guardado
- [ ] **Todos** os registros aparecem na Cloudflare (especialmente MX,
      SPF/DKIM/DMARC, verificações)
- [ ] Modo SSL/TLS = **Full (Strict)** na Cloudflare
- [ ] Todos os registros estão em modo **DNS only (cinza)** —
      validar laranja depois
- [ ] Você tem 1–24h de janela tolerante (não é horário de cobrança
      de cliente, não é go-live de campanha de marketing, etc.)

---

## Trade-offs e considerações

### O que vale ligar "laranja" depois?
- ✅ `myurbanai.com` (apex) e `www` — site público, beneficia de CDN/WAF
- ⚠️ `app.myurbanai.com` — cuidado com cookies, dá pra ligar mas teste antes
- ❌ `api.myurbanai.com` — webhooks Stripe podem ser bloqueados, melhor cinza
- ❌ Subdomínios de email (MX) — proxy não funciona pra mail mesmo

### Limitações do plano Free
- 100 MB upload máximo via proxy
- Sem WebSocket persistente em proxy
- Sem image optimization
- Sem rate limiting customizado (tem básico, mas limitado)

Tudo isso **só importa se você ligar laranja**. Em modo cinza (DNS only),
limitação nenhuma.

### Quando faz sentido upgrade pro Pro ($20/mês)?
- Quando ligar laranja em rotas críticas e quiser regras de cache/firewall
  customizadas
- Quando trafego passar de ~200k req/mês e quiser image optimization
- Não recomendo agora — Free cobre o caso atual da Urban AI

---

*Última atualização: 25/04/2026.*
