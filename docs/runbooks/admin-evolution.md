# Runbook — Painel Admin: o que existe, o que falta, plano de evolução

**Atualizado:** 24/04/2026 (final do dia)

> Pergunta direta do Gustavo: "esse painel admin realmente mostra 100% da gestão do sistema e todas as coisas que os gestores da Urban querem ver?"
>
> **Resposta honesta: não, está em ~60%.** O que existe hoje cobre o crítico operacional + IA + dataset + funil + Stays + qualidade — o suficiente para uma reunião quinzenal de gestão. Mas falta a camada financeira (MRR/ARR/churn), saúde técnica de pipeline (Prefect, Scrapyd), comunicação com cliente e analytics de aquisição (GA4/Pixel). Plano abaixo.

---

## 1. O que existe hoje (entregue na sessão de 24/04)

### Backend — 9 endpoints `/admin/*`

| Endpoint | Cobre |
|---|---|
| `GET /admin/overview` | KPIs principais — usuários, imóveis, eventos, análises, taxa aceite, assinaturas, tier IA, dataset |
| `GET /admin/pricing/status` | Estratégia ativa (rules/xgboost/adaptive), tier, razão da decisão |
| `GET /admin/dataset/metrics` | Snapshots por origem, top listings, dias cobertos |
| `GET /admin/events/analytics` | Total, ativos, % com coords, % enriquecidos, próximos 7/30/90d, mega-eventos, por categoria/cidade/relevância, top 10 |
| `GET /admin/stays/health` | Contas conectadas, listings, push status últimos 30d, recentes |
| `GET /admin/funnel` | Signup → analyses → aceito → aplicado → assinatura |
| `GET /admin/pricing/quality` | MAPE real (preço sugerido vs aplicado), RMSE, gate de qualidade |
| `GET /admin/occupancy/coverage` | Status, origem, listings distintos com histórico |
| `GET /admin/users` + `PATCH /role`, `PATCH /active` | Listagem paginada, mudança de role, ativação |

### Frontend — 6 páginas

- `/admin` — overview com KPIs + bloco IA + bloco dataset + nav cards
- `/admin/users` — gestão paginada
- `/admin/events` — analytics do motor de eventos
- `/admin/stays` — saúde da integração Stays
- `/admin/funnel` — funil de produto com taxa de aceite e aplicação
- `/admin/quality` — MAPE + cobertura de ocupação

### Acesso

Restrito por `User.role='admin'` via `RolesGuard`. Primeiro admin via SQL:
```sql
UPDATE user SET role='admin' WHERE email='gustavog.macedo16@gmail.com';
```

---

## 2. O que ainda falta (gaps reais)

### 2.1 Receita / Financeiro — alto impacto, ainda não temos

- ❌ **MRR / ARR** consolidado (hoje só temos `activeSubscriptions` cru)
- ❌ **Churn rate** mensal (taxa de cancelamento)
- ❌ **LTV / CAC** estimado por coorte
- ❌ **Receita projetada** (subscriptions ativas × preço médio × meses)
- ❌ **Distribuição de planos** (quantos starter / profissional / escala)
- ❌ **Reembolsos / disputas** Stripe
- ❌ **Trial → pago** taxa de conversão

**Plano:** `GET /admin/revenue/overview` agregando do Stripe + Payment table. ~4h dev.

### 2.2 Saúde técnica do pipeline — média urgência

- ❌ **Prefect Cloud flows status** (último run, sucesso/falha por flow)
- ❌ **Scrapyd jobs status** por spider (último crawl, qty items, erros)
- ❌ **Sentry inline** (alertas críticos das últimas 24h, top issues)
- ❌ **UptimeRobot status** (% uptime últimos 30d)
- ❌ **MySQL stats** (tamanho, queries lentas, conexões)
- ❌ **Redis stats** (filas, jobs travados)

**Plano:** `GET /admin/health/pipeline` (Prefect API), `GET /admin/health/scrapers` (Scrapyd API), `GET /admin/health/runtime` (env vars sanity check). Sentry e UptimeRobot ficam como links externos (não vale embedar). ~6h dev.

### 2.3 Marketing / Aquisição — baixa urgência (depende de tráfego pago start)

- ❌ **GA4 metrics** (sessions, conversions, source/medium)
- ❌ **Meta Pixel events** (PageView, Lead, Subscribe)
- ❌ **Waitlist signups** (Formspark/Formspree feed)
- ❌ **Top URLs de origem** (qual canal traz cliente)

**Plano:** após F5.3 ativar tráfego pago, pegar via GA4 Reporting API + Meta Marketing API. ~6h dev. Pode ficar como "link externo para GA4" enquanto volume é baixo.

### 2.4 Suporte / Comunicação — pendente

- ❌ **Tickets de suporte** — não temos sistema de ticketing ainda
- ❌ **NPS** — survey após 30 dias de uso
- ❌ **E-mails enviados** (volume + bounce rate Mailersend)
- ❌ **Notificações in-app** estatísticas

