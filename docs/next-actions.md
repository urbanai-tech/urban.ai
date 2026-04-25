# Próximas Ações — Operacionais (Gustavo)

**Atualizado:** 24/04/2026 · noite · pós roadmap v2.6

Lista priorizada do que **só você consegue fazer** — fora do meu alcance pelo IDE. Datas estimadas em "semanas" referem-se ao cronograma do `docs/roadmap-pos-sprint.md`.

---

## 🔴 Esta semana (S5 — 24–29/04)

### 1. Submeter KYC Stripe
- Reunir RG/CPF dos sócios majoritários + comprovante de residência
- Contrato social Urban AI (ato constitutivo)
- Conta PJ ativa para recebimento
- Submeter no Dashboard → Settings → Activate Live Mode
- **Bloqueia:** cobrança real em produção

### 2. Aprovar orçamento de marketing com Fabrício e Rogério
- R$ 4.340–8.170/mês (gestão + mídia + design + IA vídeo)
- Detalhes em `docs/roadmap-pos-sprint.md` § F5.4
- **Bloqueia:** F5.3 (tráfego pago) inteira

### 3. Validar Stays como o "representante Airbnb" e iniciar contato
- One-pager em `docs/outreach/stays-one-pager.md`
- Roteiro WhatsApp/LinkedIn em `docs/outreach/stays-contato-comercial.md`
- WhatsApp comercial: +55 21 96706-9723
- **Bloqueia:** F6.4 ativação + Tier 4 do dataset

### 4. Decidir caminho de expansão de time
- Contractor dev pleno TS/Node: R$ 12–20k/mês
- Sócio em vendas dedicado: redistribuição de tempo
- Agência de marketing terceirizada: dentro do orçamento de F5.4
- **Bloqueia:** velocidade de execução pós-S7

---

## 🟠 Esta semana ou próxima (S5–6) — destrava IA Tier 1+

### 5. Criar conta AirROI (~10 min)
- https://www.airroi.com → sign up grátis
- Acessar https://www.airroi.com/data-portal/markets/so-paulo-brazil
- Baixar CSV inicial pela UI (28k listings SP)
- Pegar API key em https://www.airroi.com/api → setar `AIRROI_API_KEY` no Railway
- **Destrava:** primeira fonte real de dataset

### 6. Criar projeto GCP + habilitar BigQuery (~30 min)
- https://console.cloud.google.com → criar projeto `urban-ai-dataset`
- Habilitar BigQuery API
- Query inicial:
  ```sql
  SELECT * FROM `basedosdados.mundo_inside_airbnb.listing`
  WHERE city = 'sao paulo' LIMIT 1000;
  ```
- Salvar service account JSON em Railway env var (`GCP_SERVICE_ACCOUNT_KEY`)
- **Destrava:** fonte 2 do dataset (espelho InsideAirbnb)

### 7. Solicitar SP no InsideAirbnb data request
- https://insideairbnb.com/data-requests/
- Formulário gratuito, lead time variável
- Não bloqueia nada — é "free hit" em paralelo

### 8. Provisionar staging Railway (3–4h)
- Runbook: `docs/runbooks/staging-provisioning.md`
- 7 serviços para criar (backend, front, KNN [skip — aposentado], pipeline, scraping, MySQL, Redis)
- DNS: `staging.myurbanai.com` + `staging-api.myurbanai.com` no Hostinger
- Smoke test do checklist
- **Destrava:** F5C.4 itens #6 (backup drill), #7 (load test), #8 (WCAG manual)

### 9. Criar 8 Stripe Price IDs F6.5
- Dashboard Stripe → Products → Prices
- Matriz: 2 planos × 4 ciclos = 8 Price IDs em modo teste (e mesma quantidade em live após KYC)
- Setar env vars no Railway:
  - `STARTER_PRICE_MONTHLY/QUARTERLY/SEMESTRAL/ANNUAL`
  - `PROFISSIONAL_PRICE_MONTHLY/QUARTERLY/SEMESTRAL/ANNUAL`
- **Destrava:** F6.5 efetivo em produção

### 10. Setar env vars novas no Railway
Lista completa do que está pendente (todas opcionais — sistema funciona sem; mas habilita features):

