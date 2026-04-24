# Urban AI — SLO e SLA

**Versão:** 1.0 · **Data:** 24/04/2026 · **Aplicabilidade:** a partir do go-live oficial (S15–16, mid-Jul/2026)

Este documento define os compromissos operacionais do Urban AI com os anfitriões que pagam pelo serviço. SLO (Service Level Objective) é a meta interna que o time persegue; SLA (Service Level Agreement) é o compromisso externo publicado na página pública.

**SLA precede SLO em no mínimo 2–3 pontos percentuais** — margem para o time reagir sem quebrar o compromisso com o cliente.

---

## 1. Metas iniciais (Go-Live S15–16)

### 1.1 Disponibilidade da API e do dashboard

- **SLO interno:** **99.7%** uptime mensal
- **SLA publicado:** **99.5%** uptime mensal

99.5% = até **3h39 de downtime por mês** permitido. 99.7% = **2h11**.

Medido por: UptimeRobot pingando `https://app.myurbanai.com/health` (backend) + home page (frontend) a cada 1 min. Downtime = resposta com 5xx ou timeout por ≥ 2 pings consecutivos.

**Escopo**: app.myurbanai.com, urbanai.com.br, API do backend. **Fora do escopo** (intencionalmente): pipeline Prefect, Scrapyd, crons noturnos — são batch jobs, não user-facing.

### 1.2 Latência

- **SLO p50:** < 300ms em endpoints `/propriedades/*`, `/auth/*`, `/payments/*`
- **SLO p95:** < 1s
- **SLO p99:** < 3s

Endpoints que envolvem scraping ou chamadas externas (Airbnb, Stripe) ficam fora desses limites enquanto a dependência externa dominar o tempo. Medido via Sentry Performance.

### 1.3 Recuperação (RTO/RPO)

- **RTO** (Recovery Time Objective): **2h** para restaurar serviço após incidente maior (DB corrupto, deploy quebrado, provider down)
- **RPO** (Recovery Point Objective): **24h** de perda de dados máxima

RPO 24h alinha com o snapshot automático diário do MySQL no Railway (plano Pro, retenção de 7 dias). Para reduzir, precisamos de point-in-time recovery — fora de escopo até 10k usuários.

### 1.4 Webhook do Stripe

- **SLO**: webhook processado em ≤ 30s após recebido (p95)
- Se não processar em 5 minutos, alertar (F9.3)

### 1.5 E-mail transacional (Mailersend)

- **SLO**: 95% dos e-mails entregues em ≤ 2min após trigger
- **SLO**: taxa de bounce permanente < 2%
- Reset de senha, confirmação e notificação diária são os fluxos críticos

### 1.6 Pipeline de scraping

- **SLO**: flow `raw_data_extraction_and_dump` completa com sucesso em 6 de 7 dias por semana
- Se falhar 2 dias seguidos, alertar

---

## 2. Janela de manutenção

Até S15, não há janela formal — deploys acontecem em prod a qualquer hora sob risco de downtime momentâneo.

A partir de S15, proposta:

- **Janela preferencial:** terça-feira 03:00–05:00 BRT (menor tráfego observado no Airbnb SP)
- Deploys com migration destrutiva só nesta janela.
- Mudanças compatíveis com rollback imediato (features atrás de flag, migrations aditivas) podem acontecer em qualquer horário com zero-downtime via Railway rolling deploy.

---

## 3. Error budget

Com SLO de 99.7%, o error budget é **2h11/mês**. Política:

- **Se error budget > 50% consumido no mês corrente:** todo deploy exige revisão por pares.
- **Se error budget > 80% consumido:** só deploys de correção de bugs. Features novas ficam bloqueadas até o budget resetar.
- **Se error budget esgotado:** incidente formal, postmortem obrigatório, plano de ação em `docs/postmortems/`.

