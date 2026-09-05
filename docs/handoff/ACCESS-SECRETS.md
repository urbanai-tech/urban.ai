# Acessos e secrets

**Atualizado em:** 2026-07-21

Este arquivo não contém valores reais de secrets, tokens de verificação ou credenciais.

## Política

Nunca copiar tokens, senhas, JWTs, chaves privadas, URLs de banco com senha ou valores TXT de verificação para Git, documentação, issues, pull requests, chats ou capturas de tela. Qualquer chave compartilhada por um canal inadequado deve ser tratada como exposta, rotacionada no provedor e substituída nos secret stores.

## Como conceder acesso

| Sistema | Mecanismo recomendado |
|---|---|
| GitHub | convite ao repositório/organização com menor privilégio |
| Railway | convite ao projeto e aos ambientes necessários |
| Cloudflare | usuário ou token temporário restrito à zona e às permissões necessárias |
| Stripe | convite ao Dashboard; test mode em desenvolvimento |
| Google Cloud | IAM no projeto correto |
| Brevo/Sentry | convite ao projeto ou chave entregue por cofre |
| Bancos | variáveis do Railway/GitHub; nunca documentação ou chat |

## Fontes de verdade

| Ambiente | Fonte |
|---|---|
| Local | `.env`/`.env.local` ignorado pelo Git |
| Staging | Railway staging e GitHub secrets/vars |
| Production | Railway production e GitHub secrets/vars |
| Handoff humano | 1Password, Bitwarden ou acesso direto ao provedor |

## Grupos de configuração

- Backend: autenticação, banco, health/readiness, Redis, Stripe, email, mapas/IA, Stays e observabilidade.
- Frontend: URLs públicas, NextAuth, Stripe publicável, analytics, Sentry, SEO e fixtures E2E.
- Pipeline/scraping: AWS/S3, Prefect, APIs externas, ingest do backend e Scrapyd.

Os nomes esperados devem ser consultados em `.env.example`, workflows e runbooks; os valores ficam apenas nos secret stores.

## Cloudflare e staging

Os CNAME/TXT necessários já foram provisionados anteriormente e não devem ser recriados por inferência. Destinos e valores de verificação devem ser consultados diretamente no Railway e Cloudflare autenticados, sem serem copiados para documentação.

Em 2026-07-21, os hostnames customizados ainda falhavam em TLS estrito. O frontend canônico também aparecia sem domínio público e com região inválida, exigindo correção/validação antes de qualquer mudança DNS.

## Checklist de transferência

- [ ] Acessos concedidos diretamente nos provedores.
- [ ] Chaves anteriormente compartilhadas em canais inadequados rotacionadas.
- [ ] Arquivos `.env*` locais confirmados como ignorados.
- [ ] Secrets/vars de CI configurados sem impressão em logs.
- [ ] Permissões temporárias revogadas após a conclusão.