| Env var | Onde | Para quê |
|---|---|---|
| `JWT_SECRET` | backend | F5C.2 — fail-fast se ausente |
| `CORS_ALLOWED_ORIGINS` | backend | F5C.2 — whitelist explícita |
| `AIRROI_API_KEY` | backend | dataset externo |
| `GCP_SERVICE_ACCOUNT_KEY` | backend | dataset externo BigQuery |
| `PRICING_STRATEGY=adaptive` | backend | default novo (auto-tier) |
| `NEXT_PUBLIC_GA4_ID` | frontend | analytics |
| `NEXT_PUBLIC_META_PIXEL_ID` | frontend | analytics |
| `NEXT_PUBLIC_WAITLIST_ENDPOINT` | frontend | form pré-cadastro |
| `STAYS_API_BASE_URL` | backend | quando parceria fechar |
| Stripe Price IDs (8) | backend | F6.5 |

---

## 🟡 Próximas 2-3 semanas (S6–7) — Tier 1 da IA

### 11. Completar os 3 stubs de Feature Engineering
Service: `src/knn-engine/feature-engineering.service.ts`. Cada um tem TODO claro:
- `geocodePending()` — Google Geocoding API
- `computeMetroDistancePending()` — haversine às 76 estações SP
- `estimateAmenitiesPending()` — Gemini API sobre `list.titulo`

Esforço estimado: ~16h dev. Pode ser sua se tiver tempo, ou contractor (item 4).

### 12. Migration adicionando colunas de feature
```sql
ALTER TABLE address ADD COLUMN metro_distance_km DECIMAL(8,3);
ALTER TABLE list ADD COLUMN amenities_count INT;
ALTER TABLE list ADD COLUMN category TINYINT;
```
Seguir `docs/runbooks/migrations-cutover.md` — staging primeiro.

### 13. Backfill features para imóveis existentes
Script `scripts/backfill-features.ts` que percorre todos os imóveis e enriquece. ~4h dev. Custo Google: < US$ 60 (free credit cobre).

---

## 🟢 Em paralelo, sem urgência (S6+)

### 14. Disparar 6 DPAs prioritários
Stripe, Mailersend, AWS, Railway, Upstash, Sentry. Procedimento em `docs/lgpd/dpa-checklist.md`. Cada um leva 5–30 min.

### 15. Configurar UptimeRobot
Health check pingando `https://app.myurbanai.com/health` a cada 1 min. **Antes**: criar endpoint `/health` no backend (não existe ainda). Esforço: ~1h dev + 10 min config.

### 16. Recrutar 20–30 voluntários Superhost SP
Comunidade Facebook + grupos de Telegram + Airbnb Community. Modelo: 3 meses grátis em troca de histórico + caso de ROI. Vai virar pré-condição da F7 beta.

### 17. Criar form Formspark/Formspree para waitlist
30s no Formspark.io → setar `NEXT_PUBLIC_WAITLIST_ENDPOINT` no Railway. Mais simples que criar endpoint próprio.

### 18. Property GA4 e Pixel Meta
- GA4: https://analytics.google.com → Admin → Property → Create
- Pixel Meta: https://business.facebook.com → Events Manager → Create Pixel
- Setar IDs no Railway

---

## ✅ O que JÁ ESTÁ AUTOMÁTICO (não precisa fazer nada)

- Cron diário 03:30 BRT começa a popular `PriceSnapshot` no próximo deploy (assim que tiver o código mergeado em prod, o que acontece automaticamente via Railway watch).
- `recordCompsFromAnalysis` é disparado a cada análise — milhares de pontos de dataset entrando todo dia que o cron de análise rodar.
- `AdaptivePricingStrategy` ativa por default — comportamento atual é idêntico (cai em rules), mas migra automaticamente quando dataset crescer.
- 84 testes verdes no backend rodando em CI a cada push.

---

## Cronograma resumido até o moat (Tier 4)

```
Hoje (S5)        ─────  ▶  Ações 1–4 (KYC, marketing, Stays, time)
S6 (29/04–05/05) ─────  ▶  Ações 5–10 (datasets externos, staging, env vars)
S7 (06–12/05)    ─────  ▶  Tier 1 IA (feature engineering completo)
S8–9             ─────  ▶  XGBoost shadow mode em prod
S10–11           ─────  ▶  XGBoost vira Tier 2 (auto via AdaptiveStrategy)
S12              ─────  ▶  Beta fechado + 3 cases ROI
S15–17           ─────  ▶  Go-live oficial
S18–22           ─────  ▶  Crescimento orgânico do dataset
~S22+            ─────  ▶  Tier 3 — XGBoost validado MAPE ≤15%
~12–18 meses     ─────  ▶  Dataset bate 10k×12m, Tier 4 (modelo híbrido) entra
                            como `HybridNeuralPricingStrategy` carregada,
                            AdaptiveStrategy detecta automaticamente.
```

---

*Documento vivo. Atualizar a cada decisão tomada ou tarefa concluída.*
