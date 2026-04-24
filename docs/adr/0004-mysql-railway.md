# ADR 0004 — MySQL gerenciado no Railway como DB primário

**Status:** Aceito (retroativo, escrito em 24/04/2026)

## Contexto

O sistema Urban AI tem um DB relacional primário que guarda:
- Usuários, endereços, listagens, eventos
- Pagamentos (snapshot do Stripe)
- `analise_preco` (cada recomendação de preço gerada)
- Refresh tokens (desde F5C.2 item #10)

Total ~11 entidades TypeORM, relações moderadamente normalizadas. Volume de escrita esperado: baixo (centenas a milhares de rows/dia na fase inicial).

O sistema legado da Lumina rodava MySQL em infraestrutura on-premise. Dump original: `docs/dump-ai_urban-202603131344.sql` (~12MB).

## Opções consideradas

1. **MySQL gerenciado no Railway** (caminho escolhido).
2. **PostgreSQL no Railway** — melhor suporte a JSONB, row-level security, features avançadas.
3. **MySQL no RDS/Aurora da AWS** — mais profissional, backup point-in-time.
4. **Supabase** — Postgres com BaaS em cima.

## Decisão

**MySQL gerenciado no Railway** na mesma conta do restante dos serviços.

Razões:

1. **Compatibilidade com o dump legado** — o sistema veio de MySQL on-premise. Migrar para Postgres exigiria rewrite de schema + reimportação + teste de regressão em entidades com 11 tabelas interligadas. Risco alto, ganho marginal no curto prazo.
2. **Railway já é onde tudo roda** (ver ADR 0005) — uma DB no mesmo projeto tem latência interna baixa, backup automático (plano Pro), painel unificado.
3. **TypeORM 0.3 suporta MySQL e Postgres com o mesmo código** — se um dia migrar, é trocar connector + ajustar alguns tipos (JSONB, arrays). Sem breaking changes no ORM.
4. **RDS/Aurora** descartado pela sobrecarga de ops — configurar VPC peering Railway↔AWS, networking entre os dois, custos de transferência. Não compensa para o volume atual.
5. **Supabase** descartado pelo mesmo motivo do ADR 0001 (BaaS = lock-in + limita controle de schema).

## Consequências

**Positivas:**
- Migração da Lumina → Urban AI aconteceu com `mysqldump` + `mysql` direto. Zero conversão de tipos.
- Conexão interna Railway ↔ Railway pelo private network, <1ms.
- Backup automático (Pro tier) com 7 dias de retenção.

**Negativas:**
- **MySQL tem JSON mas o driver typeorm trata mal** — para campos ricos (como o futuro `User.consents` em F9.2), Postgres JSONB seria mais confortável.
- **Sem row-level security** — se algum dia precisar de multi-tenancy com isolamento de dados por tenant, MySQL exige filtro explícito em toda query. Postgres resolve com RLS.
- **Sem `GENERATED ALWAYS AS`** para colunas derivadas.
- **Risco de vendor lock-in leve no Railway** — escalar horizontalmente (read replicas) exige sair do plano atual.

## Quando revisitar

- Se começar a ter mais de 5 tabelas com colunas JSON grandes → avaliar port para Postgres.
- Se precisar de multi-tenancy com isolamento duro.
- Se o Railway parar de ter SLA aceitável para o DB (sem incidentes até hoje).

## Referências

- `docs/avaliacao-projeto-2026-04-16.md` §4 — avaliação de infra
- `docs/banco-antigo-analise.md` + `docs/banco-antigo-schemas.md` — contexto do DB legado
- Runbook: `docs/runbooks/migrations-cutover.md`
