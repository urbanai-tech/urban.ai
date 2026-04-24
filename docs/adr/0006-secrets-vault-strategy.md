# ADR 0006 — Estratégia de cofre de secrets

**Status:** Aceito (24/04/2026)

## Contexto

A Urban AI tem ~25 secrets em produção: `JWT_SECRET`, credenciais de DB, Stripe (`SECRET_KEY` + `WEBHOOK_SECRET`), Mailersend, AWS IAM, Google Maps, RapidAPI, Sentry DSN, etc. Em F5C.1 já saneamos as chaves óbvias (RapidAPI movida do código pra env, JWT_SECRET fail-fast). Agora a pergunta: **como a Urban AI gerencia esses secrets a longo prazo?**

A auditoria sugeriu: Railway Secrets (mínimo viável), Doppler, ou HashiCorp Vault Cloud.

## Opções consideradas

1. **Railway Secrets** (variáveis de ambiente nativas do Railway).
2. **Doppler** — SaaS de cofre com sync automático para Railway, GitHub Actions, etc.
3. **HashiCorp Vault Cloud** — full-blown secrets manager, profissional.
4. **AWS Secrets Manager** — combina com S3 e IAM já existentes.
5. **Status quo + processo manual** (rotação documentada, sem ferramenta nova).

## Decisão

**Opção 1 (Railway Secrets)** + processo de rotação trimestral documentado em `docs/runbooks/access-onboarding.md` § Rotação periódica.

Razões:

1. **Razoável para o tamanho atual.** ~25 secrets, 1–2 devs com acesso, sem requisito de auditoria externa fora LGPD. A complexidade operacional do Doppler/Vault não compensa.
2. **Zero setup adicional.** Os secrets já estão no Railway. Trocar para Doppler exige configurar webhook de sync, dual-source temporariamente, lidar com edge cases — duas semanas de fricção.
3. **Sem custo extra.** Doppler começa em US$ 8/usuário/mês (gratuito limitado a 5 secrets na free tier). Vault Cloud é US$ 0,03/secret-hora (~US$ 700/mês para 25 secrets em uso contínuo). Para a escala atual, isso é desperdício.
4. **Railway é o único hosting hoje** (ADR 0005). Sync entre cofres faria sentido se também rodasse em Vercel/AWS/GCP — não é o caso.

Quando revisitar (sair do Railway Secrets):

- Quando houver 4+ ambientes (prod, staging, qa, dev compartilhado) e o número de duplicações de env vars começar a virar fonte de bug.
- Quando precisarmos de **secrets dinâmicos** (credentials que rotacionam automaticamente, ex: short-lived DB tokens).
- Quando precisarmos compartilhar secrets entre Railway e GitHub Actions de forma segura para pipeline de deploy mais sofisticado.
- Quando a base de devs passar de 4 com acesso a secrets — aí vira difícil rastrear quem viu o quê manualmente.

## Consequências

**Positivas:**
- Sem custo adicional.
- Sem nova dependência para falhar.
- Rotação manual trimestral é factível com 25 secrets.

**Negativas:**
- **Sem audit trail granular** — Railway loga acesso ao painel, mas não "quem viu qual secret". Mitigação: lista de pessoas com acesso é curta e auditada manualmente no checklist de onboarding.
- **Sem secrets dinâmicos.** Tokens com TTL curto exigiriam Vault. Aceitável enquanto rotação trimestral cobrir.
- **Dependência de Railway uptime** — se o painel cair, não conseguimos editar env vars (mas a aplicação continua rodando com os valores cached). Mitigação: backup das env vars críticas em cofre offline (1Password do Gustavo).

## Implementação operacional

1. **Inventário** das env vars: ver `urban-ai-backend-main/.env.example` e `Urban-front-main/.env.example` — listas autoritativas.
2. **Princípio do menor privilégio**: cada serviço só recebe os secrets que precisa. Backend não recebe `NEXTAUTH_SECRET`, frontend não recebe `STRIPE_WEBHOOK_SECRET`.
3. **Naming convention:**
   - `*_SECRET` para credenciais de assinatura (JWT, Stripe webhook)
   - `*_KEY` para API keys (RapidAPI, Mailersend)
   - `*_URL` para endpoints
   - prefixo `NEXT_PUBLIC_` apenas no frontend e apenas em valores que **podem** ser públicos
4. **Backup das env vars**: trimestralmente, exportar as env vars de prod via Railway CLI (`railway variables`) e guardar criptografado no 1Password do Gustavo.

## Referências

- `docs/avaliacao-projeto-2026-04-16.md` §4 — apontamento da ausência de cofre formal
- `docs/runbooks/access-onboarding.md` § Rotação periódica
- `urban-ai-backend-main/.env.example` — inventário backend
- `Urban-front-main/.env.example` — inventário frontend
