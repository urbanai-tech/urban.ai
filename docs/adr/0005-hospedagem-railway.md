# ADR 0005 — Hospedagem em Railway como cloud primária

**Status:** Aceito (retroativo, escrito em 24/04/2026)

## Contexto

Em fev/mar/2026 a Urban AI saiu de infraestrutura on-premise da Lumina Lab e precisou de cloud própria. Stack a hospedar:
- Backend NestJS
- Frontend Next.js 15 (output standalone)
- Pipeline Prefect (`serve.py`)
- Scrapyd + 8 spiders
- Motor KNN standalone (antes — hoje embedado, ver ADR 0002)
- MySQL
- Upstash Redis (serviço externo, não precisa host)

Equipe pequena (1–2 devs). Orçamento: R$ 1.000–2.000/mês para toda infra.

## Opções consideradas

1. **Railway** (caminho escolhido).
2. **AWS** (ECS + RDS + ElastiCache + CloudFront) — cobertura completa, alta configurabilidade.
3. **Google Cloud Run + Cloud SQL** — serverless com menos ops.
4. **Vercel (front) + backend em Fly.io ou Render**.
5. **DigitalOcean App Platform** — intermediário entre Railway e AWS.

## Decisão

**Railway como cloud primária para todos os serviços**, complementado por:
- AWS S3 para o data lake (`urbanai-data-lake`, região sa-east-1)
- Upstash Redis (serverless, compatível com BullMQ)
- Google Cloud APIs (Maps, OAuth)
- Prefect Cloud (orquestração, ADR 0003)
- Sentry (observabilidade de erros)

Razões:

1. **Deploy via `git push`** — CI/CD embutido, sem configurar pipeline próprio. Desbloqueia iteração rápida em equipe pequena.
2. **5 serviços + DB em uma tela só** — toda a infra Urban AI fica visível e gerenciável em um projeto Railway. AWS exigiria organizar em stacks separadas com Terraform ou CDK.
3. **Preço previsível** — ~R$ 1.000/mês para o stack todo, vs. AWS onde custos variáveis (NAT gateway, transferência, CloudWatch) podem surpreender sem alertas bem configurados.
4. **Private networking interno** entre serviços — backend ↔ MySQL ↔ Redis com <1ms, sem configurar VPC ou security groups.
5. **Certificado SSL automático** nos custom domains — Let's Encrypt gerenciado.
6. **AWS** descartado pela complexidade operacional para esta fase. Faz sentido quando o produto tiver tração e orçamento para um DevOps dedicado. Mantivemos S3 lá porque o pipeline Prefect já estava escrevendo lá e trocar iria pra tras.
7. **Vercel** descartado porque o frontend Next.js roda standalone (não precisa do edge Vercel para sobreviver) e hospedar só o front separado do back adiciona uma conta a gerenciar.

## Consequências

**Positivas:**
- D14 — sistema migrado inteiro em 14 dias corridos.
- Custo dentro do orçado (R$ 1.000/mês confirmado).
- Onboarding de novo dev é "entra no Railway do projeto" — zero setup local obrigatório.
- Backup automático MySQL no plano Pro.

**Negativas:**
- **Railway tem SLA mais modesto** que um hyperscaler — uptime histórico bom, mas incidentes podem ser mais longos que AWS. Mitigação parcial: Sentry para detectar, UptimeRobot para alertar (configurado na F4.4 D8).
- **Sem WAF/DDoS avançado** — Railway tem proteção básica embutida. Se a Urban AI virar alvo, precisará de Cloudflare na frente.
- **Menos regiões** — Railway roda principalmente em us-east. Latência do Brasil é ~120ms. Para usuários em SP é aceitável mas não ótimo.
- **Scaling horizontal limitado** — Railway suporta múltiplas réplicas mas sem auto-scaling por métrica ainda tão maduro quanto ECS/K8s.
- **Vendor lock-in moderado** — se precisarmos sair, cada serviço é um container Docker comum; portabilidade é boa. O que vai com mais atrito: o MySQL (dump+restore) e o pipeline Prefect (que já é externo).

## Quando revisitar

- Quando o tráfego real passar de 1k req/min sustentadas (provavelmente S12+ se o tráfego pago converter).
- Se houver incidente prolongado no Railway que derrube o produto em horário de pico.
- Quando o orçamento permitir DevOps dedicado → considerar AWS ou GCP direto para controle fino.

## Referências

- `docs/avaliacao-projeto-2026-04-16.md` §4 — avaliação da infra atual
- `docs/roadmap.md` F2 — sprint de migração (D1–D14)
- `docs/runbooks/staging-provisioning.md` — como o staging também roda em Railway
