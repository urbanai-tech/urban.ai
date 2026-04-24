# Runbook — Onboarding de acessos para novo dev/op

**Contexto:** F5C.3 do roadmap. Quando um novo dev (ou um sócio operando alguma área) entra na Urban AI, este runbook lista todos os acessos que precisa receber, em qual papel, e como cada um é formalizado.

Sempre rodar este checklist com o **Gustavo** (DPO atual) presente — alguns acessos exigem 2FA do owner para serem concedidos.

---

## 1. Acessos por sistema

### Railway (hosting prod + staging)

- **Onde:** https://railway.app/team/urban-ai
- **Quem:** owner (Gustavo) → Settings → Members → Invite
- **Roles disponíveis:**
  - `Admin` — pode editar serviços, env vars, billing. **Apenas Gustavo + 1 backup (Fabrício).**
  - `Member` — pode ler logs, ver status; **não** consegue editar env vars de prod.
- **Default para novo dev contractor:** `Member` em prod, `Admin` em staging.
- **2FA obrigatório** no Railway antes da concessão.

### Sentry (observabilidade)

- **Org:** `urbanai-ff` em https://urbanai-ff.sentry.io
- **Roles:**
  - `Owner/Manager` — apenas Gustavo
  - `Member` — vê issues, edita alertas
  - `Billing` — apenas para sócios que precisam ver custos
- **Default novo dev:** `Member`.
- 2FA recomendado.

### Mailersend (transacional)

- **Conta:** `urbanai-ff` em https://app.mailersend.com
- **Roles:** Owner / Admin / Member.
- **Default novo dev:** `Member` (só envia teste, vê logs).
- Trocar template ou domínio: `Admin` (apenas Gustavo).

### Stripe Dashboard

- **Conta:** Urban AI (post-KYC).
- **Acesso via:** Dashboard → Settings → Team → Add user.
- **Roles:**
  - `Administrator` — apenas Gustavo + Fabrício
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

### GitHub (monorepo `Gustavogm9/urban.ai`)

- **Repo privado** desde 24/04/2026.
- **Roles a conceder:**
  - `Read` — só clone/PR review
  - `Triage` — pode comentar issues
  - `Write` — pode mergear PRs
  - `Maintain` — pode editar workflows e branch protection
  - `Admin` — apenas Gustavo
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

### Hostinger (DNS)

- **Conta:** Urban AI.
- **Acesso:** apenas Gustavo. Mudança de DNS é evento crítico — fazer em mob com Gustavo presente.

### UptimeRobot (monitoramento)

- **Conta:** Urban AI.
- **Default novo dev:** acesso de leitura para acompanhar checks.

---

## 2. Checklist de onboarding (rodar uma vez por dev)

Salvar uma cópia preenchida em `docs/onboarding/<nome-dev>-<data>.md` para auditoria.

```
Nome:                          ____________________________
E-mail corporativo (Gmail Workspace ou pessoal):  __________________
Cargo/Função:                  ____________________________
Data de início:                ____________________________
Sponsor (sócio/Gustavo):       ____________________________

Acessos concedidos:
[ ] Railway (role: ________)
[ ] Sentry (role: ________)
[ ] Mailersend (role: ________)
[ ] Stripe (role: ________ — test mode/live mode)
[ ] AWS IAM user nominal (com MFA)
[ ] GitHub (role: ________)
[ ] Google Cloud (role: ________)
[ ] Prefect Cloud (role: ________)
[ ] Hostinger ___ NÃO (apenas Gustavo)
[ ] UptimeRobot

Documentos lidos pelo dev:
[ ] AGENTS.md
[ ] CLAUDE.md
[ ] docs/avaliacao-projeto-2026-04-16.md
[ ] docs/runbooks/migrations-cutover.md
[ ] docs/runbooks/staging-provisioning.md
[ ] docs/runbooks/incident-response/* (todos)
[ ] docs/lgpd/politica-privacidade-interna.md (mesmo se for dev — entender o tratamento de dados)

NDA assinado:  Sim / Não — link: ________________________

Setup local validado:
[ ] Clone do repo + branch staging (ou main)
[ ] `cd urban-ai-backend-main && yarn install && yarn start:dev` sobe sem erro
[ ] `cd Urban-front-main && yarn install && yarn dev` sobe sem erro
[ ] `npm test` no backend passa (67 testes)
[ ] Login no Sentry, Railway, GitHub validado pelo dev mesmo
```

---

## 3. Offboarding (quando um dev sai)

**Mesmo dia:**

- [ ] Remover de todos os sistemas listados acima (não apenas downgrade — remoção)
- [ ] Rotacionar `JWT_SECRET` no Railway (cookies emitidos sob ele continuam válidos até expirarem)
- [ ] Rotacionar todas as API keys que o dev tinha acesso (RapidAPI, Stripe webhook secret, Google Maps, Mailersend, Sentry DSN se necessário)
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
