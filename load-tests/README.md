# Load tests — k6

Scripts de carga para validar o Urban AI antes do go-live. **Rodar contra staging, nunca contra prod.**

## Pré-requisitos

- k6 instalado (https://k6.io/docs/get-started/installation/).
  - macOS: `brew install k6`
  - Windows (choco): `choco install k6`
  - Linux: `sudo apt install k6` ou binário de https://github.com/grafana/k6/releases
- Staging environment no ar (F5C.2 item #11 — seguir `docs/runbooks/staging-provisioning.md`).
- Usuários de teste pré-cadastrados em staging (ver seção "Dados semente").

## Alvos de performance

Definidos em `docs/slo.md`:

| Métrica | Alvo |
|---|---|
| p50 `/auth/*`, `/propriedades/*`, `/payments/*` | < 300ms |
| p95 | < 1s |
| p99 | < 3s |
| Error rate | < 1% |
| Disponibilidade sob 100 VUs sustentados | 99%+ |

## Cenários

### 1. `smoke.js` — 1 VU, 30s

Validação rápida de que o backend staging está respondendo. Rodar **antes** de qualquer carga maior.

```bash
k6 run --env BASE_URL=https://staging-api.myurbanai.com load-tests/smoke.js
```

Critério de aceitação: 0 erros, todos os endpoints respondendo < 2s.

### 2. `login-flow.js` — ramp-up até 50 VUs, 5 min

Simula 50 usuários simultâneos fazendo login e acessando dashboard. Testa caminho `/auth/login` + `/auth/profile` + `/propriedades`.

```bash
k6 run \
  --env BASE_URL=https://staging-api.myurbanai.com \
  --env TEST_EMAIL_PREFIX=loadtest+ \
  --env TEST_PASSWORD=senha-forte-de-teste-123 \
  load-tests/login-flow.js
```

### 3. `pricing-recommendation.js` — 100 VUs sustentados, 10 min

Cenário **crítico** do SLO: 100 anfitriões simultâneos pedindo recomendação de preço.

```bash
k6 run \
  --env BASE_URL=https://staging-api.myurbanai.com \
  --env TEST_EMAIL_PREFIX=loadtest+ \
  --env TEST_PASSWORD=senha-forte-de-teste-123 \
  load-tests/pricing-recommendation.js
```

## Dados semente (staging)

Antes do primeiro load test, criar 100 usuários de teste com o script:

```bash
# De dentro do staging, via Railway CLI:
railway run --service urban-ai-backend-staging npm run seed:loadtest
```

Script `seed:loadtest` a implementar em `urban-ai-backend-main/scripts/seed-loadtest.ts`:
- Cria 100 usuários `loadtest+0@urbanai.test` até `loadtest+99@urbanai.test`
- Senha padrão (passada por env).
- Cada um com 2 imóveis cadastrados em endereços de SP reais.

## Cleanup após teste

Os load tests geram linhas em `analise_preco`. Limpar após a rodada:

```sql
DELETE FROM analise_preco
 WHERE createdAt >= '<timestamp do início do teste>'
   AND user_id IN (SELECT id FROM user WHERE email LIKE 'loadtest+%');
```

## Relatório

k6 gera saída de texto com p50, p95, p99, error rate. Salvar em `load-tests/reports/YYYY-MM-DD-<cenario>.txt` para comparação histórica.

Meta: **baseline** registrado antes do go-live. Re-rodar trimestralmente e em marcos (pós-F6.4 integração Stays, pós-F6.5 repricing).

---

*Scripts criados em 24/04/2026 · F5C.4 item #7. Execução bloqueada em staging provisionado.*
