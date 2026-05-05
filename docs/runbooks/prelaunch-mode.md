# Runbook — Modo pré-lançamento (PRELAUNCH_MODE)

**Owner:** Gustavo · **Status:** Ativo · **Origem:** F8.2 (v2.12)

---

## O que é

Modo de operação em que o sistema fica **acessível mas com cadastros bloqueados**:
- Login funciona normalmente (founders, admins, beta testers convidados)
- Tela de signup (`/create`) vira **lista de espera** com posição na fila
- Landing pages ficam ativas e capturam interesse
- Admin gerencia a fila em `/admin/waitlist` e envia convites quando quiser

Permite colocar o produto no ar e validar funil + copy + canais antes do beta
fechado da F7, sem expor o produto a tráfego desconhecido.

## Como ligar

1. **Backend (Railway):** setar env var
   ```
   PRELAUNCH_MODE=true
   ```
   Reiniciar o serviço.

2. **Frontend:** **NÃO precisa rebuild**. O frontend pega o flag dinamicamente
   via `GET /public-config` em runtime, então mudar a env do backend reflete
   nos clients no próximo refresh.

3. (Opcional) Setar fallback build-time pro frontend caso o backend caia:
   ```
   NEXT_PUBLIC_PRELAUNCH_MODE=true
   ```
   No Vercel/Railway do frontend.

## Como desligar (go-live)

Setar `PRELAUNCH_MODE=false` no Railway → reiniciar. `/create` volta a ser
signup tradicional. Entradas que ainda estão na waitlist permanecem; podem
ser convidadas via `/admin/waitlist`.

## Rotas afetadas

| Rota | Modo normal | Pré-lançamento |
|------|-------------|----------------|
| `/` | Login | Login (igual) |
| `/lancamento` | Landing pública | Landing pública (CTA → /create vira waitlist) |
| `/create` | Signup tradicional | `<WaitlistSignup />` |
| `/waitlist/aceitar?token=...` | n/a | Página de aceite de convite |
| `/admin/waitlist` | Admin gerencia | Admin gerencia (mesma) |
| `POST /auth/register` | Cria User real | Cria entrada na waitlist; resposta tem `mode: "waitlist"` |
| `POST /waitlist` | Cria entrada (waitlist independe do flag) | Cria entrada |

## Endpoints da Waitlist

**Públicos (rate-limited):**
- `POST /waitlist` — inscreve um e-mail. Retorna `{position, referralCode, aheadOfYou, totalSignups}`.
  Idempotente: se e-mail já existe, retorna a posição atual em vez de erro.
- `GET /waitlist/me?code=<referralCode>` — consulta posição atual sem precisar logar.
- `GET /waitlist/invite?token=<token>` — valida link de convite.

**Admin (RolesGuard):**
- `GET /admin/waitlist?page&limit&search&status` — paginado.
- `GET /admin/waitlist/stats` — total, byStatus, bySource, top referrers.
- `POST /admin/waitlist/:id/invite` — gera magic link + envia email com 7 dias de validade.
- `PATCH /admin/waitlist/:id/notes` — notas internas do admin.
- `DELETE /admin/waitlist/:id` — remove da fila.

## Sistema de referral

Cada inscrição gera um `referralCode` URL-safe de 8 chars. Link de share fica
`https://urban.ai/lancamento?ref=<code>`. Quando alguém entra pelo link e
se inscreve:
- A nova entry registra `referredBy = <code>`
- A entry indicadora ganha `+1` em `referralsCount`

Indicações são exibidas no card de status do usuário e no `/admin/waitlist`
(top referrers). Não muda automaticamente a posição na fila — admin pode
priorizar manualmente quem mais indicou ao convidar.

## Convites (magic link)

Quando admin clica "Convidar" em `/admin/waitlist`:
1. Backend gera token de 32 bytes (64 hex chars), expira em 7 dias
2. Status da entry muda `pending` → `invited`
3. Email é enviado via Mailersend com template (logo, nome, link, posição)
4. URL: `https://urban.ai/waitlist/aceitar?token=<token>`

Quando o convidado clica o link:
1. Frontend chama `GET /waitlist/invite?token=...` para validar
2. Se OK, mostra form de criar senha (email já vem do convite, read-only)
3. Submit — fluxo de aceite definitivo (criar User real + login automático)
   está marcado como TODO próximo PR (front atualmente redireciona pro home
   com email pré-preenchido).

## Métricas de sucesso

- **Total na fila:** quantos cadastros captou
- **Conversão:** % de `pending` → `invited` → `converted`
- **Top sources:** qual canal traz mais inscritos
- **Top referrers:** quem está realmente mobilizando rede
- **Tempo médio de espera:** entre cadastro e convite

Tudo acessível em `/admin/waitlist` (KPIs no topo + tabela detalhada).

## O que NÃO está coberto

- **Auto-convite por critérios** (ex: "convide automaticamente quem indicou
  3+ pessoas") — manual hoje, evolução futura
- **Email de "sua posição mudou"** — não enviamos a cada movimento da fila
  (anti-spam). Só email de boas-vindas no signup e o convite final.
- **A/B test do landing copy** — feito separadamente via flags de marketing
- **Aceite de convite de fato criando User** — UI pronta, endpoint de
  `POST /auth/register-from-waitlist?token=...` é o próximo PR

---

*Última atualização: 25/04/2026.*
