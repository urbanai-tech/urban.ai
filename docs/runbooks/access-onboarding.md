# Runbook — Onboarding de acessos para novo dev/op

> ⚠️ **Parcialmente desatualizado — ver [`../ACESSOS-E-FERRAMENTAS.md`](../ACESSOS-E-FERRAMENTAS.md)** (escopo mínimo e canal MCP/CLI por provedor). DNS não está mais na Hostinger: é no Cloudflare. O checklist de concessão abaixo continua útil. (marcado em 2026-10-23)


**Contexto:** F5C.3 do roadmap. Quando um novo dev (ou outro mantenedor operando alguma área) entra na Urban AI, este runbook lista todos os acessos que precisa receber, em qual papel, e como cada um é formalizado.

Sempre rodar este checklist com o **responsável técnico** (DPO atual) presente — alguns acessos exigem 2FA do administrador para serem concedidos.

---

## 1. Acessos por sistema

### Railway (hosting prod + staging)

- **Onde:** https://railway.app/team/urban-ai
- **Quem:** administrador do time → Settings → Members → Invite
- **Roles disponíveis:**
  - `Admin` — pode editar serviços, env vars, billing. **Apenas o responsável técnico + 1 backup.**
  - `Member` — pode ler logs, ver status; **não** consegue editar env vars de prod.
- **Default para novo dev contractor:** `Member` em prod, `Admin` em staging.
- **2FA obrigatório** no Railway antes da concessão.

### Sentry (observabilidade)

- **Org:** `urbanai-ff` em https://urbanai-ff.sentry.io
- **Roles:**
  - `Owner/Manager` — apenas o responsável técnico
  - `Member` — vê issues, edita alertas
  - `Billing` — apenas para quem precisa ver custos
- **Default novo dev:** `Member`.
- 2FA recomendado.

### Brevo (transacional)

- **Conta:** Urban AI no painel Brevo: https://app.brevo.com
- **Roles:** Owner / Admin / Member.
- **Default novo dev:** `Member` (só envia teste, vê logs).
- Trocar template ou domínio: `Admin` (apenas Gustavo).

### Stripe Dashboard

- **Conta:** Urban AI (post-KYC).
- **Acesso via:** Dashboard → Settings → Team → Add user.
- **Roles:**
  - `Administrator` — apenas o responsável técnico + 1 backup
  - `Developer` — vê chaves, webhooks, edita Price IDs (test mode)
  - `Analyst` — só leitura (relatórios, customers)
- **Default novo dev:** `Developer` em test mode; **nunca** acesso a Live mode até fechamento explícito.

### AWS Console (S3 data lake)

- **Conta:** Urban AI (criada na F2 do sprint).
- **IAM users existentes:**
  - `urban-ai-scrapy` — IAM user com permissão restrita ao bucket `urbanai-data-lake` (já criado, é o que o pipeline usa)
- **Acesso humano:** criar IAM user nominal por dev (`gustavo`, `dev1`, etc.) com MFA obrigatório.
- **Política inicial:**
  - `S3ReadOnly` em `urbanai-data-lake/*`
  - Acesso ao painel de billing **negado** por default (apenas Gustavo)
- Console: https://console.aws.amazon.com

### Upstash Redis

- **Conta:** Urban AI em https://upstash.com
- **Roles:** Owner / Member.
- **Default novo dev:** `Member`. Geralmente nem precisa entrar — basta a `REDIS_URL` no Railway.

### GitHub (monorepo `urbanai-tech/urban.ai`)

- **Roles a conceder:**
  - `Read` — só clone/PR review
  - `Triage` — pode comentar issues
  - `Write` — pode mergear PRs
  - `Maintain` — pode editar workflows e branch protection
  - `Admin` — apenas o responsável técnico
- **Default novo dev contractor:** `Write`.
- **Branch protection** em `main` (a configurar quando 2+ devs):
  - Exigir PR review (1 aprovador)
  - Exigir CI verde (workflow `.github/workflows/ci.yml`)
  - Bloquear force-push direto

### Google Cloud (Maps API + OAuth)

- **Project:** `urban-ai-prod` em https://console.cloud.google.com
- **Roles a conceder via IAM:**
  - `Project Editor` — apenas Gustavo
  - `Project Viewer` — devs que precisam ver quotas/billing
- **Default novo dev:** `Service Account User` para gerar chaves quando preciso, sem `Editor`.

### Prefect Cloud

- **Workspace:** `urbanai-prod` em https://app.prefect.cloud
- **Roles:** Workspace Owner / Member / Restricted.
- **Default novo dev:** `Restricted` (vê runs, não edita flows).

### Cloudflare (DNS; antes Hostinger)

- **Conta:** Urban AI (zona `myurbanai.com`).
- **Acesso:** apenas Gustavo. Mudança de DNS é evento crítico — fazer em mob com Gustavo presente.

### UptimeRobot (monitoramento)

- **Conta:** Urban AI.
- **Default novo dev:** acesso de leitura para acompanhar checks.

---

## 2. Checklist de onboarding (rodar uma vez por dev)

Salvar uma cópia preenchida em `docs/onboarding/<nome-dev>-<data>.md` para auditoria (a pasta ainda não existe; crie-a no primeiro uso. Atenção: não registrar segredos nem dados pessoais além do necessário, pois o repositório é versionado).