Isso **não** é regra dura no dia 1 — é aspiracional para quando o time crescer e o volume justificar. Por enquanto, Gustavo acompanha no dashboard do UptimeRobot semanalmente.

---

## 4. Medição e dashboard

### Fontes de verdade

| Métrica | Fonte | Agregação |
|---|---|---|
| Uptime | UptimeRobot | ping-to-ping |
| Latência p50/p95/p99 | Sentry Performance | 24h rolling |
| Erros 5xx | Sentry Issues | contagem por hora |
| Webhook Stripe tempo | Log customizado no Sentry | p95 últimos 7d |
| E-mail entrega | Painel Mailersend | diário |
| Pipeline Prefect | Painel Prefect Cloud | por run |

### Dashboard consolidado

Localização planejada: **Grafana hospedado no Railway** (F9.3) ou **PostHog free tier** para métricas de produto.

Até existir, o status semanal é compilado manualmente pelo Gustavo a partir das 4 fontes acima e anexado ao relatório quinzenal ao cliente (ver `docs/roadmap-pos-sprint.md` § "Estrutura de Relatórios ao Cliente").

---

## 5. SLA público (a publicar em /termos quando o go-live chegar)

Texto resumido para site público:

```
Urban AI compromete-se a manter o Serviço disponível 99.5% do tempo,
medido mensalmente, excluindo:
(a) janela de manutenção programada (terça 03:00–05:00 BRT);
(b) eventos de força maior (outages do Railway, Stripe, Google, AWS,
    Mailersend, Upstash, Sentry ou backbone de internet);
(c) manutenções emergenciais motivadas por falha crítica de segurança.

Se a disponibilidade ficar abaixo de 99.5% em dois meses consecutivos,
o anfitrião terá direito a 10% de crédito no mês seguinte ou,
alternativamente, cancelamento sem multa proporcional.

Reclamações de SLA devem ser enviadas para suporte@myurbanai.com em até
30 dias após o mês-calendário em questão.
```

**Status:** rascunho. Revisar com assessoria jurídica antes do go-live.

---

## 6. Status report interno

Formato semanal, enviado todas as segundas 09:00 BRT (a automatizar):

```
Urban AI — Status semanal <YYYY-MM-DD>
-------------------------------------
Uptime da semana:     <99.8%> (SLO 99.7%)  ✅ / ⚠️ / 🔴
Incidentes:           <N>   total
 - <breve descrição cada um, com link para postmortem>
Latência p95 (7d):    <250ms> (SLO <1s) ✅
Erros 5xx:            <NN> (semana anterior: NN)
Webhook Stripe p95:   <Xs> (SLO <30s) ✅
Pipeline Prefect:     <6/7 dias> ✅
E-mail bounces:       <0.8%> (SLO <2%) ✅

Next week focus: <...>
```

---

## 7. Postmortem

Todo incidente que cause downtime > 15 min ou perda de dados > 0 exige postmortem em `docs/postmortems/<YYYY-MM-DD>-titulo-curto.md` com formato:

- Linha do tempo (quando começou, quando detectamos, quando resolveu)
- Root cause
- Impacto (quantos usuários, qual gravidade)
- O que fizemos certo
- O que fizemos errado
- Action items (com donos e prazos)

Template: `docs/postmortems/_template.md` (a criar junto com o primeiro incidente).

---

## 8. Revisão

Revisar este documento trimestralmente. Próxima revisão: **24/07/2026** (em paralelo com a LGPD).

Ajustes esperados:
- Após S15, subir o SLO gradualmente se os números reais permitirem (99.7% → 99.8% → 99.9%).
- Com time maior, formalizar janela de manutenção e error budget policy.
- Com volume > 100k req/dia, reduzir RPO.

---

## Changelog

| Versão | Data | Autor | Mudança |
|---|---|---|---|
| 1.0 | 24/04/2026 | Gustavo + Claude | Criação inicial — resposta à F5C.4 item #5 |

---

*Urban AI © 2026 · Operação interna*