**Plano:** integrar com Crisp/Intercom (free tier) → painel agrega contagens. NPS via formulário próprio + agregado em `GET /admin/nps`. ~10h dev. Vale fazer só após go-live.

### 2.5 Análise por imóvel / drill-down — média urgência

- ❌ **Detalhe de um imóvel:** todas as análises geradas, preço aplicado, histórico de receita estimada
- ❌ **Comparação entre imóveis** do mesmo anfitrião
- ❌ **Top performers** (imóveis com maior taxa de aceite ou maior uplift)

**Plano:** `GET /admin/properties/:id/details` + page `/admin/properties/[id]`. ~8h dev. Útil para suporte conversar com anfitrião específico.

### 2.6 Auditoria / Compliance — média urgência (LGPD)

- ❌ **Solicitações LGPD recebidas** (acesso, exclusão, portabilidade) e prazo
- ❌ **Logins suspeitos** (failed login spikes do throttler)
- ❌ **Mudanças de role** (audit log)
- ❌ **Push de preço fora do guardrail** (rejected count + investigar)

**Plano:** entity nova `AuditLog` que captura mudanças sensíveis + UI `/admin/audit`. ~6h dev. Necessário antes de go-live com volume.

### 2.7 Operação contínua — pequenos buracos

- ❌ **Trigger manual de jobs** (forçar retreino do KNN, forçar pricingBootstrap, disparar sync Stays)
- ❌ **Limpeza de cache** (PricingStrategyFactory cache de 5min)
- ❌ **Backfill de features** (rodar `FeatureEngineeringService.runFullPipeline()` por demanda)

**Plano:** `POST /admin/jobs/trigger` com whitelist de jobs permitidos + UI botões `/admin/jobs`. ~4h dev. Ajuda muito no dia-a-dia operacional.

---

## 3. Prioridade sugerida

### Sprint 1 — Esta sprint pós-go-live (S15+)

1. **Receita / Financeiro** (2.1) — sócios pedem semanalmente; ROI direto
2. **Saúde técnica do pipeline** (2.2) — sem isso debugar incidente é vasculhar Sentry/Railway separados
3. **Auditoria / Compliance** (2.6) — exigência LGPD antes de qualquer ANPD vir

### Sprint 2

4. **Análise por imóvel** (2.5) — suporte precisa para conversar com anfitrião
5. **Operação contínua** (2.7) — produtividade do dev/op
6. **Suporte/Comunicação** (2.4) — só após primeiros tickets reais entrarem

### Sprint 3+

7. **Marketing / Aquisição** (2.3) — só faz sentido com tráfego pago ativo

---

## 4. Decisões importantes

### 4.1 Embed vs link externo

Para serviços com dashboards próprios (Sentry, UptimeRobot, GA4, Stripe), a recomendação é **link externo** com SSO se possível, não embedar. Razões:
- Mantemos um único painel (o nativo deles) que já é robusto
- Evita re-implementar features que já existem
- Reduz superfície de manutenção
- Acessos diferentes por colaborador (algumas pessoas só veem certos painéis)

O painel Urban AI fica responsável por:
- KPIs **de produto e negócio** (que Sentry não dá)
- KPIs **proprietários** (tier IA, dataset, MAPE, ocupação)
- Mutations administrativas (mudar role, ativar usuário, trigger jobs)

### 4.2 Dashboard executivo separado

À medida que o negócio crescer, vale pensar em:
- `/admin/exec` — visão de 1 página com 5–8 KPIs financeiros (sócios)
- `/admin/ops` — visão técnica completa (Gustavo + dev contractor)
- `/admin/support` — visão de atendimento (suporte futuro)

Roles `admin/support` que já existem suportam isso.

### 4.3 Frequência de refresh

Hoje tudo é fetch on-mount. Para painéis com KPIs caros (eventos, stays), valerá:
- Cache agregado em Redis (TTL 5min) para queries pesadas
- WebSocket / SSE para "ao vivo" só onde fizer sentido (push history, alertas)

Aceitável manter on-mount por enquanto — volume de admins é pequeno.

---

## 5. Métricas de sucesso do painel

Quando ele estiver "completo" o suficiente:

- ✅ Sócios conseguem responder em 30 segundos: "como estamos vs mês passado?"
- ✅ Suporte resolve dúvida de anfitrião sem precisar abrir SQL
- ✅ Time técnico identifica regressão de IA antes do anfitrião reclamar
- ✅ DPO atende solicitação LGPD em ≤ 15 dias rastreando aqui
- ✅ Operador consegue fazer retreino, sync, backfill sem terminal

Hoje passamos os 2 primeiros e o terceiro parcial. Os outros dois exigem os blocos 2.6 e 2.7.

---

*Próxima revisão: pós go-live (S15) com base em feedback real de uso.*