```
Nome:                          ____________________________
E-mail corporativo (Gmail Workspace ou pessoal):  __________________
Cargo/Função:                  ____________________________
Data de início:                ____________________________
Sponsor:       ____________________________

Acessos concedidos:
[ ] Railway (role: ________)
[ ] Sentry (role: ________)
[ ] Brevo (role: ________)
[ ] Stripe (role: ________ — test mode/live mode)
[ ] AWS IAM user nominal (com MFA)
[ ] GitHub (role: ________)
[ ] Google Cloud (role: ________)
[ ] Prefect Cloud (role: ________)
[ ] Cloudflare (DNS) ___ NÃO (apenas Gustavo)
[ ] UptimeRobot

Documentos lidos pelo dev:
[ ] docs/runbooks/migrations-cutover.md
[ ] docs/runbooks/staging-provisioning.md
[ ] docs/runbooks/incident-response/* (todos)
[ ] Política interna de privacidade (mesmo se for dev — entender o tratamento de dados)

NDA assinado:  Sim / Não — link: ________________________

Setup local validado:
[ ] Clone do repo + branch staging (ou main)
[ ] `docker compose up` na raiz sobe MySQL, Redis, backend e front (ver `CONTRIBUTING.md` §1); `GET http://localhost:10000/health/live` responde 200
    (o primeiro `up` leva ~10 min por causa do `npm ci` e da compilação; não há `yarn.lock`, o gerenciador é npm; comandos do front copiados do `docker-compose.yml`)
[ ] Alternativa sem Docker: `cd urban-ai-backend-main && npm ci && npm run start:dev` e `cd Urban-front-main && npm ci --legacy-peer-deps && npm run dev`
[ ] `cd urban-ai-backend-main && npm test` passa (a contagem de testes mudou; vale o resultado verde, não um número fixo)
[ ] `scripts/validate-local.sh` passa (mesmas verificações do CI)
[ ] Login no Sentry, Railway, GitHub validado pelo dev mesmo
```

---

## 3. Offboarding (quando um dev sai)

**Mesmo dia:**

- [ ] Remover de todos os sistemas listados acima (não apenas downgrade — remoção)
- [ ] Rotacionar `JWT_SECRET` no Railway (cookies emitidos sob ele continuam válidos até expirarem)
- [ ] Rotacionar todas as API keys que o dev tinha acesso (RapidAPI, Stripe webhook secret, Google Maps, Brevo, Sentry DSN se necessário)
- [ ] Fazer `git log --author='<email>'` e revisar últimas semanas de commits — verificar se há algo a auditar (raro, mas precaução)
- [ ] Remover SSH keys do dev no GitHub (configurações pessoais dele) e no Railway

**Em até 7 dias:**

- [ ] Confirmar que ele não tem login local em nenhum dos sistemas
- [ ] Documentar saída em `docs/onboarding/<nome-dev>-offboard.md`

---

## 4. Rotação periódica

Rodar **trimestralmente** mesmo sem mudança de pessoal:

- [ ] Rotacionar `JWT_SECRET` (ver `docs/runbooks/jwt-cookie-migration.md` para impacto)
- [ ] Rotacionar `STRIPE_WEBHOOK_SECRET` (criar novo no Dashboard, deploy backend, remover o velho)
- [ ] Confirmar 2FA ativo em todas as contas (Railway, Sentry, AWS, Stripe, GitHub)
- [ ] Revisar lista de IAM users AWS — remover os inativos por > 90 dias
- [ ] Auditoria de DPAs (semestral, não trimestral) — ver `docs/lgpd/dpa-checklist.md`

---

*Última atualização: 24/04/2026 · F5C.3 item #1*

## Ensaio local (25/10/2026)

Só conferência de caminhos e comandos; nenhum acesso foi concedido ou testado.

**Conferido e correto:** `.github/workflows/ci.yml` existe (e roda em `main` e `staging`); `docs/runbooks/migrations-cutover.md`, `staging-provisioning.md`, `jwt-cookie-migration.md` e `incident-response/` existem; `docs/lgpd/dpa-checklist.md` existe; `../ACESSOS-E-FERRAMENTAS.md` existe; a rotação trimestral cita `JWT_SECRET` e `STRIPE_WEBHOOK_SECRET`, ambos lidos pelo código.

**Corrigido:** "Hostinger (DNS)" virou Cloudflare, também na checklist; o "Setup local validado" mandava `yarn install`/`yarn start:dev`, mas o repositório só tem `package-lock.json` (npm) e o caminho oficial hoje é `docker compose up` (`CONTRIBUTING.md`), que foi usado de verdade neste ensaio para backend, MySQL e Redis (`/health/live` = 200); a contagem fixa "67 testes" foi trocada por "passa"; a pasta `docs/onboarding/` citada não existe e agora isso está dito, com aviso para não versionar segredos/dados pessoais.

**Não ensaiado:** o front (`Urban-front-main`) não foi subido (o escopo do ensaio era MySQL, Redis e backend); o comando `npm ci --legacy-peer-deps` do front foi copiado do `docker-compose.yml`, e a pendência 13 de `ARQUITETURA-ATUAL.md` registra lockfile do front fora de sincronia. `npm test` e `scripts/validate-local.sh` não foram executados aqui.

**Não ensaiável localmente (e o acesso necessário):** todas as concessões da seção 1 e o offboarding da seção 3 (Railway, Sentry, Brevo, Stripe, AWS IAM, Upstash, GitHub, Google Cloud, Prefect, Cloudflare, UptimeRobot) exigem Admin/Owner de cada provedor com 2FA; os nomes de conta/org/bucket citados (`urbanai-ff`, `urban-ai-prod`, `urbanai-data-lake`, `urban-ai-scrapy`, `urbanai-prod` do Prefect) não puderam ser confirmados sem login.
