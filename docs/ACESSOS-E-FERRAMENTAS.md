# Acessos e ferramentas — Urban AI

**Data:** 2026-10-23 · **Responsável:** mantenedor técnico · **Status:** Canônico
**Última validação:** 2026-10-23 · **Próxima revisão:** a cada entrada/saída de mantenedor ou troca de provedor.
**Relação:** topologia em [`ARQUITETURA-ATUAL.md`](./ARQUITETURA-ATUAL.md); nomes de variáveis em [`runbooks/matriz-env-operacional.md`](./runbooks/matriz-env-operacional.md); checklist de concessão em [`runbooks/access-onboarding.md`](./runbooks/access-onboarding.md).

## Regras

1. Este arquivo **não contém valores** de secrets, senhas, tokens, IPs ou URLs de banco. O repositório é público.
2. Acesso é concedido **pelo provedor** (convite de membro, token com escopo) ou por cofre de senhas. Nunca por chat, issue, PR ou print.
3. Menor privilégio: comece em leitura/staging; produção e billing só quando a tarefa exigir, com prazo.
4. Chave que apareceu em chat, log ou commit é considerada exposta: rotacionar no provedor e atualizar Railway / GitHub / Prefect.
5. Ferramentas via MCP ou CLI usam a credencial do próprio mantenedor (OAuth ou token pessoal com escopo), nunca a de outra pessoa.

## Onde vivem os secrets

| Ambiente | Fonte |
|---|---|
| Local | `.env` / `.env.local` (ignorados pelo Git). Não commitar `.env.staging`. |
| Staging / produção (runtime) | Variáveis do serviço no Railway (por ambiente). |
| CI, backup, restore drill, gates E2E | GitHub Secrets/Variables do repositório canônico `urbanai-tech/urban.ai`. |
| Pipeline | Prefect Secret blocks (`mysql-bronze-url`, `aws-*`) + `PREFECT_API_URL`/`PREFECT_API_KEY` no ambiente do worker. |
| Transferência humana | Cofre de senhas (1Password/Bitwarden) ou convite direto no provedor. |

## Matriz por provedor

| Provedor | Para que o mantenedor precisa | Escopo mínimo recomendado | Canal de gestão |
|---|---|---|---|
| **GitHub** | Código, PRs, Actions, secrets de CI | No repositório `urbanai-tech/urban.ai`, Write para abrir PR (Maintain/Admin só para quem gere secrets e branch protection) | CLI `gh` (`gh auth login`, `gh pr`, `gh run`, `gh secret list`) |
| **Railway** | Deploys, logs, variáveis de backend/front/webscraping/MySQL | Membro do projeto; staging com edição; produção somente leitura até necessidade | MCP oficial `https://mcp.railway.com`; CLI `railway` (`railway login`, `railway link`, `railway logs`, `railway variables`) |
| **Cloudflare** | DNS de `myurbanai.com`, proxy, TLS | API token com **Zone:Read + DNS:Edit** restrito à zona `myurbanai.com`; membro com papel de DNS se for usar o painel | Servidores MCP da Cloudflare (com OAuth) ou API com o token escopado |
| **Stripe** | Produtos/preços, webhooks, conferência de assinaturas | Convite no Dashboard; **test mode** para desenvolvimento; papel Developer/View only em live | MCP oficial `https://mcp.stripe.com`; CLI `stripe` (`stripe login`, `stripe listen` para webhooks locais) |
| **Sentry** | Erros e performance de backend e front | Membro da organização com acesso aos projetos; auth token de upload de sourcemaps apenas no build/CI | MCP oficial `https://mcp.sentry.dev/mcp` |
| **AWS** | Backup off-site do MySQL e restore drill | Usuário IAM dedicado ao backup com `s3:PutObject` e `s3:ListBucket` **somente no bucket de backup** (restore drill também precisa de `s3:GetObject`); console apenas para quem administra IAM | AWS MCP + CLI `aws` (`aws s3 ls`, `aws sts get-caller-identity`) |
| **Prefect** | Ver runs/falhas do flow de spiders, ajustar schedule | Service account **somente leitura** para diagnóstico; edição só para quem mantém o pipeline | MCP oficial `prefect-mcp` / plugin Prefect; CLI `prefect` |
| **Brevo** | E-mail transacional, remetentes, domínio | Usuário com acesso a transacional/logs; API key própria por ambiente | MCP oficial `https://mcp.brevo.com` |
| **Vercel** | Apenas se alguma peça auxiliar vier a ser publicada nele (o produto roda no Railway) | Membro do time com leitura | MCP oficial `https://mcp.vercel.com` |
| **Google Cloud** | OAuth client (login Google), Maps/Geocoding, credenciais SEO server-side | Papel por API (ex.: editor de credenciais apenas no projeto Urban AI); restrição de chave por API e por origem | CLI `gcloud` |
| **Upstash** | Redis da fila Bull | Membro do database/time; credencial de leitura para diagnóstico | Console/API Upstash |
| **Stays** | Integração de preço (connect, sync, push, rollback) | Open API ativada **por cliente** no App Center → Stays API → External API, que gera `client_id`/`client_secret` (custo informado: US$ 19/mês por conta). Programa de parceria via `sac@stays.com.br` | Painel Stays do cliente; credenciais ficam criptografadas no backend (`STAYS_TOKEN_ENCRYPTION_KEY`) |
| **Hostinger** | Somente se ainda for o registrador do domínio (renovação). DNS **não** está mais lá | Apenas o administrador do domínio | `hostinger-api-mcp` (se necessário) |
| **Analytics (GA4/Meta)** | Métricas de marketing | Leitura na propriedade | Painéis dos provedores |
| **Coletores de eventos** (Ticketmaster, API-Football, SerpAPI, Firecrawl, Tavily) | Chaves dos coletores do webscraping | Uma chave por coletor, com limite de uso | Painel de cada provedor; valor só no Railway do webscraping |

## Checklist de entrada de mantenedor

- [ ] GitHub: acesso ao repositório canônico e leitura de [ARQUITETURA-ATUAL §8](./ARQUITETURA-ATUAL.md#8-repositório-canônico).
- [ ] Railway: staging com edição; produção somente leitura.
- [ ] Cloudflare: token escopado (Zone:Read + DNS:Edit) ou papel de DNS.
- [ ] Stripe test mode; Sentry; Brevo; Google Cloud conforme a frente de trabalho.
- [ ] Prefect somente leitura (se mexer em eventos/pipeline).
- [ ] AWS apenas se for operar backup/restore.
- [ ] Hooks locais instalados (`npm run hooks:install`) e `npm run gate:repository` rodando.

## Checklist de saída

- [ ] Remover o membro de cada provedor da tabela acima.
- [ ] Revogar tokens pessoais e chaves criadas para a pessoa.
- [ ] Rotacionar qualquer secret compartilhado a que a pessoa teve acesso direto.
